/**
 * tools/icp-probe.mjs — the evidence behind "WooCommerce / Webflow / custom
 * stores need Product schema, Shopify does not".
 *
 * The failure this guards against is not a crash. It is a *price*. A wrong
 * figure copied into a file the merchant pastes live is worse than an empty
 * field, and an ambiguous figure is the usual way that happens: "1,299" is
 * 1299 in one locale and 1.299 in another. Every price test below is about
 * what the parser refuses to read, not about what it reads.
 *
 * The second failure is mislabeling the platform. The ICP decision hinges on
 * "Shopify does not need us, WooCommerce does", so a Shopify store reported as
 * woocommerce would invert the whole conclusion.
 */
import { describe, it, expect } from 'vitest';
import {
  parsePriceStrict,
  detectPlatform,
  pageKind,
  inspectPage,
} from '../../tools/icp-probe.mjs';

describe('parsePriceStrict — refuse anything with two readings', () => {
  it('reads a US price with a thousands separator', () => {
    expect(parsePriceStrict('1,299.00')).toBe(1299);
    expect(parsePriceStrict('$1,299.00')).toBe(1299);
  });

  it('reads a European price with a thousands separator', () => {
    expect(parsePriceStrict('1.299,00')).toBe(1299);
    expect(parsePriceStrict('€1.299,00')).toBe(1299);
  });

  it('reads a European decimal comma', () => {
    expect(parsePriceStrict('19,99')).toBe(19.99);
    expect(parsePriceStrict('19,99 €')).toBe(19.99);
  });

  it('REFUSES "1,299" — 1299 or 1.299 depending on locale', () => {
    // This is the exact case that turned 19,99 into 1999.00 in build-pack v1.
    expect(parsePriceStrict('1,299')).toBeNull();
    expect(parsePriceStrict('2,500')).toBeNull();
  });

  it('reads a plain integer and a plain decimal', () => {
    expect(parsePriceStrict('49')).toBe(49);
    expect(parsePriceStrict('59.00')).toBe(59);
    expect(parsePriceStrict(18.99)).toBe(18.99);
  });

  it('refuses values that are not single numbers', () => {
    expect(parsePriceStrict('')).toBeNull();
    expect(parsePriceStrict(null)).toBeNull();
    expect(parsePriceStrict(undefined)).toBeNull();
    expect(parsePriceStrict('free')).toBeNull();
    expect(parsePriceStrict('10-20')).toBeNull();
  });

  it('refuses zero and negative, which are never a retail price', () => {
    expect(parsePriceStrict(0)).toBeNull();
    expect(parsePriceStrict('-5')).toBeNull();
  });
});

describe('detectPlatform — Shopify must never be reported as a WordPress shop', () => {
  it('detects Shopify from the CDN host or theme global', () => {
    expect(detectPlatform('<script src="https://cdn.shopify.com/x.js"></script>')).toBe('shopify');
    expect(detectPlatform('<script>Shopify.theme = {id: 1}</script>')).toBe('shopify');
  });

  it('detects WooCommerce', () => {
    expect(detectPlatform('<link rel="stylesheet" href="/wp-content/plugins/woocommerce/a.css">')).toBe('woocommerce');
    expect(detectPlatform('<body class="woocommerce-page">')).toBe('woocommerce');
  });

  it('detects Webflow', () => {
    expect(detectPlatform('<html data-wf-page="abc" data-wf-site="def">')).toBe('webflow');
  });

  it('falls back to custom', () => {
    expect(detectPlatform('<html><body>hello</body></html>')).toBe('custom');
  });

  it('prefers Shopify when a Shopify store also credits WordPress somewhere', () => {
    // Real storefronts embed analytics and footer credits for other platforms.
    const html = '<a href="https://wordpress.org">Powered by WordPress</a>' + '<script src="https://cdn.shopify.com/s/files/x.js"></script>';
    expect(detectPlatform(html)).toBe('shopify');
  });

  it('reports a headless Webflow store as Webflow, not Shopify', () => {
    // clicks.tech is a Webflow storefront with a myshopify backend. Treating
    // that link as proof of Shopify inverted the ICP conclusion on 2026-11-02.
    const html =
      '<html data-wf-page="abc" data-wf-site="def">' +
      '<a href="https://clicks-tech.myshopify.com/cart">Cart</a>';
    expect(detectPlatform(html)).toBe('webflow');
  });
});

describe('pageKind — a pricing page is not a product page', () => {
  it('refuses /pricing even when the page carries a Product node', () => {
    expect(pageKind('https://stripe.com/pricing', true)).toBe('pricing');
  });

  it('accepts a product URL shape with no Product node', () => {
    expect(pageKind('https://nalgene.com/product/22oz-fitness-draft/', false)).toBe('product');
  });

  it('marks anything else unknown rather than guessing product', () => {
    expect(pageKind('https://example.com/about', false)).toBe('unknown');
  });
});

const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

const fullProduct = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Draft Bottle',
  image: 'https://example.com/a.jpg',
  brand: { '@type': 'Brand', name: 'Nalgene' },
  offers: { '@type': 'Offer', price: '18.99', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
  sku: 'BTL-1',
};

