import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createRequire } from "module";
import { injectMainEntry, injectMenu } from "../src/menu.js";

const require = createRequire(import.meta.url);
const hook = require("../src/hooks/ri-main-cn.cjs");
const ROOT = join(import.meta.dirname, "..");
const HOOK_SRC = readFileSync(join(ROOT, "src", "hooks", "ri-main-cn.cjs"), "utf8");
const DICT = JSON.parse(readFileSync(join(ROOT, "locales/zh-CN/main.json"), "utf8"));

test("translateTemplate 翻译 label,保留助记符、子菜单与其它字段,且不改原模板", () => {
  const c = hook.compile(DICT);
  const tpl = [
    {
      label: "&Window",
      submenu: [
        { label: "New Window", accelerator: "Ctrl+N" },
        { label: "&Close" },
        { label: "Display On System Tray", type: "checkbox" },
        { type: "separator" },
        { label: "" },
      ],
    },
    { label: "Toggle &Developer Tools" },
    { label: "About Redis Insight" },
    { label: "Look Up “a && b”" },
    { label: "Some Unknown Item" },
  ];
  const out = hook.translateTemplate(c, tpl);
  assert.strictEqual(out[0].label, "窗口(&W)");
  assert.deepStrictEqual(out[0].submenu.map((x) => x.label), [
    "新建窗口", "关闭(&C)", "显示在系统托盘", undefined, "",
  ]);
  assert.strictEqual(out[0].submenu[0].accelerator, "Ctrl+N");
  assert.strictEqual(out[1].label, "切换开发者工具(&D)");
  assert.strictEqual(out[2].label, "关于 Redis Insight");
  assert.strictEqual(out[3].label, "查询“a && b”");
  assert.strictEqual(out[4].label, "Some Unknown Item");
  assert.strictEqual(tpl[0].label, "&Window"); // 原模板未被修改
});

test("install 包装 Menu 与 dialog,且重复 install 不重复包装", () => {
  let seen = null, box = null, errTitle = null;
  const electron = {
    Menu: { buildFromTemplate: (t) => { seen = t; return t; } },
    dialog: {
      showMessageBoxSync: (...args) => { box = args[args.length - 1]; },
      showErrorBox: (t) => { errTitle = t; },
    },
  };
  hook.install(electron, DICT);
  const wrapped = electron.Menu.buildFromTemplate;
  hook.install(electron, DICT);
  assert.strictEqual(electron.Menu.buildFromTemplate, wrapped);
  electron.Menu.buildFromTemplate([{ label: "&View" }]);
  assert.strictEqual(seen[0].label, "视图(&V)");
  electron.dialog.showMessageBoxSync({}, { title: "Quit", buttons: ["Cancel", "&Close"] });
  assert.strictEqual(box.title, "退出");
  assert.deepStrictEqual(box.buttons, ["Cancel", "关闭(&C)"]);
  electron.dialog.showErrorBox("A JavaScript error occurred in the main process", "x");
  assert.strictEqual(errTitle, "主进程发生 JavaScript 错误");
});

test("injectMainEntry 插在最前,保留 shebang 与 use strict,幂等", () => {
  const a = injectMainEntry("!function(){}();\n");
  assert.strictEqual(a.startsWith("try { require('./ri-main-cn.js');"), true);
  assert.strictEqual(injectMainEntry(a), a);
  const b = injectMainEntry("#!/usr/bin/env node\n'use strict';\nfoo();\n");
  assert.strictEqual(b.startsWith("#!/usr/bin/env node\n'use strict';\ntry { require("), true);
  assert.strictEqual(b.endsWith("foo();\n"), true);
});

test("injectMenu 写入钩子与词典并接入入口;无 package.json 时跳过", () => {
  const root = mkdtempSync(join(tmpdir(), "menu-"));
  mkdirSync(join(root, "dist", "main"), { recursive: true });
  writeFileSync(join(root, "dist", "main", "main.js"), "ORIGINAL\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x", main: "./dist/main/main.js" }));

  const r1 = injectMenu(root, DICT, HOOK_SRC);
  assert.strictEqual(r1.mainPatched, true);
  assert.strictEqual(readFileSync(join(root, "dist/main/main.js"), "utf8").endsWith("ORIGINAL\n"), true);
  assert.strictEqual(readFileSync(join(root, "dist/main/ri-main-cn.js"), "utf8"), HOOK_SRC);
  assert.deepStrictEqual(JSON.parse(readFileSync(join(root, "dist/main/ri-main-data.json"), "utf8")), DICT);
  assert.strictEqual(injectMenu(root, DICT, HOOK_SRC).mainPatched, false);

  const empty = mkdtempSync(join(tmpdir(), "menu-empty-"));
  assert.strictEqual(injectMenu(empty, DICT, HOOK_SRC).skipped, true);
});

test("--no-app-update:写入 ri-main-options.json,钩子据此关闭 Redis Insight 自动更新", () => {
  const root = mkdtempSync(join(tmpdir(), "menu-opt-"));
  mkdirSync(join(root, "dist", "main"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ main: "dist/main/main.js" }));
  writeFileSync(join(root, "dist", "main", "main.js"), "module.exports = 1;\n");
  injectMenu(root, { File: "文件" }, HOOK_SRC, { noAppUpdate: true });
  const optPath = join(root, "dist", "main", "ri-main-options.json");
  assert.deepEqual(JSON.parse(readFileSync(optPath, "utf8")), { noAppUpdate: true });
  // 在副本目录里加载钩子:应设置更新相关环境变量
  const keys = ["RI_MANUAL_UPGRADES_LINK", "RI_UPGRADES_LINK", "RI_DISABLE_AUTO_UPGRADE"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    for (const k of keys) delete process.env[k];
    const hookPath = join(root, "dist", "main", "hook-copy.cjs");
    writeFileSync(hookPath, HOOK_SRC);
    createRequire(hookPath)(hookPath);
    assert.match(process.env.RI_MANUAL_UPGRADES_LINK, /127\.0\.0\.1/);
    assert.equal(process.env.RI_DISABLE_AUTO_UPGRADE, "true");
    // 不开开关时不动环境变量
    for (const k of keys) delete process.env[k];
    const root2 = mkdtempSync(join(tmpdir(), "menu-opt2-"));
    mkdirSync(join(root2, "dist", "main"), { recursive: true });
    writeFileSync(join(root2, "package.json"), JSON.stringify({ main: "dist/main/main.js" }));
    writeFileSync(join(root2, "dist", "main", "main.js"), "module.exports = 1;\n");
    injectMenu(root2, { File: "文件" }, HOOK_SRC, {});
    const hook2 = join(root2, "dist", "main", "hook-copy2.cjs");
    writeFileSync(hook2, HOOK_SRC);
    createRequire(hook2)(hook2);
    assert.equal(process.env.RI_MANUAL_UPGRADES_LINK, undefined);
  } finally {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
});
