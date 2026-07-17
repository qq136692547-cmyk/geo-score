function analyzeNegativeSignals(html) {
  const checks = [];
  const deductions = [];

  if (!html) {
    return { score: 0, maxScore: 0, checks: [
      { id: 'excessive-cta', label: 'Excessive CTA density', passed: false, severity: 'medium' },
      { id: 'popups', label: 'Popup/modal interference', passed: false, severity: 'medium' },
      { id: 'thin-content', label: 'Thin content', passed: false, severity: 'high' },
      { id: 'broken-links', label: 'Broken links', passed: true, severity: 'medium' },
      { id: 'keyword-stuffing', label: 'Keyword stuffing', passed: true, severity: 'medium' },
      { id: 'missing-author', label: 'Missing author signal', passed: true, severity: 'low' },
      { id: 'excessive-boilerplate', label: 'Excessive boilerplate', passed: true, severity: 'low' },
      { id: 'mixed-signals', label: 'Mixed signals (H1/content mismatch)', passed: true, severity: 'low' },
    ], deductions: [], passed: 8, total: 8 };
  }

  const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text.split(/\s+/).filter(Boolean).length;

  // Excessive CTA
  const ctaCount = (html.match(/(buy now|sign up|subscribe|get started|shop now|free trial|contact us)/gi) || []).length;
  const ctaThreshold = Math.max(5, Math.floor(words * 0.01));
  const ctaFlag = ctaCount > ctaThreshold;
  checks.push({ id: 'excessive-cta', label: `CTA count: ${ctaCount} (threshold: ${ctaThreshold})`, passed: !ctaFlag, severity: 'medium' });
  if (ctaFlag) deductions.push({ id: 'excessive-cta', label: 'Excessive CTA density', deduction: 3, severity: 'medium' });

  // Popups
  const hasPopups = /modal|overlay|lightbox|popup/i.test(html);
  checks.push({ id: 'popups', label: 'Popup/modal elements detected', passed: !hasPopups, severity: 'medium' });
  if (hasPopups) deductions.push({ id: 'popups', label: 'Popup/modal interference', deduction: 3, severity: 'medium' });

  // Thin content
  const thinContent = words < 300;
  checks.push({ id: 'thin-content', label: `Content ${words} words`, passed: !thinContent, severity: 'high' });
  if (thinContent) deductions.push({ id: 'thin-content', label: 'Thin content (<300 words)', deduction: 5, severity: 'high' });

  // Broken links check (basic — invalid href patterns)
  const brokenLinkPatterns = /href=["\']#["\']|href=["\']javascript:["\']|href=["\'](\s*)["\']/gi;
  const brokenCount = (html.match(brokenLinkPatterns) || []).length;
  checks.push({ id: 'broken-links', label: `${brokenCount} suspicious link(s)`, passed: brokenCount <= 3, severity: 'medium' });
  if (brokenCount > 3) deductions.push({ id: 'broken-links', label: 'Broken or empty links', deduction: 2, severity: 'medium' });

  // Keyword stuffing (rough check)
  const commonStopwords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
  const wordFreq = {};
  text.toLowerCase().split(/\s+/).filter(Boolean).forEach(w => {
    if (!commonStopwords.includes(w) && w.length > 3) wordFreq[w] = (wordFreq[w] || 0) + 1;
  });
  const maxFreq = Math.max(...Object.values(wordFreq), 0);
  const wordTotal = Object.keys(wordFreq).length || 1;
  const maxDensity = maxFreq / wordTotal;
  const stuffingFlag = maxDensity > 0.025 && maxFreq > 5;
  checks.push({ id: 'keyword-stuffing', label: `Top keyword density: ${(maxDensity * 100).toFixed(1)}%`, passed: !stuffingFlag, severity: 'medium' });
  if (stuffingFlag) deductions.push({ id: 'keyword-stuffing', label: 'Keyword stuffing', deduction: 2, severity: 'medium' });

  // Missing author
  const hasAuthor = /rel=["\']author["\']|<meta[^>]+name=["\']author["\']/i.test(html);
  checks.push({ id: 'missing-author', label: 'Author signal found', passed: hasAuthor, severity: 'low' });
  if (!hasAuthor) deductions.push({ id: 'missing-author', label: 'Missing author signal', deduction: 1, severity: 'low' });

  // Boilerplate ratio (nav/footer vs content)
  const navContent = (html.match(/<nav[^>]*>/gi) || []).length + (html.match(/<footer[^>]*>/gi) || []).length;
  const bodyContent = (html.match(/<article[^>]*>/gi) || []).length + (html.match(/<main[^>]*>/gi) || []).length + (html.match(/<section[^>]*>/gi) || []).length;
  const boilerplateFlag = navContent > 0 && bodyContent === 0;
  checks.push({ id: 'excessive-boilerplate', label: boilerplateFlag ? 'Excessive boilerplate (no main/article)' : 'Content/boilerplate ratio OK', passed: !boilerplateFlag, severity: 'low' });
  if (boilerplateFlag) deductions.push({ id: 'excessive-boilerplate', label: 'Excessive boilerplate', deduction: 1, severity: 'low' });

  // Mixed signals
  const hasH1 = /<h1[^>]*>/i.test(html);
  const h1Promise = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const h1Text = h1Promise ? h1Promise[1] : '';
  const h1Long = h1Text.length > 10;
  const mixedFlag = hasH1 && h1Long && words < 200 && !h1Text.toLowerCase().includes('redirect');
  checks.push({ id: 'mixed-signals', label: mixedFlag ? 'H1 promises depth but content is thin' : 'H1/content match OK', passed: !mixedFlag, severity: 'low' });
  if (mixedFlag) deductions.push({ id: 'mixed-signals', label: 'Mixed signals (H1/content mismatch)', deduction: 1, severity: 'low' });

  const totalDeduction = deductions.reduce((sum, d) => sum + d.deduction, 0);
  const severityLevel = deductions.filter(d => d.severity === 'high').length >= 2 ? 'high' :
    deductions.length >= 3 ? 'medium' :
    deductions.length >= 1 ? 'low' : 'none';

  return {
    score: totalDeduction,
    maxScore: 0,
    deductions,
    checks,
    severity: severityLevel,
    passed: checks.filter((c) => c.passed).length,
    total: checks.length
  };
}

export { analyzeNegativeSignals };
