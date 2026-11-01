#!/usr/bin/env node
/**
 * ICP probe: does a real product page actually need the $49 Fix Pack?
 *
 * WHY THIS EXISTS
 * On 2026-11-01 we measured three real Shopify stores with tools/build-pack.mjs
 * and found the pack delivers almost nothing there: Shopify already emits a
 * complete Product node, already allows AI crawlers in robots.txt, and already
 * serves an llms.txt. So the $49 offer was aimed at the wrong buyer.
 *
 * We then moved the ICP to WooCommerce / Webflow / custom storefronts, on the
 * strength of a 12-page spot check. That spot check only ever existed in a
 * conversation. The project's own rule is that any sample size we state in
 * public must have a CSV and the script that produced it, so this file exists
 * to make that claim reproducible before anyone repeats it to a customer.
 *
 * WHAT IT MEASURES (and what it does not)
 * - Which platform the page is built on, from markup fingerprints, NOT from the
 *   label in the target list. The label is only a hypothesis; a target labelled
 *   woocommerce that fingerprints as Shopify must report shopify.
 * - Whether the page carries a Product / ProductGroup node, and which of the
 *   properties a shopping surface needs are missing.
 * - Whether a price could be read with exactly ONE unambiguous reading. See
 *   parsePriceStrict: an ambiguous figure is reported as such, never guessed.
 *
 * It does NOT claim any of this improves AI citation. We have no data for that
 * and no page copy may imply it.
 *
 * Usage:
 *   node tools/icp-probe.mjs [--out data/icp-probe.csv] [--only woocommerce]
 *                            [--concurrency 3] [--timeout 20000]
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const OUT = opt('--out', 'data/icp-probe.csv');
const ONLY = opt('--only', '');
const CONCURRENCY = Number(opt('--concurrency', '2'));
// 30s, not 20s: vercel.com/pricing takes ~7s from here and crosses 20s when
// three fetches share the connection, which showed up as a fake "fetch-failed".
const TIMEOUT = Number(opt('--timeout', '30000'));

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/**
 * group is the hypothesis we are testing, not an input to the result.
 * Every row reports the platform we actually fingerprinted, so a target whose
 * group and platform disagree is visible rather than silently averaged in.
 */
const TARGETS = [
  // WooCommerce: core emits a Product node but no `brand`; Yoast free emits none at all.
  { group: 'woocommerce', url: 'https://www.brodo.com/product/organic-chicken-bone-broth/' },
  { group: 'woocommerce', url: 'https://www.jimmynelson.com/product/premium-card-box-before-they-pass-away-jimmy-nelson/' },
  { group: 'woocommerce', url: 'https://nalgene.com/product/22oz-fitness-draft/' },
  // Webflow: no Product node at all on the sampled pages.
  { group: 'webflow', url: 'https://www.bondandgrace.com/products/a-distant-hope' },
  { group: 'webflow', url: 'https://clicks.tech/products/clicks-keyboard-for-iphone-16' },
  { group: 'webflow', url: 'https://www.ziprunning.com/product/commutepack' },
  // Custom / enterprise storefronts.
  { group: 'custom', url: 'https://www.apple.com/shop/buy-iphone/iphone-16' },
  { group: 'custom', url: 'https://www.ikea.com/us/en/p/billy-bookcase-white-00263850/' },
  { group: 'custom', url: 'https://www.sonos.com/en-us/shop/era-100' },
  // Shopify: the control group. These are the stores the pack does NOT fit.
  { group: 'shopify', url: 'https://greatjonesgoods.com/products/the-dutchess' },
  { group: 'shopify', url: 'https://allbirds.com/products/mens-tree-runner-nz-medium-grey' },
  { group: 'shopify', url: 'https://ripplefoods.com/products/ripple-chocolate-plant-based-protein-shake-12-pack' },
  // B2B SaaS: pricing pages, not product pages. Included to prove we refuse them.
  { group: 'saas', url: 'https://postmarkapp.com/pricing' },
  { group: 'saas', url: 'https://stripe.com/pricing' },
  { group: 'saas', url: 'https://vercel.com/pricing' },
].filter((t) => !ONLY || t.group === ONLY);

