// test/backup.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { ensureBackup, restore } from "../src/backup.js";

function scene() {
  const root = mkdtempSync(join(tmpdir(), "bak-"));
  const asar = join(root, "app.asar");
  writeFileSync(asar, "ORIGINAL");
  mkdirSync(join(root, "app.asar.unpacked"));
  writeFileSync(join(root, "app.asar.unpacked", "native.node"), "BIN");
  return { root, asar };
}

test("首次备份复制 asar 与 unpacked 到 .bak / .bak.unpacked", () => {
  const { root, asar } = scene();
  const { bakAsar, bakUnpacked } = ensureBackup(asar);
  assert.strictEqual(bakAsar, asar + ".bak");
  assert.strictEqual(bakUnpacked, asar + ".bak.unpacked");
  assert.strictEqual(readFileSync(bakAsar, "utf8"), "ORIGINAL");
  assert.strictEqual(readFileSync(join(bakUnpacked, "native.node"), "utf8"), "BIN");
});

test("已存在备份则不覆盖（保护原始英文源）", () => {
  const { asar } = scene();
  ensureBackup(asar);
  writeFileSync(asar, "TRANSLATED"); // 模拟已翻译
  ensureBackup(asar);
  assert.strictEqual(readFileSync(asar + ".bak", "utf8"), "ORIGINAL"); // 仍是原始
});

test("restore 从备份还原 asar 与 unpacked", () => {
  const { asar } = scene();
  ensureBackup(asar);
  writeFileSync(asar, "TRANSLATED");
  restore(asar);
  assert.strictEqual(readFileSync(asar, "utf8"), "ORIGINAL");
  assert.strictEqual(existsSync(asar + ".unpacked"), true);
});

test("无备份时 restore 抛错", () => {
  const { asar } = scene();
  assert.throws(() => restore(asar));
});
