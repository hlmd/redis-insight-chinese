// hanhua.js
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { locateAsar } from "./src/locate.js";
import { ensureBackup, restore as restoreBackup } from "./src/backup.js";
import { extractAsar, packAsar, deriveUnpackDir, unpackedSet } from "./src/asar.js";
import { injectInto } from "./src/inject.js";
import { extractCandidates } from "./src/extract-strings.js";

function parseArgs(argv) {
  const cmd = argv[0];
  const opts = {};
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a.startsWith("--")) opts[a.slice(2)] = argv[++i];
  }
  return { cmd, opts };
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
  const tmp = mkdtempSync(join(tmpdir(), "hanhua-"));
  try {
    extractAsar(bakAsar, tmp);
    const dictPath = opts.dict || "translations.json";
    const dict = JSON.parse(readFileSync(dictPath, "utf8"));
    // 运行时注入式汉化：只在 DOM 上替换元素文字/属性，不改代码。
    const stats = injectInto(tmp, dict);
    const report =
      (opts.dryRun ? "=== 汉化报告（DRY-RUN 试运行，未写入）===\n" : "=== 汉化报告（注入式）===\n") +
      `字典条目: ${Object.keys(dict).length}\n` +
      `可用中文条目(内嵌注入脚本): ${stats.entries}\n` +
      `注入脚本: dist/renderer/zh-inject.js\n` +
      `index.html 注入 <script>: ${stats.tagAdded ? "已添加" : "已存在(跳过)"}`;
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
  const tmp = mkdtempSync(join(tmpdir(), "hanhua-ext-"));
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
    switch (cmd || "apply") {
      case "apply": return await cmdApply(opts);
      case "extract": return cmdExtract(opts);
      case "restore": return cmdRestore(opts);
      case "verify": return cmdVerify(opts);
      default:
        console.error(`未知命令: ${cmd}。可用: apply | extract | restore | verify`);
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