describe('inspectPage — verdicts the ICP decision rests on', () => {
  const shopifyHtml = '<script>Shopify.theme={}</script>' + ld(fullProduct);

  it('Shopify store with a complete node and a brand is "no-gap"', () => {
    const r = inspectPage({ group: 'shopify', url: 'https://s.com/products/x' }, shopifyHtml, 200);
    expect(r.platform).toBe('shopify');
    expect(r.has_product_node).toBe(1);
    expect(r.has_brand).toBe(1);
    expect(r.verdict).toBe('no-gap');
    expect(r.price_source).toBe('jsonld');
    expect(r.price_value).toBe(18.99);
    expect(r.price_currency).toBe('USD');
  });

  it('WooCommerce page with a node but no brand is "needs-brand"', () => {
    const { brand, ...noBrand } = fullProduct;
    const html = '<body class="woocommerce">' + ld(noBrand);
    const r = inspectPage({ group: 'woocommerce', url: 'https://w.com/product/x/' }, html, 200);
    expect(r.platform).toBe('woocommerce');
    expect(r.has_brand).toBe(0);
    expect(r.verdict).toBe('needs-brand');
  });

  it('Webflow page with no Product node is "needs-product-schema"', () => {
    const html = '<html data-wf-page="a">' + ld({ '@type': 'WebSite', name: 'x' });
    const r = inspectPage({ group: 'webflow', url: 'https://w.com/product/x' }, html, 200);
    expect(r.platform).toBe('webflow');
    expect(r.has_product_node).toBe(0);
    expect(r.verdict).toBe('needs-product-schema');
    expect(r.note).toBe('jsonld-but-no-product');
  });

  it('records a platform/group mismatch instead of hiding it', () => {
    const r = inspectPage({ group: 'woocommerce', url: 'https://s.com/products/x' }, shopifyHtml, 200);
    expect(r.platform).toBe('shopify');
    expect(r.platform_matches_group).toBe(0);
  });

  it('marks a pricing page not-applicable and reads no price', () => {
    const r = inspectPage({ group: 'saas', url: 'https://stripe.com/pricing' }, shopifyHtml, 200);
    expect(r.verdict).toBe('not-applicable');
    expect(r.price_value).toBe('');
  });

  it('REFUSES to judge schema from a block page', () => {
    // nalgene.com returns 200 to curl and 403 to Node. The 403 body is a
    // challenge page; calling it "needs-product-schema" would tell a customer
    // their site is broken when we never read it.
    const blockPage = '<html><body>Access denied</body></html>';
    const r = inspectPage({ group: 'woocommerce', url: 'https://nalgene.com/product/x/' }, blockPage, 403);
    expect(r.verdict).toBe('fetch-blocked');
    expect(r.note).toBe('http-403');
    expect(r.has_product_node).toBe(0);
    expect(r.price_value).toBe('');
  });
});

describe('inspectPage — price source honesty', () => {
  it('falls back to text only when the page shows exactly one distinct figure', () => {
    const html = '<html data-wf-page="a"><body>Commute Pack <div class="price">$59.00</div></body></html>';
    const r = inspectPage({ group: 'webflow', url: 'https://w.com/product/x' }, html, 200);
    expect(r.price_source).toBe('text-single-symbol');
    expect(r.price_value).toBe(59);
  });

  it('REFUSES to pick a price when the page shows several', () => {
    // A struck-through original plus a sale price is the common case; a
    // "you may also like" block looks identical from here.
    const html = '<html data-wf-page="a"><body><s>$79.00</s> <div class="price">$59.00</div></body></html>';
    const r = inspectPage({ group: 'webflow', url: 'https://w.com/product/x' }, html, 200);
    expect(r.price_source).toBe('ambiguous');
    expect(r.price_value).toBe('');
    expect(r.note).toContain('distinct figures');
  });

  it('reports jsonld-no-currency rather than borrowing a currency glyph', () => {
    const { offers, ...rest } = fullProduct;
    const html = ld({ ...rest, offers: { '@type': 'Offer', price: '18.99', availability: 'https://schema.org/InStock' } });
    const r = inspectPage({ group: 'shopify', url: 'https://s.com/products/x' }, html, 200);
    expect(r.price_value).toBe(18.99);
    expect(r.price_source).toBe('jsonld-no-currency');
    expect(r.price_currency).toBe('');
  });

  it('reads a price from priceSpecification, which IKEA uses', () => {
    const { offers, ...rest } = fullProduct;
    const html = ld({
      ...rest,
      offers: { '@type': 'Offer', priceSpecification: { '@type': 'UnitPriceSpecification', price: '129.00', priceCurrency: 'USD' } },
    });
    const r = inspectPage({ group: 'custom', url: 'https://i.com/us/en/p/x/' }, html, 200);
    expect(r.price_value).toBe(129);
  });

  it('reports none when there is no figure at all', () => {
    const html = '<html data-wf-page="a"><body>Sold out</body></html>';
    const r = inspectPage({ group: 'webflow', url: 'https://w.com/product/x' }, html, 200);
    expect(r.price_source).toBe('none');
    expect(r.price_value).toBe('');
  });
});
