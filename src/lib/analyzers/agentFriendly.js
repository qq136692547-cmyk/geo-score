function analyzeAgentFriendly(html, robotsTxt, llmsTxt, sitemapXml) {
  const checks = [];
  let score = 0;
  const maxScore = 4;

  if (!html) {
    return { score: 0, maxScore, checks: [
      { id: 'api-endpoints', label: 'API endpoints documented', passed: false, weight: 1 },
      { id: 'structured-output', label: 'Structured data for AI extraction', passed: false, weight: 1 },
      { id: 'rate-limits', label: 'Rate limits documented for agents', passed: false, weight: 1 },
      { id: 'sitemap', label: 'Sitemap.xml available', passed: false, weight: 1 },
    ], passed: 0, total: 4 };
  }

  const hasApiDocs = /api|endpoint|graphql|rest/i.test(html);
  checks.push({ id: 'api-endpoints', label: 'API endpoints documented', passed: hasApiDocs, weight: 1 });
  if (hasApiDocs) score += 1;

  const hasSchema = /<script[^>]*type=["\']application\/ld\+json["\']/i.test(html);
  checks.push({ id: 'structured-output', label: 'Structured data for AI extraction', passed: hasSchema, weight: 1 });
  if (hasSchema) score += 1;

  // 2026-10-22: this used to test /X-RateLimit|x-ratelimit/i against the HTML
  // *body*. X-RateLimit is a response HEADER, so the check could only pass if a
  // page happened to paste the header name into its own text -- it scored 0 for
  // all 324 sites in our corpus (data/geo-audit-v2-final.csv). A browser audit
  // also cannot read most response headers cross-origin, so "the header is
  // present" is not observable here at all.
  // What IS observable, and what a real agent needs, is that the rate limit is
  // *documented* somewhere the agent can read: the page itself, its API docs,
  // or the llms.txt we already fetch.
  const agentReadable = html + ' ' + (llmsTxt || '');
  const hasRateLimit = /rate[\s-]?limits?|X-RateLimit|x-ratelimit/i.test(agentReadable);
  checks.push({ id: 'rate-limits', label: 'Rate limits documented for agents', passed: hasRateLimit, weight: 1 });
  if (hasRateLimit) score += 1;

  const hasSitemap = sitemapXml
    ? /<urlset|<sitemapindex/i.test(sitemapXml)
    : /sitemap/i.test(html);
  checks.push({ id: 'sitemap', label: 'Sitemap.xml available', passed: hasSitemap, weight: 1 });
  if (hasSitemap) score += 1;

  return { score, maxScore, checks, passed: checks.filter((c) => c.passed).length, total: checks.length };
}

export { analyzeAgentFriendly };