async function get(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    return { status: res.status, body: await res.text(), url: res.url };
  } catch (e) {
    return { status: 0, body: '', url, error: (e && e.message) || String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read the platform from markup fingerprints.
 *
 * Order matters. A Shopify store routinely carries WordPress-looking analytics
 * snippets and a WooCommerce store routinely carries webflow.com links in its
 * footer credits, so the most specific fingerprint has to win. Shopify's CDN
 * host and Shopify.theme global are the hardest to have by accident.
 */
export function detectPlatform(html) {
  const h = String(html).toLowerCase();
  // Webflow stamps data-wf-page / data-wf-site on <html>, which no other
  // platform emits. This is checked BEFORE Shopify because a headless Webflow
  // storefront legitimately links out to a myshopify.com backend (clicks.tech
  // does exactly this) and would otherwise be classified as Shopify — which
  // would invert the conclusion this whole probe exists to support.
  if (/data-wf-page|data-wf-site/.test(h)) {
    return 'webflow';
  }
  if (/cdn\.shopify\.com|shopify\.theme|\/cdn\/shop\/|shopify-section/.test(h)) {
    return 'shopify';
  }
  if (/woocommerce|wc-block|wp-content\/plugins|wp-json\/|class="[^"]*\bwc-/.test(h)) {
    return 'woocommerce';
  }
  return 'custom';
}

/** Pull every application/ld+json block out of an HTML document. */
function ldBlocks(html) {
  const out = [];
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

/** Depth-first walk over whatever shape the JSON-LD takes. */
function walk(node, visit) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const n of node) walk(n, visit);
    return;
  }
  if (typeof node !== 'object') return;
  visit(node);
  for (const v of Object.values(node)) walk(v, visit);
}

function typesOf(node) {
  const t = node['@type'];
  if (!t) return [];
  return (Array.isArray(t) ? t : [t]).map(String);
}

const REQUIRED = ['name', 'image'];
const OFFER_PROPS = ['price', 'priceCurrency', 'availability'];
const IDENTITY = ['sku', 'gtin', 'gtin13', 'gtin8', 'mpn'];

function inspectProduct(html) {
  const blocks = ldBlocks(html);
  if (!blocks.length) return { found: false, reason: 'no-jsonld' };

  const products = [];
  for (const raw of blocks) {
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      continue;
    }
    walk(json, (node) => {
      const t = typesOf(node);
      if (t.includes('Product') || t.includes('ProductGroup')) products.push(node);
    });
  }
  if (!products.length) return { found: false, reason: 'jsonld-but-no-product' };

  const score = (p) => Object.keys(p).length;
  products.sort((a, b) => score(b) - score(a));
  const p = products[0];

  const has = (k) => {
    const v = p[k];
    if (v === undefined || v === null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'string') return v.trim().length > 0;
    return true;
  };

  const offers =
    p.offers ||
    (Array.isArray(p.hasVariant) ? p.hasVariant.map((v) => v && v.offers).find(Boolean) : null);
  const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];
  const offerHas = (k) =>
    offerList.some((o) => o && o[k] !== undefined && o[k] !== null && String(o[k]).trim() !== '');

  const variants = Array.isArray(p.hasVariant) ? p.hasVariant : [];
  const identityAnywhere = (k) =>
    has(k) ||
    variants.some((v) => v && v[k] !== undefined && v[k] !== null && String(v[k]).trim() !== '');

  const missing = [];
  for (const k of REQUIRED) if (!has(k)) missing.push(k);
  if (!offerList.length) missing.push('offers');
  for (const k of OFFER_PROPS) if (!offerHas(k)) missing.push('offers.' + k);
  if (!IDENTITY.some(identityAnywhere)) missing.push('sku/gtin/mpn');

  // brand is optional in schema.org, so it never counts as "broken". It is
  // reported separately because it is the one gap WooCommerce core leaves
  // behind and the one our pack can therefore still sell against.
  const rawPrice = offerList.map((o) => (o ? o.price : undefined)).find((v) => v !== undefined);
  const rawCurrency = offerList
    .map((o) => (o ? o.priceCurrency : undefined))
    .find((v) => v !== undefined);

  return {
    found: true,
    type: typesOf(p).join('+'),
    nodeCount: products.length,
    missing,
    hasBrand: has('brand'),
    rawPrice,
    rawCurrency,
    // IKEA uses priceSpecification[].price, which is valid and is read here.
    specPrice: (() => {
      for (const o of offerList) {
        const spec = o && o.priceSpecification;
        const list = Array.isArray(spec) ? spec : spec ? [spec] : [];
        for (const s of list) if (s && s.price !== undefined) return s.price;
      }
      return undefined;
    })(),
  };
}

