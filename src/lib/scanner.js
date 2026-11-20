/**
 * Main scanner — orchestrates fetching and analysis across 11 weighted dimensions plus deduction checks.
 */
import { fetchResource, fetchPageWithHeaders } from './fetcher.js';
import { analyzeAuditPayload, normalizeUrl, extractContentPageUrl } from './auditEngine.js';

// The content-page fetch is the only one that cannot start until the core
// batch has resolved, so it is also the only one that can push an audit into a
// second full proxy timeout — the 15s + 15s that produced the measured
// 30,016ms run. It is also the only one the report can do without: the schema
// and E-E-A-T analyzers take `pageHtml + aboutHtml + contentHtml`, so missing
// it degrades two dimensions instead of failing the audit outright. Capping it
// trades a little input for a bounded wait. 3000ms is ~3x the slowest healthy
// sample measured (870ms for geoscore.help's blog page).
var CONTENT_PAGE_BUDGET_MS = 3000;

async function auditUrl(url) {
  const normalized = normalizeUrl(url);
  const base = new URL(normalized);
  const origin = base.origin;

  // The optional discovery endpoints below do not depend on the page HTML, so
  // they start here rather than in a second batch after the core fetches.
  // They used to wait, which doubled the audit's worst case: every fetch can
  // burn one full proxy timeout, and a site that needed the proxy for both
  // batches paid it twice — measured at ~30s end to end. Only the content-page
  // fetch genuinely needs pageHtml, so it is still deferred.
  const aboutUrl = `${origin}/about`;
  const aboutPending = fetchResource(aboutUrl);
  const optionalPending = [
    fetchResource(`${origin}/.well-known/ai.txt`),
    fetchResource(`${origin}/ai/summary.json`, 'json'),
    fetchResource(`${origin}/ai/faq.json`, 'json'),
    fetchResource(`${origin}/sitemap.xml`),
    aboutPending,
  ];

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

  // Optional AI discovery endpoints: failure here should NOT abort the audit.
  //
  // extractContentPageUrl falls back to /about when the page carries no blog
  // link, and /about is already in flight from the batch above. Asking for the
  // same URL twice costs one extra request and — because this batch only starts
  // once the core batch has resolved — one extra full proxy timeout when the
  // proxy is the slow part. Reusing the promise keeps combinedHtml byte-identical
  // to today's output, so scores do not move.
  const contentUrl = extractContentPageUrl(pageHtml, origin);
  const [aiTxt, aiSummary, aiFaq, sitemapXml, aboutHtml, contentHtml] = await Promise.allSettled([
    ...optionalPending,
    contentUrl === aboutUrl ? aboutPending : fetchResource(contentUrl, 'text', CONTENT_PAGE_BUDGET_MS),
  ]).then(function(results) {
    return results.map(function(r) { return r.status === 'fulfilled' ? r.value : null; });
  });

  return analyzeAuditPayload({
    url: normalized,
    pageHtml,
    responseHeaders,
    robotsTxt,
    llmsTxt,
    sitemapXml,
    aiTxt,
    aiSummary,
    aiFaq,
    aboutHtml,
    contentHtml,
  });
}

export { auditUrl, normalizeUrl };
