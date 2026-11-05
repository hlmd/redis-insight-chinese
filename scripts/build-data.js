#!/usr/bin/env node
/*
 * build-data.js —— 生成「编译单文件二进制」前需要的可嵌入快照 generated/embedded.json。
 *
 * 快照内容 = { 相对路径: 文件文本 },包含两个钩子源码(src/hooks/ri-chinese.js / src/hooks/ri-main-cn.cjs)
 * 与两份词典(locales/zh-CN/renderer.json / locales/main/zh-CN.json)。
 * bun --compile 会把它静态打进二进制;二进制运行时身边没有这些源文件,靠它取数据。
 *
 * 平时 `node redis-insight-chinese.js` 不需要它——源码模式直接读仓库里的文件。
 * scripts/build-bin.js 在 `bun build` 前会自动调用本模块,避免漏跑。
 *
 * 用法: node scripts/build-data.js
 */
import { readFileSync, writeFileSync, statSync, mkdirSync } from "fs";
import { execFileSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { EMBEDDED_FILES } from "../src/resources.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const EMBEDDED_PATH = join(ROOT, "generated", "embedded.json");

// 最近一次提交的 commit 与时间:用于和在线数据包比新旧(不在 git 仓库里时退回当前时间)
function gitMeta() {
  const git = (args) => {
    try { return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; }
  };
  return { commit: git(["rev-parse", "HEAD"]) || null, committedAt: git(["log", "-1", "--format=%cI"]) || new Date().toISOString() };
}

export function buildData() {
  const out = {};
  for (const rel of EMBEDDED_FILES) {
    const text = readFileSync(join(ROOT, rel), "utf8");
    if (rel.endsWith(".json")) JSON.parse(text); // 先校验,坏 JSON 不进快照
    out[rel] = text;
  }
  out._meta = gitMeta();
  mkdirSync(dirname(EMBEDDED_PATH), { recursive: true });
  writeFileSync(EMBEDDED_PATH, JSON.stringify(out));
  console.log(`[完成] ${EMBEDDED_FILES.length} 个文件 -> generated/embedded.json (${(statSync(EMBEDDED_PATH).size / 1024).toFixed(0)} KB)`);
  return EMBEDDED_PATH;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  buildData();
}
