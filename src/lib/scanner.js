/**
 * Main scanner — orchestrates fetching and analysis across all 12 dimensions.
 */
import { fetchResource, fetchPageWithHeaders } from './fetcher.js';
import { analyzeRobots } from './analyzers/robots.js';
import { analyzeLlmstxt } from './analyzers/llmstxt.js';
import { analyzeSchema } from './analyzers/schema.js';
import { analyzeMeta } from './analyzers/meta.js';
import { analyzeContent } from './analyzers/content.js';
import { analyzeEeat } from './analyzers/eeat.js';
import { analyzeBrand } from './analyzers/brand.js';
import { analyzeCitations } from './analyzers/citations.js';
import { analyzeDiscovery } from './analyzers/discovery.js';
import { analyzeAgentFriendly } from './analyzers/agentFriendly.js';
import { analyzeFreshness } from './analyzers/freshness.js';
import { analyzeNegativeSignals } from './analyzers/negativeSignals.js';
import { analyzePromptInjection } from './analyzers/promptInjection.js';
import { computeScore } from './scoring.js';
import { generateRecommendations } from './recommendations.js';

async function auditUrl(url) {
  const normalized = normalizeUrl(url);
  const base = new URL(normalized);
  const origin = base.origin;

  // Core resources: if these fail, the audit cannot proceed
  const [robotsTxt, llmsTxt, pageResult] = await Promise.all([
    fetchResource(`${origin}/robots.txt`),
    fetchResource(`${origin}/llms.txt`),
    fetchPageWithHeaders(normalized),
  ]);

  // If the page HTML itself couldn't be fetched, we can't audit
  const pageHtml = pageResult ? pageResult.body : null;
  const responseHeaders = pageResult ? pageResult.headers : {};

  if (!pageHtml) {
    throw new Error(
      "Could not fetch " + normalized + ". The site may be blocking cross-origin requests or is offline."
    );
  }

  // Optional AI discovery endpoints: failure here should NOT abort the audit
  const [aiTxt, aiSummary, aiFaq, sitemapXml, aboutHtml, contentHtml] = await Promise.allSettled([
    fetchResource(`${origin}/.well-known/ai.txt`),
    fetchResource(`${origin}/ai/summary.json`, 'json'),
    fetchResource(`${origin}/ai/faq.json`, 'json'),
    fetchResource(`${origin}/sitemap.xml`),
    fetchResource(`${origin}/about`),
    fetchResource(extractContentPageUrl(pageHtml, origin)),
  ]).then(function(results) {
    return results.map(function(r) { return r.status === 'fulfilled' ? r.value : null; });
  });

  const robotsResult = analyzeRobots(robotsTxt);
  const llmsResult = analyzeLlmstxt(llmsTxt);
  const combinedHtml = pageHtml + (aboutHtml || '') + (contentHtml || '');
  const schemaResult = analyzeSchema(combinedHtml);
  const metaResult = analyzeMeta(pageHtml);
  const contentResult = analyzeContent(pageHtml);
  const eeatResult = analyzeEeat(combinedHtml, schemaResult, responseHeaders);
  const brandResult = analyzeBrand(pageHtml, schemaResult);
  const citationsResult = analyzeCitations(pageHtml);
  const discoveryResult = analyzeDiscovery(aiTxt, aiSummary, aiFaq);
  const agentResult = analyzeAgentFriendly(pageHtml, robotsTxt, llmsTxt, sitemapXml);
  const freshnessResult = analyzeFreshness(pageHtml);
  const negativeResult = analyzeNegativeSignals(pageHtml);
  const promptInjectionResult = analyzePromptInjection(pageHtml);

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

  const scoring = computeScore(dimensions, negativeResult, promptInjectionResult);
  const recommendations = generateRecommendations(dimensions, negativeResult, promptInjectionResult, scoring);

  // Generate a human-readable summary
  const passedDims = Object.values(scoring.dimensions).filter(d => d.percentage >= 60).length;
  const totalDims = Object.keys(scoring.dimensions).length;
  const piFlags = promptInjectionResult.flags.length;
  const isZh = typeof document !== 'undefined' && (document.documentElement.lang || 'en').toLowerCase().indexOf('zh') === 0;
  const LEVEL_ZH = { Excellent: "优秀", Good: "良好", Basic: "基础", Critical: "较差" };
  const summary = isZh
    ? `得分 ${scoring.total}/100（${LEVEL_ZH[scoring.level] || scoring.level}）。${passedDims}/${totalDims} 个维度高于 60%。检测到 ${negativeResult.deductions.length} 个负面信号和 ${piFlags} 个提示注入标记。`
    : `Score ${scoring.total}/100 (${scoring.level}). ${passedDims}/${totalDims} dimensions above 60%. ${negativeResult.deductions.length} negative signal(s) detected. ${piFlags} prompt injection flag(s).`;

  return {
    url: normalized,
    timestamp: new Date().toISOString(),
    score: scoring.total,
    level: scoring.level,
    summary,
    dimensions: scoring.dimensions,
    negativeSignals: negativeResult,
    promptInjection: promptInjectionResult,
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


function extractContentPageUrl(html, origin) {
  if (!html) return origin + '/about';
  var patterns = [
    /href=["'](\/[^"']*(?:blog|review|article|post|news|guide)\/[^"']*)["']/i,
    /href=["'](\/[^"']*(?:blog|review|article|post|news|guide)["'])/i,
  ];
  for (var i = 0; i < patterns.length; i++) {
    var match = html.match(patterns[i]);
    if (match && match[1]) {
      var href = match[1];
      if (href.startsWith('/')) return origin + href;
      if (href.startsWith('http') && href.includes(origin)) return href;
    }
  }
  return origin + '/about';
}

export { auditUrl, normalizeUrl };
