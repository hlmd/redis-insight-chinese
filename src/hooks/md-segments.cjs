/*
 * md-segments.cjs —— 教程 Markdown 的「段落切分 + 按段替换」(纯函数,ES5,浏览器 / Node 通用)
 *
 * 教程正文(~/.redis-insight/tutorials/**.md)由 Redis Insight 运行时从 GitHub 下载,渲染时内联格式
 * (加粗、`代码`、链接)会把一段话拆成很多文本节点,DOM 整段匹配翻不了。所以在内容加载进来时、
 * 渲染之前,按「段落」整段替换 Markdown 源文本。
 *
 * 切分规则(无损:各段 s 依次拼接 === 原文):
 *   - 围栏代码块(``` / ~~~)整块原样保留,不翻;
 *     但 ```redis[:[参数]] 按钮文字 的「按钮文字」是界面上的运行按钮,单独作为一个可翻译段;
 *     Redis 命令块里每行 // 之后的注释文字也单独成段(Workbench 执行前会剥掉注释,翻译不影响运行);
 *   - 围栏外,连续的非空行组成一个段落(标题、列表、表格、引用都按块整体),作为可翻译段;
 *     不含英文字母的、只有图片的段落不翻。
 *   - 段落 key 去掉 \r;替换时整段换成译文。
 *
 * 同一份源码三处共用:注入器把它内联进 ri-chinese.js(浏览器全局 __RI_MD__);
 * redis-insight-locale-fetcher 的 tutorials.js 用 require 提取段落;注入器测试用 createRequire。
 */
(function (root, factory) {
  var m = factory();
  // 两处都给:渲染进程即便开了 nodeIntegration(有 module)也要挂全局,钩子按全局名取
  if (typeof module === "object" && module && module.exports) module.exports = m;
  if (root) root.__RI_MD__ = m;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var FENCE_RE = /^[ \t]*(`{3,}|~{3,})/;
  var RUN_LABEL_RE = /^([ \t]*`{3,}redis(?::\[[^\]]*\])?[ \t]+)(\S(?:.*\S)?)([ \t]*)$/;

  function splitLines(text) {
    var out = [], i = 0;
    while (i < text.length) {
      var j = text.indexOf("\n", i);
      if (j === -1) { out.push(text.slice(i)); break; }
      out.push(text.slice(i, j + 1));
      i = j + 1;
    }
    return out;
  }
  function body(line) { return line.replace(/\r?\n$/, ""); }
  function eol(line) { var m = line.match(/\r?\n$/); return m ? m[0] : ""; }
  function isBlank(line) { return /^[ \t]*\r?\n?$/.test(line); }

  // 与 Workbench 剥注释的规则一致(ui/src/utils/monaco/monacoUtils.ts removeCommentsFromLine):
  // 第一个前面 ' " ` 都成对的 // 起算注释;另外要求 // 位于行首或空白之后,避开 URL 里的 //
  function commentStart(b) {
    var from = 0;
    for (;;) {
      var at = b.indexOf("//", from);
      if (at === -1) return -1;
      var before = b.slice(0, at);
      var even = ["'", '"', "`"].every(function (q) { return (before.split(q).length - 1) % 2 === 0; });
      if (even) return (at === 0 || /\s/.test(b[at - 1])) ? at : -1;
      from = at + 2;
    }
  }

  function translatable(s) {
    var rest = s.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/<[^>]+>/g, "");
    return /[A-Za-z]/.test(rest);
  }

  // -> [{ t: true|false, s: "原文片段" }],t 表示可翻译;拼接所有 s 即原文
  function segment(text) {
    var lines = splitLines(String(text));
    var segs = [];
    function raw(s) {
      if (!s) return;
      var last = segs[segs.length - 1];
      if (last && !last.t) last.s += s; else segs.push({ t: false, s: s });
    }
    function para(s) {
      if (translatable(s)) segs.push({ t: true, s: s }); else raw(s);
    }
    // 代码行:// 之后的注释文字单独成段,代码与 // 的位置原样保留
    function codeLine(l) {
      var b = body(l), at = commentStart(b);
      if (at === -1) { raw(l); return; }
      var m = b.slice(at + 2).match(/^([ \t]*)([\s\S]*?)([ \t]*)$/);
      if (!/[A-Za-z]/.test(m[2])) { raw(l); return; }
      raw(b.slice(0, at + 2) + m[1]);
      segs.push({ t: true, s: m[2] });
      raw(m[3] + eol(l));
    }
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      var fm = body(line).match(FENCE_RE);
      if (fm) {
        var mark = fm[1];
        var lm = body(line).match(RUN_LABEL_RE);
        if (lm) { raw(lm[1]); para(lm[2]); raw(lm[3] + eol(line)); } else raw(line);
        var lang = (body(line).slice(fm[0].length).match(/^\S*/) || [""])[0];
        // 只在 Redis 命令块里翻 // 注释(redis / 无语言 / 以命令名作语言);其它语言里 // 可能是运算符
        var withComments = lang === "" || /^redis\b/i.test(lang) || /^[A-Z]/.test(lang);
        i++;
        var closeRe = new RegExp("^[ \\t]*" + (mark[0] === "`" ? "`" : "~") + "{" + mark.length + ",}[ \\t]*$");
        while (i < lines.length) {
          var l = lines[i++];
          if (closeRe.test(body(l))) { raw(l); break; }
          if (withComments) codeLine(l); else raw(l);
        }
        continue;
      }
      if (isBlank(line)) { raw(line); i++; continue; }
      var start = i;
      while (i < lines.length && !isBlank(lines[i]) && !FENCE_RE.test(body(lines[i]))) i++;
      var block = lines.slice(start, i).join("");
      var tail = eol(lines[i - 1]);
      para(block.slice(0, block.length - tail.length));
      raw(tail);
    }
    return segs;
  }

  function key(s) { return s.replace(/\r/g, ""); }

  // 可翻译段的 key 列表(去重,保持出现顺序)
  function keys(text) {
    var seen = Object.create(null), out = [];
    var segs = segment(text);
    for (var i = 0; i < segs.length; i++) {
      if (!segs[i].t) continue;
      var k = key(segs[i].s);
      if (!seen[k]) { seen[k] = 1; out.push(k); }
    }
    return out;
  }

  // 按段替换;返回 { text, hit, total }
  function translate(text, dict) {
    var segs = segment(text), hit = 0, total = 0, out = "";
    for (var i = 0; i < segs.length; i++) {
      var sg = segs[i];
      if (sg.t) {
        total++;
        var zh = dict && Object.prototype.hasOwnProperty.call(dict, key(sg.s)) ? dict[key(sg.s)] : null;
        if (typeof zh === "string" && zh) {
          hit++;
          out += /\r\n/.test(sg.s) ? zh.replace(/\r?\n/g, "\r\n") : zh;
          continue;
        }
      }
      out += sg.s;
    }
    return { text: out, hit: hit, total: total };
  }

  return { segment: segment, keys: keys, translate: translate, key: key };
});
