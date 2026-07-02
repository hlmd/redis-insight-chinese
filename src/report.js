export function formatReport(stats, opts = {}) {
  const lines = [];
  lines.push(opts.dryRun ? "=== 汉化报告（DRY-RUN 试运行，未写入）===" : "=== 汉化报告 ===");
  lines.push(`字典条目: ${stats.dictSize}`);
  lines.push(`命中并应用的 key: ${stats.appliedKeys}`);
  lines.push(`修改文件数: ${stats.filesChanged}`);
  lines.push(`总替换次数: ${stats.occurrences}`);
  if (stats.unmatchedKeys.length) {
    lines.push(`零命中的 key (${stats.unmatchedKeys.length}):`);
    for (const k of stats.unmatchedKeys.slice(0, 50)) lines.push(`  - ${k}`);
    if (stats.unmatchedKeys.length > 50) lines.push(`  ... 其余 ${stats.unmatchedKeys.length - 50} 条`);
  } else {
    lines.push("零命中的 key: 无");
  }
  return lines.join("\n");
}
