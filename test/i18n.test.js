// test/i18n.test.js —— 语言探测、非中文语言的片段规则与菜单助记符
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join } from "path";
import { createRequire } from "module";
import { normalizeLang, detectLang, resolveLang, LANGUAGES } from "../src/i18n.js";
import { buildInjectScript } from "../src/inject.js";

const require = createRequire(import.meta.url);
const HOOK = readFileSync(join(import.meta.dirname, "..", "src", "hooks", "ri-chinese.js"), "utf8");
const MAIN = require("../src/hooks/ri-main-cn.cjs");

test("normalizeLang:各种写法归一到支持的语言", () => {
  const cases = {
    "zh_CN.UTF-8": "zh-CN", zh: "zh-CN", "zh-Hans-CN": "zh-CN", "zh-SG": "zh-CN",
    "zh_TW.UTF-8": "zh-TW", "zh-HK": "zh-TW", "zh-Hant": "zh-TW", "zh-Hant-MO": "zh-TW",
  };
  for (const [tag, want] of Object.entries(cases)) assert.equal(normalizeLang(tag), want, tag);
  for (const tag of ["C", "POSIX", "C.UTF-8", "en_US.UTF-8", "ja_JP.UTF-8", "ko-KR", "de_DE@euro", "fr-CA", "pt-BR", "ru_RU.UTF-8", "", null, "xx"]) assert.equal(normalizeLang(tag), null, String(tag));
});

test("detectLang:RI_LANG > LC_ALL/LANG > AppleLanguages > Intl > 默认", () => {
  assert.equal(detectLang({ env: { RI_LANG: "zh-TW", LANG: "zh_CN.UTF-8" }, intlLocale: "zh-CN" }).lang, "zh-TW");
  assert.equal(detectLang({ env: { LANG: "zh_HK.UTF-8" }, intlLocale: "zh-CN" }).lang, "zh-TW");
  // LANG 是英文 / C / 不支持的语言时跳过,继续看后面的来源
  assert.equal(detectLang({ env: { LANG: "en_US.UTF-8" }, intlLocale: "zh-TW" }).lang, "zh-TW");
  assert.equal(detectLang({ env: { LANG: "ja_JP.UTF-8" }, intlLocale: "ja-JP" }).lang, "zh-CN");
  assert.equal(detectLang({ env: {}, platform: "darwin", appleLanguages: ["zh-Hant-TW", "en"], intlLocale: "en-US" }).lang, "zh-TW");
  assert.equal(detectLang({ env: {}, platform: "linux", intlLocale: "en-US" }).lang, "zh-CN");
});

test("resolveLang:--lang 优先,不支持的语言报错", () => {
  assert.deepEqual(resolveLang("zh-CN", { env: { LANG: "zh_TW" } }), { lang: "zh-CN", from: "--lang" });
  assert.equal(resolveLang("zh-tw").lang, "zh-TW");
  assert.throws(() => resolveLang("klingon"), /不支持的语言/);
  assert.throws(() => resolveLang("ja"), /不支持的语言/);
  assert.deepEqual(Object.keys(LANGUAGES), ["zh-CN", "zh-TW"]);
});

function loadHook(dict, fragments) {
  const mod = { exports: {} };
  new Function("module", "__RI_DICT__", "__RI_FRAGMENTS__", HOOK)(mod, dict, fragments);
  return mod.exports;
}
const chain = (context, parts) => {
  const nodes = parts.map((p) => ({ nodeType: 3, nodeValue: p }));
  nodes.forEach((n, i) => { n.previousSibling = nodes[i - 1] || null; n.nextSibling = nodes[i + 1] || null; });
  for (const n of nodes) { const z = context(n, n.nodeValue); if (z != null) n.nodeValue = z; }
  return nodes.map((n) => n.nodeValue).join("");
};

test("片段规则按语言数据生效;没有规则的语言保留英文短词", () => {
  const de = loadHook({}, { betweenNumbers: { of: "von" }, afterNumber: { entries: "Einträge" }, afterQuantity: { s: "" } });
  assert.equal(chain(de.context, ["1", " of ", "17"]), "1 von 17");
  assert.equal(chain(de.context, ["3", " ", "entries"]), "3 Einträge");
  const none = loadHook({}, null);
  assert.equal(chain(none.context, ["1", " of ", "17"]), "1 of 17");
  assert.equal(chain(none.context, ["3", " ", "entries"]), "3 entries");
});

test("注入脚本带上片段规则与语言代码", () => {
  const s = buildInjectScript({ Save: "Speichern" }, "/*hook*/", { fragments: { now: "jetzt" }, lang: "de" });
  assert.ok(s.includes('var __RI_FRAGMENTS__ = {"now":"jetzt"};'));
  assert.ok(s.includes('var __RI_LANG__ = "de";'));
  assert.ok(!buildInjectScript({}, "", {}).includes("__RI_LANG__"));
});

test("菜单助记符:中日韩补 (&X),拉丁 / 西里尔字母插在同一字母前,译文自带 & 时原样用", () => {
  const c = MAIN.compile({ Window: "ウィンドウ", Edit: "Bearbeiten", Help: "Справка", Quit: "&Beenden", View: "보기" });
  assert.equal(MAIN.translateLabel(c, "&Window"), "ウィンドウ(&W)");
  assert.equal(MAIN.translateLabel(c, "&View"), "보기(&V)");
  assert.equal(MAIN.translateLabel(c, "&Edit"), "B&earbeiten");
  assert.equal(MAIN.translateLabel(c, "&Help"), "&Справка");
  assert.equal(MAIN.translateLabel(c, "&Quit"), "&Beenden");
  assert.equal(MAIN.translateLabel(c, "Window"), "ウィンドウ");
});
