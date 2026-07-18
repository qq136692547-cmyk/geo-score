/**
 * GeoScore CORS Proxy — Cloudflare Worker
 * Proxies fetch requests to target URLs for CORS-restricted resources.
 * 
 * Routes:
 *   GET /?url=https://example.com/robots.txt  — proxy fetch
 *   GET /fetch?url=...                         — alias
 *   GET /health                                — health check
 * 
 * Deploy: cd worker && wrangler deploy
 */
export default {
  async fetch(request, env, ctx) {
    var url = new URL(request.url);
    var pathname = url.pathname.replace(/\/$/, "");

    // Health check
    if (pathname === "/health" || (pathname === "" && url.searchParams.has("health"))) {
      return new Response(JSON.stringify({ status: "ok", service: "geo-score-proxy", version: "1.0.0" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // Extract target URL
    var targetUrl = url.searchParams.get("url");
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "Missing ?url= parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // Validate URL
    try { new URL(targetUrl); } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid URL" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    try {
      var response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "GeoScore/1.0 (GEO Audit Tool; +https://github.com/qq136692547-cmyk/geo-score)",
          "Accept": "text/html,application/xhtml+xml,text/plain,*/*",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });

      var contentType = response.headers.get("Content-Type") || "text/plain";
      var body = await response.text();

      return new Response(body, {
        status: response.status,
        headers: {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "X-GeoScore-Proxy": "true",
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  },
};
