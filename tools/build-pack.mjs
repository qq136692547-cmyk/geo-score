/**
 * Build the $49 Fix Pack for one URL.
 *
 * WHY THIS EXISTS
 * The gig promises three files in 48 hours. Writing them by hand is one to two
 * hours per order, and the first delivery decides whether the gig survives — a
 * pack with a wrong price is a dispute, not a bad review. So the files are
 * generated from what the page actually contains, and everything the page does
 * NOT contain is listed for the operator to ask about instead of being guessed.
 *
 * THE ONE RULE
 * Nothing is invented. A price is emitted only if a price was found; a GTIN is
 * emitted only if a GTIN was found. When two sources disagree (JSON-LD says one
 * price, Open Graph says another) the conflict is recorded rather than silently
 * resolved, because the merchant is the only one who knows which is right.
 *
 * WHAT IS REUSED
 * `generateRobotsTxt` already encodes a hard-won rule: never add `Allow: /` to a
 * site that closed itself on purpose, and never re-allow a bot the owner blocked
 * by name. Rewriting that here would lose it.
 *
 * Usage:
 *   node tools/build-pack.mjs <url> [--out <dir>] [--zh]
 */
import fs from 'node:fs';
import path from 'node:path';
import { extractJsonLd } from '../src/lib/analyzers/schema.js';
import { fetchPageWithHeaders } from '../src/lib/node-fetcher.js';

/* ------------------------------------------------------------------ *
 * Reading the page
 * ------------------------------------------------------------------ */

const PRODUCT_TYPES = new Set(['product', 'productgroup']);

/** Fields a shopping surface needs before it can read a product at all. */
export const REQUIRED = ['name', 'image', 'price', 'priceCurrency', 'availability'];

/** Any one of these is enough to identify the item. */
export const IDENTIFIERS = ['sku', 'gtin13', 'gtin', 'mpn'];

const AVAILABILITY = {
  instock: 'InStock',
  limitedavailability: 'LimitedAvailability',
  onlineonly: 'OnlineOnly',
  instoreonly: 'InStoreOnly',
  outofstock: 'OutOfStock',
  soldout: 'SoldOut',
  preorder: 'PreOrder',
  preorderitems: 'PreOrder',
  backorder: 'BackOrder',
  discontinued: 'Discontinued',
};

function typeList(node) {
  const t = node && node['@type'];
  return (Array.isArray(t) ? t : [t]).filter((x) => typeof x === 'string').map((x) => x.toLowerCase());
}

export function isProductNode(node) {
  return typeList(node).some((t) => PRODUCT_TYPES.has(t));
}

/** schema.org allows a value to be a string, an object with url/@id, or a list. */
export function firstString(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const s = firstString(item);
      if (s) return s;
    }
    return '';
  }
  if (value && typeof value === 'object') {
    if (typeof value.url === 'string') return value.url.trim();
    if (typeof value.name === 'string') return value.name.trim();
    if (typeof value['@id'] === 'string') return value['@id'].trim();
  }
  return '';
}

/**
 * Product images, deduped by file.
 *
 * A Shopify product page lists the same photograph four times, once per
 * `?width=` variant. Shipping all four into a customer's HTML looks careless and
 * bloats the node, so they collapse to one entry — the widest — per file.
 */
