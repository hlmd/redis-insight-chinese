import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { buildInjectScript, injectInto } from "../src/inject.js";
const HOOK = readFileSync(join(import.meta.dirname, "..", "src", "hooks", "ri-chinese.js"), "utf8");

test("buildInjectScript 内嵌字典且是合法 JS", () => {
  const script = buildInjectScript({ Save: "保存", Skip: "", Keep: "Keep" }, HOOK);
  assert.ok((script).includes('"Save":"保存"'));
  assert.ok(!(script).includes("Skip")); // 空值被过滤
  assert.ok(!(script).includes('"Keep"')); // 值等于键的被过滤
  // 语法合法：能被编译（不执行，避免引用 document 报错）
  assert.doesNotThrow(() => new Function(script));
});

function makeTree() {
  const root = mkdtempSync(join(tmpdir(), "inject-"));
  const rd = join(root, "dist", "renderer");
  mkdirSync(rd, { recursive: true });
  writeFileSync(
    join(rd, "index.html"),
    `<!doctype html><html><head>
<script>var X="startsWith";X.startsWith("s");</script>
</head><body><div id="root"></div>
<script type="module" crossorigin src="./assets/index-abc.js"></script>
</body></html>`
  );
  return { root, rd };
}

test("injectInto 生成 ri-chinese.js 并在 module 脚本前插入引用，代码不被改动", () => {
  const { root, rd } = makeTree();
  const res = injectInto(root, { Save: "保存", Delete: "删除" }, HOOK);
  // 1. 注入脚本生成，含字典
  assert.strictEqual(existsSync(join(rd, "ri-chinese.js")), true);
  assert.ok((readFileSync(join(rd, "ri-chinese.js"), "utf8")).includes("保存"));
  assert.strictEqual(res.entries, 2);
  assert.strictEqual(res.tagAdded, true);
  // 2. index.html 加了引用，且在 module 脚本之前
  const html = readFileSync(join(rd, "index.html"), "utf8");
  assert.ok((html).includes('<script src="./ri-chinese.js"></script>'));
  assert.ok(html.indexOf("ri-chinese.js") < html.indexOf('type="module"'));
  // 3. 原有内联代码原封不动（startsWith 未被破坏）
  assert.ok((html).includes('X.startsWith("s")'));
});

test("injectInto 幂等：二次注入不重复插入 script 标签", () => {
  const { root, rd } = makeTree();
  injectInto(root, { Save: "保存" }, HOOK);
  const res2 = injectInto(root, { Save: "保存", Delete: "删除" }, HOOK);
  assert.strictEqual(res2.tagAdded, false);
  const html = readFileSync(join(rd, "index.html"), "utf8");
  const count = html.split('<script src="./ri-chinese.js"></script>').length - 1;
  assert.strictEqual(count, 1);
  // 但字典已更新为最新
  assert.ok((readFileSync(join(rd, "ri-chinese.js"), "utf8")).includes("删除"));
});

// 在无 DOM 环境执行钩子,拿到导出的纯函数
function loadHook(dict) {
  const module = { exports: {} };
  new Function("module", "__ZH_DICT__", HOOK + "\n")(module, dict);
  return module.exports;
}

test("钩子 tr:精确匹配保留前后空白,折叠内部空白,跳过无字母文本", () => {
  const h = loadHook({ Save: "保存", "Add Redis database": "添加 Redis 数据库" });
  assert.strictEqual(h.tr("  Save "), "  保存 ");
  assert.strictEqual(h.tr("Add  Redis\n database"), "添加 Redis 数据库");
  assert.strictEqual(h.tr("保存"), null);
  assert.strictEqual(h.tr("Unknown"), null);
});

test("钩子 tr:{{占位}} 模板匹配并代入译文", () => {
  const h = loadHook({
    "Delete {{count}} keys": "删除 {{count}} 个键",
    "{{count}} Command - {{success}} success": "{{count}} 条命令 - {{success}} 条成功",
    "Same {{x}}": "Same {{x}}", // 值等于键的被忽略
  });
  assert.strictEqual(h.tr("Delete 12 keys"), "删除 12 个键");
  assert.strictEqual(h.tr("3 Command - 2 success"), "3 条命令 - 2 条成功");
  assert.strictEqual(h.tr("Delete keys"), null);
  assert.strictEqual(h.tr("Same 1"), null);
});

test("injectAssets 只替换哈希一致的原图", async () => {
  const { injectAssets } = await import("../src/inject.js");
  const { createHash } = await import("crypto");
  const root = mkdtempSync(join(tmpdir(), "assets-"));
  const dir = join(root, "dist", "renderer", "assets");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "empty_list_dark-AAA.svg"), "<svg>en</svg>");
  writeFileSync(join(dir, "empty_list_light-BBB.svg"), "<svg>changed upstream</svg>");
  const sha = (s) => createHash("sha256").update(s).digest("hex");
  const manifest = {
    empty_list_dark: { sha256: sha("<svg>en</svg>"), file: "empty_list_dark.svg" },
    empty_list_light: { sha256: sha("<svg>en light</svg>"), file: "empty_list_light.svg" },
    missing: { sha256: "x", file: "missing.svg" },
  };
  const r = injectAssets(root, manifest, { "empty_list_dark.svg": "<svg>中</svg>", "empty_list_light.svg": "<svg>中</svg>" });
  assert.deepEqual(r.replaced, ["empty_list_dark-AAA.svg"]);
  assert.equal(r.skipped.length, 2);
  assert.equal(readFileSync(join(dir, "empty_list_dark-AAA.svg"), "utf8"), "<svg>中</svg>");
  assert.equal(readFileSync(join(dir, "empty_list_light-BBB.svg"), "utf8"), "<svg>changed upstream</svg>");
});

test("withCaseVariants 不给数据类型名生成变体(Time series → 不生成 Time Series)", async () => {
  const { withCaseVariants } = await import("../src/inject.js");
  const d = withCaseVariants({ "Time series": "时间序列", "Basic Redis use cases": "Redis 基础用例" });
  assert.ok(!("Time Series" in d));
  assert.ok(!("TIME SERIES" in d));
  assert.equal(d["Time series"], "时间序列");
  assert.equal(d["BASIC REDIS USE CASES"], "Redis 基础用例");
});
