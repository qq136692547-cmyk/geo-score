/**
 * Cloudflare Pages Function for dynamic GeoScore SVG badges: /badge/<domain>.svg
 */
import { parseBadgeDomain, renderBadgeSvg } from '../../src/lib/badgeSvg.js';
import { analyzeAuditPayload, extractContentPageUrl } from '../../src/lib/auditEngine.js';

const MAX_BODY_BYTES = 350 * 1024;
const FETCH_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;

const BASE_SVG_HEADERS = {
  'Content-Type': 'image/svg+xml; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
  'Access-Control-Allow-Origin': '*',
};

function makeSvgResponse(svg, cacheControl, method) {
  const headers = new Headers(BASE_SVG_HEADERS);
  headers.set('Cache-Control', cacheControl);
  return new Response(method === 'HEAD' ? null : svg, {
    status: 200,
    headers,
  });
}

function parseJsonOrNull(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function headersToObject(headers) {
  const out = {};
  if (!headers || typeof headers.forEach !== 'function') return out;
  headers.forEach((value, key) => {
    out[String(key).toLowerCase()] = value;
  });
  return out;
}

function isBlockedRedirectHost(hostname) {
  if (!hostname) return true;
  if (hostname === 'geoscore.help' || hostname === 'www.geoscore.help') return true;
  if (hostname === 'pages.dev' || hostname.endsWith('.pages.dev')) return true;
  if (hostname === 'workers.dev' || hostname.endsWith('.workers.dev')) return true;
  return false;
}

function validateExternalUrl(urlObj, isRedirect) {
  if (!urlObj) return false;
  if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') return false;
  if (urlObj.port !== '') return false;
  const cleanHost = parseBadgeDomain(urlObj.hostname);
  if (!cleanHost) return false;
  if (isRedirect && isBlockedRedirectHost(cleanHost)) return false;
  return true;
}

export async function readLimitedText(res, maxBytes = MAX_BODY_BYTES) {
  if (!res || !res.body || typeof res.body.getReader !== 'function') return '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let out = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      if (totalBytes + value.byteLength > maxBytes) {
        const remaining = maxBytes - totalBytes;
        if (remaining > 0) {
          out += decoder.decode(value.subarray(0, remaining), { stream: true });
        }
        await reader.cancel().catch(() => {});
        break;
      }

      totalBytes += value.byteLength;
      out += decoder.decode(value, { stream: true });
    }
    out += decoder.decode();
    return out;
  } catch {
    await reader.cancel().catch(() => {});
    return out;
  }
}

async function safeFetchInternal(url, opts = {}) {
  const fetchFn = opts.fetchFn || fetch;
  const maxBytes = opts.maxBytes || MAX_BODY_BYTES;
  const signal = opts.signal || AbortSignal.timeout(FETCH_TIMEOUT_MS);

  let currentUrl;
  try {
    const initial = new URL(url);
    if (!validateExternalUrl(initial, false)) return null;
    currentUrl = initial.href;
  } catch {
    return null;
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res;
    try {
      res = await fetchFn(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal,
        headers: {
          'User-Agent': 'GeoScoreBadgeBot/1.0 (+https://geoscore.help/)',
          Accept: 'text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.8',
        },
      });
    } catch {
      return null;
    }

    if (!res) return null;

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers && typeof res.headers.get === 'function'
        ? res.headers.get('location')
        : null;
      await res.body?.cancel?.().catch(() => {});
      if (!location || hop >= MAX_REDIRECTS) return null;

      let nextUrl;
      try {
        nextUrl = new URL(location, currentUrl);
      } catch {
        return null;
      }
      if (!validateExternalUrl(nextUrl, true)) return null;
      currentUrl = nextUrl.href;
      continue;
    }

    if (res.status < 200 || res.status >= 300) {
      await res.body?.cancel?.().catch(() => {});
      return null;
    }

    const text = await readLimitedText(res, maxBytes);
    return {
      text,
      headers: headersToObject(res.headers),
      url: currentUrl,
    };
  }

  return null;
}

export async function safeFetchText(url, opts = {}) {
  const res = await safeFetchInternal(url, opts);
  return res ? res.text : null;
}

async function fetchAssetResource(assets, assetPath) {
  try {
    const res = await assets.fetch(new Request('https://geoscore.help' + assetPath, { method: 'GET' }));
    if (!res || !res.ok) {
      await res?.body?.cancel?.().catch(() => {});
      return null;
    }
    const text = await readLimitedText(res, MAX_BODY_BYTES);
    return { text, headers: headersToObject(res.headers) };
  } catch {
    return null;
  }
}

