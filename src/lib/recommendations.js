const DIMENSION_LABELS = {
  aiCrawlability: 'AI Crawlability (Robots.txt)',
  aiGuidance: 'AI Guidance (llms.txt)',
  structuredData: 'Structured Data (Schema)',
  metaSocial: 'Meta & Social Tags',
  contentQuality: 'Content Quality',
  eeat: 'E-E-A-T Signals',
  brandEntity: 'Brand & Entity',
  citationReadiness: 'Citation Readiness',
  discoveryEndpoints: 'Discovery Endpoints',
  agentFriendliness: 'Agent-Friendliness',
  freshness: 'Freshness & Maintenance',
};

function generateRecommendations(dimensions, negativeResult, scoring) {
  const recommendations = [];

  // Per-dimension failed checks
  for (const [key, dim] of Object.entries(dimensions)) {
    if (!dim.checks) continue;
    for (const check of dim.checks) {
      if (!check.passed) {
        const priority = DIMENSION_WEIGHTS[key] >= 10 ? 'high' : DIMENSION_WEIGHTS[key] >= 6 ? 'medium' : 'low';
        recommendations.push({
          dimension: DIMENSION_LABELS[key] || key,
          dimensionKey: key,
          issue: check.label,
          priority,
          fix: getFixSuggestion(key, check.id),
        });
      }
    }
  }

  // Negative signal deductions
  if (negativeResult?.deductions) {
    for (const d of negativeResult.deductions) {
      recommendations.push({
        dimension: 'Negative Signals',
        dimensionKey: 'negativeSignals',
        issue: d.label,
        priority: d.severity === 'high' ? 'high' : d.severity === 'medium' ? 'medium' : 'low',
        fix: getNegativeFix(d.id),
      });
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}

function getFixSuggestion(dimension, checkId) {
  const fixes = {
    aiCrawlability: {
      'oai-searchbot': 'Add `User-agent: OAI-SearchBot` with `Allow: /` to robots.txt',
      'perplexity': 'Add `User-agent: PerplexityBot` with `Allow: /` to robots.txt',
      'claudebot': 'Add `User-agent: ClaudeBot` with `Allow: /` to robots.txt',
      'google-extended': 'Add `User-agent: Google-Extended` with `Allow: /` to robots.txt',
      'gptbot': 'Add `User-agent: GPTBot` with `Disallow: /` to robots.txt to prevent training',
      'anthropic-ai': 'Add `User-agent: anthropic-ai` with `Disallow: /` to robots.txt to prevent training',
    },
    aiGuidance: {
      'exists': 'Create an llms.txt file at your site root following the llms.txt standard',
      'structure': 'Add an H1 title and a blockquote summary at the top of llms.txt',
      'areas': 'Organize links into at least 2 sections (## Section) in llms.txt',
      'links': 'Add descriptive markdown links: [Title](url) with brief descriptions',
      'length': 'Keep llms.txt under 200 lines for optimal AI parsing',
    },
    structuredData: {
      'org': 'Add Organization schema with name, url, logo, and sameAs properties',
      'article': 'Add Article schema with headline, author, datePublished on blog posts',
      'faq': 'Add FAQPage schema with Question/Answer pairs for Q&A content',
      'howto': 'Add HowTo schema for instructional content',
      'props': 'Populate at least 5 properties per schema block for completeness',
    },
    metaSocial: {
      'og-title': 'Add a unique og:title meta tag to each page',
      'og-desc': 'Add og:description with 120-200 characters',
      'twitter-card': 'Add twitter:card meta tag (summary, summary_large_image, etc.)',
      'canonical': 'Add canonical URL to prevent duplicate content issues',
      'lang': 'Set the HTML lang attribute to match your content language',
    },
    contentQuality: {
      'h1': 'Ensure each page has exactly one descriptive H1 heading',
      'wordcount': 'Aim for at least 600-800 words of substantive content per page',
      'stats': 'Include specific statistics with cited sources to boost credibility',
      'headings': 'Use a clear H1 → H2 → H3 hierarchy throughout the page',
      'lists': 'Add bullet lists, numbered lists, or tables for scannable content',
      'citations': 'Link to 3+ authoritative external sources (.edu, .gov, industry leaders)',
    },
    eeat: {
      'author': 'Add author bylines with rel="author" on all content pages',
      'author-schema': 'Add Person schema markup with author credentials',
      'trust-pages': 'Create or link to About, Privacy Policy, and Terms pages',
      'reviews': 'Display reviews, testimonials, or trust badges',
      'https-eeat': 'Enable HTTPS, set HSTS and CSP headers',
    },
    brandEntity: {
      'brand-consistent': 'Use a consistent brand name across title, OG tags, and schema',
      'about-page': 'Add a detailed About page with team and company information',
      'contact': 'Make contact information (email, phone, address) easily findable',
      'sameas': 'Add sameAs links to Organization schema (GitHub, Twitter, LinkedIn, etc.)',
    },
    citationReadiness: {
      'ext-links': 'Add more external links to authoritative sources',
      'stats': 'Include specific numbers, percentages, and dollar amounts',
      'quotes': 'Add expert quotations with name, title, and source attribution',
      'research': 'Publish original research, survey data, or case studies',
      'edu-gov': 'Seek citations or links from .edu and .gov domains',
    },
    discoveryEndpoints: {
      'ai-txt': 'Create .well-known/ai.txt for AI crawler discovery',
      'ai-summary': 'Create /ai/summary.json with a structured site overview for AI',
      'ai-faq': 'Create /ai/faq.json with structured Q&A content for AI engines',
    },
    agentFriendliness: {
      'api-endpoints': 'Document API endpoints clearly for AI agents',
      'structured-output': 'Add JSON-LD structured data for AI extraction',
      'rate-limits': 'Include rate limiting headers in API responses',
      'sitemap': 'Ensure sitemap.xml is available and up to date',
    },
    freshness: {
      'date-modified': 'Add dateModified meta or Last-Modified header to pages',
      'recent-content': 'Update content to reference recent dates and developments',
      'copyright-year': 'Update copyright year to the current year in the footer',
    },
  };
  return fixes[dimension]?.[checkId] || 'Review this area and align with GEO best practices';
}

function getNegativeFix(id) {
  const fixes = {
    'excessive-cta': 'Keep CTAs under 5 per page; maintain a 90/10 informative-to-promotional ratio',
    'popups': 'Minimize popups/modals; use banner-style CTAs instead of intrusive overlays',
    'thin-content': 'Expand content to at least 300 words; match depth to heading promises',
    'broken-links': 'Run a broken link checker monthly and fix or remove dead links',
    'keyword-stuffing': 'Write naturally; use synonyms and vary phrasing',
    'missing-author': 'Add author bylines with Person schema markup on all content',
    'excessive-boilerplate': 'Reduce nav/footer size; prioritize content area in HTML order',
    'mixed-signals': 'Ensure each H1/H2 is backed by substantive content that fulfills the promise',
  };
  return fixes[id] || 'Review and fix this negative signal';
}

const DIMENSION_WEIGHTS = {
  aiCrawlability: 12, aiGuidance: 12, structuredData: 14, metaSocial: 10,
  contentQuality: 12, eeat: 8, brandEntity: 8, citationReadiness: 8,
  discoveryEndpoints: 6, agentFriendliness: 4, freshness: 4,
};

export { generateRecommendations, DIMENSION_LABELS };
