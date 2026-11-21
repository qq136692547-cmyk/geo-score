import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  parseBadgeDomain,
  renderBadgeSvg,
  buildBadgeEmbedSnippets,
} from '../src/lib/badgeSvg.js';
import {
  handleBadgeRequest,
  readLimitedText,
  safeFetchText,
} from '../functions/badge/[domain].js';

async function loadShareButtons(lang) {
  vi.resetModules();
  globalThis.document = { documentElement: { lang } };
  return import('../src/components/shareButtons.js');
}

afterEach(() => {
  delete globalThis.document;
  vi.resetModules();
});

function makeMockCache() {
  const store = new Map();
  return {
    store,
    async match(req) {
      const hit = store.get(req.url);
      return hit ? hit.clone() : undefined;
    },
    async put(req, res) {
      store.set(req.url, res.clone());
    },
  };
}

describe('parseBadgeDomain', () => {
  it('normalizes valid domains and strips case-insensitive .svg suffix', () => {
    expect(parseBadgeDomain('example.com')).toBe('example.com');
    expect(parseBadgeDomain('Example.COM.svg')).toBe('example.com');
    expect(parseBadgeDomain('  sub.my-site.co.uk.SVG  ')).toBe('sub.my-site.co.uk');
    expect(parseBadgeDomain('xn--fsqu00a.xn--0zwm56d.svg')).toBe('xn--fsqu00a.xn--0zwm56d');
  });

  it('rejects IPv4, IPv6, decimal/hex IPs, and localhost', () => {
    for (const bad of [
      '127.0.0.1',
      '192.168.1.1.svg',
      '10.0.0.1',
      '8.8.8.8',
      '169.254.169.254',
      '[::1]',
      '2001:db8::1',
      '2130706433',
      '0x7f000001',
      '0x7f.0.0.1',
      'localhost',
      'LOCALHOST.svg',
      'sub.localhost',
    ]) {
      expect(parseBadgeDomain(bad), `should reject ${bad}`).toBeNull();
    }
  });

  it('rejects reserved and internal suffixes', () => {
    const suffixes = [
      '.local',
      '.internal',
      '.arpa',
      '.localhost',
      '.test',
      '.invalid',
      '.example',
      '.onion',
      '.lan',
      '.corp',
      '.home',
    ];
    for (const s of suffixes) {
      expect(parseBadgeDomain(`app${s}`), `should reject ${s}`).toBeNull();
      expect(parseBadgeDomain(`a.b${s}.svg`), `should reject a.b${s}`).toBeNull();
    }
  });

  it('rejects ports, paths, queries, whitespace, non-ASCII, consecutive dots, bad hyphens, and out-of-range lengths', () => {
    for (const bad of [
      '',
      null,
      undefined,
      'a.b',
      'a'.repeat(250) + '.com',
      'example.com:8080',
      'example.com/foo',
      'example.com?a=1',
      'example .com',
      'exämple.com',
      'example..com',
      '-example.com',
      'example-.com',
      '.example.com',
      'example.com.',
    ]) {
      expect(parseBadgeDomain(bad), `should reject ${String(bad)}`).toBeNull();
    }
  });
});

describe('renderBadgeSvg', () => {
  it('colors the 4 score bands and rounds the score', () => {
    const cases = [
      [88.4, '#16a34a', '88/100'],
      [80, '#16a34a', '80/100'],
      [65, '#2563eb', '65/100'],
      [60, '#2563eb', '60/100'],
      [45, '#ca8a04', '45/100'],
      [40, '#ca8a04', '40/100'],
      [25, '#dc2626', '25/100'],
    ];
    for (const [score, color, label] of cases) {
      const svg = renderBadgeSvg({ score, level: 'Good' });
      expect(svg).toContain(`fill="${color}"`);
      expect(svg).toContain(`>${label}<`);
      expect(svg).toContain('role="img"');
      expect(svg).toContain('<title>');
      expect(svg).toContain('aria-label="');
    }
  });

  it('renders invalid and unavailable states in slate gray and escapes XML', () => {
    const invalidSvg = renderBadgeSvg({ status: 'invalid' });
    expect(invalidSvg).toContain('fill="#64748b"');
    expect(invalidSvg).toContain('>invalid<');

    const unavailSvg = renderBadgeSvg({ status: 'unavailable' });
    expect(unavailSvg).toContain('fill="#64748b"');
    expect(unavailSvg).toContain('>unavailable<');

    const nanSvg = renderBadgeSvg({ score: 'bad' });
    expect(nanSvg).toContain('fill="#64748b"');
    expect(nanSvg).toContain('>unavailable<');

    const escaped = renderBadgeSvg({ score: 90, level: '<script>"&\'</script>' });
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;');
  });

  it('widens the right segment for longer labels to prevent text overlap', () => {
    const shortSvg = renderBadgeSvg({ score: 9, level: 'Critical' });
    const longSvg = renderBadgeSvg({ status: 'unavailable' });
    const widthOf = (s) => Number(/width="(\d+)"/.exec(s)[1]);
    expect(widthOf(longSvg)).toBeGreaterThan(widthOf(shortSvg));
  });
});

