/**
 * Resource fetcher — tries direct browser fetch first, falls back to CORS proxy.
 * 
 * The PROXY_BASE must be updated after deploying the Cloudflare Worker:
 *   cd worker && wrangler deploy
 * Then update this URL to match your worker's hostname.
 */
var PROXY_BASE = "https://geo-score-proxy.your-username.workers.dev";

async function fetchResource(url, type) {
  if (!type) type = "text";
  var controller = new AbortController();
  var timeout = setTimeout(function() { controller.abort(); }, 10000);

  try {
    var res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "GeoScore/1.0" }
    });
    clearTimeout(timeout);
    if (!res.ok && res.status !== 404) return null;
    if (res.status === 404) return null;
    return type === "json" ? await res.json() : await res.text();
  } catch (err) {
    clearTimeout(timeout);
    // Fallback: try through CORS proxy
    try {
      var proxyUrl = PROXY_BASE + "/?url=" + encodeURIComponent(url);
      var proxyRes = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
      if (!proxyRes.ok) return null;
      return type === "json" ? await proxyRes.json() : await proxyRes.text();
    } catch (e) {
      return null;
    }
  }
}

export { fetchResource, PROXY_BASE };
