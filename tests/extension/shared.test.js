import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

import {
  DIMENSION_LABELS_EN,
  DIMENSION_LABELS_ZH,
  LEVEL_LABELS_ZH,
  detectBrowserLang,
  resolveLang,
  setLangPreference,
  getLangPreference,
  createTranslator,
} from '../../extension/src/shared/i18n.js';

import { inspectFetchedResource } from '../../extension/src/shared/soft404.js';

import {
  extractRenderableText,
  flattenSchemaTypes,
  computeSsrCsrDiff,
} from '../../extension/src/shared/ssrDiff.js';

import { buildCursorFixPrompt } from '../../extension/src/shared/promptBuilder.js';

import {
  extractBrandAndTopic,
  buildSmokeTestData,
} from '../../extension/src/shared/smokeTest.js';

import {
  computeAuditDiff,
  getSettings,
  saveSettings,
  saveAuditSnapshot,
  getAuditHistory,
} from '../../extension/src/shared/storage.js';

import {
  detectTechStack,
  getStackGuidance,
} from '../../extension/src/shared/stackDetector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const extRoot = path.resolve(projectRoot, 'extension');

describe('Chrome MV3 Extension Foundation', () => {
  it('manifest.json conforms to strict least-privilege MV3 specification', () => {
    const manifestPath = path.join(extRoot, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('__MSG_extName__');
    expect(manifest.description).toBe('__MSG_extDescription__');
    expect(manifest.default_locale).toBe('en');
    expect(manifest.version).toBe('1.9.0');

    // Strict permissions: activeTab, sidePanel, storage, scripting
    expect(manifest.permissions).toEqual(['activeTab', 'sidePanel', 'storage', 'scripting']);

    // Optional host permissions only
    expect(manifest.optional_host_permissions).toEqual(['https://*/*', 'http://*/*']);

    // Strictly no default host_permissions or <all_urls> or static content_scripts
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();

    // Action and Sidepanel
    expect(manifest.action).toBeDefined();
    expect(manifest.action.default_title).toBe('__MSG_actionTitle__');
    expect(manifest.action.default_popup).toBeUndefined(); // onClicked trigger
    expect(manifest.action.default_icon['16']).toBe('icons/icon-16.png');
    expect(manifest.action.default_icon['128']).toBe('icons/icon-128.png');

    expect(manifest.side_panel?.default_path).toBe('sidepanel/index.html');
    expect(manifest.background?.service_worker).toBe('background.js');
    expect(manifest.background?.type).toBe('module');

    expect(manifest.icons['128']).toBe('icons/icon-128.png');
  });

  it('_locales contain full English and Simplified Chinese messages', () => {
    const enPath = path.join(extRoot, '_locales/en/messages.json');
    const zhPath = path.join(extRoot, '_locales/zh_CN/messages.json');

    expect(fs.existsSync(enPath)).toBe(true);
    expect(fs.existsSync(zhPath)).toBe(true);

    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const zh = JSON.parse(fs.readFileSync(zhPath, 'utf8'));

    expect(en.extName.message).toContain('GeoScore');
    expect(en.extDescription.message).toContain('11 GEO dimensions');
    expect(en.actionTitle.message).toBe('Audit GEO Readiness with GeoScore');

    expect(zh.extName.message).toContain('GeoScore');
    expect(zh.extDescription.message).toContain('11 维度 GEO 评分');
    expect(zh.actionTitle.message).toContain('GeoScore');
  });

  it('generates real 32-bit RGBA PNG icons and validates 128px 16px transparent padding', () => {
    const sizes = [16, 32, 48, 128];
    for (const size of sizes) {
      const p = path.join(extRoot, `icons/icon-${size}.png`);
      expect(fs.existsSync(p)).toBe(true);
      const buf = fs.readFileSync(p);

      // PNG Signature
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
      expect(buf[2]).toBe(0x4e);
      expect(buf[3]).toBe(0x47);

      // IHDR
      const chunkLen = buf.readUInt32BE(8);
      const chunkType = buf.toString('ascii', 12, 16);
      expect(chunkType).toBe('IHDR');
      expect(chunkLen).toBe(13);

      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      const bitDepth = buf[24];
      const colorType = buf[25];

      expect(width).toBe(size);
      expect(height).toBe(size);
      expect(bitDepth).toBe(8);
      expect(colorType).toBe(6); // RGBA

      if (size === 128) {
        // Extract IDAT and verify strictly transparent margin
        const idats = [];
        let cur = 8;
        while (cur < buf.length) {
          const l = buf.readUInt32BE(cur);
          const t = buf.toString('ascii', cur + 4, cur + 8);
          if (t === 'IDAT') {
            idats.push(buf.subarray(cur + 8, cur + 8 + l));
          }
          cur += 12 + l;
        }
        const decompressed = zlib.inflateSync(Buffer.concat(idats));
        const rowBytes = 128 * 4;

        for (let y = 0; y < 128; y++) {
          const rowStart = y * (1 + rowBytes) + 1;
          for (let x = 0; x < 128; x++) {
            const alpha = decompressed[rowStart + x * 4 + 3];
            if (x < 16 || x > 111 || y < 16 || y > 111) {
              expect(alpha).toBe(0);
            }
          }
        }

        // Check center pixel is solid
        const centerAlpha = decompressed[64 * (1 + rowBytes) + 1 + 64 * 4 + 3];
        expect(centerAlpha).toBe(255);
      }
    }
  });
});

describe('Shared Module: i18n', () => {
  it('contains all 11 GEO dimensions in both EN and ZH', () => {
    const requiredDims = [
      'aiCrawlability',
      'aiGuidance',
      'structuredData',
      'metaSocial',
      'contentQuality',
      'eeat',
      'brandEntity',
      'citationReadiness',
      'discoveryEndpoints',
      'agentFriendliness',
      'freshness',
    ];

    expect(Object.keys(DIMENSION_LABELS_EN)).toHaveLength(11);
    expect(Object.keys(DIMENSION_LABELS_ZH)).toHaveLength(11);

    for (const d of requiredDims) {
      expect(DIMENSION_LABELS_EN[d]).toBeDefined();
      expect(DIMENSION_LABELS_ZH[d]).toBeDefined();
    }
    expect(LEVEL_LABELS_ZH.Excellent).toBe('优秀');
  });

  it('detects language and translates with interpolation', () => {
    expect(['en', 'zh_CN']).toContain(detectBrowserLang());
    expect(resolveLang('zh')).toBe('zh_CN');
    expect(resolveLang('en')).toBe('en');

    setLangPreference('zh_CN');
    expect(getLangPreference()).toBe('zh_CN');

    const tZh = createTranslator('zh_CN');
    const msgZh = tZh('auditComplete', { ms: 120 });
    expect(msgZh).toBe('检测完成，耗时 120ms');

    const tEn = createTranslator('en');
    const msgEn = tEn('auditComplete', { ms: 120 });
    expect(msgEn).toBe('Audit completed in 120ms');

    // Fallback to key if not found
    expect(tEn('non_existent_key')).toBe('non_existent_key');
  });
});

describe('Shared Module: soft404', () => {
  it('flags soft 404 when server returns HTML Content-Type for robots.txt or llms.txt', () => {
    const res = inspectFetchedResource({
      url: 'https://example.com/robots.txt',
      status: 200,
      ok: true,
      contentType: 'text/html; charset=utf-8',
      body: 'User-agent: *',
      expectedType: 'robots',
    });

    expect(res.isSoft404).toBe(true);
    expect(res.valid).toBe(false);
    expect(res.cleanBody).toBeNull();
  });

  it('flags soft 404 when body contains HTML/SPA shell', () => {
    const res = inspectFetchedResource({
      url: 'https://example.com/llms.txt',
      status: 200,
      ok: true,
      contentType: 'text/plain',
      body: '<!doctype html><html><head><title>SPA</title></head><body><div id="root"></div></body></html>',
      expectedType: 'llms',
    });

    expect(res.isSoft404).toBe(true);
    expect(res.valid).toBe(false);
    expect(res.cleanBody).toBeNull();
  });

  it('accepts clean robots.txt and markdown llms.txt', () => {
    const resRobots = inspectFetchedResource({
      url: 'https://example.com/robots.txt',
      status: 200,
      ok: true,
      contentType: 'text/plain',
      body: 'User-agent: *\nDisallow: /admin\n',
      expectedType: 'robots',
    });
    expect(resRobots.isSoft404).toBe(false);
    expect(resRobots.valid).toBe(true);
    expect(resRobots.cleanBody).toBe('User-agent: *\nDisallow: /admin');

    const resLlms = inspectFetchedResource({
      url: 'https://example.com/llms.txt',
      status: 200,
      ok: true,
      contentType: 'text/markdown',
      body: '# GeoScore\n> AI SEO Checker',
      expectedType: 'llms',
    });
    expect(resLlms.isSoft404).toBe(false);
    expect(resLlms.valid).toBe(true);
  });

  it('validates json endpoints with structural object parsing', () => {
    const validJson = inspectFetchedResource({
      url: 'https://example.com/ai/summary.json',
      status: 200,
      ok: true,
      contentType: 'application/json',
      body: '{"name":"GeoScore","features":["audit","repair"]}',
      expectedType: 'json',
    });
    expect(validJson.valid).toBe(true);
    expect(validJson.data.name).toBe('GeoScore');

    const invalidJson = inspectFetchedResource({
      url: 'https://example.com/ai/summary.json',
      status: 200,
      ok: true,
      contentType: 'application/json',
      body: '{ broken json }',
      expectedType: 'json',
    });
    expect(invalidJson.valid).toBe(false);
    expect(invalidJson.isSoft404).toBe(false);
  });

  it('validates xml sitemap root tags', () => {
    const validXml = inspectFetchedResource({
      url: 'https://example.com/sitemap.xml',
      status: 200,
      ok: true,
      contentType: 'application/xml',
      body: '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc></url></urlset>',
      expectedType: 'xml',
    });
    expect(validXml.valid).toBe(true);

    const emptyXml = inspectFetchedResource({
      url: 'https://example.com/sitemap.xml',
      status: 200,
      ok: true,
      contentType: 'text/plain',
      body: 'No urls here',
      expectedType: 'xml',
    });
    expect(emptyXml.valid).toBe(false);
  });
});

describe('Shared Module: ssrDiff', () => {
  it('extractRenderableText strips scripts, styles, templates, and tags', () => {
    const raw = `
      <html>
        <head><style>.hero { color: red; }</style><script>console.log("secret");</script></head>
        <body>
          <template><p>Hidden template</p></template>
          <noscript>Please enable JS</noscript>
          <h1>Hello World &amp; GeoScore</h1>
          <p>This is a live test paragraph.</p>
        </body>
      </html>
    `;
    const text = extractRenderableText(raw);
    expect(text).not.toContain('.hero');
    expect(text).not.toContain('secret');
    expect(text).not.toContain('Hidden template');
    expect(text).not.toContain('Please enable JS');
    expect(text).toContain('Hello World & GeoScore');
    expect(text).toContain('This is a live test paragraph.');
  });

  it('flattenSchemaTypes extracts @graph and nested types cleanly', () => {
    const blocks = [
      {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'Organization', name: 'GeoScore Corp' },
          { '@type': 'WebSite', name: 'GeoScore' },
        ],
      },
      {
        '@type': ['Article', 'TechArticle'],
        headline: 'GEO Optimization Guide',
      },
    ];

    const types = flattenSchemaTypes(blocks);
    expect(types).toContain('Organization');
    expect(types).toContain('WebSite');
    expect(types).toContain('Article');
    expect(types).toContain('TechArticle');
  });

  it('computes SSR/CSR diff and flags JavaScript rendering traps', () => {
    const ssrHtml = `
      <!doctype html>
      <html><body><div id="root">Loading application...</div></body></html>
    `;

    // 60+ words in CSR body + Schema injected via JS
    const csrBodyWords = Array.from({ length: 65 }, (_, i) => `word${i}`).join(' ');
    const csrHtml = `
      <!doctype html>
      <html>
        <head>
          <script type="application/ld+json">
            { "@context": "https://schema.org", "@type": "SoftwareApplication", "name": "GeoScore" }
          </script>
        </head>
        <body>
          <main>
            <h1>Client Rendered Application</h1>
            <p>${csrBodyWords}</p>
          </main>
        </body>
      </html>
    `;

    const diff = computeSsrCsrDiff({ ssrHtml, csrHtml });
    expect(diff.jsTrapTriggered).toBe(true);
    expect(diff.wordLossPercent).toBeGreaterThan(50);
    expect(diff.csrOnlySchemaTypes).toContain('SoftwareApplication');
    expect(diff.ssrSchemaCount).toBe(0);
    expect(diff.csrSchemaCount).toBe(1);
    expect(diff.schemaSurvivalRate).toBe(0);
  });

  it('reports healthy 100% survival rate for clean SSG / SSR pages', () => {
    const html = `
      <!doctype html>
      <html>
        <head>
          <script type="application/ld+json">
            { "@context": "https://schema.org", "@type": "Organization", "name": "GeoScore" }
          </script>
        </head>
        <body>
          <h1>Complete Server Rendered Page</h1>
          <p>Everything is present in the initial HTML for all crawlers.</p>
        </body>
      </html>
    `;

    const diff = computeSsrCsrDiff({ ssrHtml: html, csrHtml: html });
    expect(diff.jsTrapTriggered).toBe(false);
    expect(diff.textSurvivalRate).toBe(100);
    expect(diff.wordLossPercent).toBe(0);
    expect(diff.schemaSurvivalRate).toBe(100);
    expect(diff.overallSurvivalRate).toBe(100);
    expect(diff.csrOnlySchemaTypes).toEqual([]);
  });
});

