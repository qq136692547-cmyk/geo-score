/**
 * Resource fetcher — tries direct browser fetch first,
 * then races multiple CORS proxies in parallel for fastest successful response.
 */

var PROXIES = [
  // Self-hosted Cloudflare Pages proxy — the only one measured to still work.
  { url: "https://geo-score-proxy.pages.dev/api/proxy?url=", type: "raw" },
  // Public proxies as fallback.
  //
  // corsproxy.io used to be last here but is gone: it now answers
  //   401 {"error":"A valid API key is required. Get one at https://console.corsproxy.io/"}
  // for every request, so it only ever contributed a wasted round trip. It can
  // come back if an API key is provisioned and sent, but until then it is dead
  // weight.
  //
  // The remaining three are kept on purpose even though they time out from
  // mainland-China networks: that timeout is not proof the service is down, and
  // removing them would strip overseas visitors of their only fallback paths.
  { url: "https://api.allorigins.win/get?url=", type: "json-wrap" },
  { url: "https://api.allorigins.win/raw?url=", type: "raw" },
  { url: "https://api.codetabs.com/v1/proxy/?quest=", type: "raw" },
];

async function tryProxy(proxy, url, type, signal) {
  var proxyUrl = proxy.url + encodeURIComponent(url);
  var proxyRes = await fetch(proxyUrl, { signal: signal });
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

  // 2) Try every proxy in parallel; the first one that actually succeeds wins.
  //
  // Promise.race by itself is not enough here: it settles on the first promise
  // to *finish*, not the first to succeed. A single fast failure — the common
  // case, since the self-hosted proxy answers in ~350ms — therefore used to
  // drop us into waiting out every remaining 15s timeout, even when a slower
  // proxy would still have returned usable content. Waiting for all is only the
  // right fallback once every proxy has genuinely failed.
  // One controller covers the whole batch, and it is aborted on either of two
  // events: the 15s budget running out, or a winner being known. Without the
  // second case the losing requests stay in flight for their full timeout — a
  // headed run measured 27 proxy requests still unresolved at the moment the
  // report rendered. They cannot change the answer any more, and under
  // HTTP/1.1 they just occupy connections that later fetches need.
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, 15000);
  var proxyPromises = PROXIES.map(function(proxy) {
    return tryProxy(proxy, url, type, controller.signal).catch(function() { return null; });
  });

  return new Promise(function(resolve) {
    var done = false;
    function finish(value) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      controller.abort();
      resolve(value);
    }
    proxyPromises.forEach(function(p) {
      p.then(function(r) {
        if (r && r.status === "ok") finish(r.value);
        // A 4xx from a proxy means the resource genuinely is not there, so
        // there is nothing left for the slower proxies to find either.
        else if (r && r.status === "notfound") finish(null);
      });
    });
    Promise.all(proxyPromises).then(function(results) {
      for (var i = 0; i < results.length; i++) {
        if (results[i] && results[i].status === "ok") return finish(results[i].value);
      }
      finish(null);
    });
  });
}


async function fetchPageWithHeaders(url) {
  // Try direct fetch first (gives us response headers)
  try {
    var res = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "follow" });
    if (res.ok) {
      var hdrs = {};
      res.headers.forEach(function(v, k) { hdrs[k] = v; });
      return { body: await res.text(), headers: hdrs };
    }
    if (res.status >= 400 && res.status < 500) return { body: null, headers: {} };
  } catch (_) {}
  // Fall through to proxies (no origin headers available)
  var body = await fetchResource(url);
  return { body: body, headers: {} };
}

export { fetchResource, fetchPageWithHeaders, PROXIES };
