function analyzeCitations(html) {
  const checks = [];
  let score = 0;
  const maxScore = 8;

  const allChecks = [
    // --- Original 15 checks ---
    { id: 'ext-links', label: 'External links to authoritative domains', weight: 2 },
    { id: 'stats', label: 'Statistics with specific numbers', weight: 2 },
    { id: 'quotes', label: 'Expert quotations with attribution', weight: 2 },
    { id: 'research', label: 'Original research or data', weight: 1 },
    { id: 'edu-gov', label: 'Links to .edu or .gov domains', weight: 1 },
    { id: 'cite-tags', label: 'Proper citation markup (cite/blockquote)', weight: 1 },
    { id: 'data-tables', label: 'Structured data tables', weight: 1 },
    { id: 'faq-schema', label: 'FAQ or Q&A format content', weight: 1 },
    { id: 'comparisons', label: 'Comparison or benchmark data', weight: 1 },
    { id: 'case-studies', label: 'Case studies or real examples', weight: 1 },
    { id: 'definitions', label: 'Clear definitions for key terms', weight: 1 },
    { id: 'numbered-steps', label: 'Numbered step-by-step instructions', weight: 1 },
    { id: 'images-alt', label: 'Images with descriptive alt text', weight: 1 },
    { id: 'internal-links', label: 'Internal contextual links', weight: 1 },
    { id: 'timestamps', label: 'Content with publication/update dates', weight: 1 },
    // --- New 10 checks (15→25) ---
    { id: 'blockquote-count', label: 'Blockquote elements for quotable passages', weight: 1 },
    { id: 'authoritative-links', label: 'Links to authoritative sources (.org/.ac./known domains)', weight: 1 },
    { id: 'article-schema', label: 'Article JSON-LD schema detected', weight: 1 },
    { id: 'passage-density', label: 'Dense informational passages (>150 words/paragraph)', weight: 1 },
    { id: 'connective-words', label: 'Logical connectives (however/moreover/therefore)', weight: 1 },
    { id: 'question-headings', label: 'Question-format headings for voice search', weight: 1 },
    { id: 'reference-section', label: 'References or further reading section', weight: 1 },
    { id: 'nuance-signals', label: 'Nuance/honesty signals (limitations/caveats)', weight: 1 },
    { id: 'social-proof', label: 'Social proof (testimonials/reviews/ratings)', weight: 1 },
    { id: 'accessibility-aria', label: 'ARIA landmarks for accessibility', weight: 1 },
  ];

  if (!html) {
    return {
      score: 0, maxScore, checks: allChecks.map(c => ({ ...c, passed: false })), passed: 0, total: allChecks.length
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
  const hasQuotes = /["\u201C][^"\u201D]{10,}["\u201D]\s*[-\u2013\u2014]\s*\w+/g.test(text) || /<blockquote[^>]*>/i.test(html);
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
    /"@type"\s*:\s*"FAQPage"/i.test(html) || /<details[^>]*>.*?<summary[^>]*>.*?<\/summary>/is.test(html);
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

  // 16. Blockquote count (weight 1) — GeoReady "Quotation Addition"
  const blockquoteCount = (html.match(/<blockquote[^>]*>/gi) || []).length;
  checks.push({ id: 'blockquote-count', label: `${blockquoteCount} blockquote(s) for quotable passages`, passed: blockquoteCount >= 1, weight: 1 });
  if (blockquoteCount >= 1) score += 1;

  // 17. Authoritative links (.org, .ac., well-known domains) (weight 1)
  const authoritativeDomains = /\.(org|ac\.[a-z]{2,3}|edu)\b/i;
  const knownDomains = /w3\.org|mozilla\.org|eff\.org|ieee\.org|who\.int|nature\.com|science\.org|wikipedia\.org|wikidata\.org|github\.com/i;
  const authoritativeLinks = externalLinks.filter(l => authoritativeDomains.test(l) || knownDomains.test(l)).length;
  checks.push({ id: 'authoritative-links', label: `${authoritativeLinks} authoritative source link(s)`, passed: authoritativeLinks >= 2, weight: 1 });
  if (authoritativeLinks >= 2) score += 1;

  // 18. Article JSON-LD schema (weight 1) — GeoReady "Blog Structure"
  const hasArticleSchema = /"@type"\s*:\s*"Article"|"@type"\s*:\s*"BlogPosting"|"@type"\s*:\s*"NewsArticle"/i.test(html);
  checks.push({ id: 'article-schema', label: 'Article JSON-LD schema detected', passed: hasArticleSchema, weight: 1 });
  if (hasArticleSchema) score += 1;

  // 19. Passage density (weight 1) — GeoReady "Passage Density"
  const paragraphs = (html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || []).map(p => stripHtmlSimple(p));
  const denseParagraphs = paragraphs.filter(p => p.split(/\s+/).filter(Boolean).length >= 150).length;
  const denseRatio = paragraphs.length > 0 ? denseParagraphs / paragraphs.length : 0;
  checks.push({ id: 'passage-density', label: `${denseParagraphs} dense paragraph(s) (${(denseRatio * 100).toFixed(0)}% of ${paragraphs.length})`, passed: denseParagraphs >= 1, weight: 1 });
  if (denseParagraphs >= 1) score += 1;

  // 20. Logical connectives (weight 1) — GeoReady "Fluency Optimization"
  const connectiveMatches = text.match(/\b(however|moreover|therefore|furthermore|consequently|nevertheless|thus|hence|accordingly|additionally|in addition|on the other hand|in contrast)\b/gi) || [];
  checks.push({ id: 'connective-words', label: `${connectiveMatches.length} logical connective(s)`, passed: connectiveMatches.length >= 2, weight: 1 });
  if (connectiveMatches.length >= 2) score += 1;

  // 21. Question-format headings (weight 1) — GeoReady "Voice Search Ready"
  const headings = html.match(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi) || [];
  const questionHeadings = headings.filter(h => /\?\s*$/.test(stripHtmlSimple(h))).length;
  checks.push({ id: 'question-headings', label: `${questionHeadings} question-format heading(s)`, passed: questionHeadings >= 1, weight: 1 });
  if (questionHeadings >= 1) score += 1;

  // 22. Reference section (weight 1) — GeoReady "Attribution Completeness"
  const hasReferenceSection = /\b(references|further reading|sources?|bibliography|works cited|cited sources?)\b/i.test(text) ||
    /<section[^>]*(?:id|class)=["'][^"']*(?:ref|source|biblio)[^"']*["']/i.test(html) ||
    /<footer[^>]*>[\s\S]*?\b(references|sources?)\b/i.test(html);
  checks.push({ id: 'reference-section', label: 'References or further reading section', passed: hasReferenceSection, weight: 1 });
  if (hasReferenceSection) score += 1;

  // 23. Nuance/honesty signals (weight 1) — GeoReady "Nuance/Honesty Signals"
  const nuanceMatches = text.match(/\b(however|on the other hand|limitation|caveat|drawback|trade-off|tradeoff|while .{0,30}(?:may|might|can|could)|it should be noted|important to note|with the caveat|despite this|nonetheless|importantly)\b/gi) || [];
  checks.push({ id: 'nuance-signals', label: `${nuanceMatches.length} nuance signal(s)`, passed: nuanceMatches.length >= 1, weight: 1 });
  if (nuanceMatches.length >= 1) score += 1;

  // 24. Social proof (weight 1) — GeoReady "Social Proof"
  const hasSocialProof = /\b(testimonial|review|rating|rated|stars?|customer feedback|user review|verified purchase|aggregate rating)\b/i.test(text) ||
    /"@type"\s*:\s*"(?:Review|AggregateRating)"/i.test(html);
  checks.push({ id: 'social-proof', label: 'Social proof (testimonials/reviews/ratings)', passed: hasSocialProof, weight: 1 });
  if (hasSocialProof) score += 1;

  // 25. ARIA landmarks (weight 1) — GeoReady "Accessibility Signals"
  const ariaLandmarks = html.match(/\brole=["'](?:banner|main|nav|contentinfo|search|complementary|region|form)["']/gi) || [];
  const html5Landmarks = html.match(/<(?:header|nav|main|footer|aside|section)[^>]*>/gi) || [];
  const totalLandmarks = ariaLandmarks.length + html5Landmarks.length;
  checks.push({ id: 'accessibility-aria', label: `${totalLandmarks} ARIA/semantic landmark(s)`, passed: totalLandmarks >= 3, weight: 1 });
  if (totalLandmarks >= 3) score += 1;

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
