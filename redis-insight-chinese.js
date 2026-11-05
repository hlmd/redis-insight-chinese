#!/usr/bin/env node
// redis-insight-chinese.js
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, realpathSync } from "fs";
import { fileURLToPath } from "url";
import { tmpdir } from "os";
import { join } from "path";
import { locateAsar } from "./src/locate.js";
import { ensureBackup, restore as restoreBackup } from "./src/backup.js";
import { extractAsar, packAsar, deriveUnpackDir, unpackedSet } from "./src/asar.js";
import { injectInto, withCaseVariants, RENDERER_FILE } from "./src/inject.js";
import { injectMenu, MAIN_HOOK_FILE } from "./src/menu.js";
import {
  readResource, readJsonResource, hasResource, RENDERER_HOOK, MAIN_HOOK, MD_SEGMENTS,
  REQUIRED_FILES, embeddedMeta, hasLocalData, setRemoteData,
} from "./src/resources.js";
import { LANGUAGES, resolveLang, localeFile } from "./src/i18n.js";
import { resolveDataBundle, selfUpdate, cleanupOldBinary } from "./src/updater.js";
import pkg from "./package.json" with { type: "json" };
import { extractCandidates } from "./src/extract-strings.js";

// 不带值的开关
const FLAGS = { "--dry-run": "dryRun", "--offline": "offline", "--no-self-update": "noSelfUpdate", "--no-app-update": "noAppUpdate" };

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
  const bundle = await resolveDataBundle({ embeddedAt: meta && meta.committedAt, offline: opts.offline, required: REQUIRED_FILES });
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

// 可选词典:缺了返回 fallback(source 记为「(无)」)
async function optionalJson(rel, fallback) {
  try { return await readJsonResource(rel); } catch { return { data: fallback, source: "(无)" }; }
}

