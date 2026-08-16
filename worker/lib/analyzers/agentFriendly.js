function analyzeAgentFriendly(html, robotsTxt, llmsTxt) {
  const checks = [];
  let score = 0;
  const maxScore = 4;

  if (!html) {
    return { score: 0, maxScore, checks: [
      { id: 'api-endpoints', label: 'API endpoints documented', passed: false, weight: 1 },
      { id: 'structured-output', label: 'Structured data for AI extraction', passed: false, weight: 1 },
      { id: 'rate-limits', label: 'Rate limiting headers', passed: false, weight: 1 },
      { id: 'sitemap', label: 'Sitemap.xml available', passed: false, weight: 1 },
    ], passed: 0, total: 4 };
  }

  const hasApiDocs = /api|endpoint|graphql|rest/i.test(html);
  checks.push({ id: 'api-endpoints', label: 'API endpoints documented', passed: hasApiDocs, weight: 1 });
  if (hasApiDocs) score += 1;

  const hasSchema = /<script[^>]*type=["\']application\/ld\+json["\']/i.test(html);
  checks.push({ id: 'structured-output', label: 'Structured data for AI extraction', passed: hasSchema, weight: 1 });
  if (hasSchema) score += 1;

  const hasRateLimit = /X-RateLimit|x-ratelimit/i.test(html);
  checks.push({ id: 'rate-limits', label: 'Rate limiting headers', passed: hasRateLimit, weight: 1 });
  if (hasRateLimit) score += 1;

  const hasSitemap = /sitemap/i.test(html);
  checks.push({ id: 'sitemap', label: 'Sitemap.xml available', passed: hasSitemap, weight: 1 });
  if (hasSitemap) score += 1;

  return { score, maxScore, checks, passed: checks.filter((c) => c.passed).length, total: checks.length };
}

export { analyzeAgentFriendly };