/**
 * Parse a price only when there is exactly one way to read it.
 *
 * "1,299.00" -> 1299      (comma is thousands, dot is decimal)
 * "1.299,00" -> 1299      (dot is thousands, comma is decimal)
 * "19,99"    -> 19.99     (comma is decimal, two digits follow)
 * "1,299"    -> null      (ambiguous: 1299 or 1.299 — refuse)
 * "1.299"    -> 1299      (three digits after a dot is a thousands group)
 *
 * Refusing is the point. A wrong price written into a file the customer pastes
 * live is worse than an empty field, so an ambiguous figure is never guessed.
 */
export function parsePriceStrict(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : null;
  if (typeof raw !== 'string') return null;

  // Strip ONE currency marker at an edge, then demand that what is left is a
  // single amount. Salvaging by deleting every non-digit is what turned "10-20"
  // into 1020 and "-5" into 5 in the first draft of this file: a range and a
  // negative both survived as if they were prices. Refusing is cheaper than
  // explaining to a merchant why their pack says the wrong number.
  const stripped = raw
    .trim()
    .replace(/^(?:US\$|USD|EUR|GBP|JPY|CNY|RMB|[€£¥$])\s*/i, '')
    .replace(/\s*(?:USD|EUR|GBP|JPY|CNY|RMB|[€£¥])$/i, '')
    .trim();
  if (!/^[\d.,]+$/.test(stripped)) return null;

  const s = stripped;
  if (!s) return null;

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');

  if (hasDot && hasComma) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastDot > lastComma) {
      const cleaned = s.replace(/,/g, '');
      return /^\d+\.\d{1,2}$/.test(cleaned) ? Number(cleaned) : null;
    }
    const cleaned = s.replace(/\./g, '').replace(',', '.');
    return /^\d+\.\d{1,2}$/.test(cleaned) ? Number(cleaned) : null;
  }

  if (hasDot) {
    if (/^\d+\.\d{1,2}$/.test(s)) return Number(s);
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
    return null;
  }

  if (hasComma) {
    const m = /^\d+,(\d+)$/.exec(s);
    if (!m) return null;
    if (m[1].length === 2) return Number(s.replace(',', '.'));
    return null;
  }

  return /^\d+$/.test(s) ? Number(s) : null;
}

/**
 * Collect every distinct currency-looking figure in the visible text.
 *
 * Returned as a set because more than one distinct value means we cannot tell
 * which belongs to this product — a struck-through was a real page we tested,
 * a size-based price range, and an unrelated item in a "you may also like"
 * block all look exactly the same from here.
 */
function textPrices(html) {
  const body = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const re = /(?:US\$|USD|\$|€|EUR|£|GBP|¥|JPY)\s?(\d[\d.,]*)/gi;
  const out = new Set();
  let m;
  while ((m = re.exec(body)) !== null) {
    const v = parsePriceStrict(m[1]);
    if (v !== null && v > 0 && v < 100000) out.add(v);
  }
  return [...out];
}

