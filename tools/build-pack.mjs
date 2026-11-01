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
  // `"ratingValue": 4.6` is valid JSON-LD and common; requiring a string here
  // silently dropped every numeric rating on the web.
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
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
    // Protocol-relative URLs ("//cdn.shopify.com/…") are valid and common in
    // theme markup. Requiring http(s):// dropped every image on such a page,
    // which made a complete Product node look incomplete and shipped a
    // replacement with fewer images than the merchant already had.
    if (s && /^(?:https?:)?\/\//i.test(s) && !raw.includes(s)) raw.push(s);
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

/**
 * Read a price without guessing which convention wrote it.
 *
 * The first version of this function deleted every comma and kept the first
 * run of digits. On a European store that turns `19,99` into `1999.00` — a
 * hundredfold error written into a file the buyer pastes into production. A
 * price is the one field where a plausible guess is worse than a blank, so the
 * parser below accepts only strings that can be read exactly one way, and says
 * why it refused the rest.
 *
 * Returns `{ value, reason }`. `value` is '' whenever the string is not
 * unambiguous; `reason` is for the operator, never for the buyer.
 */
export function parsePrice(value) {
  const raw = decodeEntities(String(value == null ? '' : value)).trim();
  if (!raw) return { value: '', reason: 'empty' };

  const start = raw.search(/\d/);
  if (start < 0) return { value: '', reason: 'no digits' };

  // Everything before the first digit is a prefix ("$", "USD", "from"). A
  // minus sign or a second number means this is a range or a delta, not a price.
  const prefix = raw.slice(0, start);
  if (/[-\u2013\u2014]/.test(prefix)) return { value: '', reason: 'negative or range' };
  if (/[.,]$/.test(prefix)) return { value: '', reason: 'starts with a separator' };

  // A second digit group after the number ("19.99 - 24.99", "was 29.99 now
  // 19.99") cannot be told apart from the price itself, so it is refused. A
  // trailing currency is different: "19.99 USD" and "19.99€" are one number and
  // the format Google Merchant publishes.
  let body = raw.slice(start).replace(/\s+/g, ' ');
  body = body.replace(/\s*(?:[A-Za-z]{3}|[$€£¥₹₽₩₪₫₴₦₱])\s*$/, '');
  body = body.replace(/\s+/g, '');
  if (!/^[\d.,]+$/.test(body)) return { value: '', reason: 'more than one number' };
  if (/[.,]$/.test(body)) return { value: '', reason: 'ends with a separator' };

  const dots = (body.match(/\./g) || []).length;
  const commas = (body.match(/,/g) || []).length;
  const groupsOfThree = (s, sep) => new RegExp('^\\d{1,3}(' + sep + '\\d{3})+$').test(s);

  let intPart = body;
  let fracPart = '';

  if (dots && commas) {
    // Both separators present: whichever comes last is the decimal point. This
    // is the only case where the convention is unambiguous on its own.
    const decSep = body.lastIndexOf('.') > body.lastIndexOf(',') ? '.' : ',';
    const thousands = decSep === '.' ? ',' : '.';
    const at = body.lastIndexOf(decSep);
    intPart = body.slice(0, at);
    fracPart = body.slice(at + 1);
    if (!groupsOfThree(intPart, thousands)) return { value: '', reason: 'thousands grouping does not add up' };
    if (!/^\d+$/.test(fracPart)) return { value: '', reason: 'decimal part is not digits' };
    intPart = intPart.split(thousands).join('');
  } else if (dots || commas) {
    const sep = dots ? '.' : ',';
    if (dots + commas > 1) {
      // A separator cannot appear twice as a decimal point, so it is grouping.
      if (!groupsOfThree(body, sep)) return { value: '', reason: 'thousands grouping does not add up' };
      intPart = body.split(sep).join('');
    } else {
      const [head, tail] = body.split(sep);
      if (!/^\d+$/.test(head) || !/^\d+$/.test(tail)) return { value: '', reason: 'not a single number' };
      // "1,299" is 1299 in the US and 1.299 in the EU. The two readings differ
      // by a factor of a thousand, so neither is chosen — and the reason quotes
      // the input rather than a hardcoded example.
      if (tail.length === 3) {
        return { value: '', reason: 'ambiguous: three digits after the separator in "' + body + '", so it could be a thousands separator or a decimal point' };
      }
      if (tail.length > 2) return { value: '', reason: 'more than two decimal places' };
      intPart = head;
      fracPart = tail;
    }
  }

  if (!/^\d+$/.test(intPart)) return { value: '', reason: 'not a single number' };
  const n = Number(intPart + '.' + (fracPart || '0'));
  if (!Number.isFinite(n) || n < 0) return { value: '', reason: 'not a number' };
  // Beyond this, toFixed(2) switches to exponent notation and the "price" stops
  // being a price.
  if (n >= 1e15) return { value: '', reason: 'larger than any real price' };
  return { value: n.toFixed(2), reason: '' };
}

/** "1,299.00" -> "1299.00"; anything ambiguous or unparseable -> ''. */
export function normalizePrice(value) {
  return parsePrice(value).value;
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
  if (pageIsHttps && u.startsWith('//')) return 'https:' + u;
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
    let cp = NaN;
    if (/^#x[0-9a-f]+$/.test(key)) cp = parseInt(key.slice(2), 16);
    else if (/^#[0-9]+$/.test(key)) cp = parseInt(key.slice(1), 10);
    if (!Number.isFinite(cp)) return m;
    // A numeric reference can name a code point that does not exist, and
    // String.fromCodePoint throws on those — one malformed entity in a
    // merchant's title would have crashed the whole run. NUL is dropped
    // because it silently truncates a file for anything that reads it as C.
    if (cp <= 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return m;
    return String.fromCodePoint(cp);
  });
}

/* ------------------------------------------------------------------ *
 * WooCommerce's price, which lives only in the theme markup
 * ------------------------------------------------------------------ */

/**
 * The markup of the element that starts at `tagStart`, without its own tags.
 *
 * A regex cannot match a nested element (`<span><bdi><span>$</span>18.99</bdi></span>`),
 * so the closing tag is found by counting opens of the same element name. Other
 * tags are copied through untouched.
 */
function innerOf(html, tagStart) {
  const open = html.slice(tagStart).match(/^<([a-z][a-z0-9-]*)/i);
  if (!open) return '';
  const name = open[1].toLowerCase();
  const openEnd = html.indexOf('>', tagStart);
  if (openEnd < 0) return '';
  const opens = new RegExp('^<\\s*' + name + '\\b', 'i');
  const closes = new RegExp('^<\\s*/\\s*' + name + '\\b', 'i');

  let depth = 1;
  let i = openEnd + 1;
  let out = '';
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) break;
    out += html.slice(i, lt);
    const gt = html.indexOf('>', lt);
    if (gt < 0) break;
    const tag = html.slice(lt, gt + 1);
    if (closes.test(tag)) {
      depth -= 1;
      if (depth === 0) return out;
    } else if (opens.test(tag)) {
      depth += 1;
    }
    out += tag;
    i = gt + 1;
  }
  return out;
}

