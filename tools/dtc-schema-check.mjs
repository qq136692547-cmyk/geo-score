/**
 * Measure Product JSON-LD on real storefronts.
 *
 * WHY THIS EXISTS
 * The $49 Fix Pack is being re-weighted from llms.txt to Product schema, because
 * two things became clear on 2026-11-01:
 *   - Shopify now generates llms.txt for every store, and its Liquid override
 *     cannot read the catalogue, so "we rebuild your llms.txt from your catalog"
 *     was not deliverable as written.
 *   - structuredData is the largest single dimension in our own scorer (14 of 98
 *     points) and the 324-site study averages 1.7/14 on it.
 *
 * Re-weighting the sales page without measuring the new lead claim would repeat
 * the llms.txt mistake in the other direction, so this produces the evidence
 * first. Output goes to CSV and is committed, like data/dtc-llms-check.csv.
 *
 * It measures what is checkable: does a product page carry a Product (or
 * ProductGroup) node, and which of the properties a shopping surface needs are
 * actually present. It does NOT claim any of this improves AI citation — we have
 * no data for that and the page must not imply it.
 *
 * Usage:
 *   node tools/dtc-schema-check.mjs --in data/dtc-stores.txt --out data/dtc-schema-check.csv
 *                                [--concurrency 4] [--timeout 15000]
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const IN = opt('--in', 'data/dtc-stores.txt');
const OUT = opt('--out', 'data/dtc-schema-check.csv');
const CONCURRENCY = Number(opt('--concurrency', '4'));
const TIMEOUT = Number(opt('--timeout', '15000'));

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/**
 * Properties are split by how defensible it is to call them missing.
 *
 * REQUIRED mirrors what Google's Product structured-data guidelines need before
 * a product is eligible for a rich result, plus the offer fields a shopping
 * surface needs to quote a price. Calling these missing is a factual statement.
 *
 * RECOMMENDED are genuinely optional in schema.org — a store without a rating
 * is not broken, it just has no rating. Counting them as defects would inflate
 * the gap and any merchant who checks schema.org would catch it. They are
 * reported separately and never rolled into the headline.
 *
 * ProductGroup is accepted because Shopify emits it for multi-variant products.
 * On a ProductGroup the offers and the identifiers live on hasVariant[], not on
 * the group node, so both are resolved across variants — the first version of
 * this file looked only at the top node and wrongly reported casper.com as
 * missing its offer block, which is exactly the kind of error a customer would
 * find in ten seconds.
 */
const REQUIRED = ['name', 'image'];
const OFFER_PROPS = ['price', 'priceCurrency', 'availability'];
const IDENTITY = ['sku', 'gtin', 'gtin13', 'gtin8', 'mpn'];
const RECOMMENDED = ['brand', 'aggregateRating', 'review'];

const domains = fs
  .readFileSync(IN, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => l.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase());

async function get(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
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
  if (Array.isArray(node)) { for (const n of node) walk(n, visit); return; }
  if (typeof node !== 'object') return;
  visit(node);
  for (const v of Object.values(node)) walk(v, visit);
}

function typesOf(node) {
  const t = node['@type'];
  if (!t) return [];
  return (Array.isArray(t) ? t : [t]).map(String);
}

/**
 * Find the product node and report which properties it carries.
 * ProductGroup is accepted because Shopify emits it for multi-variant products
 * and shopping surfaces read it, but the variants inside it are what carry
 * offers, so offers are looked for on the node and one level down.
 */
