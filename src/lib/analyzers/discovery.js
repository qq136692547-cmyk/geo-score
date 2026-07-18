function analyzeDiscovery(aiTxt, aiSummary, aiFaq) {
  const checks = [];
  let score = 0;
  const maxScore = 6;

  // .well-known/ai.txt
  const hasAiTxt = aiTxt !== null && aiTxt !== undefined;
  checks.push({ id: 'ai-txt', label: '.well-known/ai.txt endpoint', passed: hasAiTxt, weight: 2 });
  if (hasAiTxt) score += 2;

  // /ai/summary.json
  const hasSummary = aiSummary !== null && aiSummary !== undefined && !(aiSummary instanceof Error);
  checks.push({ id: 'ai-summary', label: '/ai/summary.json endpoint', passed: !!hasSummary, weight: 2 });
  if (hasSummary) score += 2;

  // /ai/faq.json
  const hasFaq = aiFaq !== null && aiFaq !== undefined && !(aiFaq instanceof Error);
  checks.push({ id: 'ai-faq', label: '/ai/faq.json endpoint', passed: !!hasFaq, weight: 2 });
  if (hasFaq) score += 2;

  return { score, maxScore, checks, passed: checks.filter((c) => c.passed).length, total: checks.length };
}

export { analyzeDiscovery };