describe('Shared Module: promptBuilder', () => {
  it('builds structured prompt with prioritized items and RFC 9309 notice', () => {
    const result = {
      url: 'https://example.com/blog',
      total: 58,
      level: 'Basic',
      dimensions: {
        aiGuidance: {
          checks: [
            { id: 'llms-txt-exists', label: 'llms.txt file exists at root', passed: false, weight: 3 },
          ],
        },
        structuredData: {
          checks: [
            { id: 'json-ld-present', label: 'JSON-LD schema present', passed: false, weight: 4 },
          ],
        },
      },
    };

    const ssrDiff = {
      jsTrapTriggered: true,
      wordLossPercent: 75,
      ssrWords: 20,
      csrWords: 100,
      csrOnlySchemaTypes: ['Organization'],
    };

    const soft404Map = {
      robots: { isSoft404: true, reason: 'HTML shell returned', url: 'https://example.com/robots.txt' },
    };

    const fixFiles = {
      llmsTxt: '# Example LLMS.txt',
      robotsTxt: 'User-agent: GPTBot\nAllow: /',
      jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite' },
    };

    const promptEn = buildCursorFixPrompt({ result, ssrDiff, soft404Map, fixFiles, lang: 'en' });
    expect(promptEn).toContain('**Current Score**: 58/100 (Basic)');
    expect(promptEn).toContain('CRITICAL: JavaScript Client-Side Rendering Trap Detected');
    expect(promptEn).toContain('Soft 404 Endpoint Warnings');
    expect(promptEn).toContain('Prioritized Action Items');
    // Weight 4 should be listed before Weight 3
    const posWeight4 = promptEn.indexOf('Weight 4');
    const posWeight3 = promptEn.indexOf('Weight 3');
    expect(posWeight4).toBeLessThan(posWeight3);
    expect(promptEn).toContain('Diagnostic Recommendation (RFC 9309 Compliant)');
    expect(promptEn).toContain('# Example LLMS.txt');

    const promptZh = buildCursorFixPrompt({ result, ssrDiff, soft404Map, fixFiles, lang: 'zh_CN' });
    expect(promptZh).toContain('**当前评分**: 58/100 (基础)');
    expect(promptZh).toContain('客户端渲染盲区');
    expect(promptZh).toContain('软 404 端点伪响应告警');
    expect(promptZh).toContain('待优化与修复项清单');
    expect(promptZh).toContain('RFC 9309');
  });
});

