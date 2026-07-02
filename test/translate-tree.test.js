import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { translateTree } from "../src/translate.js";

function setup() {
  const root = mkdtempSync(join(tmpdir(), "tree-"));
  mkdirSync(join(root, "dist/renderer/assets"), { recursive: true });
  mkdirSync(join(root, "dist/main"), { recursive: true });
  writeFileSync(join(root, "dist/renderer/assets/index-abc.js"), `x("Save")`);
  writeFileSync(join(root, "dist/renderer/splash.html"), `<b>Loading</b>`);
  writeFileSync(join(root, "dist/main/main.js"), `menu("Quit")`);
  // 不该被处理的文件
  writeFileSync(join(root, "dist/renderer/assets/style.css"), `.Save{}`);
  return root;
}

test("翻译目标文件并统计", () => {
  const root = setup();
  const stats = translateTree(root, { Save: "保存", Loading: "加载中", Quit: "退出", Missing: "不存在" });
  expect(readFileSync(join(root, "dist/renderer/assets/index-abc.js"), "utf8")).toBe(`x("保存")`);
  expect(readFileSync(join(root, "dist/renderer/splash.html"), "utf8")).toBe(`<b>加载中</b>`);
  expect(readFileSync(join(root, "dist/main/main.js"), "utf8")).toBe(`menu("退出")`);
  expect(readFileSync(join(root, "dist/renderer/assets/style.css"), "utf8")).toBe(`.Save{}`); // 未动
  expect(stats.filesChanged).toBe(3);
  expect(stats.occurrences).toBe(3);
  expect(stats.unmatchedKeys).toEqual(["Missing"]);
});

test("幂等：二次运行无变化", () => {
  const root = setup();
  translateTree(root, { Save: "保存", Loading: "加载中", Quit: "退出" });
  const stats2 = translateTree(root, { Save: "保存", Loading: "加载中", Quit: "退出" });
  expect(stats2.filesChanged).toBe(0);
  expect(stats2.occurrences).toBe(0);
});
