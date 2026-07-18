import { describe, it, expect } from 'vitest';
import { analyzeFreshness } from '../../src/lib/analyzers/freshness.js';

const goodHtml = `<!DOCTYPE html>
<html><head>
  <meta name="dateModified" content="2026-07-15">
  <meta name="last-modified" content="2026-07-15">
  <link rel="lastmod" href="/page">
</head><body>
  <time datetime="2026-07-15">July 15, 2026</time>
  <p>Our 2026 Q2 results show 40% growth. Based on our 2025 Annual Report.</p>
  <footer>&copy; 2026 Acme Corp</footer>
</body></html>`;

const oldHtml = `<!DOCTYPE html>
<html><head>
  <title>Old Page</title>
</head><body>
  <p>Welcome to our site from 2022.</p>
  <footer>&copy; 2022 Old Corp</footer>
</body></html>`;

describe('analyzeFreshness', () => {
  it('should pass all freshness checks for recent page', () => {
    const result = analyzeFreshness(goodHtml);
    expect(result.passed).toBe(3);
    expect(result.score).toBe(4);
  });

  it('should fail most checks for old page', () => {
    const result = analyzeFreshness(oldHtml);
    expect(result.passed).toBeLessThanOrEqual(1);
    expect(result.score).toBeLessThan(2);
  });

  it('should return zero for null HTML', () => {
    const result = analyzeFreshness(null);
    expect(result.score).toBe(0);
    expect(result.total).toBe(3);
  });
});
