// src/inject.js
// 运行时注入式汉化：不改任何代码，只在渲染出的 DOM 上把英文文本/属性替换成中文。
// 生成一个 zh-inject.js 注入脚本（内嵌字典），并在 index.html 里加一行 <script> 引用它。
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

// 运行时脚本主体（不含字典）。引用全局 __ZH_DICT__。
// 只做「整段文本节点精确匹配」与「指定属性精确匹配」，所以不会误伤代码或部分单词。
const RUNTIME = `(function () {
  var DICT = (typeof __ZH_DICT__ !== "undefined") ? __ZH_DICT__ : {};
  var ATTRS = ["placeholder", "title", "aria-label", "alt", "label"];
  function tr(s) {
    if (s == null) return null;
    var t = ("" + s).trim();
    if (!t) return null;
    var z = DICT[t];
    if (z == null || z === "") return null;
    var lead = s.match(/^\\s*/)[0];
    var trail = s.match(/\\s*$/)[0];
    return lead + z + trail;
  }
  function doText(node) {
    var v = node.nodeValue;
    var z = tr(v);
    if (z != null && z !== v) node.nodeValue = z;
  }
  function doAttrs(el) {
    if (!el || el.nodeType !== 1 || !el.getAttribute) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (el.hasAttribute(a)) {
        var cur = el.getAttribute(a);
        var z = tr(cur);
        if (z != null && z !== cur) el.setAttribute(a, z);
      }
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var list = [], n;
    while ((n = w.nextNode())) list.push(n);
    for (var i = 0; i < list.length; i++) doText(list[i]);
    if (root.querySelectorAll) {
      doAttrs(root);
      var els = root.querySelectorAll("*");
      for (var j = 0; j < els.length; j++) doAttrs(els[j]);
    }
  }
  var observer = null;
  var OBS_OPTS = { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS };
  function onMut(muts) {
    if (observer) observer.disconnect();
    try {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === "characterData") doText(m.target);
        else if (m.type === "attributes") doAttrs(m.target);
        else if (m.addedNodes) {
          for (var k = 0; k < m.addedNodes.length; k++) {
            var an = m.addedNodes[k];
            if (an.nodeType === 3) doText(an);
            else if (an.nodeType === 1) walk(an);
          }
        }
      }
    } finally {
      if (observer) observer.observe(document.documentElement, OBS_OPTS);
    }
  }
  function start() {
    walk(document.body || document.documentElement);
    observer = new MutationObserver(onMut);
    observer.observe(document.documentElement, OBS_OPTS);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
`;

const INJECT_MARK = "zh-inject.js";
const SCRIPT_TAG = '<script src="./zh-inject.js"></script>';

// 生成注入脚本内容：内嵌字典（仅保留有中文值的条目）+ 运行时主体。
export function buildInjectScript(dict) {
  const clean = {};
  for (const k of Object.keys(dict)) {
    const v = dict[k];
    if (v && v !== k) clean[k] = v;
  }
  return "var __ZH_DICT__ = " + JSON.stringify(clean) + ";\n" + RUNTIME;
}

// 把注入脚本写入 dist/renderer/zh-inject.js，并在 index.html 中插入 <script> 引用。
// 幂等：若已注入过则不重复插入（但仍会用最新字典覆盖 zh-inject.js）。
export function injectInto(rootDir, dict) {
  const rendererDir = join(rootDir, "dist", "renderer");
  const htmlPath = join(rendererDir, "index.html");
  const scriptPath = join(rendererDir, "zh-inject.js");
  if (!existsSync(htmlPath)) {
    throw new Error("未找到 index.html: " + htmlPath);
  }

  const entries = Object.keys(dict).filter((k) => dict[k] && dict[k] !== k).length;
  writeFileSync(scriptPath, buildInjectScript(dict));

  let html = readFileSync(htmlPath, "utf8");
  let tagAdded = false;
  if (!html.includes(INJECT_MARK)) {
    const moduleIdx = html.indexOf('<script type="module"');
    if (moduleIdx !== -1) {
      html = html.slice(0, moduleIdx) + SCRIPT_TAG + "\n    " + html.slice(moduleIdx);
    } else if (html.includes("</body>")) {
      html = html.replace("</body>", "    " + SCRIPT_TAG + "\n  </body>");
    } else {
      html = html + "\n" + SCRIPT_TAG + "\n";
    }
    writeFileSync(htmlPath, html);
    tagAdded = true;
  }

  return { scriptPath, htmlPath, entries, tagAdded };
}