function imagesOf(value) {
  const raw = [];
  const walk = (x) => {
    if (Array.isArray(x)) { x.forEach(walk); return; }
    const s = firstString(x);
    if (s && /^https?:\/\//i.test(s) && !raw.includes(s)) raw.push(s);
  };
  walk(value);

  const widthOf = (u) => {
    const m = u.match(/[?&](?:width|w)=(\d+)/i);
    return m ? Number(m[1]) : 0;
  };
  const byFile = new Map();
  for (const u of raw) {
    const base = u.split('?')[0];
    const best = byFile.get(base);
    if (!best || widthOf(u) > widthOf(best)) byFile.set(base, u);
  }
  return Array.from(byFile.values()).slice(0, 3);
}

/**
 * Every Offer reachable from a product node.
 *
 * Shopify emits a ProductGroup whose offers live inside `hasVariant[]`, so
 * looking only at `node.offers` reports a complete store as having no price.
 */
export function offersOf(node) {
  const out = [];
  const seen = new Set();
  const walk = (x) => {
    if (!x || typeof x !== 'object') return;
    if (seen.has(x)) return;
    seen.add(x);
    if (Array.isArray(x)) { x.forEach(walk); return; }
    const types = typeList(x);
    if (types.some((t) => t === 'offer' || t === 'aggregateoffer')) out.push(x);
    for (const key of ['offers', 'hasVariant', 'variants', 'itemOffered']) {
      if (x[key]) walk(x[key]);
    }
  };
  walk(node);
  return out;
}

export function normalizeAvailability(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const tail = raw.replace(/^https?:\/\/schema\.org\//i, '');
  const key = tail.toLowerCase().replace(/[^a-z]/g, '');
  return AVAILABILITY[key] || '';
}

/** "1,299.00" -> "1299.00"; anything unparseable -> '' (never a guess). */
export function normalizePrice(value) {
  const raw = String(value == null ? '' : value).replace(/[,\s]/g, '').replace(/^[^\d.]+/, '');
  if (!raw) return '';
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return '';
  return n.toFixed(2);
}

/**
 * Upgrade an http:// asset to https:// when the page itself is served over https.
 *
 * greatjonesgoods publishes `http://cdn.shopify.com/...` in its own JSON-LD.
 * Copying that into a file pasted onto an https page gets the image blocked as
 * mixed content — so the "fix" would break the thing it was meant to fix. This
 * changes only the scheme, never the host or path.
 */
export function normalizeUrl(url, pageUrl) {
  const u = String(url || '').trim();
  if (!u) return '';
  const pageIsHttps = /^https:/i.test(String(pageUrl || ''));
  if (pageIsHttps && /^http:/i.test(u) && u.startsWith('http://')) return 'https://' + u.slice('http://'.length);
  return u;
}

export function normalizeCurrency(value) {
  const raw = String(value || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(raw) ? raw : '';
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#34': '"', '#38': '&' };

/** Titles and descriptions arrive HTML-escaped; a delivered file must not. */
export function decodeEntities(text) {
  return String(text == null ? '' : text).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code) => {
    const key = code.toLowerCase();
    if (ENTITIES[key]) return ENTITIES[key];
    if (/^#x[0-9a-f]+$/.test(key)) return String.fromCodePoint(parseInt(key.slice(2), 16));
    if (/^#[0-9]+$/.test(key)) return String.fromCodePoint(parseInt(key.slice(1), 10));
    return m;
  });
}

function metaContent(html, prop) {
  const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1].trim()) return decodeEntities(m[1].trim());
  }
  return '';
}

function itemprop(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`itemprop=["']${escaped}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`content=["']([^"']*)["'][^>]*itemprop=["']${escaped}["']`, 'i'),
    new RegExp(`itemprop=["']${escaped}["'][^>]*href=["']([^"']*)["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1].trim()) return m[1].trim();
  }
  return '';
}

function h1Text(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return '';
  return decodeEntities(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function titleText(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1].replace(/\s+/g, ' ').trim()) : '';
}

/**
 * Pull product facts out of one page, recording where each came from.
 *
 * Precedence is JSON-LD > Open Graph > microdata > visible heading, because
 * that is also the order of how deliberate each source is. The precedence only
 * decides which value is used when sources agree or only one exists — when two
 * disagree, the disagreement is reported instead of hidden.
 */
export function extractProduct(html, pageUrl) {
  const page = String(html || '');
  const nodes = page ? extractJsonLd(page) : [];
  const node = nodes.find(isProductNode) || null;
  const offers = node ? offersOf(node) : [];
  const offer = offers.find((o) => o.price != null && o.price !== '') || offers[0] || null;

  const fields = {};
  const sources = {};

  const take = (field, value, source) => {
    if (value && !fields[field]) { fields[field] = value; sources[field] = source; }
  };

  take('name', firstString(node && node.name), 'jsonld');
  take('name', metaContent(page, 'og:title'), 'og');
  take('name', h1Text(page), 'h1');
  take('name', titleText(page), 'title');

  const images = imagesOf(node && node.image).map((u) => normalizeUrl(u, pageUrl));
  if (images.length) { fields.image = images; sources.image = 'jsonld'; }
  const ogImage = metaContent(page, 'og:image') || metaContent(page, 'twitter:image');
  if (!fields.image && ogImage) { fields.image = [normalizeUrl(ogImage, pageUrl)]; sources.image = 'og'; }

  take('description', firstString(node && node.description), 'jsonld');
  take('description', metaContent(page, 'og:description'), 'og');
  take('description', metaContent(page, 'description'), 'meta');

  take('sku', firstString(node && node.sku), 'jsonld');
  take('sku', itemprop(page, 'sku'), 'microdata');

  take('gtin13', firstString(node && node.gtin13), 'jsonld');
  take('gtin', firstString(node && node.gtin), 'jsonld');
  take('gtin13', firstString(node && node.gtin13), 'jsonld');
  take('mpn', firstString(node && node.mpn), 'jsonld');

  take('brand', firstString(node && node.brand), 'jsonld');

  const ratingValue = Number(firstString(node && node.aggregateRating && node.aggregateRating.ratingValue));
  const reviewCount = Number(firstString(node && node.aggregateRating && node.aggregateRating.reviewCount));
  if (Number.isFinite(ratingValue) && ratingValue > 0
    && Number.isFinite(reviewCount) && reviewCount > 0) {
    fields.ratingValue = ratingValue;
    fields.reviewCount = reviewCount;
    sources.ratingValue = 'jsonld';
    sources.reviewCount = 'jsonld';
  }

  // Offers: price, currency, availability. Each may come from a different source.
  const jsonLdPrice = normalizePrice(offer && offer.price);
  const jsonLdCurrency = normalizeCurrency(offer && offer.priceCurrency);
  const jsonLdAvailability = normalizeAvailability(offer && offer.availability);

  const ogPrice = normalizePrice(metaContent(page, 'product:price:amount') || metaContent(page, 'og:price:amount'));
  const ogCurrency = normalizeCurrency(metaContent(page, 'product:price:currency') || metaContent(page, 'og:price:currency'));
  const ogAvailability = normalizeAvailability(metaContent(page, 'product:availability'));

  const microPrice = normalizePrice(itemprop(page, 'price'));
  const microCurrency = normalizeCurrency(itemprop(page, 'priceCurrency'));
  const microAvailability = normalizeAvailability(itemprop(page, 'availability'));

  take('price', jsonLdPrice, 'jsonld');
  take('price', ogPrice, 'og');
  take('price', microPrice, 'microdata');

  take('priceCurrency', jsonLdCurrency, 'jsonld');
  take('priceCurrency', ogCurrency, 'og');
  take('priceCurrency', microCurrency, 'microdata');

  take('availability', jsonLdAvailability, 'jsonld');
  take('availability', ogAvailability, 'og');
  take('availability', microAvailability, 'microdata');

  take('url', normalizeUrl(firstString(node && node.url), pageUrl), 'jsonld');
  take('url', normalizeUrl(metaContent(page, 'og:url'), pageUrl), 'og');
  take('url', pageUrl, 'page');

  // A disagreement is information, not noise. Report it; do not average it.
  const conflicts = [];
  const disagree = (field, a, b, fromA, fromB) => {
    if (a && b && a !== b) conflicts.push({ field, [fromA]: a, [fromB]: b });
  };
  disagree('price', jsonLdPrice, ogPrice, 'jsonld', 'og');
  disagree('price', jsonLdPrice, microPrice, 'jsonld', 'microdata');
  disagree('priceCurrency', jsonLdCurrency, ogCurrency, 'jsonld', 'og');
  disagree('availability', jsonLdAvailability, ogAvailability, 'jsonld', 'og');

  const hasIdentifier = IDENTIFIERS.some((f) => fields[f]);
  const missing = REQUIRED.filter((f) => !fields[f]);
  if (!hasIdentifier) missing.push('identifier');

  return {
    fields,
    sources,
    missing,
    conflicts,
    hasIdentifier,
    existing: {
      node: node || null,
      present: !!node,
      propertyCount: node ? Object.keys(node).length : 0,
      requiredPresent: REQUIRED.filter((f) => {
        if (f === 'image') return imagesOf(node && node.image).length > 0;
        if (f === 'name') return !!firstString(node && node.name);
        if (f === 'price') return !!(offer && offer.price);
        if (f === 'priceCurrency') return !!(offer && offer.priceCurrency);
        if (f === 'availability') return !!(offer && offer.availability);
        return false;
      }),
    },
  };
}

/* ------------------------------------------------------------------ *
 * robots.txt — change only what is actually blocked
 * ------------------------------------------------------------------ */

/** The crawlers a shopping surface or answer engine is most likely to send. */
export const AI_CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'anthropic-ai', 'Claude-SearchBot',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'CCBot', 'Bytespider',
  'meta-externalagent', 'Amazonbot', 'Applebot-Extended',
  'cohere-ai', 'DuckAssistBot', 'AI2Bot', 'xAI-Bot', 'YouBot', 'PetalBot',
];

/** Parse robots.txt into groups, the way RFC 9309 reads it. */
export function parseRobots(text) {
  const groups = [];
  let group = null;
  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const ua = line.match(/^user-agent:\s*(.+)$/i);
    if (ua) {
      if (!group || group.rules.length > 0) {
        group = { agents: [], rules: [] };
        groups.push(group);
      }
      group.agents.push(ua[1].trim().toLowerCase());
      continue;
    }
    if (!group) continue;
    const rule = line.match(/^(allow|disallow):\s*(.*)$/i);
    if (rule) group.rules.push({ type: rule[1].toLowerCase(), path: rule[2].trim() });
  }
  return groups;
}

const disallowsEverything = (g) => g.rules.some((r) => r.type === 'disallow' && r.path === '/');

/**
 * What does this robots.txt actually do to AI crawlers?
 *
 * This is the difference between shipping a fix and shipping noise. Shopify's
 * default robots.txt already contains `User-agent: GPTBot / Allow: /` for the
 * four biggest crawlers, so for a normal Shopify store there is nothing to fix
 * — and rewriting the file anyway would be a change with no benefit and some
 * risk.
 */
export function analyzeRobotsForAi(text) {
  const groups = parseRobots(text);
  const star = groups.filter((g) => g.agents.includes('*'));
  const blocksAll = star.some(disallowsEverything);

  const blockedByName = [];
  const allowedByName = [];
  for (const bot of AI_CRAWLERS) {
    const own = groups.filter((g) => g.agents.includes(bot.toLowerCase()));
    if (!own.length) continue;
    if (own.some(disallowsEverything)) blockedByName.push(bot);
    else if (own.some((g) => g.rules.some((r) => r.type === 'allow' && r.path === '/'))) allowedByName.push(bot);
  }

  const implicit = AI_CRAWLERS.filter((b) => !blockedByName.includes(b) && !allowedByName.includes(b));
  const needed = !blocksAll && blockedByName.length > 0;

  return { groups, blocksAll, blockedByName, allowedByName, implicit, needed };
}

/**
 * A patch block, not a rewritten file.
 *
 * Each unblocked crawler gets its own group, and that group repeats every
 * Disallow from the site's `*` group. Without the copy, a specific group would
 * *replace* the wildcard rules rather than add to them, quietly opening paths
 * such as /admin that the owner had closed for everyone.
 */
export function buildRobotsPatch(existing, analysis, origin) {
  const star = analysis.groups.filter((g) => g.agents.includes('*'));
  const inherited = [];
  const seen = new Set();
  for (const g of star) {
    for (const r of g.rules) {
      if (r.type !== 'disallow' || !r.path) continue;
      const key = r.path;
      if (seen.has(key)) continue;
      seen.add(key);
      inherited.push(r.path);
    }
  }

  const lines = [];
  lines.push('');
  lines.push('# --- AI crawlers: explicitly allowed (added by GeoScore) ---');
  lines.push('# These groups only add permission for the named crawlers. Every rule');
  lines.push('# above this line is unchanged, and the Disallow lines below repeat your');
  lines.push('# existing ones so a specific group cannot open paths your wildcard closed.');
  lines.push('');
  for (const bot of analysis.blockedByName) {
    lines.push('User-agent: ' + bot);
    lines.push('Allow: /');
    for (const p of inherited) lines.push('Disallow: ' + p);
    lines.push('');
  }
  if (!/^\s*sitemap:/im.test(existing)) {
    lines.push('Sitemap: ' + origin + '/sitemap.xml');
    lines.push('');
  }
  return lines.join('\n');
}

/* ------------------------------------------------------------------ *
 * Building the three files
 * ------------------------------------------------------------------ */

/**
 * The Product node we hand over.
 *
 * Returns null when there is no name: a Product without a name is not a product,
 * and emitting one would put an empty node into someone's production HTML.
 */
export function buildProductJsonLd(product, pageUrl) {
  const f = (product && product.fields) || {};
  if (!f.name) return null;

  const node = { '@context': 'https://schema.org', '@type': 'Product', name: f.name };
  if (f.image && f.image.length) node.image = f.image;
  if (f.description) node.description = f.description;
  if (f.sku) node.sku = f.sku;
  if (f.gtin13) node.gtin13 = f.gtin13;
  else if (f.gtin) node.gtin = f.gtin;
  if (f.mpn) node.mpn = f.mpn;
  if (f.brand) node.brand = { '@type': 'Brand', name: f.brand };

  // An Offer needs both halves. Half an offer is worse than none: a price with
  // no currency cannot be read as a price by anything.
  if (f.price && f.priceCurrency) {
    node.offers = {
      '@type': 'Offer',
      url: f.url || pageUrl,
      price: f.price,
      priceCurrency: f.priceCurrency,
    };
    if (f.availability) node.offers.availability = 'https://schema.org/' + f.availability;
  }

  if (f.ratingValue && f.reviewCount) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: f.ratingValue,
      reviewCount: f.reviewCount,
    };
  }

  return node;
}

export function productJsonLdFile(node) {
  return '<script type="application/ld+json">\n' + JSON.stringify(node, null, 2) + '\n</script>\n';
}

const NOISE = /^\/(cart|account|login|logout|checkout|search|wishlist|collections\/all|policies)\b/i;

/** Nav-ish links that are worth naming in an llms.txt, deduped and bounded. */
export function extractSections(html, origin) {
  const page = String(html || '');
  const seen = new Set();
  const out = [];
  const re = /<a\b[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(page)) !== null) {
    const href = m[1].trim();
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 2 || text.length > 60) continue;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) continue;
    if (/\.(png|jpe?g|webp|svg|gif|pdf|zip|css|js)$/i.test(href)) continue;

    let url;
    try {
      url = new URL(href, origin + '/');
    } catch { continue; }
    if (url.origin !== origin) continue;
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    if (NOISE.test(pathname)) continue;
    if (url.search) continue;
    if (pathname.split('/').filter(Boolean).length > 2) continue;
    // The same destination appears under several labels ("New Arrivals" twice on
    // allbirds), and a repeated label reads like a scrape rather than a curation.
    const textKey = text.toLowerCase();
    if (seen.has(pathname) || seen.has('t:' + textKey)) continue;
    seen.add(pathname);
    seen.add('t:' + textKey);
    out.push({ url: origin + pathname, text });
    if (out.length >= 6) break;
  }
  return out;
}

/**
 * A curated llms.txt draft.
 *
 * Deliberately short and hand-shaped: the platform-generated file on Shopify is
 * an agent-integration guide, and a 400-line dump is what stripe.com has. The
 * operator is told to review it before it ships.
 */
export function buildLlmsDraft(input) {
  const { origin, siteName, summary, sections, productUrl, productName } = input;
  const lines = [];
  lines.push('# ' + (siteName || origin.replace(/^https?:\/\//, '')));
  lines.push('');
  lines.push('> ' + (summary || siteName || origin));
  lines.push('');

  if (productUrl && productName) {
    lines.push('## Product');
    lines.push('');
    lines.push('- [' + productName + '](' + productUrl + ')');
    lines.push('');
  }

  if (sections && sections.length) {
    lines.push('## Sections');
    lines.push('');
    for (const s of sections) lines.push('- [' + s.text + '](' + s.url + ')');
    lines.push('');
  }

  lines.push('## Machine-readable');
  lines.push('');
  lines.push('- [llms.txt](' + origin + '/llms.txt) — this file');
  lines.push('- [robots.txt](' + origin + '/robots.txt) — crawler rules');
  lines.push('- [sitemap.xml](' + origin + '/sitemap.xml) — every page');
  lines.push('');
  return lines.join('\n');
}

/* ------------------------------------------------------------------ *
 * Platform, install steps, and what to ask the merchant
 * ------------------------------------------------------------------ */

export function detectPlatform(html) {
  const page = String(html || '').toLowerCase();
  if (/cdn\.shopify\.com|shopify\.theme|myshopify\.com/.test(page)) return 'shopify';
  if (/woocommerce|wp-content\/plugins\/woocommerce/.test(page)) return 'woocommerce';
  if (/wp-content|wp-includes/.test(page)) return 'wordpress';
  if (/webflow\.(io|com)|data-wf-page/.test(page)) return 'webflow';
  if (/squarespace/.test(page)) return 'squarespace';
  if (/wixstatic|wix\.com/.test(page)) return 'wix';
  if (/bigcommerce/.test(page)) return 'bigcommerce';
  return 'custom';
}

const INSTALL = {
  shopify: {
    label: 'Shopify',
    product: [
      'Shopify usually emits its own Product JSON-LD. Check before adding anything:',
      'view-source your product page and search for `"@type": "Product"`.',
      '',
      '- If it is there **and** it already carries `offers` with price and currency, you do not need this file. Tell me and I will refund that part.',
      '- If it is there but incomplete, do **not** paste this next to it — two Product nodes on one page is ambiguous. Replace the theme snippet: Online Store → Themes → Edit code → `snippets/` and find the file that outputs `application/ld+json`.',
      '- If there is none, paste this file into `theme.liquid` immediately before `</head>`.',
    ],
    llms: [
      'Since May 2026 Shopify serves `/llms.txt` itself and redirects any custom one to its own `/agents.md`.',
      '',
      'The only supported override is a theme template. Create `templates/llms.txt.liquid`, then add the alternate in `layout/theme.liquid` `<head>`:',
      '',
      '```liquid',
      '<link rel="alternate" type="text/plain" href="{{ \'/llms.txt\' | asset_url }}" />',
      '```',
      '',
      '**Two things to know before you do this:**',
      '',
      '1. A custom template **replaces** the platform file rather than merging with it. Copy the agent-discovery links (`UCP`, `MCP`, `shop.com/SKILL`) out of the platform version into yours, or agentic checkout stops working.',
      '2. Shopify renders these templates in a restricted Liquid context: `shop`, `collections` and `pages` are blank. That is why this file is static, curated content and not a loop over your catalogue.',
    ],
    robots: [
      'Do not replace your robots.txt — append this block to the end of the existing one, or paste the whole file if you have no custom rules.',
      '',
      'Shopify serves `/robots.txt` from a template; edits made in the admin under Online Store → Preferences → Robots.txt are the supported path.',
    ],
  },
  woocommerce: {
    label: 'WooCommerce',
    product: [
      'WooCommerce does not emit Product JSON-LD by default, which is why this file matters most here.',
      '',
      'Paste it immediately before `</head>` in your child theme\'s `header.php`, or add it through a code-snippets plugin so it survives theme updates.',
    ],
    llms: [
      'Upload this file to your web root as `/llms.txt` (FTP, SFTP, or your host\'s file manager). It is a static text file — no plugin needed.',
    ],
    robots: [
      'Append this block to the existing `/robots.txt` in your web root. If WordPress manages it (Yoast or Rank Math), use the plugin\'s robots.txt editor instead of editing the file.',
    ],
  },
  wordpress: {
    label: 'WordPress',
    product: [
      'Paste immediately before `</head>` in your child theme\'s `header.php`, or through a code-snippets plugin.',
    ],
    llms: ['Upload this file to your web root as `/llms.txt`.'],
    robots: ['Append to `/robots.txt`, or use your SEO plugin\'s robots.txt editor if it manages the file.'],
  },
  webflow: {
    label: 'Webflow',
    product: [
      'Project Settings → Custom Code → **Head Code**. Paste there; it applies to every page, so confirm the product data is right for the page you want it on.',
    ],
    llms: [
      'Webflow cannot serve a static text file from the root without a redirect rule. Easiest path: put this file on any static host and add a 200 rewrite at `/llms.txt`.',
    ],
    robots: ['Webflow generates `/robots.txt` from Site Settings → SEO. Add this block there rather than editing a file.'],
  },
  custom: {
    label: 'custom build',
    product: ['Paste immediately before `</head>` on the product page, or render it server-side into the template.'],
    llms: ['Upload this file to the web root as `/llms.txt`.'],
    robots: ['Append this block to the existing `/robots.txt`, or merge the rules into whatever generates it.'],
  },
};

export function buildInstall(platform, extra, robots) {
  const p = INSTALL[platform] || INSTALL.custom;
  const lines = ['# Install steps — ' + p.label, ''];
  lines.push('Three files, in the order that matters: Product JSON-LD first, then robots.txt, then llms.txt.');
  lines.push('');
  lines.push('## 1. product.jsonld');
  lines.push('');
  lines.push(...p.product);
  lines.push('');
  lines.push('## 2. robots.txt');
  lines.push('');
  if (robots && robots.blocksAll) {
    lines.push('**No change was made.** Your robots.txt closes the whole site (`User-agent: *` + `Disallow: /`). That is a deliberate choice, and adding `Allow: /` here would silently override it. Remove that rule first if you actually want AI crawlers in.');
  } else if (robots && !robots.needed) {
    lines.push('**No change was needed, so no file is included.** Your robots.txt already lets AI crawlers in:');
    lines.push('');
    if (robots.allowedByName.length) {
      lines.push('- named explicitly with `Allow: /`: ' + robots.allowedByName.join(', '));
    }
    if (robots.implicit.length) {
      lines.push('- ' + robots.implicit.length + ' more are covered by your wildcard group, which does not block them: ' + robots.implicit.slice(0, 6).join(', ') + (robots.implicit.length > 6 ? '…' : ''));
    }
    lines.push('');
    lines.push('Nothing to paste. If someone tells you this file is broken, show them those lines.');
  } else if (robots && robots.needed) {
    lines.push('Your robots.txt blocks ' + robots.blockedByName.length + ' AI crawler' + (robots.blockedByName.length === 1 ? '' : 's') + ' by name: ' + robots.blockedByName.join(', ') + '.');
    lines.push('');
    lines.push('The included file is your original text with a block appended at the end — nothing above the marker line is changed. The appended groups repeat your existing `Disallow` rules, because a crawler-specific group replaces the wildcard group rather than adding to it.');
    lines.push('');
    lines.push(...p.robots);
  } else {
    lines.push(...p.robots);
  }
  lines.push('');
  lines.push('## 3. llms.txt');
  lines.push('');
  lines.push(...p.llms);
  lines.push('');
  if (extra && extra.length) {
    lines.push('## Specific to your site');
    lines.push('');
    for (const note of extra) lines.push('- ' + note);
    lines.push('');
  }
  lines.push('## Checking your work');
  lines.push('');
  lines.push('After pasting, run this and paste the result back to me:');
  lines.push('');
  lines.push('```');
  lines.push('node tools/diagnose.mjs ' + (extra && extra.pageUrl ? extra.pageUrl : '<your-product-url>'));
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

/**
 * The questions the operator has to ask before shipping.
 *
 * This is the whole reason the pack is a service and not a download: the page
 * is the source of truth, and the page is incomplete.
 */
export function buildNeedsConfirmation(product, context = {}) {
  const q = {
    name: 'What is the exact product name? I could not read one from the page.',
    image: 'Which image should represent this product? I found none I can point at with a stable URL.',
    price: 'What is the current price? I could not find one on the page — I will not guess at a price.',
    priceCurrency: 'Which currency is that price in? (e.g. USD, EUR, GBP)',
    availability: 'Is it in stock right now? (In stock / Out of stock / Pre-order / Back-order)',
    identifier: 'Do your products carry a GTIN/UPC barcode? If not, we will use your internal SKU instead — what is it for this product?',
  };

  const lines = [];
  const missing = (product && product.missing) || [];

  if (context.sufficient) {
    lines.push('# The schema part is not needed here');
    lines.push('');
    lines.push('The page already carries a complete Product node — name, image, price, currency, availability and an identifier are all present. product.jsonld was deliberately **not** generated: a second Product node next to a complete one is ambiguous, and you should not be charged for a file you do not need.');
    lines.push('');
    lines.push('What is left in this pack: `robots.txt` and `llms.txt`. Tell the buyer plainly.');
    lines.push('');
    return lines.join('\n');
  }

  if (!missing.length && !(product.conflicts || []).length) {
    lines.push('# Nothing to confirm');
    lines.push('');
    lines.push('Every field a shopping surface needs was found on the page. Re-read the product.jsonld file once before shipping it.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('# Confirm before shipping');
  lines.push('');
  lines.push('These are the things the page did not tell us. Ask the buyer, do not guess — a wrong price in a delivered file is a dispute.');
  lines.push('');

  if (missing.length) {
    lines.push('## Missing from the page');
    lines.push('');
    for (const field of missing) {
      lines.push('- **' + field + '** — ' + (q[field] || 'Not found on the page; please confirm the correct value.'));
    }
    lines.push('');
  }

  const conflicts = (product && product.conflicts) || [];
  if (conflicts.length) {
    lines.push('## Sources disagree');
    lines.push('');
    lines.push('The page states two different values for the same field. Only the buyer knows which is right, so nothing was chosen automatically.');
    lines.push('');
    for (const c of conflicts) {
      const pairs = Object.keys(c).filter((k) => k !== 'field').map((k) => k + ' = ' + c[k]).join(' vs ');
      lines.push('- **' + c.field + '**: ' + pairs);
    }
    lines.push('');
  }

  if (context.notes && context.notes.length) {
    lines.push('## Also worth mentioning');
    lines.push('');
    for (const note of context.notes) lines.push('- ' + note);
    lines.push('');
  }

  return lines.join('\n');
}

export function buildManifest(input) {
  const { pageUrl, host, platform, product, node, files, warnings } = input;
  const missing = product.missing || [];
  return {
    generated_at: new Date().toISOString(),
    page_url: pageUrl,
    host,
    platform,
    complete: missing.length === 0 && (product.conflicts || []).length === 0,
    is_product_page: !!input.isProductPage,
    product_jsonld_needed: !input.sufficient && !!input.isProductPage,
    robots_change_needed: !!(input.robots && input.robots.needed),
    robots: input.robots ? {
      blocks_all: input.robots.blocksAll,
      blocked_by_name: input.robots.blockedByName,
      allowed_by_name: input.robots.allowedByName,
      covered_by_wildcard: input.robots.implicit.length,
    } : null,
    product: {
      name: product.fields.name || null,
      fields: product.fields,
      sources: product.sources,
      missing,
      conflicts: product.conflicts || [],
      existing_node: {
        present: product.existing.present,
        property_count: product.existing.propertyCount,
        required_present: product.existing.requiredPresent,
        sufficient: !!input.sufficient,
      },
    },
    product_jsonld: node || null,
    files,
    warnings: warnings || [],
  };
}

/* ------------------------------------------------------------------ *
 * Assembling the pack
 * ------------------------------------------------------------------ */

/**
 * True when the page's own Product node already carries everything the pack
 * would add.
 *
 * When it is true we generate nothing. Shipping a second Product node next to a
 * complete one is worse than shipping nothing, and taking $49 for a file the
 * buyer did not need is the kind of thing that ends a gig in one review.
 */
export function productNodeSufficient(product) {
  if (!product || !product.existing || !product.existing.present) return false;
  const allRequired = REQUIRED.every((f) => product.existing.requiredPresent.includes(f));
  return allRequired && !!product.hasIdentifier;
}

/**
 * Is this actually a product page?
 *
 * Without this check, running the tool on a homepage or a collection page
 * produces a `Product` node whose name is the page title and whose image is the
 * hero banner — a file that would put wrong data into a live site. Any of the
 * three signals is enough; the absence of all three means we say so instead of
 * guessing.
 */
export function looksLikeProductPage(pageUrl, html, product) {
  const page = String(html || '');
  if (/^product$/i.test(metaContent(page, 'og:type'))) return true;

  try {
    const { pathname } = new URL(pageUrl);
    if (/\/(products?|p|item|dp|goods|shop)\/[^/]+/i.test(pathname)) return true;
  } catch { /* fall through to the content signals */ }

  const fields = (product && product.fields) || {};
  return !!(fields.price && fields.name);
}

/** The site name, taken from the site — not from the product page's title. */
export function siteNameOf(html, host) {
  const page = String(html || '');
  const fromMeta = metaContent(page, 'og:site_name');
  if (fromMeta) return fromMeta;

  const nodes = extractJsonLd(page);
  const named = nodes.find((n) => {
    const t = typeList(n);
    return (t.includes('organization') || t.includes('website') || t.includes('onlinestore')) && n.name;
  });
  if (named) {
    const name = firstString(named.name);
    if (name) return name;
  }

  // Only now the title, and only its LAST segment: a product page's title reads
  // "Product Name | Site Name", so segment 0 is the product, not the site.
  const title = titleText(page);
  const parts = title.split(/[|\u2013\u2014]/).map((x) => x.trim()).filter(Boolean);
  if (parts.length > 1) return parts[parts.length - 1];
  if (parts.length === 1) return parts[0];
  return host;
}

export function buildPack(input) {
  const {
    pageUrl, host, html, siteHtml, robotsTxt, platform, sections, warnings,
  } = input;

  let origin;
  try { origin = new URL(pageUrl).origin; } catch { origin = 'https://' + host; }

  // llms.txt describes the SITE, so its name, summary and sections come from the
  // homepage. Taking them from the product page produced the product name as the
  // title of a site-level file, with that page's nav underneath.
  const site = siteHtml || html;

  const product = extractProduct(html, pageUrl);
  const sufficient = productNodeSufficient(product);
  const isProductPage = looksLikeProductPage(pageUrl, html, product);
  const node = (sufficient || !isProductPage) ? null : buildProductJsonLd(product, pageUrl);

  const siteName = siteNameOf(site, host);
  const summary = metaContent(site, 'og:description') || metaContent(site, 'description') || '';
  const secs = (sections && sections.length) ? sections : extractSections(site, origin);

  const files = {};

  if (node) files['product.jsonld'] = productJsonLdFile(node);

  // robots.txt is only shipped when something is actually blocked. Rewriting a
  // file that already allows these crawlers is a change with no benefit.
  const robots = analyzeRobotsForAi(robotsTxt || '');
  if (robots.needed) {
    const body = String(robotsTxt || '').replace(/\s+$/, '');
    files['robots.txt'] = body + '\n' + buildRobotsPatch(body, robots, origin);
  }

  files['llms.txt'] = buildLlmsDraft({
    origin,
    siteName,
    summary,
    sections: secs,
    productUrl: product.fields.url || pageUrl,
    productName: product.fields.name || '',
  });

  const allWarnings = warnings ? warnings.slice() : [];
  if (robots.blocksAll) {
    allWarnings.push('robots.txt closes the whole site to every crawler. It was left exactly as it is — adding Allow: / would override a deliberate choice.');
  } else if (!robots.needed) {
    allWarnings.push('robots.txt already allows AI crawlers (' + robots.allowedByName.length + ' named, ' + robots.implicit.length + ' covered by the wildcard). No file was shipped for it.');
  } else {
    allWarnings.push('robots.txt blocked ' + robots.blockedByName.length + ' AI crawler(s) by name; a patch was appended and the original text is unchanged above it.');
  }
  if (sufficient) {
    allWarnings.push('The page already carries a complete Product node. product.jsonld was NOT generated — the value of this pack here is robots.txt and llms.txt. Consider refunding the schema portion.');
  } else if (!isProductPage) {
    allWarnings.push('This URL does not look like a product page (no /products/ path, no og:type=product, no price). product.jsonld was NOT generated — re-run it against the product URL you want done.');
  } else if (!node) {
    allWarnings.push('No product name could be read, so product.jsonld was NOT generated. Ask the buyer for the name before shipping.');
  } else if (product.existing.present) {
    allWarnings.push('The page already carries a Product node. Do not paste ours next to it — replace the existing one (see INSTALL.md).');
  }
  for (const c of product.conflicts || []) {
    allWarnings.push('Sources disagree on ' + c.field + '; nothing was chosen automatically.');
  }

  files['INSTALL.md'] = buildInstall(platform, [{ ...(input.extra || {}), pageUrl }].filter(Boolean), robots);
  files['NEEDS-CONFIRMATION.md'] = buildNeedsConfirmation(product, { notes: allWarnings, sufficient });

  const manifest = buildManifest({
    pageUrl, host, platform, product, node,
    files: Object.keys(files).concat(['manifest.json']),
    warnings: allWarnings,
    sufficient,
    isProductPage,
    robots,
  });

  return { files, manifest, product, node, sufficient };
}

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

function normalizeHost(raw) {
  return String(raw || '').trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./i, '')
    .toLowerCase();
}

function localDate() {
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
}

async function main() {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith('--'));
  const outIdx = args.indexOf('--out');
  const outArg = outIdx >= 0 ? args[outIdx + 1] : '';

  if (!target) {
    console.error('Usage: node tools/build-pack.mjs <product-url> [--out <dir>]');
    process.exit(2);
  }

  const host = normalizeHost(target);
  const pageUrl = /^https?:\/\//i.test(target) ? target : 'https://' + host;

  let origin;
  try { origin = new URL(pageUrl).origin; } catch { origin = 'https://' + host; }

  const page = await fetchPageWithHeaders(pageUrl);
  if (!page || !page.body) {
    console.error('Could not fetch ' + pageUrl + ' — no pack produced. Without the page there is nothing honest to write.');
    process.exit(1);
  }

  // The homepage supplies the site-level facts: name, summary and sections.
  // A product page cannot describe the site it sits on.
  const home = await fetchPageWithHeaders(origin + '/').catch(() => null);
  const siteHtml = (home && home.body) || '';

  const robotsTxt = await fetchPageWithHeaders(origin + '/robots.txt')
    .then((r) => (r && r.body) || '')
    .catch(() => '');

  const html = page.body;
  const platform = detectPlatform(siteHtml || html);
  const sections = extractSections(siteHtml || html, origin);

  const warnings = [];
  const closesEverything = /User-agent:\s*\*/i.test(robotsTxt)
    && /^Disallow:\s*\/\s*$/im.test(robotsTxt);
  if (robotsTxt && closesEverything) {
    warnings.push('robots.txt closes the whole site to every crawler. The generated file is deliberately left unchanged — see its comments.');
  }
  if (!siteHtml) {
    warnings.push('The homepage could not be fetched, so the site name and summary came from the product page. Check llms.txt before shipping.');
  }

  const { files, manifest, sufficient } = buildPack({
    pageUrl, host, html, siteHtml, robotsTxt, platform, sections, warnings,
  });

  const outDir = outArg || path.join('out', 'packs', host + '-' + localDate());
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(outDir, name), content, 'utf8');
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  console.log('Pack written to ' + outDir);
  console.log('  platform      ' + platform);
  console.log('  product name  ' + (manifest.product.name || '(not found)'));
  console.log('  existing node ' + (manifest.product.existing_node.present
    ? 'yes, ' + manifest.product.existing_node.property_count + ' properties'
    : 'none'));
  const schemaWhy = manifest.product_jsonld_needed
    ? 'yes'
    : (manifest.product.existing_node.sufficient ? 'NO — the page already has a complete node' : 'NO — this is not a product page');
  console.log('  schema needed ' + schemaWhy);
  console.log('  complete      ' + (manifest.complete ? 'yes' : 'NO — see NEEDS-CONFIRMATION.md'));
  if (manifest.product.missing.length) {
    console.log('  missing       ' + manifest.product.missing.join(', '));
  }
  for (const w of manifest.warnings) console.log('  ! ' + w);
}

if (process.argv[1] && /build-pack\.mjs$/.test(process.argv[1])) {
  main();
}
