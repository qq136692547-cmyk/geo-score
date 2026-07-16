/**
 * Resource fetcher — tries direct browser fetch first, falls back to CORS proxy.
 */
const PROXY_BASE = 'https://geo-score-proxy.your-username.workers.dev';

function encodeUrl(url) {
  return btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function fetchResource(url, type = 'text') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'GeoScore/1.0' }
    });
    clearTimeout(timeout);
    if (!res.ok && res.status !== 404) return null;
    if (res.status === 404) return null;
    return type === 'json' ? await res.json() : await res.text();
  } catch (err) {
    clearTimeout(timeout);
    // Fallback: try through CORS proxy
    try {
      const proxyUrl = `${PROXY_BASE}/fetch?url=${encodeURIComponent(url)}`;
      const proxyRes = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
      if (!proxyRes.ok) return null;
      return type === 'json' ? await proxyRes.json() : await proxyRes.text();
    } catch {
      return null;
    }
  }
}

export { fetchResource, PROXY_BASE };
