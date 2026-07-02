import { readFileSync } from "fs";
import { relative } from "path";
import { walkFileTree, toPosix } from "./paths.js";

function looksLikeUI(s, minLen) {
  if (s.length < minLen) return false;
  if (!/^[\x20-\x7E]+$/.test(s)) return false;            // 仅可打印 ASCII
  if (/[/\\{}<>=|@#$]/.test(s)) return false;              // 代码特征字符
  if (/\.(js|css|json|svg|png|woff2?|ttf|html|node)$/i.test(s)) return false;
  if (!/[A-Za-z]/.test(s)) return false;                   // 至少含字母
  const hasSpace = /\s/.test(s);
  const capStart = /^[A-Z]/.test(s);
  if (!hasSpace && !capStart) return false;                // 排除 utf-8 之类
  return true;
}

export function extractCandidates(rootDir, minLen = 3) {
  const out = {};
  const rx = /(["'])((?:[^"'\\]|\\.)*?)\1/g;
  for (const abs of walkFileTree(rootDir)) {
    const rel = toPosix(relative(rootDir, abs));
    if (!/^dist\/renderer\/assets\/.*\.js$/.test(rel) && !/^dist\/main\/.*\.js$/.test(rel)) continue;
    const content = readFileSync(abs, "utf8");
    let m;
    while ((m = rx.exec(content)) !== null) {
      const s = m[2];
      if (looksLikeUI(s, minLen)) out[s] = "";
    }
  }
  return out;
}
