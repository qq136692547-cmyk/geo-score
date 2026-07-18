function analyzeFreshness(html) {
  const checks = [];
  let score = 0;
  const maxScore = 4;

  if (!html) {
    return { score: 0, maxScore, checks: [
      { id: 'date-modified', label: 'Date modified meta or header', passed: false, weight: 1.5 },
      { id: 'recent-content', label: 'Content references recent dates', passed: false, weight: 1.5 },
      { id: 'copyright-year', label: 'Copyright year is current', passed: false, weight: 1 },
    ], passed: 0, total: 3 };
  }

  const currentYear = new Date().getFullYear().toString();

  const hasDateModified = /dateModified|last-modified|lastmod|<time[^>]*>/i.test(html);
  checks.push({ id: 'date-modified', label: 'Date modified meta or header', passed: hasDateModified, weight: 1.5 });
  if (hasDateModified) score += 1.5;

  const recentYear = (parseInt(currentYear) - 2).toString();
  const hasRecentContent = new RegExp(`20[2-9][4-9]|20[3-9][0-9]`).test(html);
  checks.push({ id: 'recent-content', label: 'Content references recent dates', passed: hasRecentContent, weight: 1.5 });
  if (hasRecentContent) score += 1.5;

  const hasCurrentCopyright = new RegExp(currentYear).test(html);
  checks.push({ id: 'copyright-year', label: `Copyright year ${currentYear}`, passed: hasCurrentCopyright, weight: 1 });
  if (hasCurrentCopyright) score += 1;

  return { score, maxScore, checks, passed: checks.filter((c) => c.passed).length, total: checks.length };
}

export { analyzeFreshness };