describe('Shared Module: smokeTest', () => {
  it('extracts brand and topic from JSON-LD, og tags, and headings', () => {
    const html = `
      <!doctype html>
      <html>
        <head>
          <meta property="og:site_name" content="GeoScore AI" />
          <meta name="description" content="AI SEO & llms.txt diagnostic platform." />
          <title>AI Readiness Audit | GeoScore AI</title>
        </head>
        <body>
          <h1>Audit Any Webpage for AI Search Visibility</h1>
        </body>
      </html>
    `;

    const { brand, topic } = extractBrandAndTopic(html, 'https://geoscore.help');
    expect(brand).toBe('GeoScore AI');
    expect(topic).toBe('Audit Any Webpage for AI Search Visibility');

    const smoke = buildSmokeTestData({ html, url: 'https://geoscore.help', lang: 'en' });
    expect(smoke.prompts).toHaveLength(3);
    expect(smoke.prompts[0].targets.chatgpt).toContain('https://chatgpt.com/?q=');
    expect(smoke.prompts[0].targets.perplexity).toContain('https://www.perplexity.ai/search?q=');
    expect(smoke.prompts[0].targets.claude).toContain('https://claude.ai/new?q=');
    expect(smoke.disclaimer).toContain('Does not simulate synthetic live traffic');
  });
});

