function analyzeContent(html) {
  const checks = [];
  let score = 0;
  const maxScore = 12;

  if (!html) {
    return { score: 0, maxScore, checks: [
      { id: 'h1', label: 'H1 present and descriptive', passed: false, weight: 2 },
      { id: 'wordcount', label: 'Content >= 800 words', passed: false, weight: 2 },
      { id: 'stats', label: 'Statistics cited with sources', passed: false, weight: 2 },
      { id: 'headings', label: 'Clear heading hierarchy', passed: false, weight: 2 },
      { id: 'lists', label: 'Lists or tables present', passed: false, weight: 2 },
      { id: 'citations', label: 'External authoritative citations', passed: false, weight: 2 },
    ], passed: 0, total: 6 };
  }

  const text = stripHtml(html);

  // H1
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const hasH1 = h1Match && h1Match[1].trim().length > 5;
  checks.push({ id: 'h1', label: 'H1 present and descriptive', passed: hasH1, weight: 2 });
  if (hasH1) score += 2;

  // Word count
  const words = text.split(/\s+/).filter(Boolean).length;
  const wordOk = words >= 600;
  checks.push({ id: 'wordcount', label: `Content ${words} words` + (words >= 600 ? '' : ' (need 600+)'), passed: wordOk, weight: 2 });
  if (wordOk) score += 2;

  // Statistics
  const hasStats = /\d+%|\d+\.\d+|\$\d+|\d+ million|\d+ billion/i.test(text);
  checks.push({ id: 'stats', label: 'Statistics cited with sources', passed: hasStats, weight: 2 });
  if (hasStats) score += 2;

  // Heading hierarchy
  const h1s = (html.match(/<h1[^>]*>/gi) || []).length;
  const h2s = (html.match(/<h2[^>]*>/gi) || []).length;
  const h3s = (html.match(/<h3[^>]*>/gi) || []).length;
  const hierarchyOk = h1s === 1 && h2s >= 1;
  checks.push({ id: 'headings', label: `H1:${h1s} H2:${h2s} H3:${h3s} hierarchy`, passed: hierarchyOk, weight: 2 });
  if (hierarchyOk) score += 2;

  // Lists
  const hasLists = /<ul[^>]*>/i.test(html) || /<ol[^>]*>/i.test(html) || /<table[^>]*>/i.test(html);
  checks.push({ id: 'lists', label: 'Lists or tables present', passed: hasLists, weight: 2 });
  if (hasLists) score += 2;

  // External citations
  const externalLinks = (html.match(/<a[^>]+href=["']https?:\/\/[^"']+["'][^>]*>/gi) || []).length;
  const citesOk = externalLinks >= 3;
  checks.push({ id: 'citations', label: `${externalLinks} external link(s)` + (citesOk ? '' : ' (need 3+)'), passed: citesOk, weight: 2 });
  if (citesOk) score += 2;

  return { score, maxScore, checks, passed: checks.filter((c) => c.passed).length, total: checks.length };
}

function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[^;]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export { analyzeContent };
