function analyzeCitations(html) {
  const checks = [];
  let score = 0;
  const maxScore = 8;

  if (!html) {
    return {
      score: 0, maxScore, checks: [
        { id: 'ext-links', label: 'External links to authoritative domains', passed: false, weight: 2 },
        { id: 'stats', label: 'Statistics with specific numbers', passed: false, weight: 2 },
        { id: 'quotes', label: 'Expert quotations with attribution', passed: false, weight: 2 },
        { id: 'research', label: 'Original research or data', passed: false, weight: 1 },
        { id: 'edu-gov', label: 'Links to .edu or .gov domains', passed: false, weight: 1 },
        { id: 'cite-tags', label: 'Proper citation markup (cite/blockquote)', passed: false, weight: 1 },
        { id: 'data-tables', label: 'Structured data tables', passed: false, weight: 1 },
        { id: 'faq-schema', label: 'FAQ or Q&A format content', passed: false, weight: 1 },
        { id: 'comparisons', label: 'Comparison or benchmark data', passed: false, weight: 1 },
        { id: 'case-studies', label: 'Case studies or real examples', passed: false, weight: 1 },
        { id: 'definitions', label: 'Clear definitions for key terms', passed: false, weight: 1 },
        { id: 'numbered-steps', label: 'Numbered step-by-step instructions', passed: false, weight: 1 },
        { id: 'images-alt', label: 'Images with descriptive alt text', passed: false, weight: 1 },
        { id: 'internal-links', label: 'Internal contextual links', passed: false, weight: 1 },
        { id: 'timestamps', label: 'Content with publication/update dates', passed: false, weight: 1 },
      ], passed: 0, total: 15
    };
  }

  const text = stripHtmlSimple(html);
  const words = text.split(/\s+/).filter(Boolean);

  // 1. External links (weight 2)
  const externalLinks = (html.match(/<a[^>]+href=["']https?:\/\/[^"']+["'][^>]*>/gi) || []);
  const totalExternal = externalLinks.length;
  checks.push({ id: 'ext-links', label: `${totalExternal} external link(s)`, passed: totalExternal >= 3, weight: 2 });
  if (totalExternal >= 3) score += 2;

  // 2. Statistics with specific numbers (weight 2)
  const statsMatches = text.match(/\d+%|\d+\.\d+|\$\d+|\d+x\b/gi) || [];
  const hasStats = statsMatches.length >= 2;
  checks.push({ id: 'stats', label: `${statsMatches.length} statistic(s) found`, passed: hasStats, weight: 2 });
  if (hasStats) score += 2;

  // 3. Expert quotations with attribution (weight 2)
  const hasQuotes = /["\u201C][^"\u201D]{10,}["\u201D]\s*[-–—]\s*\w+/g.test(text) || /<blockquote[^>]*>/i.test(html);
  checks.push({ id: 'quotes', label: 'Expert quotations with attribution', passed: hasQuotes, weight: 2 });
  if (hasQuotes) score += 2;

  // 4. Original research or data (weight 1)
  const hasResearch = /study|research|survey|report|analysis|data|experiment|finding/i.test(text);
  checks.push({ id: 'research', label: 'Original research or data references', passed: hasResearch, weight: 1 });
  if (hasResearch) score += 1;

  // 5. .edu / .gov links (weight 1)
  const eduGovLinks = externalLinks.filter(l => /\.edu\b|\.gov\b/.test(l)).length;
  checks.push({ id: 'edu-gov', label: `${eduGovLinks} link(s) to .edu/.gov`, passed: eduGovLinks >= 1, weight: 1 });
  if (eduGovLinks >= 1) score += 1;

  // 6. Proper citation markup (cite, blockquote with cite attr) (weight 1)
  const hasCiteTags = /<cite[^>]*>/i.test(html) || /<blockquote[^>]+cite=/i.test(html);
  checks.push({ id: 'cite-tags', label: 'Citation markup (cite/blockquote)', passed: hasCiteTags, weight: 1 });
  if (hasCiteTags) score += 1;

  // 7. Structured data tables (weight 1)
  const hasTables = /<table[^>]*>/i.test(html);
  checks.push({ id: 'data-tables', label: 'Structured data tables', passed: hasTables, weight: 1 });
  if (hasTables) score += 1;

  // 8. FAQ or Q&A format (weight 1)
  const hasFaq = /faq|frequently asked|Q\s*[&]&\s*A|Q\d|question.{0,20}answer/i.test(text) ||
    /"@\type"\s*:\s*"FAQPage"/i.test(html) || /<details[^>]*>.*?<summary[^>]*>.*?<\/summary>/is.test(html);
  checks.push({ id: 'faq-schema', label: 'FAQ or Q&A format content', passed: hasFaq, weight: 1 });
  if (hasFaq) score += 1;

  // 9. Comparison or benchmark data (weight 1)
  const hasComparison = /\bvs\.?\b|versus|compared to|comparison|benchmark|faster than|better than|more than/i.test(text);
  checks.push({ id: 'comparisons', label: 'Comparison or benchmark data', passed: hasComparison, weight: 1 });
  if (hasComparison) score += 1;

  // 10. Case studies or real examples (weight 1)
  const hasCaseStudy = /case study|case-study|real.world example|use case|example:|for example/i.test(text);
  checks.push({ id: 'case-studies', label: 'Case studies or real examples', passed: hasCaseStudy, weight: 1 });
  if (hasCaseStudy) score += 1;

  // 11. Clear definitions for key terms (weight 1)
  const hasDefinitions = /\b(is|are|means|refers to|defined as|definition:)\s+/i.test(text) ||
    /<dfn[^>]*>/i.test(html) || /<dl[^>]*>/i.test(html);
  checks.push({ id: 'definitions', label: 'Clear definitions for key terms', passed: hasDefinitions, weight: 1 });
  if (hasDefinitions) score += 1;

  // 12. Numbered step-by-step instructions (weight 1)
  const hasSteps = /<ol[^>]*>/i.test(html) || /\bstep\s*\d|step\s*1|step\s*2|step\s*3/i.test(text) ||
    /\b\d+\.\s+[A-Z]/.test(text);
  checks.push({ id: 'numbered-steps', label: 'Numbered step-by-step instructions', passed: hasSteps, weight: 1 });
  if (hasSteps) score += 1;

  // 13. Images with descriptive alt text (weight 1)
  const allImages = html.match(/<img[^>]+alt=["'][^"']+["'][^>]*>/gi) || [];
  const imagesWithoutAlt = html.match(/<img(?![^>]+alt=)[^>]*>/gi) || [];
  const hasGoodAlt = allImages.length >= 1 && imagesWithoutAlt.length === 0;
  checks.push({ id: 'images-alt', label: `${allImages.length} image(s) with alt, ${imagesWithoutAlt.length} without`, passed: hasGoodAlt, weight: 1 });
  if (hasGoodAlt) score += 1;

  // 14. Internal contextual links (weight 1)
  const internalLinks = (html.match(/<a[^>]+href=["']\/[^"']*["'][^>]*>/gi) || []).length +
    (html.match(/<a[^>]+href=["'][^"']*#[^"']*["'][^>]*>/gi) || []).length;
  checks.push({ id: 'internal-links', label: `${internalLinks} internal link(s)`, passed: internalLinks >= 3, weight: 1 });
  if (internalLinks >= 3) score += 1;

  // 15. Content with publication/update dates (weight 1)
  const hasDates = /<time[^>]+datetime=/i.test(html) ||
    /\b(published|updated|last modified|date published|date modified)\b/i.test(text) ||
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s*\d{4}/i.test(text);
  checks.push({ id: 'timestamps', label: 'Publication/update dates', passed: hasDates, weight: 1 });
  if (hasDates) score += 1;

  // Cap score at maxScore
  score = Math.min(score, maxScore);

  return {
    score,
    maxScore,
    checks,
    passed: checks.filter(c => c.passed).length,
    total: checks.length
  };
}

function stripHtmlSimple(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[^;]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export { analyzeCitations };
