import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { toPosix, walkFileTree } from "../src/paths.js";

test("toPosix 反斜杠转正斜杠", () => {
  expect(toPosix("a\\b\\c")).toBe("a/b/c");
});

test("walkFileTree 递归列出所有文件", () => {
  const root = mkdtempSync(join(tmpdir(), "walk-"));
  mkdirSync(join(root, "sub"));
  writeFileSync(join(root, "a.txt"), "x");
  writeFileSync(join(root, "sub", "b.txt"), "y");
  const files = walkFileTree(root).map(toPosix).sort();
  expect(files.length).toBe(2);
  expect(files.some(f => f.endsWith("/a.txt"))).toBe(true);
  expect(files.some(f => f.endsWith("/sub/b.txt"))).toBe(true);
});
