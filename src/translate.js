import { readFileSync, writeFileSync } from "fs";
import { relative } from "path";
import { walkFileTree, toPosix } from "./paths.js";

function escapeFor(quote, value) {
  // 转义反斜杠与该引号字符；模板串还需转义反引号与 ${
  let v = value.replace(/\\/g, "\\\\");
  if (quote === '"') v = v.replace(/"/g, '\\"');
  else if (quote === "'") v = v.replace(/'/g, "\\'");
  else if (quote === "`") v = v.replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  return v;
}

function replaceLiteral(text, quote, key, value) {
  const from = quote + key + quote;
  const to = quote + escapeFor(quote, value) + quote;
  const parts = text.split(from);
  const n = parts.length - 1;
  return { text: n > 0 ? parts.join(to) : text, count: n };
}

export function applyDict(content, dict, opts = {}) {
  const html = !!opts.html;
  let text = content;
  const counts = {};
  const keys = Object.keys(dict)
    .filter((k) => dict[k] !== "" && dict[k] != null)
    .sort((a, b) => b.length - a.length);

  for (const key of keys) {
    const value = dict[key];
    let total = 0;

    if (!key.includes('"')) {
      const r = replaceLiteral(text, '"', key, value);
      text = r.text; total += r.count;
    }
    if (!key.includes("'")) {
      const r = replaceLiteral(text, "'", key, value);
      text = r.text; total += r.count;
    }
    if (!key.includes("`") && !key.includes("${")) {
      const r = replaceLiteral(text, "`", key, value);
      text = r.text; total += r.count;
    }
    if (html) {
      const parts = text.split(key);
      const n = parts.length - 1;
      if (n > 0) { text = parts.join(value); total += n; }
    }
    if (total > 0) counts[key] = total;
  }
  return { text, counts };
}

function isTarget(rel) {
  return (
    /^dist\/renderer\/assets\/.*\.js$/.test(rel) ||
    /^dist\/renderer\/.*\.html$/.test(rel) ||
    /^dist\/main\/.*\.js$/.test(rel)
  );
}

export function translateTree(rootDir, dict) {
  const files = walkFileTree(rootDir);
  let filesChanged = 0;
  let occurrences = 0;
  const perKey = {};

  for (const abs of files) {
    const rel = toPosix(relative(rootDir, abs));
    if (!isTarget(rel)) continue;
    const html = rel.endsWith(".html");
    const before = readFileSync(abs, "utf8");
    const { text, counts } = applyDict(before, dict, { html });
    if (text !== before) {
      writeFileSync(abs, text);
      filesChanged++;
    }
    for (const [k, n] of Object.entries(counts)) {
      perKey[k] = (perKey[k] || 0) + n;
      occurrences += n;
    }
  }

  const unmatchedKeys = Object.keys(dict)
    .filter((k) => dict[k] !== "" && dict[k] != null && !perKey[k]);

  return { filesChanged, occurrences, perKey, unmatchedKeys };
}
