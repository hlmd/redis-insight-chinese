// test/cli.test.js
import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createPackageWithOptions } from "@electron/asar";
import { extractAsar } from "../src/asar.js";
import { run } from "../hanhua.js";

// index.html 含内联代码脚本 + module 入口脚本，用来验证注入不破坏代码。
const INDEX_HTML = `<!doctype html><html><head>
<script>var P="__X__";window.z=P.startsWith("/");</script>
</head><body><div id="root"></div>
<script type="module" crossorigin src="./assets/index-x.js"></script>
</body></html>`;

async function makeInstall() {
  const work = mkdtempSync(join(tmpdir(), "cli-"));
  const srcTree = join(work, "srctree");
  mkdirSync(join(srcTree, "dist/renderer/assets"), { recursive: true });
  mkdirSync(join(srcTree, "dist/main"), { recursive: true });
  mkdirSync(join(srcTree, "node_modules/better-sqlite3/build"), { recursive: true });
  writeFileSync(join(srcTree, "dist/renderer/index.html"), INDEX_HTML);
  writeFileSync(join(srcTree, "dist/renderer/assets/index-x.js"), `x("Save")+y("Delete")`);
  writeFileSync(join(srcTree, "node_modules/better-sqlite3/build/x.node"), "BIN");
  const resources = join(work, "resources");
  mkdirSync(resources, { recursive: true });
  const asar = join(resources, "app.asar");
  await createPackageWithOptions(srcTree, asar, { unpackDir: "**/node_modules/{better-sqlite3}" });
  const dict = join(work, "translations.json");
  writeFileSync(dict, JSON.stringify({ Save: "保存", Delete: "删除" }));
  return { work, asar, dict };
}

test("apply 注入 zh-inject.js，加 script 引用，代码与 unpacked 不被破坏", async () => {
  const { asar, dict } = await makeInstall();

  const code0 = await run(["apply", "--install", asar, "--dict", dict, "--dry-run"]);
  expect(code0).toBe(0);

  const code = await run(["apply", "--install", asar, "--dict", dict]);
  expect(code).toBe(0);
  expect(existsSync(asar + ".bak")).toBe(true);

  const check = mkdtempSync(join(tmpdir(), "chk-"));
  extractAsar(asar, check);
  // 注入脚本存在且含中文字典
  expect(existsSync(join(check, "dist/renderer/zh-inject.js"))).toBe(true);
  expect(readFileSync(join(check, "dist/renderer/zh-inject.js"), "utf8")).toContain("保存");
  // index.html 加了引用，且代码脚本未被改动
  const html = readFileSync(join(check, "dist/renderer/index.html"), "utf8");
  expect(html).toContain('<script src="./zh-inject.js"></script>');
  expect(html).toContain('P.startsWith("/")'); // 代码原封不动
  // 业务 JS 未被改动（不再做字符串静态替换）
  expect(readFileSync(join(check, "dist/renderer/assets/index-x.js"), "utf8")).toBe(`x("Save")+y("Delete")`);
  // unpacked 原生文件仍在
  expect(readFileSync(join(check, "node_modules/better-sqlite3/build/x.node"), "utf8")).toBe("BIN");
});

test("restore 还原：注入脚本消失，index.html 复原", async () => {
  const { asar, dict } = await makeInstall();
  await run(["apply", "--install", asar, "--dict", dict]);
  const code = await run(["restore", "--install", asar]);
  expect(code).toBe(0);
  const check = mkdtempSync(join(tmpdir(), "chk2-"));
  extractAsar(asar, check);
  expect(existsSync(join(check, "dist/renderer/zh-inject.js"))).toBe(false);
  expect(readFileSync(join(check, "dist/renderer/index.html"), "utf8")).toBe(INDEX_HTML);
});

test("dry-run 不修改 asar 文件", async () => {
  const { asar, dict } = await makeInstall();
  const before = readFileSync(asar);
  const code = await run(["apply", "--install", asar, "--dict", dict, "--dry-run"]);
  expect(code).toBe(0);
  const after = readFileSync(asar);
  expect(after.equals(before)).toBe(true);
});

test("重复 apply 不重复注入 script 标签（始终从 pristine 备份出发）", async () => {
  const { asar, dict } = await makeInstall();
  await run(["apply", "--install", asar, "--dict", dict]);
  await run(["apply", "--install", asar, "--dict", dict]);
  const check = mkdtempSync(join(tmpdir(), "id-"));
  extractAsar(asar, check);
  const html = readFileSync(join(check, "dist/renderer/index.html"), "utf8");
  const count = html.split('<script src="./zh-inject.js"></script>').length - 1;
  expect(count).toBe(1);
});

test("未知命令返回非零退出码", async () => {
  const code = await run(["bogus"]);
  expect(code).toBe(2);
});