async function cmdApply(opts) {
  const { lang, from } = resolveLang(opts.lang);
  const langInfo = LANGUAGES[lang];
  console.log(`[语言] ${langInfo.name}(${lang}),来自 ${from}${opts.lang ? "" : ",可用 --lang 指定"}`);
  if (!opts.dict && !(await hasResource(localeFile(lang, "renderer")))) {
    throw new Error(`${langInfo.name}(${lang})暂无译文。运行 langs 查看各语言的完成情况`);
  }
  const asarPath = locateAsar(opts.install);
  const { bakAsar } = ensureBackup(asarPath);
  const unpackDir = deriveUnpackDir(bakAsar);
  const tmp = mkdtempSync(join(tmpdir(), "ri-chinese-"));
  try {
    extractAsar(bakAsar, tmp);
    // 渲染进程:DOM 注入,只替换元素文字/属性,不改代码
    const rendererDict = opts.dict
      ? { data: JSON.parse(readFileSync(opts.dict, "utf8")), source: opts.dict }
      : await readJsonResource(localeFile(lang, "renderer"));
    const rendererHook = await readResource(RENDERER_HOOK);
    // 拼接句短词的上下文规则(量词、「刚刚」等);没有就保留那些英文短词
    const fragments = await optionalJson(localeFile(lang, "fragments"), null);
    // 教程:目录树文字并入 DOM 词典(页面词典优先),正文段落交给钩子在加载 .md 时替换
    const tutorials = await optionalJson(localeFile(lang, "tutorials"), { manifest: {}, markdown: {} });
    // 远端静态内容(数据库分析的建议 Tips、创建数据库入口、指南链接):整段 DOM 匹配
    const content = await optionalJson(localeFile(lang, "content"), { dom: {} });
    // 命令助手的命令简介 / 复杂度说明(远端 commands.json)
    const commands = await optionalJson(localeFile(lang, "commands"), { dom: {} });
    const domDict = { ...(commands.data.dom || {}), ...(content.data.dom || {}), ...withCaseVariants(tutorials.data.manifest), ...rendererDict.data };
    const mdSrc = (await readResource(MD_SEGMENTS)).text;
    const stats = injectInto(tmp, domDict, rendererHook.text, { tutorials: tutorials.data, mdSrc, fragments: fragments.data, lang });
    // 主进程:原生菜单 / 对话框
    const mainDict = await optionalJson(localeFile(lang, "main"), {});
    const mainHook = await readResource(MAIN_HOOK);
    const menu = injectMenu(tmp, mainDict.data, mainHook.text, { noAppUpdate: opts.noAppUpdate });
    const report =
      (opts.dryRun ? `=== 本地化报告 · ${langInfo.name}（DRY-RUN 试运行，未写入）===\n` : `=== 本地化报告 · ${langInfo.name}（注入式）===\n`) +
      `[渲染进程] ${rendererDict.source}: ${Object.keys(rendererDict.data).length} 条,可用 ${stats.entries} 条\n` +
      `[教程]     ${tutorials.source}: 目录 ${Object.keys(tutorials.data.manifest || {}).length} 条,正文段落 ${stats.tutorials} 条\n` +
      `[静态内容] ${content.source}: ${Object.keys(content.data.dom || {}).length} 条(建议 Tips、创建数据库入口等)\n` +
      `[命令定义] ${commands.source}: ${Object.keys(commands.data.dom || {}).length} 条(命令助手的简介 / 复杂度)\n` +
      `           dist/renderer/${RENDERER_FILE}, index.html <script> ${stats.tagAdded ? "已添加" : "已存在(跳过)"}\n` +
      (menu.skipped
        ? "[主进程]   未找到主进程入口(跳过)"
        : `[主进程]   ${mainDict.source}: ${menu.entries} 条,dist/main/${MAIN_HOOK_FILE} ${menu.mainPatched ? "已接入入口" : "入口已接入(跳过)"}`) +
      `\n[应用更新] ${opts.noAppUpdate ? "已关闭 Redis Insight 自动更新(不加 --no-app-update 重新 apply 或 restore 即恢复)" : "保持 Redis Insight 自动更新(升级后需重新 apply;加 --no-app-update 可关闭)"}`;
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

// 列出支持的语言与各自的词条数(以简体中文为基准算覆盖率)
async function cmdLangs(opts) {
  const count = (d) => (d ? Object.keys(d).length : 0);
  const stat = async (lang) => {
    const r = await optionalJson(localeFile(lang, "renderer"), null);
    const t = await optionalJson(localeFile(lang, "tutorials"), null);
    const c = await optionalJson(localeFile(lang, "commands"), null);
    return { ui: count(r.data), tut: count(t.data && t.data.markdown), cmd: count(c.data && c.data.dom) };
  };
  const base = await stat("zh-CN");
  const pct = (a, b) => (b ? `${Math.min(100, Math.round((a / b) * 100))}%` : "-");
  const { lang: cur, from } = resolveLang(opts.lang);
  console.log(`当前将使用:${LANGUAGES[cur].name}(${cur}),来自 ${from}\n`);
  console.log("代码     语言                  界面   教程   命令助手");
  // 按终端显示宽度补空格(中日韩字符占两格)
  const width = (t) => [...t].reduce((w, ch) => w + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿＀-｠]/.test(ch) ? 2 : 1), 0);
  const padW = (t, n) => t + " ".repeat(Math.max(0, n - width(t)));
  for (const [code, info] of Object.entries(LANGUAGES)) {
    const s = await stat(code);
    const mark = code === cur ? "*" : " ";
    console.log(`${mark}${code.padEnd(7)} ${padW(info.name, 20)} ${pct(s.ui, base.ui).padStart(5)}  ${pct(s.tut, base.tut).padStart(5)}  ${pct(s.cmd, base.cmd).padStart(7)}`);
  }
  console.log("\n用 --lang <代码> 指定语言,如:redis-insight-chinese --lang zh-TW");
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
      case "langs":
        await prepareRemoteData(opts);
        return await cmdLangs(opts);
      case "extract": return cmdExtract(opts);
      case "restore": return cmdRestore(opts);
      case "verify": return cmdVerify(opts);
      default:
        console.error(`未知命令: ${cmd}。可用: apply | langs | extract | restore | verify | version(选项:--lang <代码> 指定语言、--offline 不联网、--no-self-update 不自更新、--no-app-update 关闭 Redis Insight 自动更新、--dry-run 试运行)`);
        return 2;
    }
  } catch (e) {
    console.error("错误:", e.message);
    return 1;
  }
}

// 是否被直接执行(而不是被测试 import)。bun 与 Node ≥24.2 有 import.meta.main;
// 更早的 Node 比较真实路径——npm 的 bin 是指向本文件的符号链接 / 包装脚本,argv[1] 未必就是本文件。
function isMain() {
  if (typeof import.meta.main === "boolean") return import.meta.main;
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  run(process.argv.slice(2)).then((code) => process.exit(code));
}