describe('Shared Module: storage & diff', () => {
  it('computeAuditDiff accurately measures score delta and newly passed / regressed checks', () => {
    const prevSnapshot = {
      total: 50,
      dimensions: {
        aiGuidance: {
          score: 5,
          maxScore: 12,
          checks: [
            { id: 'llms-present', label: 'llms.txt present', passed: false, weight: 3 },
            { id: 'crawlers-allowed', label: 'Crawlers allowed', passed: true, weight: 2 },
          ],
        },
      },
    };

    const currentResult = {
      total: 75,
      dimensions: {
        aiGuidance: {
          score: 10,
          maxScore: 12,
          checks: [
            { id: 'llms-present', label: 'llms.txt present', passed: true, weight: 3 },
            { id: 'crawlers-allowed', label: 'Crawlers allowed', passed: false, weight: 2 },
          ],
        },
      },
    };

    const diff = computeAuditDiff(prevSnapshot, currentResult);
    expect(diff.previousScore).toBe(50);
    expect(diff.currentScore).toBe(75);
    expect(diff.delta).toBe(25);

    expect(diff.newlyPassedChecks).toHaveLength(1);
    expect(diff.newlyPassedChecks[0].id).toBe('llms-present');

    expect(diff.regressedChecks).toHaveLength(1);
    expect(diff.regressedChecks[0].id).toBe('crawlers-allowed');

    expect(diff.dimensionDeltas.aiGuidance.delta).toBe(5);
  });

  it('storage helper falls back safely without chrome.storage API', async () => {
    const settings = await getSettings();
    expect(settings.autoBadge).toBe(false);
    expect(settings.langPref).toBe('auto');

    const updated = await saveSettings({ autoBadge: true });
    expect(updated.autoBadge).toBe(true);

    const saved = await saveAuditSnapshot({ url: 'https://example.com', total: 80 });
    expect(saved.url).toBe('https://example.com');

    const history = await getAuditHistory();
    expect(Array.isArray(history)).toBe(true);
  });
});

