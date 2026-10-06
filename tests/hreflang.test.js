import { describe, it, expect } from 'vitest';
import { pair, alternates, routeExists } from '../src/lib/hreflang.js';

const SITE = 'https://geoscore.help';

describe('hreflang pairing', () => {
  it('maps an English route to its Chinese spelling', () => {
    expect(pair('/methodology/')).toMatchObject({
      en: '/methodology/',
      zh: '/zh/methodology/',
      isZh: false,
    });
  });

  it('maps a Chinese route back to English', () => {
    expect(pair('/zh/methodology/')).toMatchObject({
      en: '/methodology/',
      zh: '/zh/methodology/',
      isZh: true,
    });
  });

  it('treats the roots as a pair, not as /zh/zh/', () => {
    expect(pair('/').zh).toBe('/zh/');
    expect(pair('/zh/').en).toBe('/');
  });
});

describe('alternates', () => {
  it('annotates a page that exists in both languages', () => {
    const alt = alternates(SITE, '/methodology/');
    expect(alt).not.toBeNull();
    expect(alt.en).toBe('https://geoscore.help/methodology/');
    expect(alt.zh).toBe('https://geoscore.help/zh/methodology/');
    // English is the fall-back for unmatched locales.
    expect(alt.xDefault).toBe(alt.en);
  });

  it('annotates the Chinese side with the identical set', () => {
    const fromZh = alternates(SITE, '/zh/methodology/');
    const fromEn = alternates(SITE, '/methodology/');
    expect(fromZh).toEqual(fromEn);
  });

  // The regression this guards: most blog posts have no Chinese translation.
  // Emitting hreflang anyway would point Google at a 404.
  it('emits nothing for a page with no counterpart', () => {
    expect(alternates(SITE, '/blog/what-is-geo/')).toBeNull();
    expect(alternates(SITE, '/zh/blog/what-is-geo/')).toBeNull();
  });

  it('is symmetric: one-sided pages are one-sided from both directions', () => {
    expect(alternates(SITE, '/blog/geo-vs-seo/')).toBeNull();
    expect(alternates(SITE, '/zh/blog/geo-vs-seo/')).toBeNull();
  });

  it('annotates the blog index, which does exist in both languages', () => {
    const alt = alternates(SITE, '/blog/');
    expect(alt).not.toBeNull();
    expect(alt.zh).toBe('https://geoscore.help/zh/blog/');
  });
});

describe('routeExists', () => {
  it('resolves a page that ships in the repo', () => {
    expect(routeExists('/methodology/')).toBe(true);
    expect(routeExists('/zh/methodology/')).toBe(true);
    expect(routeExists('/')).toBe(true);
    expect(routeExists('/zh/')).toBe(true);
  });

  it('does not resolve a page that does not exist', () => {
    expect(routeExists('/zh/blog/what-is-geo/')).toBe(false);
  });
});
