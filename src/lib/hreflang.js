/**
 * hreflang helpers.
 *
 * The site ships English and Chinese versions of *some* pages: the Chinese
 * tree covers the marketing and tool pages but only 1 of the 15 blog posts.
 * A hreflang annotation is therefore only correct for the pairs that actually
 * exist on both sides -- pointing at a 404 is worse than emitting nothing,
 * because Google reports it as an error and may discount the whole set.
 *
 * So the counterpart is resolved by asking the filesystem at build time.
 * Adding a Chinese page (or deleting one) makes the annotation appear (or
 * disappear) on the next build with no list to keep in sync by hand.
 */
import fs from 'node:fs';
import path from 'node:path';

var PAGES_DIR = path.join(process.cwd(), 'src', 'pages');

/**
 * Does a route have a source file? Mirrors Astro's own resolution closely
 * enough for the shapes this repo uses: /foo/ -> src/pages/foo.astro (or .md,
 * or foo/index.astro), with '' meaning src/pages/index.astro.
 */
export function routeExists(route) {
  var rel = String(route || '').replace(/^\//, '').replace(/\/$/, '');
  var base = path.join(PAGES_DIR, rel || 'index');
  return (
    fs.existsSync(base + '.astro') ||
    fs.existsSync(base + '.md') ||
    fs.existsSync(path.join(base, 'index.astro')) ||
    fs.existsSync(path.join(base, 'index.md'))
  );
}

/**
 * Split a route into its English and Chinese spellings.
 * '/zh/methodology/' -> { en: '/methodology/', zh: '/zh/methodology/' }
 * '/'               -> { en: '/', zh: '/zh/' }
 */
export function pair(pathname) {
  var p = String(pathname || '/');
  var isZh = p === '/zh' || p.indexOf('/zh/') === 0;
  var en = isZh ? p.replace(/^\/zh/, '') || '/' : p;
  var zh = '/zh' + (en === '/' ? '/' : en);
  if (en !== '/' && !/\/$/.test(en)) en = en + '/';
  return { en: en, zh: zh, isZh: isZh };
}

/**
 * Absolute alternate URLs for a page, or null when the page is one-sided.
 * x-default points at English: the product is aimed at overseas site owners,
 * so English is the right fall-back for unmatched locales.
 */
export function alternates(site, pathname) {
  var p = pair(pathname);
  if (!routeExists(p.en) || !routeExists(p.zh)) return null;
  var en = new URL(p.en, site).href;
  var zh = new URL(p.zh, site).href;
  return { en: en, zh: zh, xDefault: en };
}
