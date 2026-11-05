// src/i18n.js —— 支持的语言、系统语言探测、各语言的词典路径
//
// 词典目录:locales/<语言>/
//   renderer.json   页面文字(DOM 整段匹配)                 必需
//   main.json       原生菜单 / 对话框                       必需
//   fragments.json  拼接句里短词的上下文规则(见 ri-chinese.js) 可选
//   tutorials.json  教程 { manifest, markdown }             可选
//   content.json    远端静态内容 { dom }                    可选
//   commands.json   命令助手 { dom }                        可选
import { execFileSync } from "child_process";

// code 用 BCP 47,同时写进 <html lang>(简繁共用汉字的字形按它选)
export const LANGUAGES = {
  "zh-CN": { name: "简体中文", english: "Chinese (Simplified)" },
  "zh-TW": { name: "繁體中文", english: "Chinese (Traditional)" },
};
export const DEFAULT_LANG = "zh-CN";

export const LOCALE_KINDS = ["renderer", "main", "fragments", "tutorials", "content", "commands"];
export const REQUIRED_KINDS = ["renderer", "main"];

export const localeFile = (lang, kind) => `locales/${lang}/${kind}.json`;

// 某语言的全部数据文件(相对路径)
export function langFiles(lang) {
  return LOCALE_KINDS.map((k) => localeFile(lang, k));
}

/**
 * 把任意写法的语言标记归一成支持的代码;不支持返回 null。
 *   zh / zh-CN / zh_CN.UTF-8 / zh-Hans / zh-SG → zh-CN
 *   zh-TW / zh-HK / zh-MO / zh-Hant(-*)       → zh-TW
 *   其余语言不支持(返回 null)
 */
export function normalizeLang(tag) {
  if (!tag) return null;
  const t = String(tag).trim().replace(/[.@].*$/, "").replace(/_/g, "-").toLowerCase();
  if (!t || t === "c" || t === "posix") return null;
  const [base, ...rest] = t.split("-");
  if (base === "zh") {
    if (rest.includes("hant") || rest.some((r) => ["tw", "hk", "mo"].includes(r))) return "zh-TW";
    return "zh-CN";
  }
  const exact = Object.keys(LANGUAGES).find((c) => c.toLowerCase() === t);
  if (exact) return exact;
  return Object.keys(LANGUAGES).find((c) => c.toLowerCase() === base) || null;
}

// macOS 的界面语言不一定反映在 LANG 上(从 Finder / 双击启动时多半没有),读 AppleLanguages
function macLanguages() {
  try {
    const out = execFileSync("defaults", ["read", "-g", "AppleLanguages"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000 });
    return (out.match(/"?([A-Za-z]{2,3}(?:[-_][A-Za-z0-9]+)*)"?/g) || []).map((s) => s.replace(/"/g, ""));
  } catch {
    return [];
  }
}

/**
 * 探测系统语言,依次:RI_LANG → LC_ALL / LC_MESSAGES / LANG → (macOS)AppleLanguages → Intl。
 * 都认不出时返回 DEFAULT_LANG。返回 { lang, from }。
 */
export function detectLang({ env = process.env, platform = process.platform, intlLocale, appleLanguages } = {}) {
  const tries = [];
  if (env.RI_LANG) tries.push([env.RI_LANG, "RI_LANG"]);
  for (const k of ["LC_ALL", "LC_MESSAGES", "LANG"]) if (env[k]) tries.push([env[k], k]);
  if (platform === "darwin") for (const l of appleLanguages || macLanguages()) tries.push([l, "AppleLanguages"]);
  let intl = intlLocale;
  if (intl === undefined) { try { intl = Intl.DateTimeFormat().resolvedOptions().locale; } catch { intl = null; } }
  if (intl) tries.push([intl, "系统区域设置"]);
  for (const [tag, from] of tries) {
    const lang = normalizeLang(tag);
    if (lang) return { lang, from: `${from}=${tag}` };
  }
  return { lang: DEFAULT_LANG, from: "默认" };
}

/** --lang 参数优先(须是支持的语言),否则自动探测。不支持的 --lang 抛异常。 */
export function resolveLang(arg, opts) {
  if (arg) {
    const lang = normalizeLang(arg);
    if (!lang) throw new Error(`不支持的语言: ${arg}。可用: ${Object.keys(LANGUAGES).join(", ")}`);
    return { lang, from: "--lang" };
  }
  return detectLang(opts);
}
