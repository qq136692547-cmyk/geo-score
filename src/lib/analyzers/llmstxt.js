function analyzeLlmstxt(llmsTxt) {
  const checks = [];
  let score = 0;
  const maxScore = 12;

  // Weights changed 2026-10-23 (was: exists 4 / structure 3 / areas 2 / links 2 / length 1).
  // The old shape paid 4 of 12 for the file merely existing, plus 1 for "under
  // 200 lines" -- and an empty string splits to [''] so it is 1 line, which
  // passed. Net: a 0-byte /llms.txt earned 5/12 while teaching a model nothing.
  // Now the file's existence is worth 1 (it is a cheap signal), and the points
  // follow the content. A correctly written file still earns 12/12.
  const exists = llmsTxt !== null && llmsTxt !== undefined;
  checks.push({ id: 'exists', label: 'llms.txt exists at root', passed: exists, weight: 1 });
  if (exists) score += 1;

  if (exists) {
    const lines = llmsTxt.split('\n');
    const hasH1 = /^#\s+\S/.test(llmsTxt);
    const hasBlockquote = />\s+\S/.test(llmsTxt);
    const structureOk = hasH1 && hasBlockquote;
    checks.push({ id: 'structure', label: 'Has H1 + blockquote structure', passed: structureOk, weight: 4 });
    if (structureOk) score += 4;

    const areaCount = (llmsTxt.match(/^##\s+\S/gm) || []).length;
    checks.push({ id: 'areas', label: `Has ${areaCount} area section(s) (need 2+)`, passed: areaCount >= 2, weight: 3 });
    if (areaCount >= 2) score += 3;

    const hasDescriptiveLinks = /\[.+\]\(https?:\/\/[^\)]+\)/.test(llmsTxt);
    checks.push({ id: 'links', label: 'Has descriptive links', passed: hasDescriptiveLinks, weight: 3 });
    if (hasDescriptiveLinks) score += 3;

    // Length only counts once the file is a real llms.txt. Otherwise an empty
    // or one-line placeholder keeps earning this point, which is how the
    // 0-byte case got to 5 instead of 4.
    const under200 = lines.length <= 200;
    const lengthCounts = structureOk && under200;
    const lengthLabel = under200 && !structureOk
      ? `Under 200 lines (${lines.length}) — only counts once structure passes`
      : `Under 200 lines (${lines.length})`;
    checks.push({ id: 'length', label: lengthLabel, passed: lengthCounts, weight: 1 });
    if (lengthCounts) score += 1;
  } else {
    checks.push({ id: 'structure', label: 'Has H1 + blockquote structure', passed: false, weight: 4 });
    checks.push({ id: 'areas', label: 'Has 2+ area sections', passed: false, weight: 3 });
    checks.push({ id: 'links', label: 'Has descriptive links', passed: false, weight: 3 });
    checks.push({ id: 'length', label: 'Under 200 lines', passed: false, weight: 1 });
  }

  return { score, maxScore, checks, passed: checks.filter((c) => c.passed).length, total: checks.length };
}

export { analyzeLlmstxt };
