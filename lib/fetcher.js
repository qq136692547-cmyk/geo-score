/**
 * Resource fetcher ¡ª tries direct browser fetch first,
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

export { fetchResource, PROXIES };
