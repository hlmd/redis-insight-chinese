import { test, expect } from "bun:test";
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
  expect(cand).toHaveProperty("Add database", "");
  expect(cand).toHaveProperty("Save", "");
  expect(cand).toHaveProperty("Delete key?", "");
  expect(cand).not.toHaveProperty("ok");       // < minLen(3)? "ok"=2 → 过滤
  expect(cand).not.toHaveProperty("./foo.js");  // 含 / 与 .js
  expect(cand).not.toHaveProperty("utf-8");     // 全小写、无空格、像标识符
});
