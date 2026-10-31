/**
 * renderUpgradeCta (src/components/upgradeCta.js) — CTA ordering and honesty.
 *
 * Two things are locked down here, both of which are easy to break silently
 * because the component has no other coverage:
 *
 * 1. **Ordering.** A low-scoring site (score < 60) needs work performed, not a
 *    subscription over a broken baseline. The primary ask must be the $49
 *    done-for-you Fix Pack and the weekly-monitoring link must be the quiet
 *    secondary. Before 2026-11-01 this was inverted: "Track this site
 *    continuously" was the primary button and the Fix Pack was a small text
 *    link under it.
 *
 * 2. **The honesty label.** The mid/high branches describe the AI visibility
 *    feature. That feature is a content-based simulation, so the copy must
 *    carry the "not live engine traffic" / "不代表真实引擎流量" qualifier. This
 *    is a hard product red line — the label is the only thing standing between
 *    the page and a claim we cannot support.
 *
 * The module reads `document.documentElement.lang` at load time to pick a
 * language, so each language needs a fresh module instance (vi.resetModules).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';

const MODULE = '../src/components/upgradeCta.js';

async function load(lang) {
  vi.resetModules();
  globalThis.document = { documentElement: { lang } };
  return import(MODULE);
}

afterEach(() => {
  delete globalThis.document;
  vi.resetModules();
});

/** Pull every anchor tag out and normalise the attributes we assert on. */
function anchors(html) {
  const out = [];
  const re = /<a\b([^>]*)>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const pick = (name) => {
      const hit = new RegExp(name + '="([^"]*)"').exec(attrs);
      return hit ? hit[1] : null;
    };
    out.push({ href: pick('href'), ctaId: pick('data-cta-id'), placement: pick('data-cta-placement') });
  }
  return out;
}

const LOW = {
  score: 42,
  url: 'https://example.com/',
  timestamp: '2026-11-01',
  recommendations: [{ priority: 'high' }, { priority: 'high' }, { priority: 'high' }],
};
const MID = { score: 64, url: 'https://example.com/', timestamp: '2026-11-01', recommendations: [] };
const HIGH = { score: 88, url: 'https://example.com/', timestamp: '2026-11-01', recommendations: [] };

describe('renderUpgradeCta — low score (the done-for-you buyers)', () => {
  it('makes the $49 Fix Pack the primary ask, not the subscription', async () => {
    const { renderUpgradeCta } = await load('en');
    const links = anchors(renderUpgradeCta(LOW, 'primary'));

    const primary = links.filter((l) => l.placement === 'primary');
    expect(primary).toHaveLength(1);
    expect(primary[0].ctaId).toBe('result_fixpack');
    expect(primary[0].href).toBe('/fixpack/');

    const monitor = links.find((l) => l.ctaId === 'result_monitor');
    expect(monitor).toBeTruthy();
    expect(monitor.placement).toBe('primary-secondary');
    expect(monitor.href).toBe('/pricing/');
  });

  it('renders the Fix Pack anchor before the monitoring anchor', async () => {
    const { renderUpgradeCta } = await load('en');
    const html = renderUpgradeCta(LOW, 'primary');
    const fixAt = html.indexOf('result_fixpack');
    const monAt = html.indexOf('result_monitor');
    expect(fixAt).toBeGreaterThan(-1);
    expect(monAt).toBeGreaterThan(-1);
    expect(fixAt).toBeLessThan(monAt);
  });

  it('tells the visitor the free path exists, so the paid ask is not the only option', async () => {
    const { renderUpgradeCta } = await load('en');
    const html = renderUpgradeCta(LOW, 'primary');
    expect(html).toMatch(/free fix files/i);
  });

  it('points Chinese visitors at the Chinese Fix Pack page', async () => {
    const { renderUpgradeCta } = await load('zh-CN');
    const primary = anchors(renderUpgradeCta(LOW, 'primary')).filter((l) => l.placement === 'primary');
    expect(primary).toHaveLength(1);
    expect(primary[0].href).toBe('/zh/fixpack/');
    expect(primary[0].ctaId).toBe('result_fixpack');
  });

  it('does not promise that the score will rise', async () => {
    const { renderUpgradeCta } = await load('en');
    const html = renderUpgradeCta(LOW, 'primary');
    // "guaranteed", "will improve", "+X points" are all claims we cannot back.
    expect(html).not.toMatch(/guarantee/i);
    expect(html).not.toMatch(/\+\s*\d+\s*(points|pts)/i);
  });
});

describe('renderUpgradeCta — mid and high scores keep the honesty label', () => {
  it('labels the AI visibility feature as an estimate for mid scores', async () => {
    const { renderUpgradeCta } = await load('en');
    const html = renderUpgradeCta(MID, 'primary');
    expect(html).toMatch(/not live engine traffic/i);
    expect(html).toMatch(/simulation/i);
  });

  it('labels the AI visibility feature as an estimate for high scores', async () => {
    const { renderUpgradeCta } = await load('en');
    const html = renderUpgradeCta(HIGH, 'primary');
    expect(html).toMatch(/not live engine traffic/i);
  });

  it('carries the same qualifier in Chinese', async () => {
    const { renderUpgradeCta } = await load('zh-CN');
    expect(renderUpgradeCta(MID, 'primary')).toMatch(/不代表真实引擎流量/);
    expect(renderUpgradeCta(HIGH, 'primary')).toMatch(/不代表真实引擎流量/);
  });

  it('does not route mid/high scorers to the done-for-you pack', async () => {
    const { renderUpgradeCta } = await load('en');
    for (const r of [MID, HIGH]) {
      const ids = anchors(renderUpgradeCta(r, 'primary')).map((l) => l.ctaId);
      expect(ids).not.toContain('result_fixpack');
    }
  });
});

describe('renderUpgradeCta — guards', () => {
  it('returns an empty string when there is no result to render', async () => {
    const { renderUpgradeCta } = await load('en');
    expect(renderUpgradeCta(null, 'primary')).toBe('');
    expect(renderUpgradeCta({ url: 'https://example.com/' }, 'primary')).toBe('');
    expect(renderUpgradeCta(LOW, 'nope')).toBe('');
  });

  it('keeps the lead form collapsed until the visitor asks for it', async () => {
    const { renderUpgradeCta } = await load('en');
    const html = renderUpgradeCta(LOW, 'lead');
    expect(html).toMatch(/id="lead-entry-form"/);
    expect(html).toMatch(/id="lead-entry-form" class="hidden/);
  });
});