describe('buildBadgeEmbedSnippets', () => {
  it('generates badgeUrl, auditUrl, markdown, and html for valid domains', () => {
    const out = buildBadgeEmbedSnippets('Example.COM.svg');
    expect(out).toEqual({
      badgeUrl: 'https://geoscore.help/badge/example.com.svg',
      auditUrl: 'https://geoscore.help/?audit=https%3A%2F%2Fexample.com%2F',
      markdown: '[![GeoScore AI Readiness](https://geoscore.help/badge/example.com.svg)](https://geoscore.help/?audit=https%3A%2F%2Fexample.com%2F)',
      html: '<a href="https://geoscore.help/?audit=https%3A%2F%2Fexample.com%2F" target="_blank" rel="noopener"><img src="https://geoscore.help/badge/example.com.svg" alt="GeoScore AI Readiness" height="20" /></a>',
    });
  });

  it('returns null for invalid domains', () => {
    expect(buildBadgeEmbedSnippets('localhost')).toBeNull();
    expect(buildBadgeEmbedSnippets('127.0.0.1')).toBeNull();
  });
});

describe('shareButtons badge embed block', () => {
  it('shows green AI-ready heading when score >= 80 and zero Chinese chars in EN', async () => {
    const { renderShareButtons } = await loadShareButtons('en');
    const html = renderShareButtons({ url: 'https://example.com/', score: 85, level: 'Excellent' });
    expect(html).toContain('Your site is AI-ready! Embed your live GeoScore badge on your site footer or GitHub README');
    expect(html).toContain('data-badge-copy="markdown"');
    expect(html).toContain('data-badge-copy="html"');
    expect(html).toContain('data-badge-snippet="markdown"');
    expect(html).toContain('data-badge-snippet="html"');
    expect(html).toContain('https://geoscore.help/badge/example.com.svg');
    expect(html).not.toMatch(/onclick="[^"]*data-badge/);
    expect(/[\u4e00-\u9fff]/.test(html)).toBe(false);
  });

  it('shows neutral heading when score < 80 and Chinese copy in zh-CN', async () => {
    const { renderShareButtons } = await loadShareButtons('zh-CN');
    const htmlEn = (await loadShareButtons('en')).renderShareButtons({ url: 'https://example.com/', score: 62, level: 'Basic' });
    expect(htmlEn).toContain('Embed Live GeoScore Badge');
    expect(htmlEn).not.toContain('Your site is AI-ready!');

    const htmlZh = (await loadShareButtons('zh-CN')).renderShareButtons({ url: 'https://example.com/', score: 82, level: 'Excellent' });
    expect(htmlZh).toContain('你的网站已达到 AI 友好标准！将实时 GeoScore 徽章嵌入页脚或 GitHub README');
  });

  it('skips badge block for localhost or IP URLs', async () => {
    const { renderShareButtons } = await loadShareButtons('en');
    const localHtml = renderShareButtons({ url: 'http://localhost:3000/', score: 90, level: 'Excellent' });
    const ipHtml = renderShareButtons({ url: 'http://127.0.0.1:8080/', score: 90, level: 'Excellent' });
    expect(localHtml).not.toContain('data-badge-embed');
    expect(ipHtml).not.toContain('data-badge-embed');
  });
});

