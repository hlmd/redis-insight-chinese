import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { join } from "path";
import { buildInjectScript } from "../src/inject.js";

const require = createRequire(import.meta.url);
const MD = require("../src/hooks/md-segments.cjs");
const MD_SRC = readFileSync(join(import.meta.dirname, "..", "src", "hooks", "md-segments.cjs"), "utf8");
const HOOK = readFileSync(join(import.meta.dirname, "..", "src", "hooks", "ri-chinese.js"), "utf8");
const ZH_FRAGMENTS = JSON.parse(readFileSync(join(import.meta.dirname, "..", "locales", "zh-CN", "fragments.json"), "utf8"));
// 以简体中文的片段规则 + 上下文规则会引用到的两条词典译文加载钩子(无 DOM,只导出纯函数)
const ZH_DICT = { "Last Refresh": "上次刷新", "will be removed from the": "将被移除，来源：" };
function loadZh(mod) {
  new Function("module", "__RI_DICT__", "__RI_FRAGMENTS__", HOOK)(mod, ZH_DICT, ZH_FRAGMENTS);
}

const SAMPLE = [
  "## Hashes",
  "",
  "Use `HSET` to create a hash.",
  "It returns a number.",
  "",
  "```redis:[run_confirmation=true] Create a hash",
  "HSET bike:1 model Deimos // the model",
  "```",
  "",
  "![diagram](images/a.png)",
  "",
  "- one",
  "- two",
  "",
].join("\n");

test("segment 无损切分:各段拼接等于原文(含 CRLF)", () => {
  for (const text of [SAMPLE, SAMPLE.replace(/\n/g, "\r\n"), "no trailing newline", ""]) {
    assert.equal(MD.segment(text).map((s) => s.s).join(""), text);
  }
});

test("keys:段落、运行按钮文字、命令注释可翻;代码、纯图片不收", () => {
  assert.deepEqual(MD.keys(SAMPLE), [
    "## Hashes",
    "Use `HSET` to create a hash.\nIt returns a number.",
    "Create a hash",
    "the model",
    "- one\n- two",
  ]);
  assert.deepEqual(MD.keys(SAMPLE.replace(/\n/g, "\r\n")), MD.keys(SAMPLE));
});

test("代码块注释:// 后的文字成段,引号里 / URL 里的 // 不算,非命令语言块不收", () => {
  const md = [
    "```redis Run",
    "FT.CREATE idx    // the index name   ",
    "    // full line comment",
    "JSON.SET k $ '{\"u\":\"a // b\"}'   // real one",
    "GET http://x.y",
    "GET k // 123",
    "```",
    "```python",
    "x = a // b",
    "```",
    "",
  ].join("\n");
  assert.equal(MD.segment(md).map((s) => s.s).join(""), md);
  assert.deepEqual(MD.keys(md), ["Run", "the index name", "full line comment", "real one"]);
  const out = MD.translate(md, { "the index name": "索引名", "real one": "真正的注释" }).text;
  assert.ok(out.includes("FT.CREATE idx    // 索引名   \n"));
  assert.ok(out.includes(`'{"u":"a // b"}'   // 真正的注释\n`));
  assert.ok(out.includes("x = a // b"));
});

test("translate 按段替换,代码块原样保留,未收录的段保持英文", () => {
  const r = MD.translate(SAMPLE, {
    "## Hashes": "## 哈希",
    "Create a hash": "创建哈希",
    "Use `HSET` to create a hash.\nIt returns a number.": "使用 `HSET` 创建哈希。\n它返回一个数字。",
  });
  assert.equal(r.hit, 3);
  assert.equal(r.total, 5);
  assert.ok(r.text.includes("## 哈希\n"));
  assert.ok(r.text.includes("```redis:[run_confirmation=true] 创建哈希\nHSET bike:1 model Deimos // the model\n```"));
  assert.ok(r.text.includes("- one\n- two"));
  const crlf = MD.translate(SAMPLE.replace(/\n/g, "\r\n"), { "Use `HSET` to create a hash.\nIt returns a number.": "甲\n乙" });
  assert.ok(crlf.text.includes("甲\r\n乙\r\n"));
});

