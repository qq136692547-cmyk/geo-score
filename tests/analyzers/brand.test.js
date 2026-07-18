import { describe, it, expect } from 'vitest';
import { analyzeBrand } from '../../src/lib/analyzers/brand.js';

const goodHtml = `<!DOCTYPE html>
<html><head>
  <title>Acme Corp | GEO Solutions</title>
  <meta property="og:site_name" content="Acme Corp">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme Corp","sameAs":["https://twitter.com/acme","https://github.com/acme"]}</script>
</head><body>
  <a href="/about">About</a>
  <p>Contact us: email@acme.com or call 555-0100</p>
</body></html>`;

const minimalHtml = `<!DOCTYPE html><html><head><title>Page</title></head><body><p>Hello</p></body></html>`;

describe('analyzeBrand', () => {
  it('should pass all brand checks for well-configured page', () => {
    const schemaResult = { raw: { blocks: [{ '@type': 'Organization', sameAs: ['https://twitter.com/acme'] }] } };
    const result = analyzeBrand(goodHtml, schemaResult);
    expect(result.passed).toBe(4);
    expect(result.score).toBe(8);
  });

  it('should fail most checks for minimal page', () => {
    const result = analyzeBrand(minimalHtml, { raw: { blocks: [] } });
    expect(result.passed).toBeLessThanOrEqual(2);
    expect(result.score).toBeLessThan(4);
  });

  it('should return zero for null HTML', () => {
    const result = analyzeBrand(null);
    expect(result.score).toBe(0);
    expect(result.total).toBe(4);
  });
});