async function fetchSelfResources(assets) {
  const origin = 'https://geoscore.help';
  const [
    pageRes,
    robotsRes,
    llmsRes,
    sitemapRes,
    aiTxtRes,
    aiSummaryRes,
    aiFaqRes,
    aboutRes,
  ] = await Promise.all([
    fetchAssetResource(assets, '/index.html'),
    fetchAssetResource(assets, '/robots.txt'),
    fetchAssetResource(assets, '/llms.txt'),
    fetchAssetResource(assets, '/sitemap.xml'),
    fetchAssetResource(assets, '/.well-known/ai.txt'),
    fetchAssetResource(assets, '/ai/summary.json'),
    fetchAssetResource(assets, '/ai/faq.json'),
    fetchAssetResource(assets, '/methodology/index.html'),
  ]);

  const pageHtml = pageRes && pageRes.text ? pageRes.text : null;
  if (!pageHtml) return null;

  const responseHeaders = {
    ...(pageRes.headers || {}),
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
  };

  const aboutHtml = aboutRes ? aboutRes.text : null;
  const contentUrl = extractContentPageUrl(pageHtml, origin);
  let contentHtml = aboutHtml;
  if (contentUrl !== origin + '/about') {
    try {
      const contentPath = new URL(contentUrl).pathname;
      const normalizedPath = contentPath.endsWith('/')
        ? contentPath + 'index.html'
        : contentPath;
      const contentRes =
        (await fetchAssetResource(assets, normalizedPath)) ||
        (await fetchAssetResource(assets, contentPath + '/index.html'));
      if (contentRes && contentRes.text) contentHtml = contentRes.text;
    } catch {
      // Fallback to aboutHtml
    }
  }

  return {
    url: origin + '/',
    pageHtml,
    responseHeaders,
    robotsTxt: robotsRes ? robotsRes.text : null,
    llmsTxt: llmsRes ? llmsRes.text : null,
    sitemapXml: sitemapRes ? sitemapRes.text : null,
    aiTxt: aiTxtRes ? aiTxtRes.text : null,
    aiSummary: parseJsonOrNull(aiSummaryRes ? aiSummaryRes.text : null),
    aiFaq: parseJsonOrNull(aiFaqRes ? aiFaqRes.text : null),
    aboutHtml,
    contentHtml,
  };
}

async function fetchExternalResources(host, fetchFn) {
  const origin = `https://${host}`;
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const opts = { signal, fetchFn, maxBytes: MAX_BODY_BYTES };

  const [
    pageRes,
    robotsTxt,
    llmsTxt,
    sitemapXml,
    aiTxt,
    aiSummaryText,
    aiFaqText,
    aboutHtml,
  ] = await Promise.all([
    safeFetchInternal(`${origin}/`, opts),
    safeFetchText(`${origin}/robots.txt`, opts),
    safeFetchText(`${origin}/llms.txt`, opts),
    safeFetchText(`${origin}/sitemap.xml`, opts),
    safeFetchText(`${origin}/.well-known/ai.txt`, opts),
    safeFetchText(`${origin}/ai/summary.json`, opts),
    safeFetchText(`${origin}/ai/faq.json`, opts),
    safeFetchText(`${origin}/about`, opts),
  ]);

  if (!pageRes || !pageRes.text || !pageRes.text.trim()) {
    return null;
  }

  const contentUrl = extractContentPageUrl(pageRes.text, origin);
  const contentHtml = contentUrl === `${origin}/about`
    ? aboutHtml
    : await safeFetchText(contentUrl, opts);

  return {
    url: `${origin}/`,
    pageHtml: pageRes.text,
    responseHeaders: pageRes.headers || {},
    robotsTxt,
    llmsTxt,
    sitemapXml,
    aiTxt,
    aiSummary: parseJsonOrNull(aiSummaryText),
    aiFaq: parseJsonOrNull(aiFaqText),
    aboutHtml,
    contentHtml,
  };
}

export async function handleBadgeRequest(context, deps = {}) {
  const request = context.request;
  const method = (request && request.method ? request.method : 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    });
  }

  const rawParam = context.params && context.params.domain;
  const domainParam = Array.isArray(rawParam) ? rawParam[0] : rawParam;
  const host = parseBadgeDomain(domainParam);

  if (!host) {
    return makeSvgResponse(
      renderBadgeSvg({ status: 'invalid' }),
      'public, max-age=3600',
      method
    );
  }

  const cache = deps.cache !== undefined
    ? deps.cache
    : (typeof caches !== 'undefined' && caches.default ? caches.default : null);
  const cacheKey = new Request(`https://geoscore.help/badge/${host}.svg`, { method: 'GET' });

  if (cache) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) {
        if (method === 'HEAD') {
          return new Response(null, { status: cached.status, headers: cached.headers });
        }
        return cached;
      }
    } catch {
      // Cache read error should not fail badge generation
    }
  }

  const assets = context.env && context.env.ASSETS && typeof context.env.ASSETS.fetch === 'function'
    ? context.env.ASSETS
    : null;
  const isSelfHost = host === 'geoscore.help' || host === 'www.geoscore.help';

  let payload = null;
  try {
    payload = isSelfHost && assets
      ? await fetchSelfResources(assets)
      : await fetchExternalResources(host, deps.fetchFn || fetch);
  } catch {
    payload = null;
  }

  if (!payload || !payload.pageHtml) {
    return makeSvgResponse(
      renderBadgeSvg({ status: 'unavailable' }),
      'public, max-age=300',
      method
    );
  }

  let audit;
  try {
    audit = analyzeAuditPayload(payload);
  } catch {
    return makeSvgResponse(
      renderBadgeSvg({ status: 'unavailable' }),
      'public, max-age=300',
      method
    );
  }

  const svg = renderBadgeSvg({ score: audit.score, level: audit.level });
  const cacheResponse = makeSvgResponse(svg, 'public, max-age=3600, s-maxage=21600', 'GET');

  if (cache && typeof cache.put === 'function') {
    const putPromise = Promise.resolve(cache.put(cacheKey, cacheResponse.clone())).catch(() => {});
    if (typeof context.waitUntil === 'function') {
      context.waitUntil(putPromise);
    } else {
      await putPromise;
    }
  }

  if (method === 'HEAD') {
    return new Response(null, { status: 200, headers: cacheResponse.headers });
  }
  return cacheResponse;
}

export async function onRequest(context) {
  return handleBadgeRequest(context);
}
