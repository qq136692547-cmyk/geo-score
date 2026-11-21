import { describe, it, expect, afterEach, vi } from 'vitest';

const MODULE = '../src/components/fixFilesPanel.js';

async function load(lang) {
  vi.resetModules();
  globalThis.document = { documentElement: { lang } };
  return import(MODULE);
}

afterEach(() => {
  delete globalThis.document;
  vi.resetModules();
});

const RESULT_WITH_RAW = {
  url: 'https://example.com/',
  raw: {
    pageHtml: '<html><head><title>Example Store</title></head><body>Hello</body></html>',
    robotsTxt: 'User-agent: *\nAllow: /\n',
  },
};

function extractTabs(html) {
  const out = [];
  const re = /<button\b([^>]*\brole="tab"[^>]*)>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const pick = (name) => {
      const hit = new RegExp(name + '="([^"]*)"').exec(attrs);
      return hit ? hit[1] : null;
    };
    out.push({
      id: pick('data-stack-tab'),
      ariaSelected: pick('aria-selected'),
      hasAriaControls: /\baria-controls\s*=/.test(attrs),
      hasFocusgroupStart: /\bfocusgroupstart\b/.test(attrs),
    });
  }
  return out;
}

function extractPanels(html) {
  const out = [];
  const re = /<div\b([^>]*\brole="tabpanel"[^>]*)>([\s\S]*?)<\/div>\s*(?=<div\b[^>]*\brole="tabpanel"|<\/div>\s*<\/div>)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const pick = (name) => {
      const hit = new RegExp(name + '="([^"]*)"').exec(attrs);
      return hit ? hit[1] : null;
    };
    out.push({
      id: pick('data-stack-panel'),
      hidden: pick('hidden'),
      tabindex: pick('tabindex'),
      innerHtml: m[2],
    });
  }
  return out;
}

describe('renderFixFilesPanel — stack deployment guide', () => {
  it('returns empty string when result or result.raw is absent', async () => {
    const { renderFixFilesPanel } = await load('en');
    expect(renderFixFilesPanel(null)).toBe('');
    expect(renderFixFilesPanel({})).toBe('');
    expect(renderFixFilesPanel({ url: 'https://example.com' })).toBe('');
  });

  for (const [lang, expectedHref] of [
    ['en', '/fixpack/'],
    ['zh-CN', '/zh/fixpack/'],
  ]) {
    it(`renders 4 accessible stack tabs and panels for ${lang}`, async () => {
      const { renderFixFilesPanel } = await load(lang);
      const html = renderFixFilesPanel(RESULT_WITH_RAW);

      const tabs = extractTabs(html);
      expect(tabs.map((t) => t.id)).toEqual(['static', 'nextjs', 'wordpress', 'shopify']);
      expect(tabs[0].ariaSelected).toBe('true');
      expect(tabs[0].hasFocusgroupStart).toBe(true);
      for (const tab of tabs.slice(1)) {
        expect(tab.ariaSelected).toBe('false');
        expect(tab.hasFocusgroupStart).toBe(false);
      }
      for (const tab of tabs) {
        expect(tab.hasAriaControls).toBe(false);
      }

      const panels = extractPanels(html);
      expect(panels.map((p) => p.id)).toEqual(['static', 'nextjs', 'wordpress', 'shopify']);
      expect(panels[0].hidden).toBeNull();
      expect(panels[0].tabindex).toBe('0');
      for (const panel of panels.slice(1)) {
        expect(panel.hidden).toBe('until-found');
        expect(panel.tabindex).toBeNull();
      }

      const wpSection = html.slice(html.indexOf('id="stack-panel-wordpress"'), html.indexOf('id="stack-panel-shopify"'));
      const shopifySection = html.slice(html.indexOf('id="stack-panel-shopify"'));

      expect(wpSection).toContain(`href="${expectedHref}"`);
      expect(wpSection).toContain('data-cta-id="fixfiles_stack_fixpack"');
      expect(wpSection).toContain('data-cta-placement="stack_guide_wordpress"');
      expect(wpSection).toContain('$49');

      expect(shopifySection).toContain(`href="${expectedHref}"`);
      expect(shopifySection).toContain('data-cta-id="fixfiles_stack_fixpack"');
      expect(shopifySection).toContain('data-cta-placement="stack_guide_shopify"');
      expect(shopifySection).toContain('$49');
    });
  }

  it('contains zero Chinese characters in English mode', async () => {
    const { renderFixFilesPanel } = await load('en');
    const html = renderFixFilesPanel(RESULT_WITH_RAW);
    expect(/[\u4e00-\u9fff]/.test(html)).toBe(false);
  });
});
