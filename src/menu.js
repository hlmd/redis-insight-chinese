// src/menu.js
// 主进程注入(原生菜单 / 对话框):把钩子写成 dist/main/ri-main-cn.js、词典写成 ri-main-data.json,
// 并在主进程入口(package.json 的 main,默认 dist/main/main.js)最前面插一行 require。幂等。
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";

export const MAIN_HOOK_FILE = "ri-main-cn.js";
export const MAIN_DATA_FILE = "ri-main-data.json";
const REQUIRE_LINE =
  `try { require('./${MAIN_HOOK_FILE}'); } catch (e) { console.error('[ri-main-cn] load failed', e); }\n`;

// 纯函数:在入口源码最前面插入 require(已有则原样返回)。
// 保留 shebang;入口以 'use strict' 指令开头时插到指令之后,不破坏严格模式。
export function injectMainEntry(text) {
  if (text.includes(`require('./${MAIN_HOOK_FILE}')`)) return text;
  let head = "";
  let rest = text;
  const shebang = /^#![^\n]*\n/.exec(rest);
  if (shebang) { head += shebang[0]; rest = rest.slice(shebang[0].length); }
  const directive = /^\s*(['"])use strict\1;?[^\S\n]*\n?/.exec(rest);
  if (directive) { head += directive[0]; rest = rest.slice(directive[0].length); }
  return head + REQUIRE_LINE + rest;
}

export function injectMenu(rootDir, dict, hookSrc) {
  const pkgPath = join(rootDir, "package.json");
  if (!existsSync(pkgPath)) return { entries: 0, mainPatched: false, skipped: true };
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const entryPath = join(rootDir, pkg.main || "dist/main/main.js");
  if (!existsSync(entryPath)) return { entries: 0, mainPatched: false, skipped: true };

  const dir = dirname(entryPath);
  writeFileSync(join(dir, MAIN_HOOK_FILE), hookSrc);
  writeFileSync(join(dir, MAIN_DATA_FILE), JSON.stringify(dict));

  // latin1 按字节无损往返(插入的行是纯 ASCII),不会因重新编码改动原文件其它字节
  const src = readFileSync(entryPath, "latin1");
  const next = injectMainEntry(src);
  const mainPatched = next !== src;
  if (mainPatched) writeFileSync(entryPath, next, "latin1");
  return { entries: Object.keys(dict).length, mainPatched, skipped: false };
}
