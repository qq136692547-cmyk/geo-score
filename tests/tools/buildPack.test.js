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
  parsePrice,
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
  buildRobotsGuidance,
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
    const text = buildInstall('shopify', [], null, '', ['product.jsonld', 'llms.txt']);
    expect(text).toContain('two Product nodes on one page is ambiguous');
    expect(text).toContain('Replace the theme snippet');
  });

  it('does not give paste instructions for a file it did not write', () => {
    const text = buildInstall('shopify', [], null, '', ['llms.txt']);
    expect(text).not.toContain('Replace the theme snippet');
    expect(text).toContain('There is no `product.jsonld` in this pack, on purpose');
    expect(text).toContain('The files for your site: llms.txt');
  });

  it('carries the Shopify llms.txt caveat: a custom template replaces, and Liquid is restricted', () => {
    const text = buildInstall('shopify', []);
    expect(text).toContain('replaces** the platform file rather than merging');
    expect(text).toContain('restricted Liquid context');
  });

  it('tells a custom build where robots.txt is edited, because no file is shipped', () => {
    const text = buildInstall('custom', []);
    expect(text).toContain('Edit `/robots.txt` itself');
    expect(text).not.toContain('Append this block');
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

  it('reports a blocked crawler and ships no robots.txt at all', () => {
    const blocked = buildPack({
      pageUrl: URL, host: 'shop.example', html: SHOPIFY_HTML,
      siteHtml: '<meta property="og:site_name" content="Example">',
      robotsTxt: 'User-agent: *\nDisallow: /admin\n\nUser-agent: GPTBot\nDisallow: /\n',
      platform: 'shopify', sections: [], warnings: [],
    });
    expect(blocked.manifest.robots_change_needed).toBe(true);
    expect(blocked.manifest.robots.blocked_by_name).toEqual(['GPTBot']);
    // No file is written. Every patch shape we can generate either repeats the
    // owner's block (a no-op we would have charged for) or overrides a rule they
    // wrote on purpose.
    expect(blocked.files['robots.txt']).toBeUndefined();
    expect(blocked.files['INSTALL.md']).toContain('Delete these groups from your robots.txt');
    expect(blocked.files['INSTALL.md']).toContain('User-agent: GPTBot');
    expect(blocked.files['INSTALL.md']).not.toContain('a block appended');
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
    expect(closed.manifest.warnings.join(' ')).toContain('closes the whole site');
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

describe('buildRobotsGuidance — the fix is a deletion, and the deletion is the owner\'s call', () => {
  it('quotes the exact group to delete, including the crawler\'s own rules', () => {
    const existing = 'User-agent: *\nDisallow: /admin\n\nUser-agent: GPTBot\nDisallow: /private\nDisallow: /\n';
    const text = buildRobotsGuidance(analyzeRobotsForAi(existing, '/products/x'));
    expect(text).toContain('Delete these groups from your robots.txt');
    expect(text).toContain('User-agent: GPTBot');
    expect(text).toContain('Disallow: /private');
    expect(text).toContain('Disallow: /');
  });

  it('says plainly that it did not write a replacement file, and why', () => {
    const existing = 'User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n';
    const text = buildRobotsGuidance(analyzeRobotsForAi(existing, '/products/x'));
    expect(text).toContain('I have not written a replacement file');
    expect(text).toContain('no change, and you would have paid for nothing');
  });

  it('quotes the wildcard rule when that is what closes the page, and only the path', () => {
    const text = buildRobotsGuidance(analyzeRobotsForAi('User-agent: *\nDisallow: /products\n', '/products/x?utm_source=a'));
    expect(text).toContain('Disallow: /products');
    expect(text).not.toContain('utm_source');
  });

  it('does not quote a file it could not read', () => {
    const text = buildRobotsGuidance(analyzeRobotsForAi(''));
    expect(text).toContain('No robots.txt could be read');
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
    // The identifier has to be in the node itself, not only in the page.
    product.existing.hasIdentifier = true;
    expect(productNodeSufficient(product)).toBe(true);

    const pack = buildPack({
      pageUrl: URL, host: 'shop.example', html: SHOPIFY_HTML,
      siteHtml: '<meta property="og:site_name" content="Example">',
      robotsTxt: '', platform: 'shopify', sections: [], warnings: [],
    });
    // The fixture has no sku, so the pack still generates the file.
    expect(pack.files['product.jsonld']).toBeDefined();
  });

  it('does not count a microdata sku as an identifier on the JSON-LD node', () => {
    // A theme that prints itemprop="sku" in the markup but no sku in its
    // JSON-LD is exactly the case where the node is incomplete and the file is
    // still worth shipping. Reading the microdata made it look finished.
    const html = SHOPIFY_HTML.replace('</head>', '<meta itemprop="sku" content="WR-1"></head>');
    const product = extractProduct(html, URL);
    expect(product.hasIdentifier).toBe(true);
    expect(product.existing.hasIdentifier).toBe(false);
    expect(productNodeSufficient(product)).toBe(false);
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

  it('accepts a number where schema.org allows one', () => {
    expect(firstString(4.6)).toBe('4.6');
    expect(firstString(NaN)).toBe('');
  });
});

/* ------------------------------------------------------------------ *
 * Regressions — every one of these was a real false statement a paying
 * buyer would have pasted into production.
 * ------------------------------------------------------------------ */

describe('normalizePrice refuses a format it cannot read exactly one way', () => {
  it('reads the European forms exactly', () => {
    expect(normalizePrice('19,99')).toBe('19.99');
    expect(normalizePrice('1.234,56')).toBe('1234.56');
    expect(normalizePrice('1 234,56')).toBe('1234.56');
    expect(normalizePrice('1.234.567,89')).toBe('1234567.89');
  });

  it('reads the US forms exactly', () => {
    expect(normalizePrice('1,234,567.89')).toBe('1234567.89');
    expect(normalizePrice('$1,299.00')).toBe('1299.00');
    expect(normalizePrice('0')).toBe('0.00');
  });

  it('refuses anything that could be read two ways', () => {
    // "1,299" is 1299 in the US and 1.299 in the EU — a thousandfold gap, so
    // neither reading is chosen. The old parser deleted the comma and shipped
    // 1999.00 for "19,99".
    expect(normalizePrice('1,299')).toBe('');
    expect(normalizePrice('1.299')).toBe('');
    expect(normalizePrice('19.99 - 24.99')).toBe('');
    expect(normalizePrice('was $29.99 now $19.99')).toBe('');
    expect(normalizePrice('Call for price')).toBe('');
    expect(normalizePrice('-19.99')).toBe('');
    expect(normalizePrice('19.99.99')).toBe('');
  });

  it('says why it refused, so the question to the buyer is the right one', () => {
    expect(parsePrice('19,99').value).toBe('19.99');
    expect(parsePrice('1,299').reason).toContain('ambiguous');
    expect(parsePrice('Call for price').reason).toBe('no digits');
  });
});

describe('a field that is present but unreadable is not "already done"', () => {
  const html = `<html><head><script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"Mug","image":"https://c.example/m.jpg","sku":"M1",
 "offers":{"@type":"Offer","price":"Call for price","priceCurrency":"USD","availability":"https://schema.org/InStock"}}
</script></head><body></body></html>`;

  it('does not treat "Call for price" as a price', () => {
    const p = extractProduct(html, URL);
    expect(p.existing.requiredPresent).not.toContain('price');
    expect(productNodeSufficient(p)).toBe(false);
  });

  it('records the unreadable value instead of pretending the page had none', () => {
    const p = extractProduct(html, URL);
    expect(p.unreadable).toHaveLength(1);
    expect(p.unreadable[0].raw).toBe('Call for price');
    const text = buildNeedsConfirmation(p);
    expect(text).toContain('On the page, but not readable');
    expect(text).toContain('Call for price');
  });
});

describe('robots.txt is judged against the page we are auditing', () => {
  it('sees that a wildcard path rule closes the audited URL', () => {
    const a = analyzeRobotsForAi('User-agent: *\nDisallow: /products\n', '/products/wool-runner');
    expect(a.wildcardBlocksPath).toBe(true);
    expect(a.needed).toBe(true);
  });

  it('does not treat Disallow: / plus Allow: /products as a closed site', () => {
    const a = analyzeRobotsForAi('User-agent: *\nDisallow: /\nAllow: /products\n', '/products/wool-runner');
    expect(a.wildcardBlocksPath).toBe(false);
    expect(a.blocksAll).toBe(false);
  });

  it('does not claim the site allows AI crawlers when it closes the page', () => {
    const pack = buildPack({
      pageUrl: URL, host: 'shop.example', html: SHOPIFY_HTML,
      robotsTxt: 'User-agent: *\nDisallow: /products\n',
      platform: 'shopify', sections: [], warnings: [],
    });
    const text = pack.files['INSTALL.md'];
    expect(text).not.toContain('already lets AI crawlers in');
    expect(text).toContain('closes the page this pack is about');
    expect(text).toContain('/products/wool-runner');
    expect(pack.files['robots.txt']).toBeUndefined();
  });
});

describe('an unreadable robots.txt is not a permissive one', () => {
  it('reports that it could not read the file', () => {
    const a = analyzeRobotsForAi('');
    expect(a.readable).toBe(false);
    expect(a.needed).toBe(false);
  });

  it('does not tell the buyer their file already allows AI crawlers', () => {
    const pack = buildPack({
      pageUrl: URL, host: 'shop.example', html: SHOPIFY_HTML,
      robotsTxt: '', platform: 'shopify', sections: [], warnings: [],
    });
    const warnings = pack.manifest.warnings.join(' ');
    expect(pack.manifest.robots.readable).toBe(false);
    expect(warnings).toContain('No robots.txt could be read');
    expect(warnings).not.toContain('already allows AI crawlers');
    expect(pack.files['INSTALL.md']).toContain('No robots.txt could be read, so there is nothing to quote');
  });
});

describe('the appended group never shipped, because no patch could work', () => {
  it('proves the old patch was a no-op: the rule it copied still wins', () => {
    // RFC 9309 merges every group naming a crawler, and the longest matching
    // rule wins. `Disallow: /products` is longer than `Allow: /`, so appending
    // the block left the crawler blocked — a file the buyer paid for that
    // changed nothing.
    const after = 'User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /products\n'
      + '\nUser-agent: GPTBot\nAllow: /\nDisallow: /products\n';
    expect(analyzeRobotsForAi(after, '/products/wool-runner').blockedByName).toEqual(['GPTBot']);
  });
});

describe('INSTALL.md is a document, not a stringified object', () => {
  it('carries the audited URL and no [object Object]', () => {
    const pack = buildPack({
      pageUrl: URL, host: 'shop.example', html: SHOPIFY_HTML,
      robotsTxt: '', platform: 'shopify', sections: [], warnings: [],
      extra: ['Your theme prints two Product nodes.'],
    });
    const text = pack.files['INSTALL.md'];
    expect(text).not.toContain('[object Object]');
    expect(text).toContain('https://geoscore.help');
    expect(text).toContain(URL);
    expect(text).toContain('- Your theme prints two Product nodes.');
  });
});

describe('a collection page is not a product page', () => {
  it('rejects /shop/gift-cards, which the old pattern accepted', () => {
    expect(looksLikeProductPage('https://s.example/shop/gift-cards', '', { fields: {} })).toBe(false);
  });
});

describe('a malformed entity cannot crash the run', () => {
  it('leaves an impossible code point as it found it', () => {
    expect(() => decodeEntities('&#x110000;')).not.toThrow();
    expect(decodeEntities('&#x110000;')).toBe('&#x110000;');
    expect(decodeEntities('&#0;')).toBe('&#0;');
    expect(decodeEntities('a&#38;b')).toBe('a&b');
  });
});

describe('a page with several real prices gets a range, not a guess', () => {
  const html = `<html><head><script type="application/ld+json">
{"@context":"https://schema.org","@type":"ProductGroup","name":"Wool Runner","image":"https://c.example/w.jpg",
 "hasVariant":[
   {"@type":"Product","name":"42","sku":"WR-42","offers":{"@type":"Offer","price":"98.00","priceCurrency":"USD","availability":"https://schema.org/InStock"}},
   {"@type":"Product","name":"44","sku":"WR-44","offers":{"@type":"Offer","price":"104.00","priceCurrency":"USD","availability":"https://schema.org/InStock"}}
 ]}
</script></head><body></body></html>`;

  it('emits an AggregateOffer over the real range instead of the first variant', () => {
    const node = buildProductJsonLd(extractProduct(html, URL), URL);
    expect(node.offers['@type']).toBe('AggregateOffer');
    expect(node.offers.lowPrice).toBe('98.00');
    expect(node.offers.highPrice).toBe('104.00');
    expect(node.offers.offerCount).toBe(2);
  });
});

describe('a page that already publishes a range is not a page with no price', () => {
  // Round trip: this is the exact shape the tool itself emits, so a page using
  // it must not read back as "price missing" — that produced a Product node
  // with no offers at all, strictly worse than what the buyer already had.
  const html = `<html><head><script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"Mug","image":"https://c.example/m.jpg","sku":"M1",
 "offers":{"@type":"AggregateOffer","lowPrice":"98.00","highPrice":"104.00","priceCurrency":"USD","availability":"https://schema.org/InStock"}}
</script></head><body></body></html>`;

  it('reads lowPrice as the price and keeps the high end', () => {
    const p = extractProduct(html, URL);
    expect(p.missing).toEqual([]);
    expect(p.fields.price).toBe('98.00');
    expect(p.fields.priceHigh).toBe('104.00');
  });

  it('does not ship a second node next to a complete one', () => {
    const p = extractProduct(html, URL);
    expect(productNodeSufficient(p)).toBe(true);
    const pack = buildPack({
      pageUrl: URL, host: 'shop.example', html,
      robotsTxt: 'User-agent: *\nAllow: /\n', platform: 'custom', sections: [], warnings: [],
    });
    expect(pack.files['product.jsonld']).toBeUndefined();
  });

  it('reproduces the same range if it has to build the node', () => {
    const node = buildProductJsonLd(extractProduct(html, URL), URL);
    expect(node.offers['@type']).toBe('AggregateOffer');
    expect(node.offers.lowPrice).toBe('98.00');
    expect(node.offers.highPrice).toBe('104.00');
  });
});

describe('a currency next to the number is not a second number', () => {
  it('reads the formats Google Merchant publishes', () => {
    expect(normalizePrice('19.99 USD')).toBe('19.99');
    expect(normalizePrice('19.99€')).toBe('19.99');
    expect(normalizePrice('USD 19.99')).toBe('19.99');
  });

  it('still refuses a range and a price too large to be one', () => {
    expect(normalizePrice('19.99 - 24.99 USD')).toBe('');
    expect(normalizePrice('999999999999999999999')).toBe('');
  });
});

describe('a protocol-relative image is still an image', () => {
  const html = `<html><head><script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"Dutchess","sku":"DUT-1",
 "image":["//cdn.shopify.com/a.png","//cdn.shopify.com/b.png"],
 "offers":{"@type":"Offer","price":"395.00","priceCurrency":"USD","availability":"https://schema.org/InStock"}}
</script></head><body></body></html>`;

  it('does not make a complete node look incomplete', () => {
    const p = extractProduct(html, URL);
    expect(p.existing.requiredPresent).toContain('image');
    expect(productNodeSufficient(p)).toBe(true);
  });

  it('upgrades the scheme when it does have to write the node', () => {
    const p = extractProduct(html.replace('"sku":"DUT-1",', ''), URL);
    const node = buildProductJsonLd(p, URL);
    expect(node.image).toEqual(['https://cdn.shopify.com/a.png', 'https://cdn.shopify.com/b.png']);
  });
});

describe('the robots guidance quotes the file, not the URL', () => {
  it('prints the rule that is actually in the file', () => {
    const text = buildRobotsGuidance(analyzeRobotsForAi('User-agent: *\nDisallow: /products\n', '/products/wool-runner'));
    expect(text).toContain('Disallow: /products');
    expect(text).not.toContain('Disallow: /products/wool-runner');
  });

  it('merges the groups that name the same crawler, the way the spec does', () => {
    const a = analyzeRobotsForAi('User-agent: GPTBot\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /products\n', '/products/x');
    expect(a.blockedByName).toEqual([]);
  });

  it('prints a shared group once', () => {
    const text = buildRobotsGuidance(analyzeRobotsForAi('User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nUser-agent: CCBot\nDisallow: /\n', '/products/x'));
    expect(text.match(/User-agent: GPTBot/g)).toHaveLength(1);
    expect(text.match(/User-agent: CCBot/g)).toHaveLength(1);
  });
});

describe('an AggregateOffer without an upper bound stays an aggregate', () => {
  const html = `<html><head><script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"Mug","image":"https://c.example/m.jpg","sku":"M1",
 "offers":{"@type":"AggregateOffer","lowPrice":"98.00","priceCurrency":"USD","availability":"https://schema.org/InStock"}}
</script></head><body></body></html>`;

  it('does not assert a "from" price as the price', () => {
    const node = buildProductJsonLd(extractProduct(html, URL), URL);
    expect(node.offers['@type']).toBe('AggregateOffer');
    expect(node.offers.lowPrice).toBe('98.00');
    expect(node.offers.price).toBeUndefined();
    expect(node.offers.highPrice).toBeUndefined();
  });
});

describe('INSTALL.md only instructs on files that exist', () => {
  it('says so plainly when product.jsonld was withheld', () => {
    const pack = buildPack({
      pageUrl: URL, host: 'shop.example', html: SHOPIFY_HTML,
      robotsTxt: 'User-agent: *\nAllow: /\n', platform: 'shopify', sections: [], warnings: [],
    });
    // SHOPIFY_HTML has no sku, so the file is generated — check the other case.
    const complete = buildPack({
      pageUrl: URL, host: 'shop.example',
      html: SHOPIFY_HTML.replace('"brand"', '"sku": "WR-1", "brand"'),
      robotsTxt: 'User-agent: *\nAllow: /\n', platform: 'shopify', sections: [], warnings: [],
    });
    expect(complete.files['product.jsonld']).toBeUndefined();
    expect(complete.files['INSTALL.md']).toContain('There is no `product.jsonld` in this pack');
    expect(complete.files['INSTALL.md']).not.toContain('Replace the theme snippet');
    expect(pack.files['INSTALL.md']).toContain('Replace the theme snippet');
  });
});
