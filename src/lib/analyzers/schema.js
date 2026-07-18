function analyzeSchema(html) {
  const checks = [];
  let score = 0;
  const maxScore = 14;

  if (!html) {
    return { score: 0, maxScore, checks: [
      { id: 'org', label: 'Organization schema present', passed: false, weight: 3 },
      { id: 'article', label: 'Article schema present', passed: false, weight: 3 },
      { id: 'faq', label: 'FAQPage schema present', passed: false, weight: 3 },
      { id: 'howto', label: 'HowTo schema present', passed: false, weight: 2 },
      { id: 'props', label: '5+ properties per schema', passed: false, weight: 3 },
    ], passed: 0, total: 5 };
  }

  const blocks = extractJsonLd(html);

  const hasOrg = blocks.some((b) => b['@type'] === 'Organization' || b['@type']?.includes?.('Organization'));
  const hasArticle = blocks.some((b) => b['@type'] === 'Article' || b['@type'] === 'NewsArticle' || b['@type'] === 'BlogPosting');
  const hasFaq = blocks.some((b) => b['@type'] === 'FAQPage');
  const hasHowto = blocks.some((b) => b['@type'] === 'HowTo');

  checks.push({ id: 'org', label: 'Organization schema present', passed: hasOrg, weight: 3 });
  if (hasOrg) score += 3;

  checks.push({ id: 'article', label: 'Article schema on blog posts', passed: hasArticle, weight: 3 });
  if (hasArticle) score += 3;

  checks.push({ id: 'faq', label: 'FAQPage schema on Q&A content', passed: hasFaq, weight: 3 });
  if (hasFaq) score += 3;

  checks.push({ id: 'howto', label: 'HowTo schema present', passed: hasHowto, weight: 2 });
  if (hasHowto) score += 2;

  const allProps = blocks.reduce((acc, b) => acc + Object.keys(b).length, 0);
  const avgProps = blocks.length > 0 ? allProps / blocks.length : 0;
  const hasEnoughProps = avgProps >= 5;
  checks.push({ id: 'props', label: `Avg ${Math.round(avgProps)} properties per schema (need 5+)`, passed: hasEnoughProps, weight: 3 });
  if (hasEnoughProps) score += 3;

  return { score, maxScore, checks, passed: checks.filter((c) => c.passed).length, total: checks.length };
}

function extractJsonLd(html) {
  const blocks = [];
  const regex = /<script[^>]*type=["\']application\/ld\+json["\'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch { /* skip invalid JSON-LD */ }
  }
  return blocks;
}

export { analyzeSchema, extractJsonLd };
