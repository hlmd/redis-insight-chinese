// test/cli.test.js
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createPackageWithOptions } from "@electron/asar";
import { extractAsar } from "../src/asar.js";
import { run } from "../redis-insight-chinese.js";

// 注入报告很长;并发跑测试时大量 stdout 会让 node 测试运行器解析子进程输出出错,这里静音
mock.method(console, "log", () => {});
// 测试不依赖本机语言:固定用简体中文
process.env.RI_LANG = "zh-CN";

// index.html 含内联代码脚本 + module 入口脚本，用来验证注入不破坏代码。
const INDEX_HTML = `<!doctype html><html><head>
<script>var P="__X__";window.z=P.startsWith("/");</script>
</head><body><div id="root"></div>
<script type="module" crossorigin src="./assets/index-x.js"></script>
</body></html>`;

const MAIN_JS = "!function(){}();\nmenu.label=\"Window\";\n";

async function makeInstall() {
  const work = mkdtempSync(join(tmpdir(), "cli-"));
  const srcTree = join(work, "srctree");
  mkdirSync(join(srcTree, "dist/renderer/assets"), { recursive: true });
  mkdirSync(join(srcTree, "dist/main"), { recursive: true });
  mkdirSync(join(srcTree, "node_modules/better-sqlite3/build"), { recursive: true });
  writeFileSync(join(srcTree, "dist/renderer/index.html"), INDEX_HTML);
  writeFileSync(join(srcTree, "dist/renderer/assets/index-x.js"), `x("Save")+y("Delete")`);
  writeFileSync(join(srcTree, "node_modules/better-sqlite3/build/x.node"), "BIN");
  writeFileSync(join(srcTree, "package.json"), JSON.stringify({ name: "redisinsight", main: "./dist/main/main.js" }));
  writeFileSync(join(srcTree, "dist/main/main.js"), MAIN_JS);
  const resources = join(work, "resources");
  mkdirSync(resources, { recursive: true });
  const asar = join(resources, "app.asar");
  await createPackageWithOptions(srcTree, asar, { unpackDir: "**/node_modules/{better-sqlite3}" });
  const dict = join(work, "translations.json");
  writeFileSync(dict, JSON.stringify({ Save: "保存", Delete: "删除" }));
  return { work, asar, dict };
}

test("apply 注入 ri-chinese.js，加 script 引用，代码与 unpacked 不被破坏", async () => {
  const { asar, dict } = await makeInstall();

  const code0 = await run(["apply", "--install", asar, "--dict", dict, "--dry-run"]);
  assert.strictEqual(code0, 0);

  const code = await run(["apply", "--install", asar, "--dict", dict]);
  assert.strictEqual(code, 0);
  assert.strictEqual(existsSync(asar + ".bak"), true);

  const check = mkdtempSync(join(tmpdir(), "chk-"));
  extractAsar(asar, check);
  // 注入脚本存在且含中文字典
  assert.strictEqual(existsSync(join(check, "dist/renderer/ri-chinese.js")), true);
  assert.ok((readFileSync(join(check, "dist/renderer/ri-chinese.js"), "utf8")).includes("保存"));
  // index.html 加了引用，且代码脚本未被改动
  const html = readFileSync(join(check, "dist/renderer/index.html"), "utf8");
  assert.ok((html).includes('<script src="./ri-chinese.js"></script>'));
  assert.ok((html).includes('P.startsWith("/")')); // 代码原封不动
  // 业务 JS 未被改动（不再做字符串静态替换）
  assert.strictEqual(readFileSync(join(check, "dist/renderer/assets/index-x.js"), "utf8"), `x("Save")+y("Delete")`);
  // unpacked 原生文件仍在
  assert.strictEqual(readFileSync(join(check, "node_modules/better-sqlite3/build/x.node"), "utf8"), "BIN");
});

test("apply 接入主进程菜单钩子,原 main.js 仅在开头多一行 require", async () => {
  const { asar, dict } = await makeInstall();
  assert.strictEqual(await run(["apply", "--install", asar, "--dict", dict]), 0);
  const check = mkdtempSync(join(tmpdir(), "chk-main-"));
  extractAsar(asar, check);
  const main = readFileSync(join(check, "dist/main/main.js"), "utf8");
  assert.strictEqual(main.startsWith("try { require('./ri-main-cn.js'); }"), true);
  assert.strictEqual(main.endsWith(MAIN_JS), true);
  assert.strictEqual(existsSync(join(check, "dist/main/ri-main-cn.js")), true);
  const data = JSON.parse(readFileSync(join(check, "dist/main/ri-main-data.json"), "utf8"));
  assert.strictEqual(data["Display On System Tray"], "显示在系统托盘");
});

test("restore 还原：注入脚本消失，index.html 复原", async () => {
  const { asar, dict } = await makeInstall();
  await run(["apply", "--install", asar, "--dict", dict]);
  const code = await run(["restore", "--install", asar]);
  assert.strictEqual(code, 0);
  const check = mkdtempSync(join(tmpdir(), "chk2-"));
  extractAsar(asar, check);
  assert.strictEqual(existsSync(join(check, "dist/renderer/ri-chinese.js")), false);
  assert.strictEqual(readFileSync(join(check, "dist/renderer/index.html"), "utf8"), INDEX_HTML);
});

test("dry-run 不修改 asar 文件", async () => {
  const { asar, dict } = await makeInstall();
  const before = readFileSync(asar);
  const code = await run(["apply", "--install", asar, "--dict", dict, "--dry-run"]);
  assert.strictEqual(code, 0);
  const after = readFileSync(asar);
  assert.strictEqual(after.equals(before), true);
});

test("重复 apply 不重复注入 script 标签（始终从 pristine 备份出发）", async () => {
  const { asar, dict } = await makeInstall();
  await run(["apply", "--install", asar, "--dict", dict]);
  await run(["apply", "--install", asar, "--dict", dict]);
  const check = mkdtempSync(join(tmpdir(), "id-"));
  extractAsar(asar, check);
  const html = readFileSync(join(check, "dist/renderer/index.html"), "utf8");
  const count = html.split('<script src="./ri-chinese.js"></script>').length - 1;
  assert.strictEqual(count, 1);
});

test("未知命令返回非零退出码", async () => {
  const code = await run(["bogus"]);
  assert.strictEqual(code, 2);
});
