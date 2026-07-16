function exportMarkdown(result) {
  const lines = [];
  lines.push(`# GEO Audit Report: ${result.url}`);
  lines.push(`**Date:** ${new Date(result.timestamp).toLocaleDateString()}`);
  lines.push(`**Score:** ${result.score}/100 — ${result.level}`);
  lines.push('');
  lines.push('## Dimensions');
  for (const [key, dim] of Object.entries(result.dimensions)) {
    const pct = typeof dim.percentage !== 'undefined' ? `${dim.percentage}%` : `${dim.score}/${dim.maxScore}`;
    lines.push(`- **${key}**: ${pct} (${dim.passed}/${dim.total} checks passed)`);
    for (const check of dim.checks || []) {
      lines.push(`  - [${check.passed ? 'x' : ' '}] ${check.label}`);
    }
  }
  if (result.negativeSignals?.deductions?.length) {
    lines.push('');
    lines.push('## Negative Signals');
    for (const d of result.negativeSignals.deductions) {
      lines.push(`- ⚠ ${d.label} (-${d.deduction} pts)`);
    }
  }
  lines.push('');
  lines.push('## Recommendations');
  for (const rec of result.recommendations || []) {
    lines.push(`- [${rec.priority}] ${rec.issue}`);
    lines.push(`  → ${rec.fix}`);
  }
  return lines.join('\n');
}

function exportJson(result) {
  return JSON.stringify(result, null, 2);
}

function exportCsv(result) {
  const lines = ['Dimension,Score,MaxScore,Passed,Total'];
  for (const [key, dim] of Object.entries(result.dimensions)) {
    lines.push(`${key},${dim.score},${dim.maxScore},${dim.passed},${dim.total}`);
  }
  return lines.join('\n');
}

export { exportMarkdown, exportJson, exportCsv };
