function analyzeLlmstxt(llmsTxt) {
  const checks = [];
  let score = 0;
  const maxScore = 12;

  // Exists at root
  const exists = llmsTxt !== null && llmsTxt !== undefined;
  checks.push({ id: 'exists', label: 'llms.txt exists at root', passed: exists, weight: 4 });
  if (exists) score += 4;

  if (exists) {
    const lines = llmsTxt.split('\n');
    const hasH1 = /^#\s+\S/.test(llmsTxt);
    const hasBlockquote = />\s+\S/.test(llmsTxt);
    checks.push({ id: 'structure', label: 'Has H1 + blockquote structure', passed: hasH1 && hasBlockquote, weight: 3 });
    if (hasH1 && hasBlockquote) score += 3;

    const areaCount = (llmsTxt.match(/^##\s+\S/gm) || []).length;
    checks.push({ id: 'areas', label: `Has ${areaCount} area section(s) (need 2+)`, passed: areaCount >= 2, weight: 2 });
    if (areaCount >= 2) score += 2;

    const hasDescriptiveLinks = /\[.+\]\(https?:\/\/[^\)]+\)/.test(llmsTxt);
    checks.push({ id: 'links', label: 'Has descriptive links', passed: hasDescriptiveLinks, weight: 2 });
    if (hasDescriptiveLinks) score += 2;

    const under200 = lines.length <= 200;
    checks.push({ id: 'length', label: `Under 200 lines (${lines.length})`, passed: under200, weight: 1 });
    if (under200) score += 1;
  } else {
    checks.push({ id: 'structure', label: 'Has H1 + blockquote structure', passed: false, weight: 3 });
    checks.push({ id: 'areas', label: 'Has 2+ area sections', passed: false, weight: 2 });
    checks.push({ id: 'links', label: 'Has descriptive links', passed: false, weight: 2 });
    checks.push({ id: 'length', label: 'Under 200 lines', passed: false, weight: 1 });
  }

  return { score, maxScore, checks, passed: checks.filter((c) => c.passed).length, total: checks.length };
}

export { analyzeLlmstxt };
