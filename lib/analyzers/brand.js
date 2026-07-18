function analyzeBrand(html, schemaResult) {
  const checks = [];
  let score = 0;
  const maxScore = 8;

  if (!html) {
    return { score: 0, maxScore, checks: [
      { id: 'brand-consistent', label: 'Consistent brand name across pages', passed: false, weight: 2 },
      { id: 'about-page', label: 'About page with details', passed: false, weight: 2 },
      { id: 'contact', label: 'Contact information available', passed: false, weight: 2 },
      { id: 'sameas', label: 'sameAs links in Organization schema', passed: false, weight: 2 },
    ], passed: 0, total: 4 };
  }

  const titleBrand = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const ogSiteName = extractMetaSimple(html, 'og:site_name');
  const brandName = titleBrand?.[1]?.split(/[|-–—]/)?.[0]?.trim() || ogSiteName || '';
  const brandConsistent = brandName.length > 0;
  checks.push({ id: 'brand-consistent', label: 'Brand name detected' + (brandName ? ` (${brandName.slice(0, 30)})` : ''), passed: brandConsistent, weight: 2 });
  if (brandConsistent) score += 2;

  const hasAboutLink = /href=["\'][^"\']*about[^"\']*["\']/i.test(html);
  checks.push({ id: 'about-page', label: 'About page link found', passed: hasAboutLink, weight: 2 });
  if (hasAboutLink) score += 2;

  const hasContact = /contact|email|@|phone|address/i.test(html);
  checks.push({ id: 'contact', label: 'Contact information available', passed: hasContact, weight: 2 });
  if (hasContact) score += 2;

  const blocks = extractJsonLdSimple(html);
  const orgBlock = blocks.find((b) => b['@type'] === 'Organization' || b['@type']?.includes?.('Organization'));
  const hasSameAs = orgBlock?.sameAs && Array.isArray(orgBlock.sameAs) && orgBlock.sameAs.length > 0;
  checks.push({ id: 'sameas', label: hasSameAs ? 'sameAs links in Organization schema' : 'No sameAs links in Organization schema', passed: !!hasSameAs, weight: 2 });
  if (hasSameAs) score += 2;

  return { score, maxScore, checks, passed: checks.filter((c) => c.passed).length, total: checks.length };
}

function extractMetaSimple(html, property) {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["\']${property}["\'][^>]+content=["\']([^"\']+)["\']`, 'i'));
  if (m) return m[1];
  const m2 = html.match(new RegExp(`<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']${property}["\']`, 'i'));
  return m2 ? m2[1] : null;
}

function extractJsonLdSimple(html) {
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

export { analyzeBrand };
