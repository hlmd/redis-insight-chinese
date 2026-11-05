/*
 * ri-main-cn.js —— Redis Insight 主进程汉化钩子(原生菜单 / 原生对话框)
 *
 * 顶部菜单栏(Window / View / Help)、托盘菜单、右键菜单与原生对话框都由主进程用 Electron
 * 原生 API 绘制,不在 DOM 里,渲染进程钩子 ri-chinese.js 够不着。
 * 本钩子由 redis-insight-chinese 写到 dist/main/ri-main-cn.js,并在主进程入口 main.js 最前面插一行 require,包装:
 *   - Menu.buildFromTemplate:递归复制并翻译模板里的 label / sublabel / toolTip(不改原模板);
 *   - dialog.showMessageBox / showMessageBoxSync / showErrorBox:翻译标题、正文与按钮。
 *
 * 词典为扁平 {英文: 中文},从同目录的 ri-main-data.json 读(源自 locales/main/zh-CN.json)。
 * 整串精确匹配(保留前后空白);键里可含 {{name}} 占位,如 "About {{appName}}"。
 * 菜单助记符 & 会先剥掉再查词典,译文后补成「窗口(&W)」形式,Alt 快捷键保持可用。
 *
 * 仓库里以 .cjs 存放(仓库 package.json 是 ESM),写入 asar 时改名为 .js(应用是 CommonJS)。
 */
'use strict';

var WS_RE = /^(\s*)([\s\S]*?)(\s*)$/;
var PH_RE = /\{\{\s*(\w+)\s*\}\}/g;

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// 纯函数:把词典编译成 { exact, templates },templates 为含 {{占位}} 的键
function compile(dict) {
  var exact = Object.create(null);
  var templates = [];
  Object.keys(dict || {}).forEach(function (en) {
    var zh = dict[en];
    if (typeof zh !== 'string' || !zh) return;
    if (/\{\{\s*\w+\s*\}\}/.test(en)) {
      var names = [];
      var src = '^' + en.split(PH_RE).map(function (part, i) {
        if (i % 2) { names.push(part); return '([\\s\\S]*?)'; }
        return escapeRe(part);
      }).join('') + '$';
      templates.push({ re: new RegExp(src), names: names, zh: zh });
    } else {
      exact[en] = zh;
    }
  });
  return { exact: exact, templates: templates };
}

// 纯函数:整串翻译,保留前后空白;无匹配返回原值
function translateString(c, value) {
  if (typeof value !== 'string' || !value) return value;
  var m = WS_RE.exec(value);
  var core = m[2];
  if (!core) return value;
  if (Object.prototype.hasOwnProperty.call(c.exact, core)) return m[1] + c.exact[core] + m[3];
  for (var i = 0; i < c.templates.length; i++) {
    var t = c.templates[i];
    var hit = t.re.exec(core);
    if (!hit) continue;
    var vals = {};
    t.names.forEach(function (n, j) { vals[n] = hit[j + 1]; });
    return m[1] + t.zh.replace(PH_RE, function (all, n) { return n in vals ? vals[n] : all; }) + m[3];
  }
  return value;
}

// 纯函数:翻译菜单 label。剥掉单个 & 助记符(&& 是字面量 &)查词典,命中后补成「中文(&X)」
function translateLabel(c, label) {
  if (typeof label !== 'string' || label.indexOf('&') === -1) return translateString(c, label);
  var key = '', mn = '';
  for (var i = 0; i < label.length; i++) {
    var ch = label[i];
    if (ch === '&') {
      if (label[i + 1] === '&') { key += '&&'; i++; continue; }
      if (!mn && i + 1 < label.length) mn = label[i + 1].toUpperCase();
      continue;
    }
    key += ch;
  }
  var z = translateString(c, key);
  if (z === key) return label;
  return mn ? z + '(&' + mn + ')' : z;
}

var MENU_KEYS = ['sublabel', 'toolTip'];

// 纯函数:递归复制并翻译菜单模板(submenu 可能是 Menu 实例,原样保留)
function translateTemplate(c, template) {
  if (!Array.isArray(template)) return template;
  return template.map(function (item) {
    if (!item || typeof item !== 'object') return item;
    var out = Object.assign({}, item);
    if (typeof out.label === 'string') out.label = translateLabel(c, out.label);
    MENU_KEYS.forEach(function (k) { if (typeof out[k] === 'string') out[k] = translateString(c, out[k]); });
    if (Array.isArray(out.submenu)) out.submenu = translateTemplate(c, out.submenu);
    return out;
  });
}

var BOX_KEYS = ['title', 'message', 'detail', 'checkboxLabel'];

// 纯函数:复制并翻译 showMessageBox 的 options
function translateBoxOptions(c, opts) {
  if (!opts || typeof opts !== 'object') return opts;
  var out = Object.assign({}, opts);
  BOX_KEYS.forEach(function (k) { if (typeof out[k] === 'string') out[k] = translateString(c, out[k]); });
  if (Array.isArray(out.buttons)) out.buttons = out.buttons.map(function (b) { return translateLabel(c, b); });
  return out;
}

// showMessageBox([window, ]options):options 是最后一个参数
function wrapBox(c, fn) {
  return function () {
    var args = Array.prototype.slice.call(arguments);
    var i = args.length - 1;
    if (i >= 0) args[i] = translateBoxOptions(c, args[i]);
    return fn.apply(this, args);
  };
}

function install(electron, dict) {
  var c = compile(dict);
  var Menu = electron.Menu;
  if (Menu && typeof Menu.buildFromTemplate === 'function' && !Menu.buildFromTemplate.__riCn) {
    var orig = Menu.buildFromTemplate;
    var wrapped = function (template) { return orig.call(this, translateTemplate(c, template)); };
    wrapped.__riCn = true;
    Menu.buildFromTemplate = wrapped;
  }
  var dialog = electron.dialog;
  if (dialog) {
    ['showMessageBox', 'showMessageBoxSync'].forEach(function (name) {
      if (typeof dialog[name] === 'function' && !dialog[name].__riCn) {
        var w = wrapBox(c, dialog[name]);
        w.__riCn = true;
        dialog[name] = w;
      }
    });
    if (typeof dialog.showErrorBox === 'function' && !dialog.showErrorBox.__riCn) {
      var origErr = dialog.showErrorBox;
      var e = function (title, content) { return origErr.call(this, translateString(c, title), content); };
      e.__riCn = true;
      dialog.showErrorBox = e;
    }
  }
  return c;
}

module.exports = {
  compile: compile,
  translateString: translateString,
  translateLabel: translateLabel,
  translateTemplate: translateTemplate,
  translateBoxOptions: translateBoxOptions,
  install: install,
};

// 在 Electron 主进程里被 require 时自动安装
if (process.versions && process.versions.electron && process.type === 'browser') {
  try {
    var dict = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'ri-main-data.json'), 'utf8'));
    install(require('electron'), dict);
  } catch (err) {
    console.error('[ri-main-cn] load failed', err);
  }
}
