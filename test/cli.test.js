// test/cli.test.js
import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createPackageWithOptions } from "@electron/asar";
import { extractAsar } from "../src/asar.js";
import { run } from "../hanhua.js";

async function makeInstall() {
  const work = mkdtempSync(join(tmpdir(), "cli-"));
  // 构造一个 app 源树（含一个 unpacked 原生模块）
  const srcTree = join(work, "srctree");
  mkdirSync(join(srcTree, "dist/renderer/assets"), { recursive: true });
  mkdirSync(join(srcTree, "dist/main"), { recursive: true });
  mkdirSync(join(srcTree, "node_modules/better-sqlite3/build"), { recursive: true });
  writeFileSync(join(srcTree, "dist/renderer/assets/index-x.js"), `x("Save")+y("Delete")`);
  writeFileSync(join(srcTree, "dist/renderer/splash.html"), `<b>Loading</b>`);
  writeFileSync(join(srcTree, "dist/main/main.js"), `menu("Quit")`);
  writeFileSync(join(srcTree, "node_modules/better-sqlite3/build/x.node"), "BIN");
  // 打成 app.asar（把 better-sqlite3 标记 unpacked）
  const resources = join(work, "resources");
  mkdirSync(resources, { recursive: true });
  const asar = join(resources, "app.asar");
  await createPackageWithOptions(srcTree, asar, { unpackDir: "**/node_modules/{better-sqlite3}" });
  // 字典
  const dict = join(work, "translations.json");
  writeFileSync(dict, JSON.stringify({ Save: "保存", Delete: "删除", Quit: "退出", Loading: "加载中", Nope: "没有" }));
  return { work, asar, dict };
}

test("apply 原地汉化并保留 unpacked，dry-run 不写入", async () => {
  const { asar, dict } = await makeInstall();

  // dry-run 不改文件
  const code0 = await run(["apply", "--install", asar, "--dict", dict, "--dry-run"]);
  expect(code0).toBe(0);

  // 正式 apply
  const code = await run(["apply", "--install", asar, "--dict", dict]);
  expect(code).toBe(0);
  expect(existsSync(asar + ".bak")).toBe(true);

  // 解包结果核对
  const check = mkdtempSync(join(tmpdir(), "chk-"));
  extractAsar(asar, check);
  expect(readFileSync(join(check, "dist/renderer/assets/index-x.js"), "utf8")).toBe(`x("保存")+y("删除")`);
  expect(readFileSync(join(check, "dist/renderer/splash.html"), "utf8")).toBe(`<b>加载中</b>`);
  expect(readFileSync(join(check, "dist/main/main.js"), "utf8")).toBe(`menu("退出")`);
  // unpacked 原生文件仍在
  expect(readFileSync(join(check, "node_modules/better-sqlite3/build/x.node"), "utf8")).toBe("BIN");
});

test("restore 还原到英文原文", async () => {
  const { asar, dict } = await makeInstall();
  await run(["apply", "--install", asar, "--dict", dict]);
  const code = await run(["restore", "--install", asar]);
  expect(code).toBe(0);
  const check = mkdtempSync(join(tmpdir(), "chk2-"));
  extractAsar(asar, check);
  expect(readFileSync(join(check, "dist/renderer/assets/index-x.js"), "utf8")).toBe(`x("Save")+y("Delete")`);
});

test("dry-run 不修改 asar 文件", async () => {
  const { asar, dict } = await makeInstall();
  const before = readFileSync(asar);
  const code = await run(["apply", "--install", asar, "--dict", dict, "--dry-run"]);
  expect(code).toBe(0);
  const after = readFileSync(asar);
  expect(after.equals(before)).toBe(true);
});

test("重复 apply 不重复翻译（始终从 pristine 备份出发）", async () => {
  const { asar, dict } = await makeInstall();
  await run(["apply", "--install", asar, "--dict", dict]);
  const c1 = mkdtempSync(join(tmpdir(), "id1-"));
  extractAsar(asar, c1);
  const first = readFileSync(join(c1, "dist/renderer/assets/index-x.js"), "utf8");
  await run(["apply", "--install", asar, "--dict", dict]);
  const c2 = mkdtempSync(join(tmpdir(), "id2-"));
  extractAsar(asar, c2);
  const second = readFileSync(join(c2, "dist/renderer/assets/index-x.js"), "utf8");
  expect(second).toBe(first);
  expect(second).toBe(`x("保存")+y("删除")`);
});

test("未知命令返回非零退出码", async () => {
  const code = await run(["bogus"]);
  expect(code).toBe(2);
});
