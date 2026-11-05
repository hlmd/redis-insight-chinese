// test/asar.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "fs";
import { unpackedSet, deriveUnpackDir } from "../src/asar.js";

// 需要真实安装的用例:设置环境变量 RI_TEST_ASAR=<安装目录>/resources/app.asar 才运行
const REAL = process.env.RI_TEST_ASAR || "";
const has = !!REAL && existsSync(REAL);

test("unpackedSet 返回 99 个 unpacked 文件", { skip: !has }, () => {
  assert.strictEqual(unpackedSet(REAL).length, 99);
});

test("deriveUnpackDir 推导出三个原生模块目录 glob", { skip: !has }, () => {
  assert.strictEqual(deriveUnpackDir(REAL), "**/node_modules/{better-sqlite3,keytar,ssh2}");
});