test("buildInjectScript 有教程词典时内联切分器与段落词典,且是合法 JS", () => {
  const s = buildInjectScript({ Save: "保存" }, HOOK, { tutorials: { markdown: { "## Hashes": "## 哈希", Keep: "Keep" } }, mdSrc: MD_SRC });
  assert.ok(s.includes("var __RI_TUTORIALS__ = "));
  assert.ok(s.includes('"## Hashes":"## 哈希"'));
  assert.ok(!s.includes('"Keep":"Keep"'));
  assert.doesNotThrow(() => new Function(s));
  // 没有正文段落时不内联
  const s2 = buildInjectScript({ Save: "保存" }, HOOK, { tutorials: { markdown: {} }, mdSrc: MD_SRC });
  assert.ok(!s2.includes("__RI_TUTORIALS__ ="));
});

test("浏览器里拼接后的脚本:XHR 取教程 .md 时返回译文,其它请求不受影响", () => {
  class FakeXHR {
    open(m, url) { this.url = url; }
    get readyState() { return 4; }
    get status() { return 200; }
    get responseText() { return this.url.endsWith(".md") ? "## Hashes\n" : "plain"; }
    get response() { return this.responseText; }
  }
  const script = buildInjectScript({}, HOOK, { tutorials: { markdown: { "## Hashes": "## 哈希" } }, mdSrc: MD_SRC });
  // 模拟浏览器全局:把 DOM / XHR 挂到真实 globalThis 上,脚本作为顶层代码运行
  const fake = {
    XMLHttpRequest: FakeXHR,
    document: { readyState: "complete", body: null, documentElement: null, addEventListener() {}, createTreeWalker: () => ({ nextNode: () => null }) },
    MutationObserver: class { observe() {} disconnect() {} },
    NodeFilter: { SHOW_TEXT: 4 },
  };
  const saved = {};
  for (const k of [...Object.keys(fake), "__RI_MD__", "__RI_TUTORIALS__", "__RI_DICT__"]) saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
  Object.assign(globalThis, fake);
  try {
    // var 声明改成全局赋值,模拟 <script> 顶层 var 落到 window 上
    new Function(script.replace(/^var (__RI_\w+) = /gm, "globalThis.$1 = "))();
    const a = new FakeXHR(); a.open("GET", "static/tutorials/ds/hashes.md");
    assert.equal(a.responseText, "## 哈希\n");
    assert.equal(a.response, "## 哈希\n");
    const b = new FakeXHR(); b.open("GET", "api/databases");
    assert.equal(b.responseText, "plain");
  } finally {
    for (const [k, d] of Object.entries(saved)) {
      if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k];
    }
  }
});

test("startCase / withCaseVariants:教程页返回按钮与大写标题也能匹配目录词条", async () => {
  const { startCase, withCaseVariants } = await import("../src/inject.js");
  assert.equal(startCase("Redis basic and RAG use cases"), "Redis Basic And RAG Use Cases");
  assert.equal(startCase("E-commerce Discovery"), "E Commerce Discovery");
  assert.equal(startCase("More advanced JSONPath"), "More Advanced JSON Path");
  const d = withCaseVariants({ "Basic Redis use cases": "Redis 基础用例", Keep: "Keep" });
  assert.equal(d["Basic Redis Use Cases"], "Redis 基础用例");
  assert.equal(d["BASIC REDIS USE CASES"], "Redis 基础用例");
  assert.ok(!("KEEP" in d));
});

test("数量类占位只匹配数字:{{count}} 不会吞掉普通句子", () => {
  const mod = { exports: {} };
  new Function("module", HOOK)(mod); // 无 document 时钩子只导出纯函数
  const { compile, lookup } = mod.exports;
  const c = compile({ "{{count}} databases": "{{count}} 个数据库", "{{count}} of {{total}}": "{{count}} / {{total}}", "Hello {{name}}": "你好 {{name}}" });
  assert.equal(lookup(c, "Avoid using logical databases"), null);
  assert.equal(lookup(c, "12 databases"), "12 个数据库");
  assert.equal(lookup(c, "5 of 5"), "5 / 5");
  assert.equal(lookup(c, "1,024 of 2,048"), "1,024 / 2,048");
  assert.equal(lookup(c, "Hello Redis Cloud"), "你好 Redis Cloud");
});

