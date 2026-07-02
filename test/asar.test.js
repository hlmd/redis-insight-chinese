// test/asar.test.js
import { test, expect } from "bun:test";
import { existsSync } from "fs";
import { unpackedSet, deriveUnpackDir } from "../src/asar.js";

const REAL = "C:/Program Files/Redis Insight/resources/app.asar";
const has = existsSync(REAL);

test.if(has)("unpackedSet 返回 99 个 unpacked 文件", () => {
  expect(unpackedSet(REAL).length).toBe(99);
});

test.if(has)("deriveUnpackDir 推导出三个原生模块目录 glob", () => {
  expect(deriveUnpackDir(REAL)).toBe("**/node_modules/{better-sqlite3,keytar,ssh2}");
});
