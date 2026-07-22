/**
 * Resource fetcher — tries direct browser fetch first,
 * then races multiple CORS proxies in parallel for fastest successful response.
 */

var PROXIES = [
  // Self-hosted Cloudflare Pages proxy — most reliable
  { url: "https://geo-score-proxy.pages.dev/api/proxy?url=", type: "raw" },
  // Public proxies as fallback
  { url: "https://api.allorigins.win/get?url=", type: "json-wrap" },
  { url: "https://api.allorigins.win/raw?url=", type: "raw" },
  { url: "https://api.codetabs.com/v1/proxy/?quest=", type: "raw" },
  { url: "https://corsproxy.io/?url=", type: "raw" },
];

async function tryProxy(proxy, url, type) {
  var proxyUrl = proxy.url + encodeURIComponent(url);
  var proxyRes = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
  if (!proxyRes.ok) {
    if (proxyRes.status >= 400 && proxyRes.status < 500) return { value: null, status: "notfound" };
    throw new Error("proxy " + proxyRes.status);
  }
  var text;
  if (proxy.type === "json-wrap") {
    var wrapped = await proxyRes.json();
    if (!wrapped || !wrapped.contents) throw new Error("empty json-wrap");
    text = wrapped.contents;
  } else {
    text = await proxyRes.text();
  }
  if (!text || text.length === 0) throw new Error("empty response");
  if (type === "json") {
    try { return { value: JSON.parse(text), status: "ok" }; }
    catch (_) { throw new Error("not json"); }
  }
  return { value: text, status: "ok" };
}

async function fetchResource(url, type) {
  if (!type) type = "text";

  // 1) Try direct browser fetch
  try {
    var res = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "follow" });
    if (res.ok) {
      return type === "json" ? await res.json() : await res.text();
    }
    if (res.status >= 400 && res.status < 500) return null;
  } catch (_) {}

  // 2) Race all proxies in parallel — first success wins
  var proxyPromises = PROXIES.map(function(proxy) {
    return tryProxy(proxy, url, type).catch(function() { return null; });
  });

  // Add a promise that resolves to null after all proxies timeout
  var allSettled = Promise.all(proxyPromises).then(function(results) {
    // Find first successful result
    for (var i = 0; i < results.length; i++) {
      if (results[i] && results[i].status === "ok") return results[i].value;
      if (results[i] && results[i].status === "notfound") return null;
    }
    return null;
  });

  // Also race for first success (faster than waiting for all)
  var firstSuccess = Promise.race(proxyPromises).then(function(r) {
    if (r && r.status === "ok") return r.value;
    // If first to settle is notfound, wait for all
    if (r && r.status === "notfound") return allSettled;
    return allSettled;
  });

  return firstSuccess;
}

export { fetchResource, PROXIES };