test("上下文规则:拼接句里的短词按位置翻译,单独出现时不动", () => {
  const mod = { exports: {} };
  loadZh(mod);
  const { context } = mod.exports;
  // 用 nodeValue / nodeType / 兄弟指针模拟一串文本节点,逐个套用规则(与钩子按文档顺序处理一致)
  const run = (parts) => {
    const nodes = parts.map((p) => (typeof p === "string" ? { nodeType: 3, nodeValue: p } : { nodeType: 1, textContent: p.el, childNodes: [] }));
    nodes.forEach((n, i) => { n.previousSibling = nodes[i - 1] || null; n.nextSibling = nodes[i + 1] || null; });
    for (const n of nodes) if (n.nodeType === 3) { const z = context(n, n.nodeValue); if (z != null) n.nodeValue = z; }
    return nodes.map((n) => (n.nodeType === 3 ? n.nodeValue : n.textContent)).join("");
  };
  assert.equal(run(["1", " of ", "17"]), "1 / 17");
  assert.equal(run(["of"]), "of");
  assert.equal(run(["(", "0", " entries", ")"]), "(0 条)");
  assert.equal(run(["您即将推送 ", "3", " element", "s", " 到…"]), "您即将推送 3 个元素 到…");
  assert.equal(run(["已成功添加 ", "3", " database(s)", ". "]), "已成功添加 3 个数据库。");
  assert.equal(run(["涉及 ", "2", " ", "subscriptions", ". "]), "涉及 2 个订阅。");
  assert.equal(run([{ el: "3" }, " Element(s)"]), "3 个元素");
  assert.equal(run(["将被移除，来源：", "list", " of", " ", { el: "mykey" }]), "将被移除，来源：List 键 mykey");
  assert.equal(run(["s"]), "s");
  assert.equal(run(["my list", "."]), "my list.");
  // from:只在「N 条」后面的 span 里
  const prevT = { nodeType: 3, nodeValue: " 条" };
  const span = { nodeType: 1, previousSibling: prevT };
  const from = { nodeType: 3, nodeValue: " from  ", previousSibling: null, parentNode: span };
  assert.equal(context(from, from.nodeValue), "，起始于 ");
  assert.equal(context({ nodeType: 3, nodeValue: "from", previousSibling: null, parentNode: { previousSibling: null } }, "from"), null);
});

test("数据库模块列表:名称后面跟 \" \" \"v.\" 时保持英文", () => {
  const mod = { exports: {} };
  loadZh(mod);
  const { keepOriginal } = mod.exports;
  const mk = (vals) => { const ns = vals.map((v) => ({ nodeType: 3, nodeValue: v })); ns.forEach((n, i) => { n.nextSibling = ns[i + 1] || null; }); return ns; };
  assert.equal(keepOriginal(mk(["Time Series", " ", "v.", "8.6.12"])[0]), true);
  assert.equal(keepOriginal(mk(["Time Series"])[0]), false);
  assert.equal(keepOriginal(mk(["Probabilistic", " ", "可选"])[0]), false);
});

test("按父元素 data-testid:自动刷新的 now → 刚刚,别处的 now 不动", () => {
  const mod = { exports: {} };
  loadZh(mod);
  const { context } = mod.exports;
  const el = (id) => ({ nodeType: 1, getAttribute: (a) => (a === "data-testid" ? id : null) });
  const txt = (v, par) => ({ nodeType: 3, nodeValue: v, parentNode: par, previousSibling: null, nextSibling: null });
  assert.equal(context(txt(" now", el("slowlog-refresh-message")), " now"), " 刚刚");
  assert.equal(context(txt("now", el("refresh-message")), "now"), "刚刚");
  assert.equal(context(txt("now", el("key-value")), "now"), null);
  assert.equal(context(txt("now", { nodeType: 1, getAttribute: () => null }), "now"), null);
});

test("刷新提示框:标题「上次刷新」后面的 now → 刚刚", () => {
  const mod = { exports: {} };
  loadZh(mod);
  const { context } = mod.exports;
  const noParent = { nodeType: 1, getAttribute: () => null };
  const mk = (title) => ({ nodeType: 3, nodeValue: "now", parentNode: noParent, previousSibling: { nodeType: 1, textContent: title } });
  assert.equal(context(mk("Last Refresh"), "now"), "刚刚");
  assert.equal(context(mk("上次刷新"), "now"), "刚刚");
  assert.equal(context(mk("Status"), "now"), null);
});
