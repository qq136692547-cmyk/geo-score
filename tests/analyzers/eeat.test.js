import { describe, it, expect } from 'vitest';
import { analyzeEeat } from '../../src/lib/analyzers/eeat.js';
import { analyzeMeta } from '../../src/lib/analyzers/meta.js';

const goodHtml = `<!DOCTYPE html>
<html><head>
  <meta name="author" content="Jane Smith">
  <meta property="og:title" content="Test">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Person","name":"Jane Smith","knowsAbout":["GEO"]}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","author":{"@type":"Person","name":"Jane"}}</script>
</head><body>
  <a href="/about">About Us</a>
  <a href="/privacy">Privacy Policy</a>
  <a href="/terms">Terms of Service</a>
  <p>Check our reviews on trustpilot.com</p>
  <p>Strict-Transport-Security: max-age=31536000</p>
  <footer>&copy; 2026</footer>
</body></html>`;

const partialHtml = `<!DOCTYPE html><html><head><title>Minimal</title></head><body><p>Hello</p></body></html>`;

describe('analyzeEeat', () => {
  it('should pass all eeat checks for well-configured page', () => {
    const metaResult = analyzeMeta(goodHtml);
    const schemaResult = { raw: { blocks: [{ '@type': 'Person', name: 'Jane' }] } };
    const result = analyzeEeat(goodHtml, schemaResult);
    expect(result.passed).toBeGreaterThanOrEqual(4);
    expect(result.score).toBeGreaterThanOrEqual(6);
  });

  it('should fail most checks for minimal page', () => {
    const result = analyzeEeat(partialHtml, { raw: { blocks: [] } });
    expect(result.passed).toBeLessThanOrEqual(2);
    expect(result.score).toBeLessThan(4);
  });

  it('should return zero for null HTML', () => {
    const result = analyzeEeat(null);
    expect(result.score).toBe(0);
    expect(result.total).toBe(5);
  });
});