const WOO_AMOUNT = /<[a-z][a-z0-9-]*\b[^>]*class=["'][^"']*\bwoocommerce-Price-amount\b[^"']*["']/i;

/**
 * Positions of every `woocommerce-Price-amount` element, with the text it shows.
 *
 * `struck` records whether the element sits inside a `<del>`. WooCommerce marks
 * a sale by wrapping the old price in `<del>` and the current one in `<ins>`, so
 * the first amount on a discounted product is the price that is no longer
 * charged. Reading it would put a number on the page that the merchant has
 * explicitly crossed out.
 */
function wooAmounts(html) {
  const out = [];
  const re = new RegExp(WOO_AMOUNT.source, 'gi');
  let m;
  while ((m = re.exec(html)) !== null) {
    const tagStart = m.index;
    const struck = html.lastIndexOf('<del', tagStart) > html.lastIndexOf('</del>', tagStart);
    const tag = html.slice(tagStart, html.indexOf('>', tagStart) + 1);
    out.push({
      text: decodeEntities(innerOf(html, tagStart).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim(),
      tag,
      struck,
    });
  }
  return out;
}

/**
 * The single-product summary, which is where WooCommerce's own templates put
 * the price that belongs to this page.
 */
function summaryOf(html) {
  const m = html.match(/<[a-z][a-z0-9-]*\b[^>]*class=["'][^"']*\bsummary\b[^"']*["']/i);
  return m ? innerOf(html, m.index) : '';
}

/**
 * An ISO currency code stated outright, or ''.
 *
 * The symbol next to the number is deliberately never converted: `$` is USD,
 * CAD, AUD and a dozen others. A currency guessed from a symbol turns a correct
 * number into a wrong price.
 */
function explicitCurrency(html) {
  for (const re of [
    /"currency_code"\s*:\s*"([A-Za-z]{3})"/,
    /"currency"\s*:\s*"([A-Za-z]{3})"/,
    /data-currency=["']([A-Za-z]{3})["']/i,
  ]) {
    const m = html.match(re);
    const code = normalizeCurrency(m && m[1]);
    if (code) return code;
  }
  return '';
}

/**
 * WooCommerce's visible price, which it publishes nowhere else.
 *
 * WooCommerce emits no `itemprop` and no `og:price` for the price it renders;
 * the only stable handle is the `woocommerce-Price-amount` class. That class is
 * also a trap, because every card in the shop uses it: on nalgene.com the first
 * match in the document is a bottle in the mega-menu, and a shop's "related
 * products" strip is full of them. Publishing one of those numbers as this
 * product's price is worse than publishing none, so the search is scoped to
 * `.summary` — the container WooCommerce's own single-product template opens —
 * and only the first non-struck amount inside it is read.
 *
 * When a theme has no `.summary`, a price is accepted only if the whole page
 * shows exactly one value. Two different numbers on one page cannot be told
 * apart without knowing which card is this product, and guessing is the one
 * thing this file does not do.
 *
 * Returns the element's own text, unparsed: the caller runs it through
 * `parsePrice`, so an ambiguous format is refused with a reason instead of
 * silently dropped. `currency` is '' unless the page states a code.
 */
export function wooPrice(html) {
  const page = String(html || '');
  const summary = summaryOf(page);
  const amounts = wooAmounts(summary || page).filter((a) => !a.struck);
  const first = summary ? amounts[0] : (amounts.length === 1 ? amounts[0] : null);
  if (!first) return { text: '', currency: '' };

  const own = (first.tag.match(/data-currency=["']([A-Za-z]{3})["']/i) || [])[1];
  return { text: first.text, currency: normalizeCurrency(own) || explicitCurrency(page) };
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
  // An AggregateOffer has no `price` — it has lowPrice/highPrice. Reading only
  // `price` made a page that already publishes a correct range look like a page
  // with no price at all, and the pack then shipped a Product node with no
  // offers: strictly worse than what the buyer already had.
  //
  // schema.org also allows the number one level down, in a
  // UnitPriceSpecification (`offers.priceSpecification[].price`). Reading only
  // the two flat fields reported a page that does state its price as a page
  // that states none.
  const priceSpecOf = (o) => {
    if (!o || !o.priceSpecification) return null;
    const list = Array.isArray(o.priceSpecification) ? o.priceSpecification : [o.priceSpecification];
    return list.find((s) => s && s.price != null && s.price !== '') || null;
  };
  const priceFieldOf = (o) => {
    if (!o) return '';
    if (o.price != null && o.price !== '') return o.price;
    if (o.lowPrice != null && o.lowPrice !== '') return o.lowPrice;
    const spec = priceSpecOf(o);
    return spec ? spec.price : '';
  };
  // The currency can sit inside the same specification as the number. If the
  // two are read from different places, "is the price complete" and "what is the
  // price" disagree, and a complete node gets replaced with a worse one.
  const currencyFieldOf = (o) => {
    const own = normalizeCurrency(o && o.priceCurrency);
    if (own) return own;
    const spec = priceSpecOf(o);
    return normalizeCurrency(spec && spec.priceCurrency);
  };
  const offer = offers.find((o) => normalizePrice(priceFieldOf(o))) || offers[0] || null;

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
  //
  // A price that exists but cannot be read exactly one way is not the same as a
  // missing price: the first needs "which of these readings is right", the
  // second needs "what is the price". Keeping the reason lets us ask the right
  // question instead of claiming the page had no price on it.
  const unreadable = [];
  const readPrice = (rawValue, source) => {
    const p = parsePrice(rawValue);
    const shown = String(rawValue == null ? '' : rawValue).trim();
    if (!p.value && p.reason && p.reason !== 'empty' && shown) {
      unreadable.push({ field: 'price', raw: shown, reason: p.reason, source });
    }
    return p.value;
  };

  const jsonLdPrice = readPrice(priceFieldOf(offer), 'jsonld');
  const jsonLdCurrency = currencyFieldOf(offer);
  const jsonLdAvailability = normalizeAvailability(offer && offer.availability);

  const ogPriceRaw = metaContent(page, 'product:price:amount') || metaContent(page, 'og:price:amount');
  const ogPrice = readPrice(ogPriceRaw, 'og');
  const ogCurrency = normalizeCurrency(metaContent(page, 'product:price:currency') || metaContent(page, 'og:price:currency'));
  const ogAvailability = normalizeAvailability(metaContent(page, 'product:availability'));

  const microPrice = readPrice(itemprop(page, 'price'), 'microdata');
  const microCurrency = normalizeCurrency(itemprop(page, 'priceCurrency'));
  const microAvailability = normalizeAvailability(itemprop(page, 'availability'));

  // WooCommerce states its price in the theme markup only. The reader is gated
  // on the platform because the class it keys on is WooCommerce's own: on a
  // Webflow page a `.price`-shaped element is more often a related-product card
  // than this product's price, and that is the one number this tool must never
  // get wrong.
  const platform = detectPlatform(page);
  const woo = platform === 'woocommerce' ? wooPrice(page) : { text: '', currency: '' };
  const wooPriceValue = readPrice(woo.text, 'woocommerce');

  take('price', jsonLdPrice, 'jsonld');
  take('price', ogPrice, 'og');
  take('price', microPrice, 'microdata');
  take('price', wooPriceValue, 'woocommerce');

  take('priceCurrency', jsonLdCurrency, 'jsonld');
  take('priceCurrency', ogCurrency, 'og');
  take('priceCurrency', microCurrency, 'microdata');
  take('priceCurrency', woo.currency, 'woocommerce');

  take('availability', jsonLdAvailability, 'jsonld');
  take('availability', ogAvailability, 'og');
  take('availability', microAvailability, 'microdata');

  // A variant list carries one price per variant, and every one of them is real.
  // Taking the first silently publishes a price the merchant never chose for
  // this page, so the whole range is kept and emitted as an AggregateOffer.
  const variantPrices = [];
  for (const o of offers) {
    const v = normalizePrice(priceFieldOf(o));
    if (v && !variantPrices.includes(v)) variantPrices.push(v);
  }
  // A published AggregateOffer states the range itself; its own highPrice is
  // part of that statement and must not be dropped.
  const offerIsAggregate = typeList(offer).some((t) => t === 'aggregateoffer');
  const aggregateHigh = normalizePrice(offer && offer.highPrice);
  if (aggregateHigh && jsonLdPrice && aggregateHigh !== jsonLdPrice) {
    variantPrices.push(aggregateHigh);
  }
  if (variantPrices.length > 1) {
    const asNumbers = variantPrices.map(Number);
    const low = Math.min(...asNumbers).toFixed(2);
    const high = Math.max(...asNumbers).toFixed(2);
    fields.priceLow = low;
    fields.priceHigh = high;
    fields.offerCount = offers.filter((o) => normalizePrice(priceFieldOf(o))).length;
    sources.priceLow = 'jsonld';
    sources.priceHigh = 'jsonld';
  } else if (offerIsAggregate && jsonLdPrice) {
    // An AggregateOffer with only a lowPrice is a "from" price. Emitting it as
    // a plain Offer would assert that every variant costs exactly that.
    fields.priceLow = jsonLdPrice;
    fields.isAggregate = true;
    sources.priceLow = 'jsonld';
  }

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
  disagree('price', jsonLdPrice, wooPriceValue, 'jsonld', 'woocommerce');
  disagree('price', ogPrice, wooPriceValue, 'og', 'woocommerce');
  disagree('priceCurrency', jsonLdCurrency, ogCurrency, 'jsonld', 'og');
  disagree('priceCurrency', jsonLdCurrency, woo.currency, 'jsonld', 'woocommerce');
  disagree('availability', jsonLdAvailability, ogAvailability, 'jsonld', 'og');

  const hasIdentifier = IDENTIFIERS.some((f) => fields[f]);
  const missing = REQUIRED.filter((f) => !fields[f]);
  if (!hasIdentifier) missing.push('identifier');

  // The identifier that matters for "is the existing node already complete" is
  // the one inside that node. `fields.sku` can come from microdata elsewhere on
  // the page, and counting it made an incomplete node look finished.
  const nodeHasIdentifier = !!node && IDENTIFIERS.some((f) => {
    const v = node[f];
    return v != null && String(v).trim() !== '';
  });

  return {
    fields,
    sources,
    missing,
    conflicts,
    unreadable,
    hasIdentifier,
    existing: {
      node: node || null,
      present: !!node,
      propertyCount: node ? Object.keys(node).length : 0,
      hasIdentifier: nodeHasIdentifier,
      // Presence is not enough: `"price": "Call for price"` is a field that is
      // there and still cannot be read, and treating it as present withheld the
      // file the buyer paid for while claiming everything was in place.
      requiredPresent: REQUIRED.filter((f) => {
        if (f === 'image') return imagesOf(node && node.image).length > 0;
        if (f === 'name') return !!firstString(node && node.name);
        if (f === 'price') return !!normalizePrice(priceFieldOf(offer));
        if (f === 'priceCurrency') return !!currencyFieldOf(offer);
        if (f === 'availability') return !!normalizeAvailability(offer && offer.availability);
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

/** RFC 9309 path matching: `*` is any run of characters, `$` anchors the end. */
export function robotsRuleMatches(rule, targetPath) {
  const raw = String(rule || '');
  if (!raw) return false; // an empty Disallow matches nothing
  const anchored = raw.endsWith('$');
  const pattern = anchored ? raw.slice(0, -1) : raw;
  const body = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\s\\S]*');
  return new RegExp('^' + body + (anchored ? '$' : '')).test(targetPath);
}

/** The rule that decides one path: the longest match, and Allow wins a tie. */
function decidingRule(group, targetPath) {
  let best = null;
  for (const r of group.rules) {
    if (!robotsRuleMatches(r.path, targetPath)) continue;
    if (!best || r.path.length > best.path.length) best = r;
    else if (r.path.length === best.path.length && r.type === 'allow') best = r;
  }
  return best;
}

const groupBlocks = (group, targetPath) => {
  const r = decidingRule(group, targetPath);
  return !!r && r.type === 'disallow';
};

/**
 * What does this robots.txt actually do to AI crawlers?
 *
 * This is the difference between shipping a fix and shipping noise. Shopify's
 * default robots.txt already contains `User-agent: GPTBot / Allow: /` for the
 * four biggest crawlers, so for a normal Shopify store there is nothing to fix
 * — and rewriting the file anyway would be a change with no benefit and some
 * risk.
 *
 * The answer depends on the URL, not just the file: `Disallow: /products` blocks
 * every crawler on the page we are auditing while leaving the rest of the site
 * open. Reporting that as "already allows AI crawlers" was false, so the target
 * path is a parameter and the wildcard's verdict on it is its own field.
 */
export function analyzeRobotsForAi(text, targetPath) {
  const raw = String(text == null ? '' : text);
  const groups = parseRobots(raw);
  const path = String(targetPath || '') || '/';

  // An empty response is not the same as a permissive one. A 404 for
  // /robots.txt does mean "everything allowed", but a timeout or an empty 200
  // means we do not know — and the pack must not pretend otherwise.
  const readable = raw.trim().length > 0;

  // RFC 9309 merges every group that names a crawler, so the rules that apply
  // are the union, not the first group found. Judging groups one at a time made
  // `GPTBot: Disallow: /` + `GPTBot: Allow: /products` read as blocked on a page
  // the spec says is allowed.
  const merge = (list) => ({ rules: list.flatMap((g) => g.rules) });

  const star = groups.filter((g) => g.agents.includes('*'));
  const starRules = merge(star);
  // "Closes the whole site" is a statement about the URL we are auditing. A file
  // that says `Disallow: /` and then `Allow: /products` does not close this
  // product page, and telling the buyer it does would be wrong.
  const starClosesRoot = star.some(disallowsEverything);
  const wildcardBlocksPath = groupBlocks(starRules, path);
  const blocksAll = starClosesRoot && wildcardBlocksPath;

  const blockedByName = [];
  const allowedByName = [];
  const ownGrouped = new Set();
  for (const bot of AI_CRAWLERS) {
    const own = groups.filter((g) => g.agents.includes(bot.toLowerCase()));
    if (!own.length) continue;
    ownGrouped.add(bot);
    if (groupBlocks(merge(own), path)) blockedByName.push(bot);
    else allowedByName.push(bot);
  }

  const implicit = AI_CRAWLERS.filter((b) => !ownGrouped.has(b));
  // `needed` now means "the buyer has to change this file", not "we ship a
  // patch". There is no patch we can safely ship: see buildRobotsGuidance.
  const needed = blockedByName.length > 0 || (wildcardBlocksPath && !blocksAll);

  return {
    groups, readable, path, blocksAll, wildcardBlocksPath,
    blockedByName, allowedByName, implicit, needed,
  };
}

/**
 * What to delete, and why we are not deleting it for you.
 *
 * The previous version appended a group per blocked crawler:
 *
 *     User-agent: GPTBot
 *     Allow: /
 *     Disallow: /products
 *
 * and told the buyer it reversed their block. It did not. RFC 9309 merges every
 * group that names a crawler, and the longest matching rule wins, so
 * `Disallow: /products` (9 octets) still beat `Allow: /` (1 octet) on a product
 * page — the file was a no-op that the buyer had paid for. The only way to make
 * it work is to emit a longer `Allow:` than the owner's `Disallow:`, which is
 * exactly the thing this tool promised never to do: re-allow a bot the owner
 * blocked on purpose.
 *
 * So the fix is a deletion, the deletion is the owner's decision, and what the
 * pack delivers is the exact text to delete.
 */
export function buildRobotsGuidance(analysis) {
  const lines = [];

  if (!analysis.readable) {
    lines.push('No robots.txt could be read, so there is nothing to quote. If the file is absent, every crawler is allowed by default and there is nothing to do. If it exists but would not load, open it in a browser first.');
    return lines.join('\n');
  }

  // A group can name several agents ("User-agent: GPTBot" + "User-agent: CCBot"
  // in one block). Printing it once per bot shows the buyer two blocks that do
  // not exist in the file, and invites them to delete only one.
  const canonical = new Map(AI_CRAWLERS.map((b) => [b.toLowerCase(), b]));
  const showAgent = (a) => (a === '*' ? '*' : (canonical.get(a) || a));
  const renderGroup = (g) => {
    const out = [];
    for (const a of g.agents) out.push('User-agent: ' + showAgent(a));
    for (const r of g.rules) {
      if (!r.path) continue;
      out.push((r.type === 'allow' ? 'Allow: ' : 'Disallow: ') + r.path);
    }
    return out.join('\n');
  };

  if (analysis.blocksAll) {
    lines.push('Your robots.txt closes the whole site to every crawler:');
    lines.push('');
    lines.push('```');
    lines.push('User-agent: *');
    lines.push('Disallow: /');
    lines.push('```');
    lines.push('');
    lines.push('Every AI crawler is shut out, and so is everything else. That is either a staging-site file that went live, or a decision — I cannot tell which from here, and it is not mine to reverse.');
    return lines.join('\n');
  }

  if (analysis.wildcardBlocksPath) {
    // The rule is matched against path + query, because that is what RFC 9309
    // says to match, but the line we quote has to be the line that is actually
    // in the file. Quoting the audited URL instead invented a rule the merchant
    // could not find — `Disallow: /products/wool-runner` when the file says
    // `Disallow: /products`.
    const star = analysis.groups.filter((g) => g.agents.includes('*'));
    let rule = null;
    for (const g of star) {
      const r = decidingRule(g, analysis.path);
      if (r && (!rule || r.path.length > rule.path.length)) rule = r;
    }
    const rulePath = rule ? rule.path : '/';
    const shown = String(analysis.path || '/').split('?')[0];
    lines.push('Your wildcard group closes the page this pack is about — `' + shown + '` — to every crawler, so no AI crawler can read it at all. The rule that does it is this one:');
    lines.push('');
    lines.push('```');
    lines.push('User-agent: *');
    lines.push('Disallow: ' + rulePath);
    lines.push('```');
    lines.push('');
    lines.push('Deleting that one line reopens the page to everything, not only to AI crawlers, so it is your call rather than mine.');
    return lines.join('\n');
  }

  if (analysis.blockedByName.length) {
    lines.push('These crawlers are blocked by name, and the page this pack is about is inside the block: **' + analysis.blockedByName.join(', ') + '**.');
    lines.push('');
    lines.push('Delete these groups from your robots.txt:');
    lines.push('');
    const blocked = new Set(analysis.blockedByName.map((b) => b.toLowerCase()));
    const seen = new Set();
    const blocks = [];
    for (const g of analysis.groups) {
      if (seen.has(g)) continue;
      if (!g.agents.some((a) => blocked.has(a))) continue;
      seen.add(g);
      blocks.push(renderGroup(g));
    }
    lines.push('```');
    lines.push(blocks.join('\n\n'));
    lines.push('```');
    lines.push('');
    lines.push('I have not written a replacement file. Anything I could write would either repeat the block — no change, and you would have paid for nothing — or use a longer `Allow:` to override a rule you wrote, which is the one thing this pack promises never to do. Deleting the group restores whatever your wildcard group already says.');
    return lines.join('\n');
  }

  const named = analysis.allowedByName.length;
  lines.push('Nothing here blocks AI crawlers on this page. '
    + (named
      ? named + ' crawler' + (named === 1 ? ' is' : 's are') + ' named in your file and not blocked here, and the other '
      : 'No crawler is named in your file, and the ')
    + analysis.implicit.length + ' fall under a wildcard group that does not close this path. There is nothing to delete and nothing to paste.');
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
    const ranged = f.priceLow && f.priceHigh && f.priceLow !== f.priceHigh;
    if (ranged || f.isAggregate) {
      // A page selling several variants has several real prices. Publishing one
      // of them as "the" price is a statement the merchant never made; the
      // honest shape is the range Google documents for exactly this case. An
      // AggregateOffer with only a lowPrice is a "from" price and stays one.
      node.offers = {
        '@type': 'AggregateOffer',
        url: f.url || pageUrl,
        priceCurrency: f.priceCurrency,
        lowPrice: f.priceLow || f.price,
      };
      if (f.priceHigh) node.offers.highPrice = f.priceHigh;
      if (f.offerCount > 1) node.offers.offerCount = f.offerCount;
      if (f.availability) node.offers.availability = 'https://schema.org/' + f.availability;
    } else {
      node.offers = {
        '@type': 'Offer',
        url: f.url || pageUrl,
        price: f.price,
        priceCurrency: f.priceCurrency,
      };
      if (f.availability) node.offers.availability = 'https://schema.org/' + f.availability;
    }
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
    const text = decodeEntities(m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
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
  const { origin, siteName, summary, sections, productUrl, productName, sitemapUrl, hasRobots } = input;
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

  // Only links that were checked. The first version listed
  // `sitemap.xml — every page` on every site, including sites that publish no
  // sitemap, which turns a curated file into a broken one.
  lines.push('## Machine-readable');
  lines.push('');
  lines.push('- [llms.txt](' + origin + '/llms.txt) — this file');
  if (hasRobots) lines.push('- [robots.txt](' + origin + '/robots.txt) — crawler rules');
  if (sitemapUrl) lines.push('- [' + (sitemapUrl.split('/').pop() || 'sitemap.xml') + '](' + sitemapUrl + ') — page list');
  lines.push('');
  return lines.join('\n');
}

/* ------------------------------------------------------------------ *
 * Platform, install steps, and what to ask the merchant
 * ------------------------------------------------------------------ */

export function detectPlatform(html) {
  const page = String(html || '').toLowerCase();
  // A Webflow site can take payments through Shopify's checkout, so its markup
  // contains `*.myshopify.com` too. The theme — and therefore the place the
  // buyer edits the <head> — is Webflow. Detecting Shopify first sent that buyer
  // to `theme.liquid`, a file their site does not have. A store that really runs
  // on Shopify never emits `data-wf-page`.
  if (/webflow\.(io|com)|data-wf-page/.test(page)) return 'webflow';
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
      'Shopify serves `/robots.txt` from a template. The supported edit is Online Store → Preferences → Robots.txt — not a file you upload.',
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
      'The file is in your web root. If Yoast or Rank Math manages it, use the plugin\'s robots.txt editor — a direct file edit gets overwritten on the next save.',
    ],
  },
  wordpress: {
    label: 'WordPress',
    product: [
      'Paste immediately before `</head>` in your child theme\'s `header.php`, or through a code-snippets plugin.',
    ],
    llms: ['Upload this file to your web root as `/llms.txt`.'],
    robots: ['Edit `/robots.txt` in your web root, or use your SEO plugin\'s editor if it manages the file.'],
  },
  webflow: {
    label: 'Webflow',
    product: [
      'Project Settings → Custom Code → **Head Code**. Paste there; it applies to every page, so confirm the product data is right for the page you want it on.',
    ],
    llms: [
      'Webflow cannot serve a static text file from the root without a redirect rule. Easiest path: put this file on any static host and add a 200 rewrite at `/llms.txt`.',
    ],
    robots: ['Webflow generates `/robots.txt` from Site Settings → SEO. Edit it there — there is no file to upload.'],
  },
  custom: {
    label: 'custom build',
    product: ['Paste immediately before `</head>` on the product page, or render it server-side into the template.'],
    llms: ['Upload this file to the web root as `/llms.txt`.'],
    robots: ['Edit `/robots.txt` itself, or whatever generates it.'],
  },
};

/**
 * Fallback for a direct call with no analysis. Only reachable from tests:
 * `buildPack` always passes the real analysis. It says it could not read a file
 * rather than pretending one was read and was permissive.
 */
const EMPTY_ROBOTS = {
  readable: false, groups: [], path: '/', blocksAll: false,
  wildcardBlocksPath: false, blockedByName: [], allowedByName: [], implicit: [],
};

export function buildInstall(platform, extra, robots, pageUrl, files) {
  const p = INSTALL[platform] || INSTALL.custom;
  // `extra` is a list of sentences. An earlier call site passed an object into
  // it, and every INSTALL.md went out with `- [object Object]` in it. A single
  // string is a list of one, not a mistake to throw away.
  const notes = Array.isArray(extra)
    ? extra.filter((x) => typeof x === 'string' && x.trim())
    : (typeof extra === 'string' && extra.trim() ? [extra] : []);
  const targetUrl = String(pageUrl || '');
  const lines = ['# Install steps — ' + p.label, ''];
  const shipped = Array.isArray(files) ? files.filter((x) => typeof x === 'string') : [];
  const has = (name) => shipped.includes(name);
  const artifacts = shipped.filter((n) => n !== 'INSTALL.md');
  lines.push('The files for your site: ' + (artifacts.length ? artifacts.join(', ') : '(none — see below)')
    + '. This document, `NEEDS-CONFIRMATION.md` and `manifest.json` come with them.');
  lines.push('');
  lines.push('## 1. product.jsonld');
  lines.push('');
  if (has('product.jsonld')) {
    lines.push(...p.product);
  } else {
    // Instructions for a file that is not in the folder is how a pack sells
    // something it did not deliver. Say what is missing, and why, instead.
    lines.push('**There is no `product.jsonld` in this pack, on purpose.** This page already carries a Product node that covers what the file would have added, or the URL is not a product page. `NEEDS-CONFIRMATION.md` says which, and why a second node next to a complete one is worse than none. Nothing to paste here.');
  }
  lines.push('');
  lines.push('## 2. robots.txt — what to change, and why');
  lines.push('');
  lines.push(...buildRobotsGuidance(robots || EMPTY_ROBOTS).split(/\n/));
  lines.push('');
  lines.push(...p.robots);
  lines.push('');
  lines.push('## 3. llms.txt');
  lines.push('');
  lines.push(...p.llms);
  lines.push('');
  if (notes.length) {
    lines.push('## Specific to your site');
    lines.push('');
    for (const note of notes) lines.push('- ' + note);
    lines.push('');
  }
  lines.push('## Checking your work');
  lines.push('');
  lines.push('After you apply the changes, audit the page again at https://geoscore.help' + (targetUrl ? ' — use `' + targetUrl + '`' : '') + '. The two things to look for are `structuredData` (does it find the product) and `discoveryEndpoints` (does it find `/llms.txt`). Paste me the before and after and I will read them.');
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
    lines.push('What is left in this pack: the robots.txt diagnosis and `llms.txt`. Tell the buyer plainly.');
    lines.push('');
    return lines.join('\n');
  }

  if (!missing.length && !(product.conflicts || []).length && !(product.unreadable || []).length) {
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

  // A value that exists but cannot be read one way is a different question from
  // a value that is absent, and the buyer can only answer the right one if we
  // say which it is.
  const unreadable = (product && product.unreadable) || [];
  if (unreadable.length) {
    lines.push('## On the page, but not readable');
    lines.push('');
    lines.push('The page states these values in a form that can be read more than one way. I did not pick one:');
    lines.push('');
    for (const u of unreadable) {
      lines.push('- **' + u.field + '** — `' + u.raw + '` (from ' + u.source + '): ' + u.reason + '. Which number is right?');
    }
    lines.push('');
  }

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
      readable: input.robots.readable !== false,
      checked_path: input.robots.path || null,
      blocks_all: input.robots.blocksAll,
      wildcard_blocks_path: !!input.robots.wildcardBlocksPath,
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
      unreadable: product.unreadable || [],
      existing_node: {
        present: product.existing.present,
        property_count: product.existing.propertyCount,
        required_present: product.existing.requiredPresent,
        has_identifier: !!product.existing.hasIdentifier,
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
  return allRequired && !!product.existing.hasIdentifier;
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
    // `/shop/<anything>` was in this list and it matched `/shop/gift-cards` and
    // `/shop/new-arrivals` — collection pages, whose title and hero image would
    // have become a Product node.
    if (/\/(products?|item|dp|p)\/[^/]+/i.test(pathname)) return true;
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
    pageUrl: rawPageUrl, host, html, siteHtml, robotsTxt, platform, sections, warnings, sitemapUrl,
  } = input;

  // A bare host produced relative links in llms.txt ("[Wool Runner](shop.example)").
  const pageUrl = /^https?:\/\//i.test(String(rawPageUrl || '')) ? rawPageUrl : 'https://' + String(rawPageUrl || host || '').replace(/^\/+/, '');

  let origin;
  let pagePath;
  try {
    const u = new URL(pageUrl);
    origin = u.origin;
    pagePath = u.pathname + (u.search || '');
  } catch {
    origin = 'https://' + host;
    pagePath = '/';
  }

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

  // No robots.txt is ever shipped. Every patch shape we tried either repeated
  // the owner's block (a no-op we would have charged for) or overrode a rule
  // they wrote on purpose. What the pack delivers here is the diagnosis and the
  // exact text to delete — see buildRobotsGuidance.
  const robots = { ...analyzeRobotsForAi(robotsTxt || '', pagePath), origin };

  files['llms.txt'] = buildLlmsDraft({
    origin,
    siteName,
    summary,
    sections: secs,
    productUrl: product.fields.url || pageUrl,
    productName: product.fields.name || '',
    sitemapUrl,
    hasRobots: robots.readable,
  });

  const allWarnings = warnings ? warnings.slice() : [];
  if (robots.blocksAll) {
    allWarnings.push('robots.txt closes the whole site to every crawler, including this page. Nothing was changed: that is a deliberate choice and not mine to reverse. INSTALL.md quotes the rule to delete.');
  } else if (!robots.readable) {
    allWarnings.push('No robots.txt could be read at ' + origin + '/robots.txt, so I cannot say whether AI crawlers are allowed. If the file is absent, everything is allowed by default; if it exists but would not load, check it yourself.');
  } else if (robots.wildcardBlocksPath) {
    allWarnings.push('robots.txt closes ' + robots.path + ' to every crawler via the wildcard group, so no AI crawler can read this page. It was reported, not changed — reopening it would mean overriding a rule you wrote.');
  } else if (robots.blockedByName.length) {
    allWarnings.push('robots.txt blocks ' + robots.blockedByName.length + ' AI crawler(s) by name on this page: ' + robots.blockedByName.join(', ') + '. No replacement file was written — INSTALL.md quotes the groups to delete, and deleting them is the buyer\'s decision.');
  } else {
    allWarnings.push('robots.txt already allows AI crawlers on this page (' + robots.allowedByName.length + ' named, ' + robots.implicit.length + ' covered by the wildcard). Nothing to change there.');
  }
  if (sufficient) {
    allWarnings.push('The page already carries a complete Product node. product.jsonld was NOT generated — the value of this pack here is the robots.txt diagnosis and llms.txt. Consider refunding the schema portion.');
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
  for (const u of product.unreadable || []) {
    allWarnings.push('The page states ' + u.field + ' as `' + u.raw + '`, which can be read more than one way (' + u.reason + '). Nothing was chosen — ask the buyer.');
  }
  if (product.fields.priceLow && product.fields.priceHigh) {
    const n = product.fields.offerCount;
    allWarnings.push('This product has ' + n + ' priced variant' + (n === 1 ? '' : 's') + ', ' + product.fields.priceLow + '–' + product.fields.priceHigh + '. product.jsonld uses an AggregateOffer with that range rather than picking one.');
    // Google's merchant-listing documentation is explicit: "Product snippets
    // accept an Offer or AggregateOffer but merchant listings require an Offer."
    // An AggregateOffer is valid schema.org and earns a product snippet, but it
    // does not qualify for merchant listings — and a buyer who does not know
    // that will think the file is broken when nothing changes in Shopping.
    allWarnings.push('An AggregateOffer earns a product snippet but not a merchant listing — Google requires one Offer per variant URL for that. Tell the buyer this plainly, and offer per-variant Offers if they send the variant URLs.');
  } else if (product.fields.isAggregate) {
    allWarnings.push('The page publishes a price range without an upper bound, so product.jsonld keeps it as an AggregateOffer with only a lowPrice — not as a fixed price it never stated.');
    allWarnings.push('Same limit applies: an AggregateOffer does not qualify for merchant listings. Say so, do not let the buyer assume otherwise.');
  }

  // The buyer reads INSTALL.md, not the manifest. A limit that changes what the
  // file can achieve has to be in the document they open.
  const installNotes = (input.extra || []).slice();
  if (product.fields.priceLow) {
    installNotes.push('**What this file can and cannot do.** The product page sells more than one variant, so the markup carries an `AggregateOffer` with a price range. That is valid schema.org and earns a product snippet. It does **not** qualify for Google merchant listings: Google requires one `Offer` per variant URL. If you want that, send me the variant URLs and I will write them.');
  }

  files['INSTALL.md'] = buildInstall(platform, installNotes, robots, pageUrl, Object.keys(files));
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

/**
 * Find a sitemap that actually exists.
 *
 * llms.txt and robots.txt both point at one, and the previous version wrote
 * `Sitemap: <origin>/sitemap.xml` whether or not the site published one — a
 * broken link inside a paid file. Only a response that parses as a urlset or a
 * sitemapindex counts.
 */
async function probeSitemap(origin) {
  for (const candidate of ['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml']) {
    try {
      const r = await fetchPageWithHeaders(origin + candidate);
      const body = (r && r.body) || '';
      if (/<urlset[\s>]|<sitemapindex[\s>]/i.test(body)) return origin + candidate;
    } catch { /* try the next candidate */ }
  }
  return '';
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

  // `null` means the request came back 4xx or not at all; `''` means a real 200
  // with an empty body. The pack says which, instead of describing a file it
  // never read as permissive.
  const robotsTxt = await fetchPageWithHeaders(origin + '/robots.txt')
    .then((r) => (r && typeof r.body === 'string' ? r.body : ''))
    .catch(() => '');

  const sitemapUrl = await probeSitemap(origin);

  const html = page.body;
  const platform = detectPlatform(siteHtml || html);
  const sections = extractSections(siteHtml || html, origin);

  const warnings = [];
  if (!siteHtml) {
    warnings.push('The homepage could not be fetched, so the site name and summary came from the product page. Check llms.txt before shipping.');
  }
  if (!sitemapUrl) {
    warnings.push('No sitemap could be found at ' + origin + '/sitemap.xml, so llms.txt does not link one. If the site publishes a sitemap somewhere else, add the link before shipping.');
  }

  const { files, manifest, sufficient } = buildPack({
    pageUrl, host, html, siteHtml, robotsTxt, platform, sections, warnings, sitemapUrl,
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
  console.log('  robots.txt    ' + (manifest.robots.readable ? 'read' : 'COULD NOT READ')
    + (manifest.robots_change_needed ? ', buyer must change it' : ', no change needed'));
  console.log('  sitemap       ' + (sitemapUrl || 'none found'));
  console.log('  complete      ' + (manifest.complete ? 'yes' : 'NO — see NEEDS-CONFIRMATION.md'));
  if (manifest.product.missing.length) {
    console.log('  missing       ' + manifest.product.missing.join(', '));
  }
  for (const u of manifest.product.unreadable) {
    console.log('  ? ' + u.field + ' = "' + u.raw + '" — ' + u.reason);
  }
  for (const w of manifest.warnings) console.log('  ! ' + w);
}

if (process.argv[1] && /build-pack\.mjs$/.test(process.argv[1])) {
  main();
}
