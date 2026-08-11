/**
 * Node.js environment fetcher — uses native fetch (Node 18+).
 * Falls back to CORS proxies when direct fetch fails (e.g. sites blocking non-browser User-Agents).
 */

var PROXIES = [
  { url: 'https://api.allorigins.win/get?url=', type: 'json-wrap' },
  { url: 'https://api.allorigins.win/raw?url=', type: 'raw' },
  { url: 'https://api.codetabs.com/v1/proxy/?quest=', type: 'raw' },
  { url: 'https://corsproxy.io/?url=', type: 'raw' },
];

async function tryProxy(proxy, url, type) {
  var proxyUrl = proxy.url + encodeURIComponent(url);
  var proxyRes = await fetch(proxyUrl, {
    signal: AbortSignal.timeout(15000),
    headers: { 'User-Agent': 'GeoScore-Auditer/1.0 (+https://geoscore.help)' },
  });
  if (!proxyRes.ok) {
    if (proxyRes.status >= 400 && proxyRes.status < 500) return { value: null, status: 'notfound' };
    throw new Error('proxy ' + proxyRes.status);
  }
  var text;
  if (proxy.type === 'json-wrap') {
    var wrapped = await proxyRes.json();
    if (!wrapped || !wrapped.contents) throw new Error('empty json-wrap');
    text = wrapped.contents;
  } else {
    text = await proxyRes.text();
  }
  if (!text || text.length === 0) throw new Error('empty response');
  if (type === 'json') {
    try { return { value: JSON.parse(text), status: 'ok' }; }
    catch (_) { throw new Error('not json'); }
  }
  return { value: text, status: 'ok' };
}

async function fetchResource(url, type) {
  if (!type) type = 'text';

  // 1) Try direct fetch with a browser-like User-Agent
  try {
    var res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GeoScore-Auditer/1.0; +https://geoscore.help)',
        'Accept': 'text/html,application/json,text/plain,*/*',
      },
    });
    if (res.ok) {
      return type === 'json' ? await res.json() : await res.text();
    }
    if (res.status >= 400 && res.status < 500) return null;
  } catch (_) {
    // Network error, timeout, etc. — fall through to proxies
  }

  // 2) Try proxies sequentially (more reliable than racing in Node)
  for (var i = 0; i < PROXIES.length; i++) {
    try {
      var result = await tryProxy(PROXIES[i], url, type);
      if (result && result.status === 'ok') return result.value;
      if (result && result.status === 'notfound') return null;
    } catch (_) {
      // Try next proxy
    }
  }

  return null;
}

export { fetchResource, PROXIES };
