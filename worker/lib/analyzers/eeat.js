function analyzeEeat(html, schemaResult) {
  const checks = [];
  let score = 0;
  const maxScore = 8;

  if (!html) {
    return { score: 0, maxScore, checks: [
      { id: 'author', label: 'Author bylines on content', passed: false, weight: 2 },
      { id: 'author-schema', label: 'Person schema with credentials', passed: false, weight: 2 },
      { id: 'trust-pages', label: 'Trust pages (About, Privacy, Terms)', passed: false, weight: 2 },
      { id: 'reviews', label: 'Reviews or testimonials', passed: false, weight: 1 },
      { id: 'https-eeat', label: 'HTTPS enabled', passed: false, weight: 1 },
    ], passed: 0, total: 5 };
  }

  const hasAuthor = /rel=["\']author["\']|<meta[^>]+name=["\']author["\']/i.test(html);
  checks.push({ id: 'author', label: 'Author bylines on content', passed: hasAuthor, weight: 2 });
  if (hasAuthor) score += 2;

  // Extract JSON-LD directly from HTML to check for Person schema
  const blocks = extractJsonLd(html);
  const hasPersonSchema = blocks.some((b) => b['@type'] === 'Person');
  checks.push({ id: 'author-schema', label: 'Person schema with credentials', passed: hasPersonSchema, weight: 2 });
  if (hasPersonSchema) score += 2;

  const hasAbout = /about/i.test(html);
  const hasPrivacy = /privacy/i.test(html);
  const hasTerms = /terms/i.test(html);
  const trustCount = [hasAbout, hasPrivacy, hasTerms].filter(Boolean).length;
  checks.push({ id: 'trust-pages', label: `Trust pages: ${trustCount}/3 (About, Privacy, Terms)`, passed: trustCount >= 2, weight: 2 });
  if (trustCount >= 2) score += 2;

  const hasReviews = /reviews?|testimonials?|trustpilot|g2\.com|\.com\/review/i.test(html);
  checks.push({ id: 'reviews', label: 'Reviews or testimonials', passed: hasReviews, weight: 1 });
  if (hasReviews) score += 1;

  const hasHttps = /Strict-Transport-Security|<meta[^>]+http-equiv=["\']Content-Security-Policy["\']/i.test(html);
  checks.push({ id: 'https-eeat', label: 'HTTPS & security headers', passed: hasHttps, weight: 1 });
  if (hasHttps) score += 1;

  return { score, maxScore, checks, passed: checks.filter((c) => c.passed).length, total: checks.length };
}

export { analyzeEeat, extractJsonLd };

function extractJsonLd(html) {
  const blocks = [];
  const regex = /<script[^>]*type=["\']application\/ld\+json["\'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {}
  }
  return blocks;
}