describe('functions/badge/[domain].js', () => {
  it('allows GET and HEAD and rejects other HTTP methods with 405', async () => {
    const cache = makeMockCache();
    const res405 = await handleBadgeRequest(
      { request: new Request('https://geoscore.help/badge/example.com.svg', { method: 'POST' }), params: { domain: 'example.com.svg' } },
      { cache }
    );
    expect(res405.status).toBe(405);
  });

  it('returns 200 invalid grey SVG without writing to cache for illegal domains', async () => {
    const cache = makeMockCache();
    const res = await handleBadgeRequest(
      { request: new Request('https://geoscore.help/badge/127.0.0.1.svg'), params: { domain: '127.0.0.1.svg' } },
      { cache }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await res.text()).toContain('>invalid<');
    expect(cache.store.size).toBe(0);
  });

  it('truncates oversized streams via reader.cancel() in readLimitedText', async () => {
    let cancelled = false;
    const chunk = new Uint8Array(200 * 1024).fill(65); // 'A'
    const stream = new ReadableStream({
      pull(controller) {
        controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    });
    const text = await readLimitedText(new Response(stream), 350 * 1024);
    expect(cancelled).toBe(true);
    expect(text.length).toBe(350 * 1024);
  });

  it('blocks unsafe redirects (private/localhost, ports, geoscore.help, pages.dev, workers.dev, >3 hops)', async () => {
    const badTargets = [
      'http://127.0.0.1/secret',
      'http://localhost/admin',
      'https://example.com:8443/path',
      'https://geoscore.help/',
      'https://www.geoscore.help/',
      'https://evil.pages.dev/',
      'https://evil.workers.dev/',
      'file:///etc/passwd',
    ];
    for (const loc of badTargets) {
      let bodyCancelled = false;
      const fetchFn = async () => ({
        status: 302,
        headers: new Headers({ location: loc }),
        body: { cancel: async () => { bodyCancelled = true; } },
      });
      const out = await safeFetchText('https://example.com/', { fetchFn });
      expect(out, `redirect to ${loc} should be blocked`).toBeNull();
      expect(bodyCancelled).toBe(true);
    }

    // > 3 redirects blocked
    let hops = 0;
    const loopFetch = async () => {
      hops++;
      return {
        status: 302,
        headers: new Headers({ location: `https://example.com/step-${hops}` }),
        body: { cancel: async () => {} },
      };
    };
    expect(await safeFetchText('https://example.com/', { fetchFn: loopFetch })).toBeNull();
  });

  it('filters SPA soft-404 HTML responses on /ai/summary.json and /ai/faq.json and returns valid 200 SVG', async () => {
    const cache = makeMockCache();
    const waitUntilPromises = [];
    const fetchFn = async (url) => {
      if (url === 'https://example.com/') {
        return new Response(
          '<!doctype html><html lang="en"><head><title>Example</title><meta name="description" content="Example site"></head><body><h1>Example</h1><p>Hello world content.</p></body></html>',
          { status: 200, headers: { 'content-type': 'text/html', 'strict-transport-security': 'max-age=31536000' } }
        );
      }
      if (url === 'https://example.com/ai/summary.json' || url === 'https://example.com/ai/faq.json') {
        // Soft-404 SPA HTML
        return new Response('<html><body>Not Found SPA Shell</body></html>', { status: 200 });
      }
      if (url === 'https://example.com/robots.txt') {
        return new Response('User-agent: *\nAllow: /\n', { status: 200 });
      }
      return new Response('', { status: 404 });
    };

    const res = await handleBadgeRequest(
      {
        request: new Request('https://geoscore.help/badge/example.com.svg?foo=bar'),
        params: { domain: 'example.com.svg' },
        waitUntil: (p) => waitUntilPromises.push(p),
      },
      { cache, fetchFn }
    );
    await Promise.all(waitUntilPromises);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600, s-maxage=21600');
    const svg = await res.text();
    expect(svg).toMatch(/<svg[^>]*>/);
    expect(svg).toMatch(/>\d+\/100</);
    expect(svg).not.toContain('unavailable');
    expect(cache.store.has('https://geoscore.help/badge/example.com.svg')).toBe(true);

    // HEAD request hits cache and returns empty body
    const headRes = await handleBadgeRequest(
      {
        request: new Request('https://geoscore.help/badge/example.com.svg', { method: 'HEAD' }),
        params: { domain: 'example.com.svg' },
      },
      { cache }
    );
    expect(headRes.status).toBe(200);
    expect(await headRes.text()).toBe('');
  });

  it('returns unavailable SVG when homepage fetch fails or is blocked', async () => {
    const cache = makeMockCache();
    const fetchFn = async () => new Response('Forbidden', { status: 403 });
    const res = await handleBadgeRequest(
      { request: new Request('https://geoscore.help/badge/blocked.com.svg'), params: { domain: 'blocked.com.svg' } },
      { cache, fetchFn }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300');
    expect(await res.text()).toContain('>unavailable<');
    expect(cache.store.size).toBe(0);
  });

  it('uses ASSETS.fetch fast path for geoscore.help and injects HSTS', async () => {
    const cache = makeMockCache();
    const fetchedPaths = [];
    const assets = {
      async fetch(req) {
        const pathname = new URL(req.url).pathname;
        fetchedPaths.push(pathname);
        if (pathname === '/index.html') {
          return new Response('<html lang="en"><head><title>GeoScore</title></head><body><h1>GeoScore</h1></body></html>', { status: 200 });
        }
        if (pathname === '/methodology/index.html') {
          return new Response('<html><body>About GeoScore Methodology</body></html>', { status: 200 });
        }
        if (pathname === '/ai/summary.json' || pathname === '/ai/faq.json') {
          return new Response('{"ok":true}', { status: 200 });
        }
        return new Response('ok', { status: 200 });
      },
    };
    const res = await handleBadgeRequest(
      {
        request: new Request('https://geoscore.help/badge/geoscore.help.svg'),
        params: { domain: 'geoscore.help.svg' },
        env: { ASSETS: assets },
      },
      { cache }
    );
    expect(res.status).toBe(200);
    expect(fetchedPaths).toContain('/index.html');
    expect(fetchedPaths).toContain('/methodology/index.html');
    expect(fetchedPaths).toContain('/.well-known/ai.txt');
    const svg = await res.text();
    expect(svg).toMatch(/>\d+\/100</);
  });
});
