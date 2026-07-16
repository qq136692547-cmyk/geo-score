/**
 * GeoScore CORS Proxy — Cloudflare Worker
 * Proxies fetch requests to target URLs that may block CORS.
 * Deploy: wrangler deploy
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing ?url= parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    try {
      const origin = new URL(targetUrl).origin;
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'GeoScore/1.0 (GEO Audit Tool; +https://github.com/qq136692547-cmyk/geo-score)',
          'Accept': 'text/html,application/xhtml+xml,text/plain,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      });

      const contentType = response.headers.get('Content-Type') || 'text/plain';
      const body = await response.text();

      return new Response(body, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'X-GeoScore-Proxy': 'true',
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  },
};
