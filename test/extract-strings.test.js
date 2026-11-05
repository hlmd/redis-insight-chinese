import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { extractCandidates } from "../src/extract-strings.js";

test("提取像 UI 文案的字符串，过滤代码特征与短串", () => {
  const root = mkdtempSync(join(tmpdir(), "ext-"));
  mkdirSync(join(root, "dist/renderer/assets"), { recursive: true });
  writeFileSync(
    join(root, "dist/renderer/assets/index-x.js"),
    `a("Add database");b("Save");c("ok");d("./foo.js");e("utf-8");f("Delete key?")`
  );
  const cand = extractCandidates(root, 3);
  assert.strictEqual(cand["Add database"], "");
  assert.strictEqual(cand["Save"], "");
  assert.strictEqual(cand["Delete key?"], "");
  assert.ok(!Object.hasOwn(cand, "ok"));       // < minLen(3)? "ok"=2 → 过滤
  assert.ok(!Object.hasOwn(cand, "./foo.js"));  // 含 / 与 .js
  assert.ok(!Object.hasOwn(cand, "utf-8"));     // 全小写、无空格、像标识符
});
