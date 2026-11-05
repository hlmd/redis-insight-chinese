// src/inject.js
// 渲染进程注入:把钩子 ri-chinese.js(前置内嵌字典)写到 dist/renderer/,并在 index.html 加一行 <script> 引用。
// 钩子只在渲染出的 DOM 上把英文文本/属性替换成目标语言,不改任何应用代码。
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export const RENDERER_FILE = "ri-chinese.js";
const SCRIPT_TAG = `<script src="./${RENDERER_FILE}"></script>`;

// 近似 lodash startCase:按非字母数字与驼峰拆词、首字母大写、空格连接("JSONPath" → "JSON Path")
export function startCase(s) {
  return String(s).split(/[^A-Za-z0-9]+/)
    .flatMap((w) => w.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|[0-9]+/g) || [])
    .map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

// 教程页把目录名做了 startCase(返回按钮)与 startCase().toUpperCase()(页标题),给目录词条补上这些写法
// 变体正好撞上 Redis 数据类型名 / 模块名时不生成:"Time series" 的 startCase 是 "Time Series",
// 而键类型筛选、数据库模块列表里的 "Time Series" 要保留英文
const KEEP_ENGLISH = new Set([
  "Hash", "List", "Set", "Sorted Set", "String", "Stream", "JSON", "Vector Set", "Array",
  "Time Series", "TimeSeries", "Probabilistic", "Graph", "Bloom Filter", "Cuckoo Filter",
].flatMap((s) => [s, s.toUpperCase()]));

export function withCaseVariants(dict) {
  const out = {};
  for (const [en, zh] of Object.entries(dict || {})) {
    if (!zh || zh === en) continue;
    const sc = startCase(en);
    for (const k of [sc, sc.toUpperCase(), en.toUpperCase()]) if (k && !(k in out) && !KEEP_ENGLISH.has(k)) out[k] = zh;
  }
  return { ...out, ...dict };
}

function clean(dict) {
  const out = {};
  for (const k of Object.keys(dict || {})) {
    const v = dict[k];
    if (v && v !== k) out[k] = v;
  }
  return out;
}

// 生成注入脚本内容:内嵌字典(仅保留有译文的条目)+ 钩子源码。
// tutorials = { markdown: {段落: 译文} } 与 mdSrc(md-segments.cjs 源码)同时给出时一并内联,
// 钩子据此在教程 .md 加载时按段落替换正文。fragments 为拼接句短词规则,lang 写到 <html lang>。
export function buildInjectScript(dict, hookSrc, { tutorials, mdSrc, fragments, lang } = {}) {
  let head = "var __RI_DICT__ = " + JSON.stringify(clean(dict)) + ";\n";
  if (fragments && typeof fragments === "object") head += "var __RI_FRAGMENTS__ = " + JSON.stringify(fragments) + ";\n";
  if (lang) head += "var __RI_LANG__ = " + JSON.stringify(String(lang)) + ";\n";
  const md = clean(tutorials && tutorials.markdown);
  if (mdSrc && Object.keys(md).length) {
    head += "var __RI_TUTORIALS__ = " + JSON.stringify(md) + ";\n" + mdSrc + "\n";
  }
  return head + hookSrc;
}

// 幂等:已注入过则不重复插入 <script>(但仍用最新字典覆盖脚本)。
export function injectInto(rootDir, dict, hookSrc, extra = {}) {
  const rendererDir = join(rootDir, "dist", "renderer");
  const htmlPath = join(rendererDir, "index.html");
  const scriptPath = join(rendererDir, RENDERER_FILE);
  if (!existsSync(htmlPath)) {
    throw new Error("未找到 index.html: " + htmlPath);
  }

  const entries = Object.keys(dict).filter((k) => dict[k] && dict[k] !== k).length;
  writeFileSync(scriptPath, buildInjectScript(dict, hookSrc, extra));
  const tutorials = extra.mdSrc ? Object.keys(clean(extra.tutorials && extra.tutorials.markdown)).length : 0;

  let html = readFileSync(htmlPath, "utf8");
  let tagAdded = false;
  if (!html.includes(SCRIPT_TAG)) {
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

  return { scriptPath, htmlPath, entries, tutorials, tagAdded };
}
