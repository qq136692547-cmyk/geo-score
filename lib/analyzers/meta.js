function analyzeMeta(html) {
  const checks = [];
  let score = 0;
  const maxScore = 10;

  if (!html) {
    return { score: 0, maxScore, checks: [
      { id: 'og-title', label: 'og:title present and unique', passed: false, weight: 2 },
      { id: 'og-desc', label: 'og:description present (120-160 chars)', passed: false, weight: 2 },
      { id: 'twitter-card', label: 'twitter:card present', passed: false, weight: 2 },
      { id: 'canonical', label: 'Canonical URL set', passed: false, weight: 2 },
      { id: 'lang', label: 'HTML lang attribute correct', passed: false, weight: 2 },
    ], passed: 0, total: 5 };
  }

  const ogTitle = extractMeta(html, 'og:title');
  checks.push({ id: 'og-title', label: 'og:title present and unique', passed: !!ogTitle, weight: 2 });
  if (ogTitle) score += 2;

  const ogDesc = extractMeta(html, 'og:description');
  const descLenOk = ogDesc && ogDesc.length >= 60 && ogDesc.length <= 200;
  checks.push({ id: 'og-desc', label: 'og:description present ' + (ogDesc ? `(${ogDesc.length} chars)` : ''), passed: !!ogDesc && descLenOk, weight: 2 });
  if (ogDesc && descLenOk) score += 2;

  const twitterCard = extractMeta(html, 'twitter:card');
  checks.push({ id: 'twitter-card', label: 'twitter:card present', passed: !!twitterCard, weight: 2 });
  if (twitterCard) score += 2;

  const canonical = extractLink(html, 'canonical');
  checks.push({ id: 'canonical', label: 'Canonical URL set', passed: !!canonical, weight: 2 });
  if (canonical) score += 2;

  const langMatch = html.match(/<html[^>]*\blang=["\']([^"\']+)["\']/i);
  const langOk = langMatch && langMatch[1].length >= 2;
  checks.push({ id: 'lang', label: 'HTML lang attribute' + (langMatch ? ` (${langMatch[1]})` : ''), passed: !!langOk, weight: 2 });
  if (langOk) score += 2;

  return { score, maxScore, checks, passed: checks.filter((c) => c.passed).length, total: checks.length };
}

function extractMeta(html, property) {
  const propPattern = new RegExp(`<meta[^>]+(?:property|name)=["\']${escapeRegex(property)}["\'][^>]+content=["\']([^"']+)["\']`, 'i');
  const m = html.match(propPattern);
  if (m) return m[1].trim();
  const altPattern = new RegExp(`<meta[^>]+content=["\']([^"']+)["\'][^>]+(?:property|name)=["\']${escapeRegex(property)}["\']`, 'i');
  const m2 = html.match(altPattern);
  return m2 ? m2[1].trim() : null;
}

function extractLink(html, rel) {
  const m = html.match(new RegExp(`<link[^>]+rel=["\']${rel}["\'][^>]+href=["\']([^"']+)["\']`, 'i'));
  if (m) return m[1];
  const m2 = html.match(new RegExp(`<link[^>]+href=["\']([^"']+)["\'][^>]+rel=["\']${rel}["\']`, 'i'));
  return m2 ? m2[1] : null;
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export { analyzeMeta, extractMeta, extractLink };
