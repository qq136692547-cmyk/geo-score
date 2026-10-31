/**
 * tools/build-pack.mjs — the $49 deliverable.
 *
 * The failure this file guards against is not a crash. It is shipping a pack
 * with a price the merchant never set, or a Product node with a name we made up,
 * or a robots.txt that re-allows a bot the owner blocked on purpose. Every test
 * below is about what the tool refuses to write, not about what it writes.
 */
import { describe, it, expect } from 'vitest';
import {
  extractProduct,
  buildProductJsonLd,
  productJsonLdFile,
  offersOf,
  firstString,
  normalizePrice,
  normalizeCurrency,
  normalizeAvailability,
  extractSections,
  buildLlmsDraft,
  detectPlatform,
  buildInstall,
  buildNeedsConfirmation,
  buildManifest,
  buildPack,
  isProductNode,
  productNodeSufficient,
  siteNameOf,
  looksLikeProductPage,
  decodeEntities,
  normalizeUrl,
  analyzeRobotsForAi,
  buildRobotsPatch,
  parseRobots,
  AI_CRAWLERS,
  REQUIRED,
  IDENTIFIERS,
} from '../../tools/build-pack.mjs';

const URL = 'https://shop.example/products/wool-runner';

/** A complete Shopify-style ProductGroup, offers inside hasVariant. */
const SHOPIFY_HTML = `<!doctype html><html><head>
<title>Wool Runner | Example</title>
<meta property="og:title" content="Wool Runner">
<meta property="og:description" content="Merino wool sneaker, machine washable.">
<meta property="og:image" content="https://cdn.shopify.com/wool-runner.jpg">
<meta property="og:url" content="${URL}">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ProductGroup",
  "name": "Wool Runner",
  "image": ["https://cdn.shopify.com/wool-runner.jpg"],
  "brand": { "@type": "Brand", "name": "Example" },
  "hasVariant": [
    { "@type": "Product", "name": "Wool Runner 42",
      "offers": { "@type": "Offer", "price": "98.00", "priceCurrency": "USD", "availability": "https://schema.org/InStock" } }
  ]
}
</script></head><body>
<h1>Wool Runner</h1>
<a href="/collections/shoes">Shoes</a>
<a href="/cart">Cart</a>
<a href="/pages/about">About us</a>
</body></html>`;

/** No structured data at all — the case the pack exists for. */
const BARE_HTML = `<!doctype html><html><head>
<title>Trail Mug | Camp</title>
<meta property="og:title" content="Trail Mug">
<meta property="og:image" content="https://camp.example/mug.jpg">
</head><body><h1>Trail Mug</h1></body></html>`;

/** JSON-LD and Open Graph disagree about the price. */
const CONFLICT_HTML = `<!doctype html><html><head>
<meta property="og:title" content="Trail Mug">
<meta property="og:image" content="https://camp.example/mug.jpg">
<meta property="product:price:amount" content="24.00">
<meta property="product:price:currency" content="USD">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"Trail Mug","image":"https://camp.example/mug.jpg",
 "offers":{"@type":"Offer","price":"19.00","priceCurrency":"USD","availability":"https://schema.org/InStock"}}
</script></head><body></body></html>`;

describe('reading a price is not the same as inventing one', () => {
  it('normalizes the formats stores actually publish', () => {
    expect(normalizePrice('98')).toBe('98.00');
    expect(normalizePrice('1,299.00')).toBe('1299.00');
    expect(normalizePrice('$49.5')).toBe('49.50');
    expect(normalizePrice('  ')).toBe('');
    expect(normalizePrice('from')).toBe('');
    expect(normalizePrice(null)).toBe('');
  });

  it('accepts only a real three-letter currency', () => {
    expect(normalizeCurrency('usd')).toBe('USD');
    expect(normalizeCurrency('EUR')).toBe('EUR');
    expect(normalizeCurrency('$')).toBe('');
    expect(normalizeCurrency('dollars')).toBe('');
  });

  it('maps availability to the schema.org term, and drops anything it does not know', () => {
    expect(normalizeAvailability('https://schema.org/InStock')).toBe('InStock');
    expect(normalizeAvailability('in_stock')).toBe('InStock');
    expect(normalizeAvailability('OutOfStock')).toBe('OutOfStock');
    expect(normalizeAvailability('call us')).toBe('');
  });
});

