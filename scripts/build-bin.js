#!/usr/bin/env node
/*
 * build-bin.js —— 用 bun --compile 编译单文件二进制。
 * 编译前先调用 build-data.js 生成 generated/embedded.json,确保钩子与词典被嵌入。
 *
 * 用法: node scripts/build-bin.js <target> <outfile>
 *   例: node scripts/build-bin.js bun-windows-x64 dist/redis-insight-chinese-win-x64.exe
 *
 * 已知问题:在 Windows 主机上交叉编译非 Windows 目标时,bun 下载运行时可能不完整
 * (oven-sh/bun#25346),可在对应平台或 WSL 上编译。
 */
import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildData } from "./build-data.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [target, outfile] = process.argv.slice(2);
if (!target || !outfile) {
  console.error("用法: node scripts/build-bin.js <target> <outfile>");
  process.exit(1);
}

buildData();
const r = spawnSync(
  "bun",
  ["build", "--compile", `--target=${target}`, join(ROOT, "redis-insight-chinese.js"), "--outfile", join(ROOT, outfile)],
  { stdio: "inherit", shell: process.platform === "win32" }
);
process.exit(r.status ?? 1);
