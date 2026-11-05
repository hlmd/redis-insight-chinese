// src/resources.js
// 读取钩子源码与 locales 数据。查找顺序(同 postman-chinese-injector):
//   ① 可执行文件旁(允许在编译好的二进制旁放文件覆盖内嵌数据,无需重编译);
//   ② 仓库根目录(源码模式 node/bun redis-insight-chinese.js);
//   ③ 编译期嵌入的 generated/embedded.json(由 scripts/build-data.js 生成,单文件二进制用)。
// 通过 npm 安装(包目录位于 node_modules 下)时,包里自带的 locales/ 只是发版时的快照:
//   不算「本地覆盖」,排在在线数据包之后,这样 npx / npm i -g 的用户也能拿到最新译文。
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { LANGUAGES, DEFAULT_LANG, REQUIRED_KINDS, localeFile, langFiles } from "./i18n.js";

export const RENDERER_HOOK = "src/hooks/ri-chinese.js";
export const MAIN_HOOK = "src/hooks/ri-main-cn.cjs";
// 教程:md-segments.cjs 是段落切分器(内联进渲染钩子);tutorials 词典 = { manifest: 目录树文字, markdown: 正文段落 }
export const MD_SEGMENTS = "src/hooks/md-segments.cjs";
const HOOK_FILES = [RENDERER_HOOK, MAIN_HOOK, MD_SEGMENTS];
// 内嵌快照 / 在线数据包包含的全部文件(各语言的可选文件缺了就不打包)
export const EMBEDDED_FILES = [...HOOK_FILES, ...Object.keys(LANGUAGES).flatMap(langFiles)];
// 在线数据包必须带的文件:钩子 + 默认语言的必需词典
export const REQUIRED_FILES = [...HOOK_FILES, ...REQUIRED_KINDS.map((k) => localeFile(DEFAULT_LANG, k))];

export const ROOT = (() => {
  try {
    return join(dirname(fileURLToPath(import.meta.url)), "..");
  } catch {
    return null;
  }
})();

// 包目录是否在 node_modules 里(npx / npm i -g 安装);源码仓库里直接运行时为 false
export function isNpmInstall(root = ROOT) {
  return !!root && /[\\/]node_modules[\\/]/.test(root + "/");
}

// 「本地覆盖」的查找目录:exe 旁 + 源码仓库根目录(npm 安装的包目录不算,见 packageRoots)
function candidateRoots() {
  const roots = [];
  // 只有编译后的二进制才看可执行文件旁;源码模式下 execPath 是 node/bun 本身,跳过
  try {
    if (!/^(node|bun)(\.exe)?$/i.test(process.execPath.split(/[\\/]/).pop())) {
      roots.push(dirname(process.execPath));
    }
  } catch { /* ignore */ }
  if (ROOT && !isNpmInstall()) roots.push(ROOT);
  return roots;
}

// npm 包自带的发版快照,优先级低于在线数据包
function packageRoots() {
  return ROOT && isNpmInstall() ? [ROOT] : [];
}

let embedded;
async function loadEmbedded() {
  if (embedded === undefined) {
    try {
      embedded = (await import("../generated/embedded.json", { with: { type: "json" } })).default;
    } catch {
      embedded = null;
    }
  }
  return embedded;
}

// 内嵌快照的构建元信息 { commit, committedAt }(scripts/build-data.js 写入 embedded.json 的 _meta)
export async function embeddedMeta() {
  const emb = await loadEmbedded();
  return (emb && emb._meta) || null;
}

// 身边(exe 旁 / 仓库根目录)有词典文件时以本地为准:源码开发模式、或用户在 exe 旁手动覆盖
export function hasLocalData() {
  return candidateRoots().some((root) => existsSync(join(root, "locales")));
}

// 在线数据包(updater.resolveDataBundle 的结果),优先级:本地文件 > 在线数据包 > npm 包快照 / 内嵌快照
let remote = null;
export function setRemoteData(bundle) { remote = bundle; }

// 返回 { text, source }
export async function readResource(rel) {
  for (const root of candidateRoots()) {
    const p = join(root, rel);
    if (existsSync(p)) return { text: readFileSync(p, "utf8"), source: p };
  }
  if (remote && typeof remote.files[rel] === "string") return { text: remote.files[rel], source: `在线数据包(${remote.from})` };
  for (const root of packageRoots()) {
    const p = join(root, rel);
    if (existsSync(p)) return { text: readFileSync(p, "utf8"), source: `npm 包快照(${p})` };
  }
  const emb = await loadEmbedded();
  if (emb && typeof emb[rel] === "string") return { text: emb[rel], source: "内嵌数据" };
  throw new Error(`缺少 ${rel}(源码旁、可执行文件旁均未找到,且无内嵌数据)`);
}

// 资源是否存在(任一来源)
export async function hasResource(rel) {
  try { await readResource(rel); return true; } catch { return false; }
}

export async function readJsonResource(rel) {
  const r = await readResource(rel);
  return { data: JSON.parse(r.text), source: r.source };
}
