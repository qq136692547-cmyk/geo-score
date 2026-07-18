function analyzeCitations(html) {
  const checks = [];
  let score = 0;
  const maxScore = 8;

  if (!html) {
    return { score: 0, maxScore, checks: [
      { id: 'ext-links', label: 'External links to authoritative domains', passed: false, weight: 2 },
      { id: 'stats', label: 'Statistics with specific numbers', passed: false, weight: 2 },
      { id: 'quotes', label: 'Expert quotations with attribution', passed: false, weight: 2 },
      { id: 'research', label: 'Original research or data', passed: false, weight: 1 },
      { id: 'edu-gov', label: 'Links to .edu or .gov domains', passed: false, weight: 1 },
    ], passed: 0, total: 5 };
  }

  const externalLinks = (html.match(/<a[^>]+href=["']https?:\/\/[^"']+["'][^>]*>/gi) || []);
  const eduGovLinks = externalLinks.filter((l) => /\.edu\b|\.gov\b/.test(l)).length;
  const totalExternal = externalLinks.length;

  checks.push({ id: 'ext-links', label: `${totalExternal} external link(s)`, passed: totalExternal >= 3, weight: 2 });
  if (totalExternal >= 3) score += 2;

  const text = stripHtmlSimple(html);
  const hasStats = /\d+%|\d+\.\d+|\$\d+/g.test(text);
  checks.push({ id: 'stats', label: 'Statistics with specific numbers', passed: hasStats, weight: 2 });
  if (hasStats) score += 2;

  const hasQuotes = /["\u201C][^"\u201D]+["\u201D]\s*[-–—]\s*\w+/g.test(text) || /<blockquote[^>]*>/i.test(html);
  checks.push({ id: 'quotes', label: 'Expert quotations with attribution', passed: hasQuotes, weight: 2 });
  if (hasQuotes) score += 2;

  const hasResearch = /study|research|survey|report|analysis|data/i.test(text);
  checks.push({ id: 'research', label: 'Original research or data', passed: hasResearch, weight: 1 });
  if (hasResearch) score += 1;

  checks.push({ id: 'edu-gov', label: `${eduGovLinks} link(s) to .edu/.gov`, passed: eduGovLinks >= 1, weight: 1 });
  if (eduGovLinks >= 1) score += 1;

  return { score, maxScore, checks, passed: checks.filter((c) => c.passed).length, total: checks.length };
}

function stripHtmlSimple(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

export { analyzeCitations };
