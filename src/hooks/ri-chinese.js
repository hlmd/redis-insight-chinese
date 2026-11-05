/*
 * ri-chinese.js —— Redis Insight 渲染进程本地化钩子(运行时 DOM 注入)
 *
 * 由 redis-insight-chinese 写入 app.asar 的 dist/renderer/,并在 index.html 里用 <script> 引用。
 * 注入时会在本文件前面加几行全局变量:
 *   __RI_DICT__       页面词典(locales/<语言>/renderer.json 等合并而成)
 *   __RI_FRAGMENTS__  拼接句短词的上下文规则(locales/<语言>/fragments.json,可缺)
 *   __RI_LANG__       语言代码,写到 <html lang>(中日韩共用汉字的字形按它选)
 *   __RI_TUTORIALS__  教程段落词典(可缺)
 * 只做「整段文本节点精确匹配」与「指定属性精确匹配」,不改任何应用代码,不会误伤部分单词。
 * 键里可含 {{name}} 占位(对应 i18next 插值,如 "Delete {{count}} keys"),匹配时占位视作任意文本并代入译文。
 */
(function () {
  var DICT = (typeof __RI_DICT__ !== "undefined") ? __RI_DICT__ : {};
  var FRAG = (typeof __RI_FRAGMENTS__ !== "undefined" && __RI_FRAGMENTS__) ? __RI_FRAGMENTS__ : {};
  var LANG = (typeof __RI_LANG__ !== "undefined") ? __RI_LANG__ : "";
  var ATTRS = ["placeholder", "title", "aria-label", "alt", "label"];
  var PH_RE = /\{\{\s*(\w+)\s*\}\}/g;
  var NUM_PH_RE = /^(count|total|amount|percentage|percent|days|hours|minutes|seconds|processed|clients|(num|max|min)\w*)$/i;

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // 纯函数:词典编译成 { exact, templates };模板带最长字面片段 anchor,先 indexOf 粗筛再跑正则
  function compile(dict) {
    var exact = Object.create(null);
    var templates = [];
    Object.keys(dict || {}).forEach(function (en) {
      var zh = dict[en];
      if (typeof zh !== "string" || !zh || zh === en) return;
      if (/\{\{\s*\w+\s*\}\}/.test(en)) {
        var names = [];
        var anchor = "";
        var src = "^" + en.split(PH_RE).map(function (part, i) {
          // 数量类占位只匹配数字,否则 "{{count}} databases" 会把 "Avoid using logical databases" 也吞掉
          if (i % 2) { names.push(part); return NUM_PH_RE.test(part) ? "([-+~]?\\d[\\d.,\\s]*[KMBkmb%]?)" : "([\\s\\S]+?)"; }
          if (part.length > anchor.length) anchor = part;
          return escapeRe(part);
        }).join("") + "$";
        templates.push({ re: new RegExp(src), names: names, zh: zh, anchor: anchor });
      } else {
        exact[en] = zh;
      }
    });
    return { exact: exact, templates: templates };
  }

  // 纯函数:整段翻译(已 trim 的文本),无匹配返回 null
  function lookup(c, t) {
    if (Object.prototype.hasOwnProperty.call(c.exact, t)) return c.exact[t];
    var collapsed = t.replace(/\s+/g, " ");
    if (collapsed !== t && Object.prototype.hasOwnProperty.call(c.exact, collapsed)) return c.exact[collapsed];
    for (var i = 0; i < c.templates.length; i++) {
      var tp = c.templates[i];
      if (tp.anchor && collapsed.indexOf(tp.anchor) === -1) continue;
      var hit = tp.re.exec(collapsed);
      if (!hit) continue;
      var vals = {};
      for (var j = 0; j < tp.names.length; j++) vals[tp.names[j]] = hit[j + 1];
      return tp.zh.replace(PH_RE, function (all, n) { return n in vals ? vals[n] : all; });
    }
    return null;
  }

  var C = compile(DICT);
  function tr(s) {
    if (s == null) return null;
    s = "" + s;
    var t = s.trim();
    if (!t || !/[A-Za-z]/.test(t)) return null;
    var z = lookup(C, t);
    if (z == null || z === "") return null;
    var lead = s.match(/^\s*/)[0];
    var trail = s.match(/\s*$/)[0];
    return lead + z + trail;
  }

  // ---- 上下文规则:JSX 拼接出来的短词片段 ----
  // 这些词("of"、"entries"、"s"……)太短,全局收录会误改用户数据;只在拼接句里固定的位置上替换。
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  var NUM_RE = /^\s*\d[\d,.]*\s*$/;
  // 数字节点:纯数字文本,或只含数字的元素(如 <b>3</b>)
  function isNum(n) {
    if (!n) return false;
    if (n.nodeType === 3) return NUM_RE.test(n.nodeValue);
    return n.nodeType === 1 && NUM_RE.test(n.textContent || "");
  }
  function isBlank(n) { return !!n && n.nodeType === 3 && /^\s*$/.test(n.nodeValue); }
  function textOf(n) { return n && n.nodeType === 3 ? n.nodeValue.trim() : null; }
  // 前面是数字(中间允许隔一个空格节点):"3" " element" / "3" " " "subscriptions"
  function afterNum(node) {
    var p = node.previousSibling;
    return isNum(p) || (isBlank(p) && isNum(p.previousSibling));
  }

  // 以下各表来自 fragments.json;某语言没有对应规则时就是空表,页面上保留那个英文短词
  function obj(v) { return v && typeof v === "object" ? v : {}; }
  function str(v) { return typeof v === "string" ? v : null; }
  // 夹在两个数字之间:引导步骤 "1" " of " "17"
  var BETWEEN_NUMBERS = obj(FRAG.betweenNumbers);
  // 紧跟数字的量词:"3" " entries"
  var AFTER_NUMBER = obj(FRAG.afterNumber);
  var QUANTITY = {};
  for (var qk in AFTER_NUMBER) if (has(AFTER_NUMBER, qk)) { QUANTITY[AFTER_NUMBER[qk]] = 1; QUANTITY[qk] = 1; }
  // 量词后面的句末标点 / 复数后缀
  var AFTER_QUANTITY = obj(FRAG.afterQuantity);
  // 词典里某英文的译文(上下文规则要认出已先被翻译过的相邻节点)
  function dictVal(en) { var v = DICT[en]; return typeof v === "string" && v ? v : null; }
  function set() { var o = {}; for (var i = 0; i < arguments.length; i++) if (arguments[i]) o[arguments[i]] = 1; return o; }
  var NOW = str(FRAG.now);
  var LAST_REFRESH = set("Last Refresh", dictVal("Last Refresh"));
  var SLOWLOG_FROM = str(FRAG.slowlogFrom);
  var ENTRIES = set("entries", "entry", AFTER_NUMBER.entries, AFTER_NUMBER.entry);
  // 键详情删除提示:"will be removed from the " + 类型(小写) + " of" + " " + <b>键名</b>
  var REMOVE_FROM = set("will be removed from the", dictVal("will be removed from the"));
  var KEY_OF = str(FRAG.removeFromKeyOf);
  var TYPE_NAMES = { "list": "List", "hash": "Hash", "set": "Set", "zset": "Sorted Set", "sorted set": "Sorted Set", "stream": "Stream", "json": "JSON" };
  var TYPE_SEEN = {};
  for (var tk in TYPE_NAMES) if (has(TYPE_NAMES, tk)) { TYPE_SEEN[tk] = 1; TYPE_SEEN[TYPE_NAMES[tk]] = 1; }

  // 保持英文的位置:数据库模块列表 名称, " ", "v.", 版本号 —— 模块名(Time Series、Probabilistic…)不翻
  function keepOriginal(node) {
    var n1 = node.nextSibling, n2 = n1 && n1.nextSibling;
    return isBlank(n1) && textOf(n2) === "v.";
  }

  // 按父元素 data-testid 定位的短词:自动刷新的「上次刷新: now」(slowlog-refresh-message、*-refresh-message)
  var BY_PARENT_TESTID = NOW ? [
    { re: /refresh-message$/, map: { "now": NOW } },
  ] : [];
  function byParent(node, t) {
    var par = node.parentNode;
    var id = par && par.getAttribute ? par.getAttribute("data-testid") || "" : "";
    if (!id) return null;
    for (var i = 0; i < BY_PARENT_TESTID.length; i++) {
      if (BY_PARENT_TESTID[i].re.test(id) && has(BY_PARENT_TESTID[i].map, t)) return BY_PARENT_TESTID[i].map[t];
    }
    return null;
  }

  function context(node, v) {
    var t = v.trim();
    if (!t) return null;
    var bp = byParent(node, t);
    if (bp != null) return v.replace(t, bp);
    var prev = node.previousSibling;
    // 刷新按钮悬停提示:<Title>Last Refresh</Title> 后面紧跟的 "now"(标题可能已先被译成「上次刷新」)
    if (t === "now" && NOW && prev && prev.nodeType === 1 && has(LAST_REFRESH, (prev.textContent || "").trim())) return v.replace(t, NOW);
    if (has(BETWEEN_NUMBERS, t) && isNum(prev) && isNum(node.nextSibling)) return " " + BETWEEN_NUMBERS[t] + " ";
    if (has(AFTER_NUMBER, t) && afterNum(node)) return (isBlank(prev) ? "" : " ") + AFTER_NUMBER[t];
    if (has(AFTER_QUANTITY, t) && prev && has(QUANTITY, textOf(prev) || "")) {
      // "s" 必须紧贴在量词后、且量词前面是数字,才是复数后缀
      if (t === "s" && !afterNum(prev)) return null;
      return AFTER_QUANTITY[t];
    }
    // 慢查询日志 "(", 5, " entries", <span> from  </span>, <时间>, ")"
    if (t === "from") {
      var par = node.parentNode;
      if (SLOWLOG_FROM && par && !prev && par.previousSibling && has(ENTRIES, textOf(par.previousSibling) || "")) return SLOWLOG_FROM;
      return null;
    }
    if (has(TYPE_NAMES, t) && prev && has(REMOVE_FROM, textOf(prev) || "")) return TYPE_NAMES[t];
    if (t === "of" && KEY_OF && prev && has(TYPE_SEEN, textOf(prev) || "") && prev.previousSibling && has(REMOVE_FROM, textOf(prev.previousSibling) || "")) return KEY_OF;
    return null;
  }
  // 测试环境(无 DOM)只导出纯函数
  if (typeof document === "undefined") {
    if (typeof module !== "undefined" && module.exports) module.exports = { compile: compile, lookup: lookup, tr: tr, context: context, keepOriginal: keepOriginal };
    return;
  }

  // 教程正文:Redis Insight 用 axios(XHR)取 static/tutorials/**.md,渲染前按段落替换 Markdown 源文本。
  // 段落词典 __RI_TUTORIALS__ 与切分器 __RI_MD__(md-segments.cjs)由注入器内联在本文件前面。
  var TUT = (typeof __RI_TUTORIALS__ !== "undefined") ? __RI_TUTORIALS__ : null;
  var MD = (typeof __RI_MD__ !== "undefined") ? __RI_MD__ : null;
  var TUT_URL_RE = /(^|\/)static\/tutorials\/.*\.md([?#]|$)/i;
  if (TUT && MD && typeof XMLHttpRequest !== "undefined" && Object.keys(TUT).length) {
    try {
      var XP = XMLHttpRequest.prototype;
      var dText = Object.getOwnPropertyDescriptor(XP, "responseText");
      var dResp = Object.getOwnPropertyDescriptor(XP, "response");
      var origOpen = XP.open;
      XP.open = function (method, url) {
        var xhr = this;
        if (dText && dResp && TUT_URL_RE.test(String(url))) {
          var cache = null;
          var zh = function (v) {
            if (xhr.readyState !== 4 || typeof v !== "string" || xhr.status < 200 || xhr.status >= 300) return v;
            if (cache === null || cache.src !== v) {
              var r = v;
              try { r = MD.translate(v, TUT).text; } catch (e) { /* 出错保持原文 */ }
              cache = { src: v, out: r };
            }
            return cache.out;
          };
          Object.defineProperty(xhr, "responseText", { configurable: true, get: function () { return zh(dText.get.call(xhr)); } });
          Object.defineProperty(xhr, "response", { configurable: true, get: function () { return zh(dResp.get.call(xhr)); } });
        }
        return origOpen.apply(this, arguments);
      };
    } catch (e) { /* 拦截失败不影响界面翻译 */ }
  }

  function doText(node) {
    var v = node.nodeValue;
    if (!v) return;
    // 上下文规则优先:"database(s)" 这类词在词典里有通用译法,跟在数字后面时要换成带量词的说法
    if (keepOriginal(node)) return;
    var z = context(node, v);
    if (z == null) z = tr(v);
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
    if (LANG) { try { document.documentElement.setAttribute("lang", LANG); } catch (e) { /* ignore */ } }
    walk(document.body || document.documentElement);
    observer = new MutationObserver(onMut);
    observer.observe(document.documentElement, OBS_OPTS);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
