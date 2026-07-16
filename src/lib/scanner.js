/**
 * Main scanner — orchestrates fetching and analysis across all 12 dimensions.
 */
import { fetchResource } from './fetcher.js';
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
import { computeScore } from './scoring.js';
import { generateRecommendations } from './recommendations.js';

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

export { auditUrl, normalizeUrl };