/** A pricing page is not a product page. Refuse it rather than mislabel it. */
export function pageKind(url, hasProduct) {
  if (/\/pricing\b|\/plans\b|\/price\b/i.test(url)) return 'pricing';
  if (hasProduct) return 'product';
  if (/\/(product|products|p|item|dp|shop\/buy)\//i.test(url)) return 'product';
  return 'unknown';
}

const esc = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const header = [
  'group',
  'url',
  'platform',
  'platform_matches_group',
  'page_kind',
  'has_product_node',
  'node_type',
  'missing_required',
  'has_brand',
  'price_source',
  'price_value',
  'price_currency',
  'verdict',
  'note',
];

export function inspectPage({ group, url }, html, httpStatus) {
  const platform = detectPlatform(html);
  const product = inspectProduct(html);

  const kind = pageKind(url, product.found);
  const row = {
    group,
    url,
    platform,
    platform_matches_group: platform === group ? 1 : 0,
    page_kind: kind,
    has_product_node: product.found ? 1 : 0,
    node_type: product.found ? product.type : '',
    missing_required: product.found ? product.missing.join(';') : '',
    has_brand: product.found ? (product.hasBrand ? 1 : 0) : '',
    price_source: '',
    price_value: '',
    price_currency: '',
    verdict: '',
    note: '',
  };

  if (kind === 'pricing') {
    row.verdict = 'not-applicable';
    row.note = 'pricing page, not a product page';
    return row;
  }

  // A non-200 body is a block page or an error page, not evidence about the
  // merchant's schema. nalgene.com answers curl with 200 and Node with 403; the
  // first draft of this file analysed the 403 body and reported
  // "needs-product-schema", which is a claim about a page we never saw.
  if (httpStatus && httpStatus !== 200) {
    row.verdict = 'fetch-blocked';
    row.note = `http-${httpStatus}`;
    return row;
  }

  if (!product.found) {
    row.verdict = 'needs-product-schema';
    row.note = product.reason;
    // Fall through to price extraction: a page with no node can still show a price.
  } else if (product.missing.length) {
    row.verdict = 'incomplete-schema';
  } else if (!product.hasBrand) {
    row.verdict = 'needs-brand';
  } else {
    row.verdict = 'no-gap';
  }

  // --- price -------------------------------------------------------------
  const jsonldPrice = product.found ? parsePriceStrict(product.rawPrice ?? product.specPrice) : null;
  const jsonldCurrency = product.found ? product.rawCurrency : undefined;

  if (jsonldPrice !== null && jsonldCurrency) {
    row.price_source = 'jsonld';
    row.price_value = jsonldPrice;
    row.price_currency = String(jsonldCurrency);
  } else if (jsonldPrice !== null) {
    row.price_source = 'jsonld-no-currency';
    row.price_value = jsonldPrice;
  } else {
    const distinct = textPrices(html);
    if (distinct.length === 1) {
      // One distinct figure on the whole page. Currency still comes from the
      // glyph, not from an ISO code, so this is recorded as a weaker source.
      row.price_source = 'text-single-symbol';
      row.price_value = distinct[0];
    } else if (distinct.length > 1) {
      row.price_source = 'ambiguous';
      row.note = [row.note, `${distinct.length} distinct figures`].filter(Boolean).join('; ');
    } else {
      row.price_source = 'none';
    }
  }

  return row;
}

async function main() {
  fs.writeFileSync(OUT, header.join(',') + '\n', 'utf8');

  let cursor = 0;
  let done = 0;
  const t0 = Date.now();
  const rows = [];

  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= TARGETS.length) return;
      const target = TARGETS[i];
      const res = await get(target.url);
      let row;
      if (!res.body) {
        row = {
          group: target.group,
          url: target.url,
          platform: '',
          platform_matches_group: '',
          page_kind: '',
          has_product_node: '',
          node_type: '',
          missing_required: '',
          has_brand: '',
          price_source: '',
          price_value: '',
          price_currency: '',
          verdict: 'fetch-failed',
          note: res.error || `http-${res.status}`,
        };
      } else {
        row = inspectPage(target, res.body, res.status);
      }
      rows.push(row);
      fs.appendFileSync(OUT, header.map((h) => esc(row[h])).join(',') + '\n');
      done++;
      console.error(`[${done}/${TARGETS.length}] ${target.group} ${target.platform || row.platform || '?'} -> ${row.verdict}`);
    }
  }

  console.error(`targets=${TARGETS.length} concurrency=${CONCURRENCY} -> ${OUT}`);
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.error(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s. out=${OUT}`);
}

// Only run when invoked directly, so tests can import the helpers.
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('icp-probe.mjs')) {
  await main();
}