function inspectProduct(html) {
  const blocks = ldBlocks(html);
  if (!blocks.length) return { found: false, reason: 'no-jsonld' };

  const products = [];
  for (const raw of blocks) {
    let json;
    try { json = JSON.parse(raw); } catch { continue; }
    walk(json, (node) => {
      const t = typesOf(node);
      if (t.includes('Product') || t.includes('ProductGroup')) products.push(node);
    });
  }
  if (!products.length) return { found: false, reason: 'jsonld-but-no-product' };

  // Report the richest node — a page can carry several.
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

  const offers = p.offers || (Array.isArray(p.hasVariant) ? p.hasVariant.map((v) => v && v.offers).find(Boolean) : null);
  const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];
  const offerHas = (k) => offerList.some((o) => o && o[k] !== undefined && o[k] !== null && String(o[k]).trim() !== '');

  // Identifiers can sit on the group node or on any variant.
  const variants = Array.isArray(p.hasVariant) ? p.hasVariant : [];
  const identityAnywhere = (k) =>
    has(k) || variants.some((v) => v && v[k] !== undefined && v[k] !== null && String(v[k]).trim() !== '');

  const missing = [];
  for (const k of REQUIRED) if (!has(k)) missing.push(k);
  if (!offerList.length) missing.push('offers');
  for (const k of OFFER_PROPS) if (!offerHas(k)) missing.push('offers.' + k);
  if (!IDENTITY.some(identityAnywhere)) missing.push('sku/gtin/mpn');

  // Reported separately, never part of `missing`, because these are optional.
  const optional = [];
  if (!has('brand')) optional.push('brand');
  if (!has('aggregateRating') && !has('review')) optional.push('rating');

  return {
    found: true,
    type: typesOf(p).join('+'),
    nodeCount: products.length,
    hasRequired: missing.length === 0,
    missing,
    missingCount: missing.length,
    optional,
  };
}

const esc = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const header = ['domain', 'product_url', 'has_product_node', 'node_type', 'missing_required', 'missing_count', 'complete', 'optional_absent', 'note'];
fs.writeFileSync(OUT, header.join(',') + '\n', 'utf8');

let cursor = 0;
let done = 0;
const t0 = Date.now();

async function one(domain) {
  const home = await get(`https://${domain}/`);
  if (home.status !== 200) return [domain, '', 0, '', '', '', 0, '', `home-http-${home.status || 'ERR'}`];

  // Shopify product URLs are /products/<handle>. Restricting to same-host links
  // keeps us from wandering onto a CDN or a marketing subdomain.
  //
  // Gift cards are excluded: they are the first /products/ link on several
  // storefronts, they legitimately carry no sku or availability, and auditing
  // one would both distort the numbers and read as sloppy to the merchant who
  // checks which page we looked at.
  const links = [...home.body.matchAll(/href\s*=\s*["']([^"']*\/products\/[^"'#?]+)/gi)]
    .map((m) => m[1])
    .filter((h) => !/^https?:\/\//i.test(h) || h.includes(domain))
    .filter((h) => !/gift[-_]?card|gift[-_]?certificate|\/giftcard/i.test(h));
  if (!links.length) return [domain, '', 0, '', '', '', 0, '', 'no-product-link-on-home'];

  const productUrl = new URL(links[0], `https://${domain}/`).href;
  const page = await get(productUrl);
  if (page.status !== 200) return [domain, productUrl, 0, '', '', '', 0, '', `product-http-${page.status || 'ERR'}`];

  const r = inspectProduct(page.body);
  if (!r.found) return [domain, productUrl, 0, '', '', '', 0, '', r.reason];

  return [
    domain,
    productUrl,
    1,
    r.type,
    r.missing.join(';'),
    r.missingCount,
    r.hasRequired ? 1 : 0,
    r.optional.join(';'),
    '',
  ].map(esc).join(',');
}

async function worker() {
  for (;;) {
    const i = cursor++;
    if (i >= domains.length) return;
    const line = await one(domains[i]);
    fs.appendFileSync(OUT, line + '\n');
    done++;
    if (done % 5 === 0 || done === domains.length) {
      console.error(`[${done}/${domains.length}] ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
}

console.error(`domains=${domains.length} concurrency=${CONCURRENCY} timeout=${TIMEOUT}ms -> ${OUT}`);
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.error(`done. out=${OUT}`);
