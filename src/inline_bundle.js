// GeoScore inlined bundle

// --- lib/icons.js ---
/**
 * Minimal SVG icon set — inline SVGs, zero dependencies.
 * All icons: 24x24 viewBox, 2px stroke, round caps.
 */
var ICONS = {
  check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  cross: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  alert: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  markdown: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18v16H3z"/><path d="M8 15V9l3 3 3-3v6"/></svg>',
  json: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15v-2a2 2 0 0 1 2-2h1"/></svg>',
  csv: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><rect x="8" y="13" width="8" height="3" rx="1"/></svg>',
  scan: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/></svg>',
  globe: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  arrowUp: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
  external: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
};

ICONS;


// --- lib/fetcher.js ---
/**
 * Resource fetcher — tries direct browser fetch first,
 * then falls back to multiple public CORS proxies.
 */
var PROXIES = [
  "https://corsproxy.io/?url=",
  "https://api.allorigins.win/raw?url="
];

async function fetchResource(url, type) {
  if (!type) type = "text";

  // 1) Try direct browser fetch
  try {
    var res = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "follow" });
    if (res.ok || res.status === 404) {
      if (res.status === 404) return null;
      return type === "json" ? await res.json() : await res.text();
    }
  } catch (_) {}

  // 2) Try public CORS proxies
  for (var i = 0; i < PROXIES.length; i++) {
    try {
      var proxyUrl = PROXIES[i] + encodeURIComponent(url);
      var proxyRes = await fetch(proxyUrl, { signal: AbortSignal.timeout(12000) });
      if (proxyRes.ok) {
        return type === "json" ? await proxyRes.json() : await proxyRes.text();
      }
    } catch (_) {}
  }

  // 3) All attempts failed
  throw new Error(
    "Could not fetch " + url + ". The site may be blocking cross-origin requests. " +
    "Try auditing a different URL or check that the site is accessible."
  );
}



// --- lib/history.js ---
var HISTORY_KEY = 'geoscope_history';

