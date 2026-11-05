// redis-insight-chinese.js
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { locateAsar } from "./src/locate.js";
import { ensureBackup, restore as restoreBackup } from "./src/backup.js";
import { extractAsar, packAsar, deriveUnpackDir, unpackedSet } from "./src/asar.js";
import { injectInto, injectAssets, withCaseVariants, RENDERER_FILE } from "./src/inject.js";
import { injectMenu, MAIN_HOOK_FILE } from "./src/menu.js";
import {
  readResource, readJsonResource, RENDERER_HOOK, MAIN_HOOK, RENDERER_LOCALE, MAIN_LOCALE,
  MD_SEGMENTS, TUTORIALS_LOCALE, CONTENT_LOCALE, COMMANDS_LOCALE,
  EMBEDDED_FILES, embeddedMeta, hasLocalData, setRemoteData, ASSETS_MANIFEST, ASSET_FILES,
} from "./src/resources.js";
import { resolveDataBundle, selfUpdate, cleanupOldBinary } from "./src/updater.js";
import pkg from "./package.json" with { type: "json" };
import { extractCandidates } from "./src/extract-strings.js";

// 不带值的开关
const FLAGS = { "--dry-run": "dryRun", "--offline": "offline", "--no-self-update": "noSelfUpdate" };

function parseArgs(argv) {
  // 第一个参数是命令;直接以开关开头(如双击后只带 --offline)时视为 apply
  const hasCmd = argv[0] && !argv[0].startsWith("--");
  const cmd = hasCmd ? argv[0] : undefined;
  const opts = {};
  for (let i = hasCmd ? 1 : 0; i < argv.length; i++) {
    const a = argv[i];
    if (FLAGS[a]) opts[FLAGS[a]] = true;
    else if (a.startsWith("--")) opts[a.slice(2)] = argv[++i];
  }
  return { cmd, opts };
}

function toolVersion() {
  return pkg.version;
}

// 注入前取最新译文:身边有本地词典(源码模式 / exe 旁覆盖)时以本地为准,不联网
async function prepareRemoteData(opts) {
  if (hasLocalData() || opts.dict) return;
  const meta = await embeddedMeta();
  const bundle = await resolveDataBundle({ embeddedAt: meta && meta.committedAt, offline: opts.offline, required: EMBEDDED_FILES });
  if (bundle) {
    setRemoteData(bundle);
    console.log(`[更新] 使用在线译文(来源 ${bundle.from},提交于 ${bundle.committedAt})`);
  }
}

function setsEqual(a, b) {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
}

