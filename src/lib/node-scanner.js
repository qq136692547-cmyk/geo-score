/**
 * Node.js scanner — orchestrates fetching and analysis using node-fetcher.
 * Same logic as scanner.js but with Node-compatible fetcher.
 */
import { fetchResource, fetchPageWithHeaders } from './node-fetcher.js';
import { analyzeAuditPayload, normalizeUrl, extractContentPageUrl } from './auditEngine.js';

async function auditUrl(url) {
  const normalized = normalizeUrl(url);
  const base = new URL(normalized);
  const origin = base.origin;

  // Core resources: if these fail, the audit cannot proceed
  const [robotsTxt, llmsTxt, pageResult] = await Promise.all([
    fetchResource(origin + '/robots.txt'),
    fetchResource(origin + '/llms.txt'),
    fetchPageWithHeaders(normalized),
  ]);

  // If the page HTML itself couldn't be fetched, we can't audit
  const pageHtml = pageResult ? pageResult.body : null;
  const responseHeaders = pageResult ? pageResult.headers : {};

  if (!pageHtml) {
    throw new Error(
      'Could not fetch ' + normalized + '. The site may be blocking requests or is offline.'
    );
  }

  // Optional AI discovery endpoints: failure here should NOT abort the audit.
  // extractContentPageUrl falls back to /about, which is already being fetched
  // below, so reuse that promise instead of requesting the same URL twice.
  const aboutUrl = origin + '/about';
  const aboutPending = fetchResource(aboutUrl);
  const contentUrl = extractContentPageUrl(pageHtml, origin);
  const [aiTxt, aiSummary, aiFaq, sitemapXml, aboutHtml, contentHtml] = await Promise.allSettled([
    fetchResource(origin + '/.well-known/ai.txt'),
    fetchResource(origin + '/ai/summary.json', 'json'),
    fetchResource(origin + '/ai/faq.json', 'json'),
    fetchResource(origin + '/sitemap.xml'),
    aboutPending,
    contentUrl === aboutUrl ? aboutPending : fetchResource(contentUrl),
  ]).then(function (results) {
    return results.map(function (r) { return r.status === 'fulfilled' ? r.value : null; });
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
