// src/resources.js
// 读取钩子源码与 locales 数据。查找顺序(同 postman-chinese-injector):
//   ① 可执行文件旁(允许在编译好的二进制旁放文件覆盖内嵌数据,无需重编译);
//   ② 仓库根目录(源码模式 node/bun redis-insight-chinese.js);
//   ③ 编译期嵌入的 generated/embedded.json(由 scripts/build-data.js 生成,单文件二进制用)。
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export const RENDERER_HOOK = "src/hooks/ri-chinese.js";
export const MAIN_HOOK = "src/hooks/ri-main-cn.cjs";
export const RENDERER_LOCALE = "locales/zh-CN/renderer.json";
export const MAIN_LOCALE = "locales/main/zh-CN.json";
// 教程:md-segments.cjs 是段落切分器(内联进渲染钩子);tutorials 词典 = { manifest: 目录树文字, markdown: 正文段落 }
export const MD_SEGMENTS = "src/hooks/md-segments.cjs";
export const TUTORIALS_LOCALE = "locales/tutorials/zh-CN.json";
export const CONTENT_LOCALE = "locales/content/zh-CN.json"; // 远端静态内容 { dom: {英文: 中文} }
export const COMMANDS_LOCALE = "locales/commands/zh-CN.json"; // 命令助手 { dom: {英文: 中文} }
// 汉化插图:manifest 记原图哈希,svg 是替换后的图(由 fetcher 的 assets.js 生成)
export const ASSETS_MANIFEST = "locales/assets/manifest.json";
export const ASSET_FILES = ["locales/assets/empty_list_dark.svg", "locales/assets/empty_list_light.svg"];
export const EMBEDDED_FILES = [RENDERER_HOOK, MAIN_HOOK, MD_SEGMENTS, RENDERER_LOCALE, MAIN_LOCALE, TUTORIALS_LOCALE, CONTENT_LOCALE, COMMANDS_LOCALE, ASSETS_MANIFEST, ...ASSET_FILES];

export const ROOT = (() => {
  try {
    return join(dirname(fileURLToPath(import.meta.url)), "..");
  } catch {
    return null;
  }
})();

function candidateRoots() {
  const roots = [];
  // 只有编译后的二进制才看可执行文件旁;源码模式下 execPath 是 node/bun 本身,跳过
  try {
    if (!/^(node|bun)(\.exe)?$/i.test(process.execPath.split(/[\\/]/).pop())) {
      roots.push(dirname(process.execPath));
    }
  } catch { /* ignore */ }
  if (ROOT) roots.push(ROOT);
  return roots;
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
  return candidateRoots().some((root) => existsSync(join(root, RENDERER_LOCALE)));
}

// 在线数据包(updater.resolveDataBundle 的结果),优先级:本地文件 > 在线数据包 > 内嵌快照
let remote = null;
export function setRemoteData(bundle) { remote = bundle; }

// 返回 { text, source }
export async function readResource(rel) {
  for (const root of candidateRoots()) {
    const p = join(root, rel);
    if (existsSync(p)) return { text: readFileSync(p, "utf8"), source: p };
  }
  if (remote && typeof remote.files[rel] === "string") return { text: remote.files[rel], source: `在线数据包(${remote.from})` };
  const emb = await loadEmbedded();
  if (emb && typeof emb[rel] === "string") return { text: emb[rel], source: "内嵌数据" };
  throw new Error(`缺少 ${rel}(源码旁、可执行文件旁均未找到,且无内嵌数据)`);
}

export async function readJsonResource(rel) {
  const r = await readResource(rel);
  return { data: JSON.parse(r.text), source: r.source };
}
