// test/asar.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "fs";
import { unpackedSet, deriveUnpackDir } from "../src/asar.js";

const REAL = "C:/Program Files/Redis Insight/resources/app.asar";
const has = existsSync(REAL);

test("unpackedSet 返回 99 个 unpacked 文件", { skip: !has }, () => {
  assert.strictEqual(unpackedSet(REAL).length, 99);
});

test("deriveUnpackDir 推导出三个原生模块目录 glob", { skip: !has }, () => {
  assert.strictEqual(deriveUnpackDir(REAL), "**/node_modules/{better-sqlite3,keytar,ssh2}");
});