describe('offersOf — Shopify puts the offer inside hasVariant', () => {
  it('finds an offer nested in a variant list', () => {
    const node = {
      '@type': 'ProductGroup',
      hasVariant: [
        { '@type': 'Product', offers: { '@type': 'Offer', price: '98.00' } },
      ],
    };
    expect(offersOf(node)).toHaveLength(1);
    expect(offersOf(node)[0].price).toBe('98.00');
  });

  it('finds offers given as an array, and survives a cycle-free deep tree', () => {
    const node = {
      '@type': 'Product',
      offers: [
        { '@type': 'Offer', price: '10.00' },
        { '@type': 'Offer', price: '12.00' },
      ],
    };
    expect(offersOf(node)).toHaveLength(2);
  });

  it('returns nothing for a node with no offers', () => {
    expect(offersOf({ '@type': 'Product', name: 'x' })).toEqual([]);
  });
});

describe('extractProduct', () => {
  it('reads the fields a complete page already carries', () => {
    const p = extractProduct(SHOPIFY_HTML, URL);
    expect(p.fields.name).toBe('Wool Runner');
    expect(p.fields.price).toBe('98.00');
    expect(p.fields.priceCurrency).toBe('USD');
    expect(p.fields.availability).toBe('InStock');
    expect(p.fields.image[0]).toContain('wool-runner.jpg');
    expect(p.sources.price).toBe('jsonld');
  });

  it('reports an identifier as missing when none of sku/gtin/mpn exists', () => {
    const p = extractProduct(SHOPIFY_HTML, URL);
    expect(p.hasIdentifier).toBe(false);
    expect(p.missing).toContain('identifier');
  });

  it('falls back to Open Graph when there is no structured data', () => {
    const p = extractProduct(BARE_HTML, URL);
    expect(p.fields.name).toBe('Trail Mug');
    expect(p.sources.name).toBe('og');
    // No price anywhere: it must be reported missing, never filled in.
    expect(p.fields.price).toBeUndefined();
    expect(p.missing).toContain('price');
    expect(p.missing).toContain('priceCurrency');
    expect(p.missing).toContain('availability');
  });

  it('records a disagreement instead of quietly picking one', () => {
    const p = extractProduct(CONFLICT_HTML, URL);
    expect(p.fields.price).toBe('19.00');
    const c = p.conflicts.find((x) => x.field === 'price');
    expect(c).toBeTruthy();
    expect(c.jsonld).toBe('19.00');
    expect(c.og).toBe('24.00');
  });

  it('describes what the page already had, so the operator can compare', () => {
    const p = extractProduct(SHOPIFY_HTML, URL);
    expect(p.existing.present).toBe(true);
    expect(p.existing.requiredPresent).toEqual(['name', 'image', 'price', 'priceCurrency', 'availability']);

    const bare = extractProduct(BARE_HTML, URL);
    expect(bare.existing.present).toBe(false);
    expect(bare.existing.propertyCount).toBe(0);
  });

  it('survives empty and malformed input', () => {
    expect(extractProduct('', URL).missing).toEqual(REQUIRED.concat('identifier'));
    expect(extractProduct('<script type="application/ld+json">{oops</script>', URL).existing.present).toBe(false);
  });

  it('does not treat a breadcrumb or an Organization as the product', () => {
    const html = `<script type="application/ld+json">
      {"@type":"BreadcrumbList","itemListElement":[]}
    </script>
    <script type="application/ld+json">
      {"@type":"Organization","name":"Example"}
    </script>`;
    expect(extractProduct(html, URL).existing.present).toBe(false);
  });
});

