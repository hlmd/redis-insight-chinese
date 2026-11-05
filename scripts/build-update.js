#!/usr/bin/env node
/*
 * build-update.js —— 生成在线热更新数据包 dist/update/ri-update.json.gz
 *   = generated/embedded.json 的全部文件(词典 + 钩子源码)+ 提交时间,
 *   由 .github/workflows/update-data.yml 推到 update-data 分支,注入程序运行时拉取(见 src/updater.js)。
 *
 * 用法: node scripts/build-update.js
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { gzipSync } from "zlib";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";
import { buildData, EMBEDDED_PATH } from "./build-data.js";
import { DATA_SCHEMA, DATA_FILE, parseDataBundle } from "../src/updater.js";
import { EMBEDDED_FILES } from "../src/resources.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "dist", "update");

buildData();
const { _meta, ...files } = JSON.parse(readFileSync(EMBEDDED_PATH, "utf8"));
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const bundle = { schema: DATA_SCHEMA, version: pkg.version, commit: _meta.commit, committedAt: _meta.committedAt, files };
const gz = gzipSync(Buffer.from(JSON.stringify(bundle), "utf8"), { level: 9 });
parseDataBundle(gz, EMBEDDED_FILES); // 自检:确保客户端能解析
mkdirSync(OUT_DIR, { recursive: true });
const out = join(OUT_DIR, DATA_FILE);
writeFileSync(out, gz);
console.log(`[完成] 在线数据包 -> ${relative(ROOT, out)}(${(gz.length / 1024).toFixed(0)} KB,${_meta.committedAt})`);
