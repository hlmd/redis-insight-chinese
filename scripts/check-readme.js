#!/usr/bin/env node
/*
 * check-readme.js —— 检查各语言 README 的页内锚点链接、语言切换栏与代码块。
 *   node scripts/check-readme.js [README.xx.md ...]   # 不带参数时检查全部 README*.md
 * 锚点按 GitHub 的规则由标题生成:转小写、去掉标点(保留字母 / 数字 / 空格 / - / _)、空格换成 -,
 * 同名标题依次加 -1、-2。代码块数量与 README.md(简体中文,基准)一致。
 */
import { readFileSync, readdirSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(ROOT).filter((f) => /^README(\.[\w-]+)?\.md$/.test(f)).map((f) => join(ROOT, f));

const slug = (h) => h.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
const codeBlocks = (s) => s.match(/```[\s\S]*?```/g) || [];
const strip = (s) => s.replace(/```[\s\S]*?```/g, "");
const base = codeBlocks(readFileSync(join(ROOT, "README.md"), "utf8"));

let bad = 0;
for (const f of files) {
  const s = readFileSync(f, "utf8");
  const problems = [];
  const seen = {};
  const heads = new Set();
  for (const m of strip(s).matchAll(/^#{1,6} (.+)$/gm)) {
    const sl = slug(m[1].replace(/`/g, ""));
    heads.add(seen[sl] ? `${sl}-${seen[sl]}` : sl);
    seen[sl] = (seen[sl] || 0) + 1;
  }
  for (const m of strip(s).matchAll(/\]\(#([^)]+)\)/g)) {
    if (!heads.has(decodeURIComponent(m[1]))) problems.push(`锚点不存在: #${m[1]}`);
  }
  if (!/^(\*\*简体中文\*\*|\[简体中文\]\(README\.md\)) · /m.test(s)) problems.push("缺少语言切换栏");
  const blocks = codeBlocks(s);
  if (blocks.length !== base.length) problems.push(`代码块数 ${blocks.length},应为 ${base.length}`);
  if (problems.length) { bad++; console.log(`✗ ${basename(f)}`); for (const p of problems) console.log(`    ${p}`); }
  else console.log(`✓ ${basename(f)}`);
}
process.exit(bad ? 1 : 0);