function getHistory() {
  try {
    var data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
}

function addToHistory(result) {
  var history = getHistory();
  var entry = {
    id: Date.now().toString(36),
    url: result.url.replace(/https?:\/\//, "").replace(/\/$/, ""),
    score: result.score,
    level: result.level,
    timestamp: result.timestamp,
    dimensions: result.dimensions ? Object.fromEntries(
      Object.entries(result.dimensions).map(function(kv) { return [kv[0], kv[1].percentage || 0]; })
    ) : {}
  };
  var existing = history.findIndex(function(e) { return e.url === entry.url; });
  if (existing >= 0) history.splice(existing, 1);
  history.unshift(entry);
  if (history.length > 50) history = history.slice(0, 50);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (e) {}
  return entry;
}

function getUrlHistory(url) {
  var clean = url.replace(/https?:\/\//, "").replace(/\/$/, "");
  return getHistory().filter(function(e) { return e.url === clean; });
}

function getComparisonData(urls) {
  var all = getHistory();
  return urls.map(function(u) {
    var clean = u.replace(/https?:\/\//, "").replace(/\/$/, "");
    return all.find(function(e) { return e.url === clean; }) || null;
  }).filter(Boolean);
}

function clearHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
}



// --- lib/export.js ---
﻿function exportMarkdown(result) {
  const lines = [];
  lines.push(`# GEO Audit Report: ${result.url}`);
  lines.push(`**Date:** ${new Date(result.timestamp).toLocaleDateString()}`);
  lines.push(`**Score:** ${result.score}/100 — ${result.level}`);
  lines.push('');
  lines.push('## Dimensions');
  for (const [key, dim] of Object.entries(result.dimensions)) {
    const pct = typeof dim.percentage !== 'undefined' ? `${dim.percentage}%` : `${dim.score}/${dim.maxScore}`;
    lines.push(`- **${key}**: ${pct} (${dim.passed}/${dim.total} checks passed)`);
    for (const check of dim.checks || []) {
      lines.push(`  - [${check.passed ? 'x' : ' '}] ${check.label}`);
    }
  }
  if (result.negativeSignals?.deductions?.length) {
    lines.push('');
    lines.push('## Negative Signals');
    for (const d of result.negativeSignals.deductions) {
      lines.push(`- ⚠ ${d.label} (-${d.deduction} pts)`);
    }
  }
  lines.push('');
  lines.push('## Recommendations');
  for (const rec of result.recommendations || []) {
    lines.push(`- [${rec.priority}] ${rec.issue}`);
    lines.push(`  → ${rec.fix}`);
  }
  return lines.join('\n');
}

function exportJson(result) {
  return JSON.stringify(result, null, 2);
}

function exportCsv(result) {
  const lines = ['Dimension,Score,MaxScore,Passed,Total'];
  for (const [key, dim] of Object.entries(result.dimensions)) {
    lines.push(`${key},${dim.score},${dim.maxScore},${dim.passed},${dim.total}`);
  }
  return lines.join('\n');
}



// --- lib/scoring.js ---
﻿const DIMENSION_WEIGHTS = {
  aiCrawlability: 12,
  aiGuidance: 12,
  structuredData: 14,
  metaSocial: 10,
  contentQuality: 12,
  eeat: 8,
  brandEntity: 8,
  citationReadiness: 8,
  discoveryEndpoints: 6,
  agentFriendliness: 4,
  freshness: 4,
};
var TOTAL_WEIGHT = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);

function computeScore(dimensions, negativeResult) {
  const dimensionScores = {};
  let weightedSum = 0;

  for (const [key, dim] of Object.entries(dimensions)) {
    const weight = DIMENSION_WEIGHTS[key];
    const dimScore = dim.maxScore > 0 ? (dim.score / dim.maxScore) * weight : 0;
    dimensionScores[key] = {
      ...dim,
      weight,
      weightedScore: Math.round(dimScore * 10) / 10,
      percentage: dim.maxScore > 0 ? Math.round((dim.score / dim.maxScore) * 100) : 0,
    };
    weightedSum += dimScore;
  }

  let total = Math.round((weightedSum / TOTAL_WEIGHT) * 100);
  const deduction = negativeResult?.deductions?.reduce((s, d) => s + (d.deduction || 0), 0) || 0;
  total = Math.max(0, total - deduction);

  let level;
  if (total >= 86) level = 'Excellent';
  else if (total >= 68) level = 'Good';
  else if (total >= 36) level = 'Basic';
  else level = 'Critical';

  return { total, level, dimensions: dimensionScores, deduction };
}



// --- lib/recommendations.js ---
﻿const DIMENSION_LABELS = {
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

// DIMENSION_WEIGHTS already defined above



// --- lib/scanner.js ---
﻿/**
 * Main scanner — orchestrates fetching and analysis across all 12 dimensions.
 */
















async function auditUrl(url) {
  const normalized = normalizeUrl(url);
  const base = new URL(normalized);
  const origin = base.origin;

  const [robotsTxt, llmsTxt, pageHtml, aiTxt, aiSummary, aiFaq] = await Promise.all([
    fetchResource(`${origin}/robots.txt`),
    fetchResource(`${origin}/llms.txt`),
    fetchResource(normalized),
    fetchResource(`${origin}/.well-known/ai.txt`),
    fetchResource(`${origin}/ai/summary.json`, 'json'),
    fetchResource(`${origin}/ai/faq.json`, 'json'),
  ]);

  const robotsResult = analyzeRobots(robotsTxt);
  const llmsResult = analyzeLlmstxt(llmsTxt);
  const schemaResult = analyzeSchema(pageHtml);
  const metaResult = analyzeMeta(pageHtml);
  const contentResult = analyzeContent(pageHtml);
  const eeatResult = analyzeEeat(pageHtml, schemaResult);
  const brandResult = analyzeBrand(pageHtml, schemaResult);
  const citationsResult = analyzeCitations(pageHtml);
  const discoveryResult = analyzeDiscovery(aiTxt, aiSummary, aiFaq);
  const agentResult = analyzeAgentFriendly(pageHtml, robotsTxt, llmsTxt);
  const freshnessResult = analyzeFreshness(pageHtml);
  const negativeResult = analyzeNegativeSignals(pageHtml);

  const dimensions = {
    aiCrawlability: robotsResult,
    aiGuidance: llmsResult,
    structuredData: schemaResult,
    metaSocial: metaResult,
    contentQuality: contentResult,
    eeat: eeatResult,
    brandEntity: brandResult,
    citationReadiness: citationsResult,
    discoveryEndpoints: discoveryResult,
    agentFriendliness: agentResult,
    freshness: freshnessResult,
  };

  const scoring = computeScore(dimensions, negativeResult);
  const recommendations = generateRecommendations(dimensions, negativeResult, scoring);

  return {
    url: normalized,
    timestamp: new Date().toISOString(),
    score: scoring.total,
    level: scoring.level,
    dimensions: scoring.dimensions,
    negativeSignals: negativeResult,
    seoSupplement: extractSeoSupplement(pageHtml, normalized),
    recommendations,
    raw: {
      robotsTxt: robotsTxt || null,
      llmsTxt: llmsTxt || null,
      pageHtml: pageHtml ? pageHtml.slice(0, 500) : null,
    }
  };
}

function normalizeUrl(url) {
  url = url.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const u = new URL(url);
  return u.origin + u.pathname.replace(/\/$/, '') || u.origin + '/';
}

function extractSeoSupplement(html, url) {
  const results = { https: false, hasTitle: false, hasMetaDesc: false, responsive: false };
  if (url.startsWith('https://')) results.https = true;
  if (!html) return results;
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  results.hasTitle = !!(titleMatch && titleMatch[1].trim().length > 0);
  const descMatch = html.match(/<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"']+)["\'][^>]*>/i);
  results.hasMetaDesc = !!(descMatch && descMatch[1].trim().length > 0);
  const viewportMatch = html.match(/<meta[^>]+name=["\']viewport["\'][^>]*>/i);
  results.responsive = !!viewportMatch;
  return results;
}



// --- lib/analyzers/robots.js ---
﻿const CHECKS = [
  { id: 'oai-searchbot', label: 'OAI-SearchBot allowed', weight: 3, check: (txt) => /User-agent:\s*OAI-SearchBot/i.test(txt) && /Allow:\s*\//i.test(txt.split(/User-agent:\s*OAI-SearchBot/i)[1].split(/\nUser-agent:/i)[0]) },
  { id: 'perplexity', label: 'PerplexityBot allowed', weight: 3, check: (txt) => /User-agent:\s*PerplexityBot/i.test(txt) && /Allow:\s*\//i.test(txt.split(/User-agent:\s*PerplexityBot/i)[1].split(/\nUser-agent:/i)[0]) },
  { id: 'claudebot', label: 'ClaudeBot allowed', weight: 3, check: (txt) => /User-agent:\s*ClaudeBot/i.test(txt) && /Allow:\s*\//i.test(txt.split(/User-agent:\s*ClaudeBot/i)[1].split(/\nUser-agent:/i)[0]) },
  { id: 'google-extended', label: 'Google-Extended allowed', weight: 3, check: (txt) => /User-agent:\s*Google-Extended/i.test(txt) && /Allow:\s*\//i.test(txt.split(/User-agent:\s*Google-Extended/i)[1].split(/\nUser-agent:/i)[0]) },
  { id: 'gptbot', label: 'GPTBot disallowed', weight: 3, check: (txt) => /User-agent:\s*GPTBot/i.test(txt) && (/Disallow:\s*\//i.test(txt.split(/User-agent:\s*GPTBot/i)[1].split(/\nUser-agent:/i)[0]) || !/Allow:/i.test(txt.split(/User-agent:\s*GPTBot/i)[1].split(/\nUser-agent:/i)[0])) },
  { id: 'anthropic-ai', label: 'anthropic-ai disallowed', weight: 3, check: (txt) => /User-agent:\s*anthropic-ai/i.test(txt) && (/Disallow:\s*\//i.test(txt.split(/User-agent:\s*anthropic-ai/i)[1].split(/\nUser-agent:/i)[0]) || !/Allow:/i.test(txt.split(/User-agent:\s*anthropic-ai/i)[1].split(/\nUser-agent:/i)[0])) },
];

function analyzeRobots(robotsTxt) {
  const checks = CHECKS.map((c) => ({
    id: c.id,
    label: c.label,
    passed: robotsTxt ? c.check(robotsTxt) : false,
    weight: c.weight,
  }));
  const passed = checks.filter((c) => c.passed).length;
  const total = checks.length;
  const score = Math.round((passed / total) * 12);
  return { score, maxScore: 12, checks, passed, total };
}



// --- lib/analyzers/llmstxt.js ---
﻿function analyzeLlmstxt(llmsTxt) {
  const checks = [];
  let score = 0;
  const maxScore = 12;

  // Exists at root
  const exists = llmsTxt !== null && llmsTxt !== undefined;
  checks.push({ id: 'exists', label: 'llms.txt exists at root', passed: exists, weight: 4 });
  if (exists) score += 4;

  if (exists) {
    const lines = llmsTxt.split('\n');
    const hasH1 = /^#\s+\S/.test(llmsTxt);
    const hasBlockquote = />\s+\S/.test(llmsTxt);
    checks.push({ id: 'structure', label: 'Has H1 + blockquote structure', passed: hasH1 && hasBlockquote, weight: 3 });
    if (hasH1 && hasBlockquote) score += 3;

    const areaCount = (llmsTxt.match(/^##\s+\S/gm) || []).length;
    checks.push({ id: 'areas', label: `Has ${areaCount} area section(s) (need 2+)`, passed: areaCount >= 2, weight: 2 });
    if (areaCount >= 2) score += 2;

    const hasDescriptiveLinks = /\[.+\]\(https?:\/\/[^\)]+\)/.test(llmsTxt);
    checks.push({ id: 'links', label: 'Has descriptive links', passed: hasDescriptiveLinks, weight: 2 });
    if (hasDescriptiveLinks) score += 2;

    const under200 = lines.length <= 200;
    checks.push({ id: 'length', label: `Under 200 lines (${lines.length})`, passed: under200, weight: 1 });
    if (under200) score += 1;
  } else {
    checks.push({ id: 'structure', label: 'Has H1 + blockquote structure', passed: false, weight: 3 });
    checks.push({ id: 'areas', label: 'Has 2+ area sections', passed: false, weight: 2 });
    checks.push({ id: 'links', label: 'Has descriptive links', passed: false, weight: 2 });
    checks.push({ id: 'length', label: 'Under 200 lines', passed: false, weight: 1 });
  }

  return { score, maxScore, checks, passed: checks.filter((c) => c.passed).length, total: checks.length };
}



// --- lib/analyzers/schema.js ---
﻿function analyzeSchema(html) {
  const checks = [];
  let score = 0;
  const maxScore = 14;

  if (!html) {
    return { score: 0, maxScore, checks: [
      { id: 'org', label: 'Organization schema present', passed: false, weight: 3 },
      { id: 'article', label: 'Article schema present', passed: false, weight: 3 },
      { id: 'faq', label: 'FAQPage schema present', passed: false, weight: 3 },
      { id: 'howto', label: 'HowTo schema present', passed: false, weight: 2 },
      { id: 'props', label: '5+ properties per schema', passed: false, weight: 3 },
    ], passed: 0, total: 5 };
  }

  const blocks = extractJsonLd(html);

  const hasOrg = blocks.some((b) => b['@type'] === 'Organization' || b['@type']?.includes?.('Organization'));
  const hasArticle = blocks.some((b) => b['@type'] === 'Article' || b['@type'] === 'NewsArticle' || b['@type'] === 'BlogPosting');
  const hasFaq = blocks.some((b) => b['@type'] === 'FAQPage');
  const hasHowto = blocks.some((b) => b['@type'] === 'HowTo');

  checks.push({ id: 'org', label: 'Organization schema present', passed: hasOrg, weight: 3 });
  if (hasOrg) score += 3;

  checks.push({ id: 'article', label: 'Article schema on blog posts', passed: hasArticle, weight: 3 });
  if (hasArticle) score += 3;

  checks.push({ id: 'faq', label: 'FAQPage schema on Q&A content', passed: hasFaq, weight: 3 });
  if (hasFaq) score += 3;

  checks.push({ id: 'howto', label: 'HowTo schema present', passed: hasHowto, weight: 2 });
  if (hasHowto) score += 2;

  const allProps = blocks.reduce((acc, b) => acc + Object.keys(b).length, 0);
  const avgProps = blocks.length > 0 ? allProps / blocks.length : 0;
  const hasEnoughProps = avgProps >= 5;
  checks.push({ id: 'props', label: `Avg ${Math.round(avgProps)} properties per schema (need 5+)`, passed: hasEnoughProps, weight: 3 });
  if (hasEnoughProps) score += 3;

  return { score, maxScore, checks, passed: checks.filter((c) => c.passed).length, total: checks.length };
}

function extractJsonLd(html) {
  const blocks = [];
  const regex = /<script[^>]*type=["\']application\/ld\+json["\'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch { /* skip invalid JSON-LD */ }
  }
  return blocks;
}



// --- lib/analyzers/meta.js ---
﻿function analyzeMeta(html) {
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



// --- lib/analyzers/content.js ---
﻿function analyzeContent(html) {
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



// --- lib/analyzers/eeat.js ---
﻿function analyzeEeat(html, schemaResult) {
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

  const blocks = schemaResult?.raw?.blocks || [];
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



// --- lib/analyzers/brand.js ---
﻿function analyzeBrand(html, schemaResult) {
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



// --- lib/analyzers/citations.js ---
﻿function analyzeCitations(html) {
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



// --- lib/analyzers/discovery.js ---
﻿function analyzeDiscovery(aiTxt, aiSummary, aiFaq) {
  const checks = [];
  let score = 0;
  const maxScore = 6;

  // .well-known/ai.txt
  const hasAiTxt = aiTxt !== null && aiTxt !== undefined;
  checks.push({ id: 'ai-txt', label: '.well-known/ai.txt endpoint', passed: hasAiTxt, weight: 2 });
  if (hasAiTxt) score += 2;

  // /ai/summary.json
  const hasSummary = aiSummary !== null && aiSummary !== undefined && !(aiSummary instanceof Error);
  checks.push({ id: 'ai-summary', label: '/ai/summary.json endpoint', passed: !!hasSummary, weight: 2 });
  if (hasSummary) score += 2;

  // /ai/faq.json
  const hasFaq = aiFaq !== null && aiFaq !== undefined && !(aiFaq instanceof Error);
  checks.push({ id: 'ai-faq', label: '/ai/faq.json endpoint', passed: !!hasFaq, weight: 2 });
  if (hasFaq) score += 2;

  return { score, maxScore, checks, passed: checks.filter((c) => c.passed).length, total: checks.length };
}



// --- lib/analyzers/agentFriendly.js ---
﻿function analyzeAgentFriendly(html, robotsTxt, llmsTxt) {
  const checks = [];
  let score = 0;
  const maxScore = 4;

  if (!html) {
    return { score: 0, maxScore, checks: [
      { id: 'api-endpoints', label: 'API endpoints documented', passed: false, weight: 1 },
      { id: 'structured-output', label: 'Structured data for AI extraction', passed: false, weight: 1 },
      { id: 'rate-limits', label: 'Rate limiting headers', passed: false, weight: 1 },
      { id: 'sitemap', label: 'Sitemap.xml available', passed: false, weight: 1 },
    ], passed: 0, total: 4 };
  }

  const hasApiDocs = /api|endpoint|graphql|rest/i.test(html);
  checks.push({ id: 'api-endpoints', label: 'API endpoints documented', passed: hasApiDocs, weight: 1 });
  if (hasApiDocs) score += 1;

  const hasSchema = /<script[^>]*type=["\']application\/ld\+json["\']/i.test(html);
  checks.push({ id: 'structured-output', label: 'Structured data for AI extraction', passed: hasSchema, weight: 1 });
  if (hasSchema) score += 1;

  const hasRateLimit = /X-RateLimit|x-ratelimit/i.test(html);
  checks.push({ id: 'rate-limits', label: 'Rate limiting headers', passed: hasRateLimit, weight: 1 });
  if (hasRateLimit) score += 1;

  const hasSitemap = /sitemap/i.test(html);
  checks.push({ id: 'sitemap', label: 'Sitemap.xml available', passed: hasSitemap, weight: 1 });
  if (hasSitemap) score += 1;

  return { score, maxScore, checks, passed: checks.filter((c) => c.passed).length, total: checks.length };
}



// --- lib/analyzers/freshness.js ---
﻿function analyzeFreshness(html) {
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



// --- lib/analyzers/negativeSignals.js ---
﻿function analyzeNegativeSignals(html) {
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



// --- components/reportHeader.js ---


var BG_CLR = { Excellent: "bg-geo-500", Good: "bg-brand-500", Basic: "bg-warn-500", Critical: "bg-danger-500" };

function renderScoreHeader(r) {
  return '<div class="stagger-section fade-in-delay-1 flex flex-col lg:flex-row items-center gap-8 mb-10 p-8 card">' +
    '<div class="relative flex-shrink-0">' +
      '<svg class="w-28 h-28 -rotate-90" viewBox="0 0 120 120">' +
        '<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(148,163,184,0.1)" stroke-width="8"/>' +
        '<circle cx="60" cy="60" r="52" fill="none" stroke="url(#scoreGrad)" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + (r.score * 3.27) + ' 326.7" class="score-ring"/>' +
        '<defs><linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#22c55e"/><stop offset="100%" stop-color="#3b82f6"/></linearGradient></defs>' +
      '</svg>' +
      '<div class="absolute inset-0 flex items-center justify-center"><span class="text-4xl font-extrabold gradient-text">' + r.score + '</span></div>' +
    '</div>' +
    '<div class="flex-1 text-center lg:text-left">' +
      '<h1 class="text-2xl font-bold mb-1">GEO Audit Report</h1>' +
      '<a href="' + r.url + '" target="_blank" class="text-brand-500 hover:underline text-sm font-mono break-all">' + r.url + '</a>' +
      '<div class="mt-3 flex flex-wrap gap-2 justify-center lg:justify-start">' +
        '<span class="px-3 py-1 rounded-full text-xs font-bold text-white ' + BG_CLR[r.level] + '">' + r.level + '</span>' +
        '<span class="px-3 py-1 rounded-full text-xs bg-white/5 text-gray-400">' + r.timestamp + '</span>' +
      '</div>' +
      '<p class="mt-3 text-sm text-gray-400">' + r.summary + '</p>' +
    '</div>' +
  '</div>';
}


// --- components/radarChart.js ---
var LABELS = { aiCrawlability: "AI Crawlability", aiGuidance: "AI Guidance", structuredData: "Structured Data", metaSocial: "Meta & Social", contentQuality: "Content Quality", eeat: "E-E-A-T", brandEntity: "Brand & Entity", citationReadiness: "Citation Readiness", discoveryEndpoints: "Discovery", agentFriendliness: "Agent Friendly", freshness: "Freshness" };
var COLORS = ["#22c55e","#3b82f6","#8b5cf6","#f59e0b","#ec4899","#06b6d4","#10b981","#f97316","#6366f1","#14b8a6","#e11d48"];

function renderRadarContainer() {
  return '<div class="stagger-section fade-in-delay-2 card p-6 mb-8"><div class="max-w-md mx-auto"><canvas id="radarChart"></canvas></div></div>';
}

async function initRadarChart(dimensions) {
  var canvas = document.getElementById("radarChart");
  if (!canvas) return null;
  var Chart = await getChartJs();
  var dimKeys = Object.keys(dimensions);
  var chart = new Chart(canvas, {
    type: "radar",
    data: {
      labels: dimKeys.map(function(k) { return LABELS[k] || k; }),
      datasets: [{
        label: "GEO Score",
        data: dimKeys.map(function(k) { var d = dimensions[k]; return d.percentage || 0; }),
        backgroundColor: "rgba(59, 130, 246, 0.12)",
        borderColor: "#3b82f6",
        borderWidth: 2,
        pointBackgroundColor: COLORS,
        pointBorderColor: "#1e293b",
        pointBorderWidth: 1.5,
        pointRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: { display: false, stepSize: 20 },
          grid: { color: "rgba(148, 163, 184, 0.12)" },
          angleLines: { color: "rgba(148, 163, 184, 0.12)" },
          pointLabels: { color: "#94a3b8", font: { size: 11, family: "system-ui, -apple-system, sans-serif" } }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          titleColor: "#e2e8f0",
          bodyColor: "#94a3b8",
          borderColor: "rgba(148,163,184,0.15)",
          borderWidth: 1,
          padding: 10,
          displayColors: false
        }
      }
    }
  });
  return chart;
}

async function getChartJs() {
  var mod = await import('chart.js');
  var Chart = mod.Chart;
  var registerables = mod.registerables;
  Chart.register(...registerables);
  return Chart;
}


// --- components/dimensionBreakdown.js ---


var LABELS = { aiCrawlability: "AI Crawlability", aiGuidance: "AI Guidance", structuredData: "Structured Data", metaSocial: "Meta & Social", contentQuality: "Content Quality", eeat: "E-E-A-T", brandEntity: "Brand & Entity", citationReadiness: "Citation Readiness", discoveryEndpoints: "Discovery", agentFriendliness: "Agent Friendly", freshness: "Freshness" };

function renderDimensionBreakdown(dimensions) {
  const dimKeys = Object.keys(dimensions);
  return '<div class="stagger-section fade-in-delay-3 card p-6 mb-8">' +
    '<h2 class="text-lg font-bold mb-5">Dimension Breakdown</h2>' +
    '<div class="space-y-4">' +
    dimKeys.map(function(k) {
      var d = dimensions[k];
      var label = LABELS[k] || k;
      var pct = d.percentage || 0;
      var barColor = pct >= 80 ? 'bg-geo-500' : pct >= 60 ? 'bg-brand-500' : pct >= 40 ? 'bg-warn-500' : 'bg-danger-500';
      var checkCount = (d.passed || 0) + "/" + (d.total || d.checks || 0);
      var items = (d.items || []).map(function(item) {
        var icon = item.pass ? ICONS.check : (item.warn ? ICONS.warning : ICONS.cross);
        var iconCls = item.pass ? 'text-geo-500' : (item.warn ? 'text-warn-500' : 'text-danger-500');
        return '<div class="flex items-start gap-2 py-1.5 text-sm"><span class="flex-shrink-0 mt-0.5 ' + iconCls + '">' + icon + '</span><span class="text-gray-300">' + item.label + '</span></div>';
      }).join("");
      return '<div class="card-hover p-4 rounded-xl">' +
        '<div class="flex justify-between items-center mb-2"><span class="text-sm font-medium text-gray-200">' + label + '</span><span class="text-xs font-mono text-gray-500">' + pct + '% &middot; ' + checkCount + '</span></div>' +
        '<div class="w-full h-1.5 rounded-full bg-gray-700/50 overflow-hidden"><div class="h-full rounded-full ' + barColor + '" style="width:' + pct + '%"></div></div>' +
        (items ? '<div class="mt-3 pl-1">' + items + '</div>' : '') +
      '</div>';
    }).join("") +
    '</div></div>';
}


// --- components/negativeSignals.js ---


function renderNegativeSignals(signals) {
  if (!signals || signals.length === 0) return "";
  var found = signals.filter(function(s) { return s.found; }).length;
  return '<div class="stagger-section fade-in-delay-4 card p-6 mb-8 border-danger-500/20">' +
    '<h2 class="text-lg font-bold mb-4 text-danger-500">' + ICONS.alert + ' Negative Signals (' + found + ' found)</h2>' +
    '<div class="space-y-2">' +
    signals.map(function(s) {
      var icon = s.found ? ICONS.cross : ICONS.check;
      var cls = s.found ? 'text-danger-500' : 'text-geo-500';
      return '<div class="flex items-start gap-2 text-sm"><span class="flex-shrink-0 mt-0.5 ' + cls + '">' + icon + '</span><span class="text-gray-300">' + s.label + '</span></div>';
    }).join("") +
    '</div></div>';
}


// --- components/seoSupplement.js ---


function renderSeoSupplement(s) {
  if (!s) return "";
  var checks = [
    { label: "HTTPS", ok: s.https },
    { label: "Title Tag", ok: s.hasTitle },
    { label: "Meta Description", ok: s.hasMetaDesc },
    { label: "Responsive Viewport", ok: s.responsive }
  ];
  return '<div class="stagger-section fade-in-delay-5 card p-6 mb-8">' +
    '<h2 class="text-lg font-bold mb-4">SEO Supplement <span class="text-sm text-gray-500 font-normal">(informational)</span></h2>' +
    '<div class="grid grid-cols-2 md:grid-cols-4 gap-3">' +
    checks.map(function(c) {
      var icon = c.ok ? ICONS.check : ICONS.cross;
      var cls = c.ok ? 'text-geo-500' : 'text-gray-500';
      return '<div class="card-hover p-4 rounded-xl text-center"><div class="text-xl mb-1 ' + cls + '">' + icon + '</div><div class="text-xs text-gray-400">' + c.label + '</div></div>';
    }).join("") +
    '</div></div>';
}


// --- components/fixesPanel.js ---
function renderFixesPanel(recommendations) {
  var html = '<div class="stagger-section fade-in-delay-6 card p-6 mb-8">' +
    '<h2 class="text-lg font-bold mb-5">Prioritized Fixes</h2>';
  if (recommendations && recommendations.length > 0) {
    html += '<div class="space-y-3">' +
      recommendations.slice(0, 15).map(function(rec, i) {
        var priCls = rec.priority === "high" ? "border-l-danger-500" : (rec.priority === "medium" ? "border-l-warn-500" : "border-l-gray-500");
        return '<div class="flex items-start gap-3 text-sm p-4 rounded-xl bg-white/5 border-l-2 ' + priCls + '">' +
          '<span class="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-gray-500/20 text-gray-400">' + (i + 1) + '</span>' +
          '<div class="flex-1"><div class="text-gray-200 font-medium">' + rec.issue + '</div><div class="text-gray-500 mt-0.5">' + rec.fix + '</div><div class="text-xs text-gray-600 mt-1">' + rec.dimension + ' &middot; ' + rec.priority + ' priority</div></div></div>';
      }).join("") +
      '</div>';
  } else { html += '<p class="text-gray-400">No issues found!</p>'; }
  html += '</div>';
  return html;
}


// --- components/historyList.js ---
var LEVEL_CLR = { Excellent: "text-geo-500", Good: "text-brand-500", Basic: "text-warn-500", Critical: "text-danger-500" };

function renderHistoryList(history) {
  if (!history || history.length === 0) return "";
  return `<div class="card p-4 text-sm"><div class="text-gray-400 mb-2 text-xs uppercase tracking-wider font-semibold">Recent Audits</div>` +
    history.slice(0, 5).map(function(e) {
      var levelCls = LEVEL_CLR[e.level] || "text-gray-400";
      return `<div class="flex justify-between items-center py-2 px-3 card-hover rounded-lg cursor-pointer" data-url="${e.url.replace(/"/g, '&quot;').replace(/` + "`" + `/g, '&#96;')}"><span class="text-gray-300 text-sm truncate mr-2">${e.url}</span><span class="font-bold text-sm ${levelCls}">${e.score}</span></div>`;
    }).join("") +
    `</div>`;
}

// --- components/trendChart.js ---
function renderTrendContainer() {
  return '<div id="trend-section" class="stagger-section fade-in-delay-4 card p-6 mb-8" style="display:none">' +
    '<h2 class="text-lg font-bold mb-4">Score History</h2>' +
    '<div class="max-w-xl mx-auto"><canvas id="trendChart"></canvas></div>' +
    '<p class="text-xs text-gray-500 text-center mt-3">Score trend for this URL over time</p>' +
  '</div>';
}

async function initTrendChart(urlHistory) {
  var canvas = document.getElementById("trendChart");
  if (!canvas || !urlHistory || urlHistory.length < 2) {
    var section = document.getElementById("trend-section");
    if (section) section.style.display = "none";
    return null;
  }
  var section = document.getElementById("trend-section");
  if (section) section.style.display = "block";
  var Chart = await getChartJs();
  var reversed = urlHistory.slice().reverse();
  var chart = new Chart(canvas, {
    type: "line",
    data: {
      labels: reversed.map(function(e) {
        var d = new Date(e.timestamp);
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      }),
      datasets: [{
        label: "Score",
        data: reversed.map(function(e) { return e.score; }),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,0.1)",
        fill: true,
        tension: 0.3,
        pointBackgroundColor: reversed.map(function(e) {
          return e.score >= 80 ? "#22c55e" : e.score >= 60 ? "#3b82f6" : e.score >= 40 ? "#eab308" : "#ef4444";
        }),
        pointRadius: 4,
        pointBorderColor: "#1e293b",
        pointBorderWidth: 1.5,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: {
          ticks: { color: "#64748b", font: { size: 10 } },
          grid: { color: "rgba(148,163,184,0.08)" }
        },
        y: {
          min: 0, max: 100,
          ticks: { color: "#64748b", font: { size: 10 }, stepSize: 20 },
          grid: { color: "rgba(148,163,184,0.08)" }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15,23,42,0.95)",
          titleColor: "#e2e8f0",
          bodyColor: "#94a3b8",
          borderColor: "rgba(148,163,184,0.15)",
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: function(ctx) { return "Score: " + ctx.parsed.y + "/100"; }
          }
        }
      }
    }
  });
  return chart;
}

async function getChartJs() {
  var mod = await import("chart.js");
  var Chart = mod.Chart;
  var registerables = mod.registerables;
  Chart.register(...registerables);
  return Chart;
}


// --- components/comparisonPanel.js ---
var DIM_LABELS = { aiCrawlability: "AI Crawlability", aiGuidance: "AI Guidance", structuredData: "Structured Data", metaSocial: "Meta & Social", contentQuality: "Content Quality", eeat: "E-E-A-T", brandEntity: "Brand & Entity", citationReadiness: "Citation Readiness", discoveryEndpoints: "Discovery", agentFriendliness: "Agent Friendly", freshness: "Freshness" };

function renderComparisonPanel(selected) {
  if (!selected || selected.length < 2) return "";
  var dimKeys = Object.keys(DIM_LABELS);
  return '<div class="stagger-section fade-in-delay-5 card p-6 mb-8">' +
    '<h2 class="text-lg font-bold mb-4">Multi-Site Comparison</h2>' +
    '<div class="overflow-x-auto"><table class="w-full text-sm">' +
    '<thead><tr class="border-b border-gray-700"><th class="pb-2 pr-3 text-left text-gray-400 font-medium">Dimension</th>' +
    selected.map(function(s) {
      return '<th class="pb-2 pr-3 text-left font-mono text-xs ' + lc(s.level) + '">' + s.url + '<br/><span class="text-sm font-bold">' + s.score + '</span></th>';
    }).join("") +
    '</tr></thead><tbody>' +
    dimKeys.map(function(k) {
      return '<tr class="border-b border-gray-700/50">' +
        '<td class="py-2 pr-3 text-gray-300 text-xs">' + DIM_LABELS[k] + '</td>' +
        selected.map(function(s) {
          var pct = s.dimensions && s.dimensions[k] != null ? s.dimensions[k] : 0;
          var bc = pct >= 80 ? "bg-geo-500" : pct >= 60 ? "bg-brand-500" : pct >= 40 ? "bg-warn-500" : "bg-danger-500";
          return '<td class="py-2 pr-3"><div class="flex items-center gap-2"><div class="w-16 h-1.5 rounded-full bg-gray-700/50 overflow-hidden"><div class="h-full rounded-full ' + bc + '" style="width:' + pct + '%"></div></div><span class="text-xs font-mono text-gray-400">' + pct + '%</span></div></td>';
        }).join("") +
        '</tr>';
    }).join("") +
    '</tbody></table></div></div>';
}

function lc(l) {
  return l === "Excellent" ? "text-geo-500" : l === "Good" ? "text-brand-500" : l === "Basic" ? "text-warn-500" : "text-danger-500";
}


// --- components/exportButtons.js ---


function renderExportButtons() {
  return `<div class="stagger-section fade-in-delay-7 flex flex-wrap gap-3 justify-center mb-12">
    <button onclick="doExport('md')" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 transition">${ICONS.markdown} Markdown</button>
    <button onclick="doExport('html')" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 transition">${ICONS.globe} HTML</button>
    <button onclick="doExport('json')" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 transition">${ICONS.json} JSON</button>
    <button onclick="doExport('csv')" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 transition">${ICONS.csv} CSV</button>
    </div>`;
}


// --- pages/index.astro (page logic) ---















var radarChartInstance = null;
var trendChartInstance = null;
var scanTimer = null;

window.showBatchInput = function() {
  var el = document.getElementById("batch-section");
  if (el) el.classList.toggle("hidden");
};

window.showComparison = function() {
  var el = document.getElementById("compare-section");
  if (el) {
    el.style.display = el.style.display === "none" ? "block" : "none";
    if (el.style.display !== "none") populateCompareList();
  }
};

function populateCompareList() {
  var root = document.getElementById("compare-list");
  var history = getHistory();
  if (history.length < 2) { root.innerHTML = "Audit at least 2 sites first."; return; }
  root.innerHTML = history.slice(0, 10).map(function(e) {
    var lc = e.level === "Excellent" ? "text-geo-500" : e.level === "Good" ? "text-brand-500" : e.level === "Basic" ? "text-warn-500" : "text-danger-500";
    return '<label class="flex items-center gap-2 py-1 px-2 card-hover rounded cursor-pointer text-sm">' +
      '<input type="checkbox" class="compare-cb" value="' + e.id + '" />' +
      '<span class="flex-1 text-gray-300 truncate">' + e.url + '</span>' +
      '<span class="font-mono text-xs font-bold ' + lc + '">' + e.score + '</span></label>';
  }).join("");
}

window.runComparison = function() {
  var cbs = document.querySelectorAll(".compare-cb:checked");
  var ids = Array.from(cbs).map(function(cb) { return cb.value; });
  var history = getHistory();
  var selected = history.filter(function(e) { return ids.indexOf(e.id) >= 0; });
  if (selected.length < 2) return;
  document.getElementById("compare-section").style.display = "none";

  // Inject comparison panel into report
  var reportRoot = document.getElementById("report-section");
  var comparisonHtml = renderComparisonPanel(selected);
  if (comparisonHtml) {
    var div = document.createElement("div");
    div.innerHTML = comparisonHtml;
    // Insert before export buttons (last section)
    var exportSection = reportRoot.querySelector(".stagger-section.fade-in-delay-7");
    if (exportSection) {
      exportSection.parentNode.insertBefore(div.firstElementChild, exportSection);
    } else {
      reportRoot.appendChild(div.firstElementChild);
    }
  }
};

window.startBatchAudit = async function() {
  var input = document.getElementById("sitemap-url");
  var url = (input.value || "").trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  var progress = document.getElementById("batch-progress");
  var bar = document.getElementById("batch-bar");
  var status = document.getElementById("batch-status");
  var results = document.getElementById("batch-results");
  progress.classList.remove("hidden");
  results.innerHTML = "Fetching sitemap...";

  try {
    var resp = await fetch(url);
    var text = await resp.text();
    var urls = extractUrlsFromSitemap(text);
    if (urls.length === 0) { results.innerHTML = "No URLs found in sitemap."; return; }
    if (urls.length > 20) { results.innerHTML = "Found " + urls.length + " URLs. Auditing first 20."; urls = urls.slice(0, 20); }
    results.innerHTML = "";
    var completed = 0;

    for (var i = 0; i < urls.length; i++) {
      status.textContent = "Scanning " + (i + 1) + "/" + urls.length + ": " + urls[i];
      bar.style.width = ((i / urls.length) * 100) + "%";
      try {
        var r = await auditUrl(urls[i]);
        completed++;
        var lc = r.level === "Excellent" ? "text-geo-500" : r.level === "Good" ? "text-brand-500" : r.level === "Basic" ? "text-warn-500" : "text-danger-500";
        results.innerHTML += '<div class="flex justify-between py-1 ' + ((i % 2 === 0) ? "bg-white/5" : "") + ' px-2 rounded"><span class="truncate mr-2 text-gray-300">' + urls[i] + '</span><span class="font-mono font-bold ' + lc + '">' + r.score + '</span></div>';
      } catch (e) {
        results.innerHTML += '<div class="flex justify-between py-1 px-2 rounded text-danger-500"><span class="truncate mr-2">' + urls[i] + '</span><span class="text-xs">Error</span></div>';
      }
    }
    bar.style.width = "100%";
    status.textContent = "Completed: " + completed + "/" + urls.length + " URLs";
  } catch (e) {
    results.innerHTML = "Error: " + e.message;
  }
};

function extractUrlsFromSitemap(xml) {
  var urls = [];
  var regex = /<loc[^>]*>([^<]+)<\/loc>/gi;
  var match;
  while ((match = regex.exec(xml)) !== null) urls.push(match[1].trim());
  return urls;
}

window.startAudit = async function () {
  var input = document.getElementById("url-input");
  var btn = document.getElementById("audit-btn");
  var url = (input.value || "").trim();
  if (!url) { input.focus(); return; }
  btn.disabled = true; btn.textContent = "Scanning…";
  document.getElementById("hero-section").classList.add("hidden");
  document.getElementById("loading-section").classList.remove("hidden");
  document.getElementById("report-section").classList.add("hidden");
  document.getElementById("scanning-url").textContent = url;

  var stepIdx = 0;
  var steps = document.querySelectorAll(".scan-step");
  steps.forEach(function(s) { s.className = "scan-step"; });
  if (steps.length > 0) steps[0].classList.add("active");
  if (scanTimer) clearInterval(scanTimer);
  scanTimer = setInterval(function() {
    if (stepIdx < steps.length) {
      steps[stepIdx].classList.remove("active");
      steps[stepIdx].classList.add("done");
      stepIdx++;
      if (stepIdx < steps.length) steps[stepIdx].classList.add("active");
    }
  }, 350);

  try {
    var targetUrl = url;
    if (!/^https?:\/\//i.test(targetUrl)) targetUrl = "https://" + targetUrl;
    var result = await auditUrl(targetUrl);
    addToHistory(result);
    localStorage.setItem("geoscope_last_result", JSON.stringify(result));
    clearInterval(scanTimer);
    document.getElementById("loading-section").classList.add("hidden");
    document.getElementById("report-section").classList.remove("hidden");
    renderReport(result);
    renderHistory();
    // Show compare link if enough history
    var history = getHistory();
    if (history.length >= 2) {
      document.getElementById("compare-link").style.display = "inline";
    }
  } catch (err) {
    clearInterval(scanTimer);
    document.getElementById("loading-section").innerHTML = '<div class="card p-8 text-center"><div class="text-danger-500 text-lg font-semibold mb-2">Audit Failed</div><p class="text-gray-400 text-sm">' + err.message + '</p><button onclick="location.reload()" class="mt-4 px-4 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/20 transition">Try Again</button></div>';
  }
  btn.disabled = false;
  btn.textContent = "Start Audit";
};

function renderReport(r) {
  if (radarChartInstance) { radarChartInstance.destroy(); radarChartInstance = null; }
  if (trendChartInstance) { trendChartInstance.destroy(); trendChartInstance = null; }
  var root = document.getElementById("report-section");
  var parts = [
    renderScoreHeader(r),
    renderRadarContainer(),
    renderDimensionBreakdown(r.dimensions),
    renderNegativeSignals(r.negativeSignals),
    renderSeoSupplement(r.seoSupplement),
    renderFixesPanel(r.recommendations),
    renderExportButtons()
  ];
  root.innerHTML = "<div>" + parts.join("") + "</div>";
  initRadarChart(r.dimensions).then(function(chart) { radarChartInstance = chart; });
  // Show trend if history exists
  var urlHistory = getUrlHistory(r.url);
  if (urlHistory.length >= 2) {
    var trendHtml = renderTrendContainer();
    var exportSection = root.querySelector("[class*='fade-in-delay-7']");
    if (exportSection) {
      var trendDiv = document.createElement("div");
      trendDiv.innerHTML = trendHtml;
      exportSection.parentNode.insertBefore(trendDiv.firstElementChild, exportSection);
      initTrendChart(urlHistory).then(function(chart) { trendChartInstance = chart; });
    }
  }
}

window.doExport = function (fmt) {
  var stored = localStorage.getItem("geoscope_last_result");
  if (!stored) return;
  var r = JSON.parse(stored);
  var content, ext, mime;
  if (fmt === "md") { content = exportMarkdown(r); ext = "md"; mime = "text/markdown"; }
  else if (fmt === "json") { content = exportJson(r); ext = "json"; mime = "application/json"; }
  else if (fmt === "html") { content = exportHtml(r); ext = "html"; mime = "text/html"; }
  else { content = exportCsv(r); ext = "csv"; mime = "text/csv"; }
  var blob = new Blob([content], { type: mime });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "geoscope-report-" + r.url.replace(/[^a-z0-9]/gi, "-").substring(0, 40) + "." + ext;
  a.click();
  URL.revokeObjectURL(a.href);
};

function exportHtml(r) {
  var dimHtml = Object.entries(r.dimensions).map(function(kv) {
    var k = kv[0]; var d = kv[1];
    return "<tr><td>" + k + "</td><td>" + (d.percentage || 0) + "%</td><td>" + (d.passed || 0) + "/" + (d.total || d.checks || 0) + "</td></tr>";
  }).join("");
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>GEO Report: ' + r.url + '</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;background:#0f172a;color:#e2e8f0}h1{background:linear-gradient(135deg,#22c55e,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.score{font-size:64px;font-weight:800;text-align:center}.lvl{display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;color:#fff}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{padding:8px 12px;text-align:left;border-bottom:1px solid rgba(148,163,184,0.15)}.rec{border-left:3px solid #3b82f6;padding:8px 16px;margin:8px 0;background:rgba(255,255,255,0.03)}</style></head><body>' +
    '<h1>GEO Audit Report</h1>' +
    '<p style="color:#94a3b8">' + r.url + ' &middot; ' + new Date(r.timestamp).toLocaleDateString() + '</p>' +
    '<div class="score">' + r.score + '<span style="font-size:18px;color:#94a3b8">/100</span></div>' +
    '<div style="text-align:center;margin:10px 0"><span class="lvl" style="background:' + (r.level === "Excellent" ? "#22c55e" : r.level === "Good" ? "#3b82f6" : r.level === "Basic" ? "#eab308" : "#ef4444") + '">' + r.level + '</span></div>' +
    '<p style="color:#94a3b8;text-align:center">' + (r.summary || "") + '</p>' +
    '<h2>Dimensions</h2><table><thead><tr style="color:#94a3b8"><th>Dimension</th><th>Score</th><th>Checks</th></tr></thead><tbody>' + dimHtml + '</tbody></table>' +
    '<h2>Recommendations</h2>' + (r.recommendations || []).slice(0, 10).map(function(rec) {
      return '<div class="rec"><strong>' + rec.issue + '</strong><br/><span style="color:#94a3b8;font-size:14px">' + rec.fix + '</span><br/><span style="color:#64748b;font-size:12px">' + rec.dimension + ' &middot; ' + rec.priority + '</span></div>';
    }).join("") +
    '<p style="color:#64748b;font-size:12px;text-align:center;margin-top:40px">Generated by GeoScore &middot; geoscore.help</p>' +
    '</body></html>';
}

function renderHistory() {
  var root = document.getElementById("history-root");
  root.innerHTML = renderHistoryList(getHistory());
}

document.addEventListener("DOMContentLoaded", function() { renderHistory(); });