describe('Shared Module: stackDetector', () => {
  it('detects Shopify, Next.js, WordPress, and returns null for unknown sites', () => {
    expect(detectTechStack('<script src="https://cdn.shopify.com/s/files/theme.js"></script>', 'https://shop.example.com')).toBe('shopify');
    expect(detectTechStack('<script>window.Shopify = { theme: {} }; Shopify.shop = "demo";</script>', 'https://store.example.com')).toBe('shopify');
    expect(detectTechStack('<div class="shopify-section"></div>', 'https://demo.myshopify.com')).toBe('shopify');

    expect(detectTechStack('<script id="__NEXT_DATA__" type="application/json">{}</script>', 'https://app.example.com')).toBe('nextjs');
    expect(detectTechStack('<script src="/_next/static/chunks/main.js"></script>', 'https://app.example.com')).toBe('nextjs');
    expect(detectTechStack('<next-route-announcer></next-route-announcer>', 'https://app.example.com')).toBe('nextjs');

    expect(detectTechStack('<link rel="stylesheet" href="/wp-content/themes/starter/style.css">', 'https://blog.example.com')).toBe('wordpress');
    expect(detectTechStack('<script src="/wp-includes/js/jquery/jquery.min.js"></script>', 'https://blog.example.com')).toBe('wordpress');
    expect(detectTechStack('<meta name="generator" content="WordPress 6.7" />', 'https://blog.example.com')).toBe('wordpress');

    expect(detectTechStack('<html><body><h1>Plain Static Site</h1></body></html>', 'https://example.com')).toBeNull();
    expect(detectTechStack('', '')).toBeNull();
  });

  it('returns accurate EN and ZH platform guidance without invalid Shopify template paths', () => {
    const shopifyEn = getStackGuidance('shopify', false);
    expect(shopifyEn).toEqual({
      stack: 'shopify',
      name: 'Shopify',
      summary: expect.stringContaining('Content > Files'),
      guideUrl: 'https://geoscore.help/geo-for/shopify/?utm_source=chrome_ext',
      showFixPackHint: true,
    });
    expect(shopifyEn.summary).toContain('/llms.txt');
    expect(shopifyEn.summary).toContain('templates/robots.txt.liquid');
    expect(shopifyEn.summary).not.toContain('llms.txt.liquid');
    expect(/[\u4e00-\u9fff]/.test(shopifyEn.summary)).toBe(false);

    const shopifyZh = getStackGuidance('shopify', true);
    expect(shopifyZh.guideUrl).toBe('https://geoscore.help/zh/geo-for/shopify/?utm_source=chrome_ext');
    expect(shopifyZh.summary).toContain('Content > Files');
    expect(shopifyZh.summary).toContain('templates/robots.txt.liquid');
    expect(shopifyZh.summary).not.toContain('llms.txt.liquid');
    expect(shopifyZh.showFixPackHint).toBe(true);

    const wpEn = getStackGuidance('wordpress', false);
    expect(wpEn.name).toBe('WordPress');
    expect(wpEn.summary).toContain('wp-config.php');
    expect(wpEn.summary).toContain('WPCode');
    expect(wpEn.guideUrl).toBe('https://geoscore.help/geo-for/wordpress/?utm_source=chrome_ext');
    expect(wpEn.showFixPackHint).toBe(true);

    const wpZh = getStackGuidance('wordpress', true);
    expect(wpZh.guideUrl).toBe('https://geoscore.help/zh/geo-for/wordpress/?utm_source=chrome_ext');
    expect(wpZh.summary).toContain('Yoast');

    const nextEn = getStackGuidance('nextjs', false);
    expect(nextEn.name).toBe('Next.js');
    expect(nextEn.summary).toContain('public/llms.txt');
    expect(nextEn.summary).toContain('app/robots.ts');
    expect(nextEn.summary).toContain('app/layout.tsx');
    expect(nextEn.guideUrl).toBe('https://geoscore.help/geo-for/nextjs/?utm_source=chrome_ext');
    expect(nextEn.showFixPackHint).toBe(false);

    const nextZh = getStackGuidance('nextjs', true);
    expect(nextZh.guideUrl).toBe('https://geoscore.help/zh/geo-for/nextjs/?utm_source=chrome_ext');
    expect(nextZh.showFixPackHint).toBe(false);

    expect(getStackGuidance(null, false)).toBeNull();
    expect(getStackGuidance('unknown', true)).toBeNull();
  });
});