describe('buildProductJsonLd — only what was found', () => {
  it('refuses to build a node with no name', () => {
    expect(buildProductJsonLd({ fields: {} }, URL)).toBeNull();
    expect(buildProductJsonLd(null, URL)).toBeNull();
  });

  it('never emits half an offer', () => {
    const node = buildProductJsonLd({ fields: { name: 'Mug', price: '19.00' } }, URL);
    expect(node.name).toBe('Mug');
    expect(node.offers).toBeUndefined();

    const noCurrency = buildProductJsonLd({ fields: { name: 'Mug', priceCurrency: 'USD' } }, URL);
    expect(noCurrency.offers).toBeUndefined();
  });

  it('emits an offer only when both halves exist, with a canonical availability URL', () => {
    const node = buildProductJsonLd({
      fields: { name: 'Mug', price: '19.00', priceCurrency: 'USD', availability: 'InStock' },
    }, URL);
    expect(node.offers).toEqual({
      '@type': 'Offer', url: URL, price: '19.00', priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    });
  });

  it('invents no identifier, brand or rating', () => {
    const node = buildProductJsonLd({ fields: { name: 'Mug' } }, URL);
    expect(node.sku).toBeUndefined();
    expect(node.gtin13).toBeUndefined();
    expect(node.brand).toBeUndefined();
    expect(node.aggregateRating).toBeUndefined();
  });

  it('keeps a rating only when both halves came off the page', () => {
    const half = buildProductJsonLd({ fields: { name: 'Mug', ratingValue: 4.6 } }, URL);
    expect(half.aggregateRating).toBeUndefined();
    const full = buildProductJsonLd({ fields: { name: 'Mug', ratingValue: 4.6, reviewCount: 210 } }, URL);
    expect(full.aggregateRating.reviewCount).toBe(210);
  });

  it('wraps the node in a paste-ready script tag with valid JSON', () => {
    const node = buildProductJsonLd({ fields: { name: 'Mug "quoted"' } }, URL);
    const file = productJsonLdFile(node);
    expect(file.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(file.trim().endsWith('</script>')).toBe(true);
    const body = file.trim().replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    expect(JSON.parse(body).name).toBe('Mug "quoted"');
  });
});

describe('extractSections', () => {
  it('keeps real sections and drops cart, account and asset links', () => {
    const s = extractSections(SHOPIFY_HTML, 'https://shop.example');
    const paths = s.map((x) => x.url.replace('https://shop.example', ''));
    expect(paths).toContain('/collections/shoes');
    expect(paths).toContain('/pages/about');
    expect(paths).not.toContain('/cart');
  });

  it('drops links off the site, and deep paths that are not sections', () => {
    const html = `<a href="https://other.example/x">Elsewhere</a>
      <a href="/a/b/c/d">Too deep</a>
      <a href="/logo.png">Logo</a>
      <a href="mailto:x@y.com">Mail</a>`;
    expect(extractSections(html, 'https://shop.example')).toEqual([]);
  });

  it('dedupes the same path reached by different links', () => {
    const html = '<a href="/about">About</a><a href="/about/">About us</a>';
    expect(extractSections(html, 'https://shop.example')).toHaveLength(1);
  });
});

describe('buildLlmsDraft', () => {
  it('produces a short curated file, not a dump', () => {
    const text = buildLlmsDraft({
      origin: 'https://shop.example',
      siteName: 'Example',
      summary: 'Merino wool sneakers.',
      sections: [{ url: 'https://shop.example/collections/shoes', text: 'Shoes' }],
      productUrl: URL,
      productName: 'Wool Runner',
    });
    expect(text.startsWith('# Example')).toBe(true);
    expect(text).toContain('> Merino wool sneakers.');
    expect(text).toContain('[Wool Runner](' + URL + ')');
    expect(text).toContain('## Sections');
    expect(text.split('\n').length).toBeLessThan(30);
  });

  it('omits the product block when there is no product name', () => {
    const text = buildLlmsDraft({ origin: 'https://x.example', siteName: 'X', sections: [] });
    expect(text).not.toContain('## Product');
  });
});

describe('detectPlatform', () => {
  it('recognises the platforms the install steps cover', () => {
    expect(detectPlatform('<link href="https://cdn.shopify.com/x.css">')).toBe('shopify');
    expect(detectPlatform('<div class="woocommerce">')).toBe('woocommerce');
    expect(detectPlatform('<link href="/wp-content/themes/x.css">')).toBe('wordpress');
    expect(detectPlatform('<html data-wf-page="abc">')).toBe('webflow');
    expect(detectPlatform('<html>')).toBe('custom');
  });
});

describe('buildInstall', () => {
  it('warns Shopify sellers that a second Product node is ambiguous', () => {
    const text = buildInstall('shopify', []);
    expect(text).toContain('two Product nodes on one page is ambiguous');
    expect(text).toContain('Replace the theme snippet');
  });

  it('carries the Shopify llms.txt caveat: a custom template replaces, and Liquid is restricted', () => {
    const text = buildInstall('shopify', []);
    expect(text).toContain('replaces** the platform file rather than merging');
    expect(text).toContain('restricted Liquid context');
  });

  it('tells a custom build to append rather than overwrite robots.txt', () => {
    const text = buildInstall('custom', []);
    expect(text).toContain('Append this block to the existing');
  });
});

describe('buildNeedsConfirmation — the questions, not a guess', () => {
  it('asks for a price rather than filling one in', () => {
    const product = extractProduct(BARE_HTML, URL);
    const text = buildNeedsConfirmation(product);
    expect(text).toContain('**price**');
    expect(text).toContain('I will not guess at a price');
    expect(text).toContain('**priceCurrency**');
  });

  it('surfaces a disagreement to the buyer instead of resolving it', () => {
    const product = extractProduct(CONFLICT_HTML, URL);
    const text = buildNeedsConfirmation(product);
    expect(text).toContain('## Sources disagree');
    expect(text).toContain('jsonld = 19.00');
    expect(text).toContain('og = 24.00');
  });

  it('says plainly when there is nothing to confirm', () => {
    const complete = {
      missing: [],
      conflicts: [],
      fields: {},
    };
    expect(buildNeedsConfirmation(complete)).toContain('Nothing to confirm');
  });
});

describe('buildPack — assembly', () => {
  const pack = buildPack({
    pageUrl: URL,
    host: 'shop.example',
    html: SHOPIFY_HTML,
    robotsTxt: 'User-agent: *\nDisallow: /admin\n',
    platform: 'shopify',
    sections: [],
    warnings: [],
  });

  it('does not ship a robots.txt when nothing is blocked', () => {
    // The fixture robots only disallows /admin, which blocks no AI crawler, so
    // there is nothing to fix and no file to paste.
    expect(Object.keys(pack.files).sort()).toEqual([
      'INSTALL.md', 'NEEDS-CONFIRMATION.md', 'llms.txt', 'product.jsonld',
    ].sort());
    expect(pack.manifest.robots_change_needed).toBe(false);
    expect(pack.manifest.files).toContain('manifest.json');
  });

  it('ships an appended patch, leaving the original text intact, when a crawler is blocked', () => {
    const blocked = buildPack({
      pageUrl: URL, host: 'shop.example', html: SHOPIFY_HTML,
      siteHtml: '<meta property="og:site_name" content="Example">',
      robotsTxt: 'User-agent: *\nDisallow: /admin\n\nUser-agent: GPTBot\nDisallow: /\n',
      platform: 'shopify', sections: [], warnings: [],
    });
    const file = blocked.files['robots.txt'];
    expect(blocked.manifest.robots_change_needed).toBe(true);
    expect(blocked.manifest.robots.blocked_by_name).toEqual(['GPTBot']);
    // Their original rules survive verbatim above the marker.
    expect(file).toContain('Disallow: /admin');
    expect(file.indexOf('Disallow: /admin')).toBeLessThan(file.indexOf('added by GeoScore'));
    // The new group repeats their Disallow, so /admin is not opened by accident.
    expect(file).toContain('User-agent: GPTBot\nAllow: /\nDisallow: /admin');
  });

  it('flags that the page already had a Product node, so nothing is pasted twice', () => {
    expect(pack.manifest.warnings.join(' ')).toContain('already carries a Product node');
  });

  it('marks the pack incomplete while an identifier is still missing', () => {
    expect(pack.manifest.complete).toBe(false);
    expect(pack.manifest.product.missing).toContain('identifier');
  });

  it('never emits product.jsonld without a name', () => {
    const noName = buildPack({
      pageUrl: URL, host: 'shop.example',
      html: '<html><head></head><body></body></html>',
      robotsTxt: '', platform: 'custom', sections: [], warnings: [],
    });
    expect(noName.files['product.jsonld']).toBeUndefined();
    expect(noName.manifest.warnings.join(' ')).toContain('product.jsonld was NOT generated');
  });

  it('leaves a deliberately closed robots.txt completely alone', () => {
    const closed = buildPack({
      pageUrl: URL, host: 'shop.example', html: SHOPIFY_HTML,
      robotsTxt: 'User-agent: *\nDisallow: /\n', platform: 'custom', sections: [], warnings: [],
    });
    expect(closed.files['robots.txt']).toBeUndefined();
    expect(closed.manifest.robots.blocks_all).toBe(true);
    expect(closed.manifest.warnings.join(' ')).toContain('left exactly as it is');
  });
});

describe('analyzeRobotsForAi — the Shopify default already allows AI crawlers', () => {
  // Copied from greatjonesgoods.com, which runs on Shopify.
  const SHOPIFY_DEFAULT = `# we use Shopify as our ecommerce platform

# Explicitly allow AI crawlers
User-agent: GPTBot
Allow: /

User-agent: CCBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: *
Disallow: /cart
Disallow: /checkout
`;

  it('sees that the four biggest crawlers are already allowed', () => {
    const a = analyzeRobotsForAi(SHOPIFY_DEFAULT);
    expect(a.needed).toBe(false);
    expect(a.blockedByName).toEqual([]);
    expect(a.allowedByName).toEqual(['GPTBot', 'ClaudeBot', 'PerplexityBot', 'CCBot']);
  });

  it('treats the rest as covered by the wildcard, not as blocked', () => {
    const a = analyzeRobotsForAi(SHOPIFY_DEFAULT);
    expect(a.implicit).toContain('Amazonbot');
    expect(a.implicit).not.toContain('GPTBot');
  });

  it('detects a crawler blocked by name', () => {
    const a = analyzeRobotsForAi('User-agent: *\nAllow: /\n\nUser-agent: CCBot\nDisallow: /\n');
    expect(a.needed).toBe(true);
    expect(a.blockedByName).toEqual(['CCBot']);
  });

  it('detects a site that closes itself to everything', () => {
    expect(analyzeRobotsForAi('User-agent: *\nDisallow: /\n').blocksAll).toBe(true);
  });

  it('needs nothing when there is no robots.txt at all', () => {
    const a = analyzeRobotsForAi('');
    expect(a.needed).toBe(false);
    expect(a.implicit).toHaveLength(AI_CRAWLERS.length);
  });

  it('parseRobots groups agents and ignores comments', () => {
    const g = parseRobots('# hi\nUser-agent: A\nDisallow: /x\n\nUser-agent: B\nAllow: /\n');
    expect(g).toHaveLength(2);
    expect(g[0].agents).toEqual(['a']);
    expect(g[0].rules[0]).toEqual({ type: 'disallow', path: '/x' });
  });
});

describe('buildRobotsPatch — a specific group replaces the wildcard, so rules are copied', () => {
  it('repeats every wildcard Disallow inside the new group', () => {
    const existing = 'User-agent: *\nDisallow: /admin\nDisallow: /cart\n\nUser-agent: GPTBot\nDisallow: /\n';
    const a = analyzeRobotsForAi(existing);
    const patch = buildRobotsPatch(existing, a, 'https://s.example');
    expect(patch).toContain('User-agent: GPTBot');
    expect(patch).toContain('Disallow: /admin');
    expect(patch).toContain('Disallow: /cart');
  });

  it('adds a Sitemap line only when the file has none', () => {
    const without = 'User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n';
    expect(buildRobotsPatch(without, analyzeRobotsForAi(without), 'https://s.example'))
      .toContain('Sitemap: https://s.example/sitemap.xml');

    const withSitemap = without + '\nSitemap: https://s.example/sitemap.xml\n';
    const patch = buildRobotsPatch(withSitemap, analyzeRobotsForAi(withSitemap), 'https://s.example');
    expect(patch.match(/Sitemap:/g)).toBeNull();
  });
});

describe('buildManifest', () => {
  it('is complete only when nothing is missing and nothing conflicts', () => {
    const product = {
      fields: { name: 'Mug', price: '19.00', priceCurrency: 'USD', availability: 'InStock', image: ['https://x/y.jpg'], sku: 'M1' },
      sources: {},
      missing: [],
      conflicts: [],
      existing: { present: false, propertyCount: 0, requiredPresent: [] },
    };
    const m = buildManifest({
      pageUrl: URL, host: 'shop.example', platform: 'custom', product, node: null, files: [], warnings: [],
    });
    expect(m.complete).toBe(true);
    expect(m.product.name).toBe('Mug');
  });
});

describe('looksLikeProductPage — never generate a Product node for a homepage', () => {
  it('accepts a /products/ URL', () => {
    expect(looksLikeProductPage('https://s.example/products/thing', '', { fields: {} })).toBe(true);
  });

  it('accepts og:type=product even on a pretty URL', () => {
    const html = '<meta property="og:type" content="product">';
    expect(looksLikeProductPage('https://s.example/thing', html, { fields: {} })).toBe(true);
  });

  it('accepts a page that actually shows a price', () => {
    expect(looksLikeProductPage('https://s.example/thing', '', { fields: { name: 'X', price: '9.00' } })).toBe(true);
  });

  it('rejects a homepage, so the page title is not turned into a product', () => {
    expect(looksLikeProductPage('https://s.example/', '', { fields: { name: 'Welcome to Example' } })).toBe(false);
  });

  it('rejects a collection page', () => {
    expect(looksLikeProductPage('https://s.example/collections/all', '', { fields: {} })).toBe(false);
  });

  it('does not emit product.jsonld when the URL is not a product page', () => {
    const pack = buildPack({
      pageUrl: 'https://s.example/',
      host: 's.example',
      html: '<html><head><title>Welcome</title><meta property="og:title" content="Welcome"></head></html>',
      siteHtml: '<html><head><meta property="og:site_name" content="Example"></head></html>',
      robotsTxt: '', platform: 'custom', sections: [], warnings: [],
    });
    expect(pack.files['product.jsonld']).toBeUndefined();
    expect(pack.manifest.warnings.join(' ')).toContain('does not look like a product page');
  });
});

describe('productNodeSufficient — do not sell a file they already have', () => {
  it('is false when there is no node at all', () => {
    expect(productNodeSufficient(extractProduct(BARE_HTML, URL))).toBe(false);
  });

  it('is false when the node is missing an identifier', () => {
    // SHOPIFY_HTML is complete on the five required fields but carries no sku.
    expect(productNodeSufficient(extractProduct(SHOPIFY_HTML, URL))).toBe(false);
  });

  it('is true only when the page already covers everything we would add', () => {
    const product = extractProduct(SHOPIFY_HTML, URL);
    product.fields.sku = 'WR-1';
    product.hasIdentifier = true;
    expect(productNodeSufficient(product)).toBe(true);

    const pack = buildPack({
      pageUrl: URL, host: 'shop.example', html: SHOPIFY_HTML,
      siteHtml: '<meta property="og:site_name" content="Example">',
      robotsTxt: '', platform: 'shopify', sections: [], warnings: [],
    });
    // The fixture has no sku, so the pack still generates the file.
    expect(pack.files['product.jsonld']).toBeDefined();
  });

  it('suppresses the file and says so when the node is already complete', () => {
    const html = SHOPIFY_HTML.replace('"brand"', '"sku": "WR-1", "brand"');
    const pack = buildPack({
      pageUrl: URL, host: 'shop.example', html,
      siteHtml: '<meta property="og:site_name" content="Example">',
      robotsTxt: '', platform: 'shopify', sections: [], warnings: [],
    });
    expect(pack.sufficient).toBe(true);
    expect(pack.files['product.jsonld']).toBeUndefined();
    expect(pack.files['NEEDS-CONFIRMATION.md']).toContain('schema part is not needed');
    expect(pack.manifest.product_jsonld_needed).toBe(false);
  });
});

describe('siteNameOf — the site name comes from the site', () => {
  it('prefers og:site_name over the page title', () => {
    const html = '<title>Wool Runner | Allbirds</title><meta property="og:site_name" content="Allbirds">';
    expect(siteNameOf(html, 'allbirds.com')).toBe('Allbirds');
  });

  it('takes the last title segment, because segment 0 is the product', () => {
    expect(siteNameOf('<title>Wool Runner | Allbirds</title>', 'x.com')).toBe('Allbirds');
  });

  it('falls back to the host', () => {
    expect(siteNameOf('', 'shop.example')).toBe('shop.example');
  });
});

describe('decodeEntities', () => {
  it('turns escaped text back into text a customer can read', () => {
    expect(decodeEntities('Men&#39;s Tree Runner')).toBe("Men's Tree Runner");
    expect(decodeEntities('a &amp; b')).toBe('a & b');
    expect(decodeEntities('&quot;quoted&quot;')).toBe('"quoted"');
    expect(decodeEntities('plain')).toBe('plain');
  });
});

describe('normalizeUrl — an http image on an https page is a broken image', () => {
  it('upgrades the scheme when the page is https', () => {
    expect(normalizeUrl('http://cdn.shopify.com/a.png', 'https://s.example/p/1'))
      .toBe('https://cdn.shopify.com/a.png');
  });

  it('leaves https and relative-looking values alone', () => {
    expect(normalizeUrl('https://cdn.shopify.com/a.png', 'https://s.example/')).toBe('https://cdn.shopify.com/a.png');
    expect(normalizeUrl('', 'https://s.example/')).toBe('');
  });

  it('does not rewrite when the page itself is http', () => {
    expect(normalizeUrl('http://s.example/a.png', 'http://s.example/')).toBe('http://s.example/a.png');
  });
});

describe('helpers', () => {
  it('firstString walks strings, arrays and objects the way schema.org allows', () => {
    expect(firstString('a')).toBe('a');
    expect(firstString(['', 'b'])).toBe('b');
    expect(firstString({ url: 'https://x/y' })).toBe('https://x/y');
    expect(firstString({ name: 'N' })).toBe('N');
    expect(firstString(null)).toBe('');
  });

  it('isProductNode accepts ProductGroup and rejects neighbours', () => {
    expect(isProductNode({ '@type': 'Product' })).toBe(true);
    expect(isProductNode({ '@type': 'ProductGroup' })).toBe(true);
    expect(isProductNode({ '@type': ['Product', 'Thing'] })).toBe(true);
    expect(isProductNode({ '@type': 'Organization' })).toBe(false);
    expect(isProductNode(null)).toBe(false);
  });

  it('IDENTIFIERS covers the four things a shopping surface accepts', () => {
    expect(IDENTIFIERS).toEqual(['sku', 'gtin13', 'gtin', 'mpn']);
  });
});