async function cmdApply(opts) {
  const asarPath = locateAsar(opts.install);
  const { bakAsar } = ensureBackup(asarPath);
  const unpackDir = deriveUnpackDir(bakAsar);
  const tmp = mkdtempSync(join(tmpdir(), "ri-chinese-"));
  try {
    extractAsar(bakAsar, tmp);
    // 渲染进程:DOM 注入,只替换元素文字/属性,不改代码
    const rendererDict = opts.dict
      ? { data: JSON.parse(readFileSync(opts.dict, "utf8")), source: opts.dict }
      : await readJsonResource(RENDERER_LOCALE);
    const rendererHook = await readResource(RENDERER_HOOK);
    // 教程:目录树文字并入 DOM 词典(页面词典优先),正文段落交给钩子在加载 .md 时替换
    let tutorials = { data: { manifest: {}, markdown: {} }, source: "(无)" };
    try { tutorials = await readJsonResource(TUTORIALS_LOCALE); } catch { /* 没有教程词典就只做界面 */ }
    // 远端静态内容(数据库分析的建议 Tips、创建数据库入口、指南链接):整段 DOM 匹配
    let content = { data: { dom: {} }, source: "(无)" };
    try { content = await readJsonResource(CONTENT_LOCALE); } catch { /* 可选 */ }
    // 命令助手的命令简介 / 复杂度说明(远端 commands.json)
    let commands = { data: { dom: {} }, source: "(无)" };
    try { commands = await readJsonResource(COMMANDS_LOCALE); } catch { /* 可选 */ }
    const domDict = { ...(commands.data.dom || {}), ...(content.data.dom || {}), ...withCaseVariants(tutorials.data.manifest), ...rendererDict.data };
    const mdSrc = (await readResource(MD_SEGMENTS)).text;
    const stats = injectInto(tmp, domDict, rendererHook.text, { tutorials: tutorials.data, mdSrc });
    // 带英文字的插图换成汉化版(原图哈希一致才换)
    let assets = { replaced: [], skipped: [] };
    try {
      const manifest = (await readJsonResource(ASSETS_MANIFEST)).data;
      const files = {};
      for (const rel of ASSET_FILES) { try { files[rel.split("/").pop()] = (await readResource(rel)).text; } catch { /* 缺图就跳过 */ } }
      assets = injectAssets(tmp, manifest, files);
    } catch { /* 没有插图数据就只做文字 */ }
    // 主进程:原生菜单 / 对话框
    const mainDict = await readJsonResource(MAIN_LOCALE);
    const mainHook = await readResource(MAIN_HOOK);
    const menu = injectMenu(tmp, mainDict.data, mainHook.text);
    const report =
      (opts.dryRun ? "=== 汉化报告（DRY-RUN 试运行，未写入）===\n" : "=== 汉化报告（注入式）===\n") +
      `[渲染进程] ${rendererDict.source}: ${Object.keys(rendererDict.data).length} 条,可用 ${stats.entries} 条\n` +
      `[教程]     ${tutorials.source}: 目录 ${Object.keys(tutorials.data.manifest || {}).length} 条,正文段落 ${stats.tutorials} 条\n` +
      `[静态内容] ${content.source}: ${Object.keys(content.data.dom || {}).length} 条(建议 Tips、创建数据库入口等)\n` +
      `[命令定义] ${commands.source}: ${Object.keys(commands.data.dom || {}).length} 条(命令助手的简介 / 复杂度)\n` +
      `[插图]     替换 ${assets.replaced.length} 张${assets.skipped.length ? `,跳过 ${assets.skipped.join("、")}` : ""}\n` +
      `           dist/renderer/${RENDERER_FILE}, index.html <script> ${stats.tagAdded ? "已添加" : "已存在(跳过)"}\n` +
      (menu.skipped
        ? "[主进程]   未找到主进程入口(跳过)"
        : `[主进程]   ${mainDict.source}: ${menu.entries} 条,dist/main/${MAIN_HOOK_FILE} ${menu.mainPatched ? "已接入入口" : "入口已接入(跳过)"}`);
    if (opts.dryRun) {
      console.log(report);
      return 0;
    }
    const outAsar = opts.out || asarPath;
    await packAsar(tmp, outAsar, unpackDir);
    if (!setsEqual(unpackedSet(outAsar), unpackedSet(bakAsar))) {
      if (outAsar === asarPath) restoreBackup(asarPath);
      console.error("错误: 重打包后 unpacked 集合与原始不一致，已回滚。");
      return 1;
    }
    console.log(report);
    console.log(`\n已写入: ${outAsar}`);
    return 0;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function cmdExtract(opts) {
  const asarPath = locateAsar(opts.install);
  const tmp = mkdtempSync(join(tmpdir(), "ri-chinese-ext-"));
  try {
    extractAsar(asarPath, tmp);
    const minLen = opts["min-len"] ? parseInt(opts["min-len"], 10) : 3;
    const cand = extractCandidates(tmp, minLen);
    const outPath = opts.out || "translations.todo.json";
    writeFileSync(outPath, JSON.stringify(cand, null, 2));
    console.log(`提取候选串 ${Object.keys(cand).length} 条 → ${outPath}`);
    return 0;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function cmdRestore(opts) {
  const asarPath = locateAsar(opts.install);
  restoreBackup(asarPath);
  console.log(`已从备份还原: ${asarPath}`);
  return 0;
}

function cmdVerify(opts) {
  const asarPath = locateAsar(opts.install);
  const set = unpackedSet(asarPath);
  console.log(`asar: ${asarPath}`);
  console.log(`unpacked 文件数: ${set.length}`);
  console.log(`备份存在: ${existsSync(asarPath + ".bak")}`);
  return 0;
}

export async function run(argv) {
  const { cmd, opts } = parseArgs(argv);
  try {
    cleanupOldBinary();
    switch (cmd || "apply") {
      case "apply": {
        // 先自更新(仅单文件二进制):新版本可能带来新的注入逻辑,更新成功就交给新版本跑完
        if (!opts.offline && !opts.noSelfUpdate && !opts.dryRun) {
          const code = await selfUpdate({ currentVersion: toolVersion(), argv });
          if (code !== null) return code;
        }
        await prepareRemoteData(opts);
        return await cmdApply(opts);
      }
      case "version":
        console.log(`redis-insight-chinese v${toolVersion()}`);
        return 0;
      case "extract": return cmdExtract(opts);
      case "restore": return cmdRestore(opts);
      case "verify": return cmdVerify(opts);
      default:
        console.error(`未知命令: ${cmd}。可用: apply | extract | restore | verify | version(开关:--offline 不联网、--no-self-update 不自更新、--dry-run 试运行)`);
        return 2;
    }
  } catch (e) {
    console.error("错误:", e.message);
    return 1;
  }
}

// 直接执行时运行（bun/node 均适用）
if (import.meta.main || (import.meta.url && process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/")))) {
  run(process.argv.slice(2)).then((code) => process.exit(code));
}
