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
