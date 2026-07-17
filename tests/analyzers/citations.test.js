import { describe, it, expect } from 'vitest';
import { analyzeCitations } from '../../src/lib/analyzers/citations.js';

const goodHtml = `<!DOCTYPE html>
<html><head><title>Research</title></head><body>
  <a href="https://example.edu/research">Edu study</a>
  <a href="https://whitehouse.gov/report">Gov report</a>
  <a href="https://w3.org/standards">W3C</a>
  <a href="https://github.com/example">GitHub</a>
  <p>According to our 2026 survey, 67% of developers use semantic HTML. Revenue increased by $2.5M.</p>
  <p>"Semantic HTML is the foundation" — Jane Smith, W3C, 2026.</p>
  <p>Original research from our 2025 study shows significant improvement.</p>
</body></html>`;

const minimalHtml = `<!DOCTYPE html><html><head><title>Page</title></head><body><p>Hello world</p></body></html>`;

describe('analyzeCitations', () => {
  it('should pass all citation checks for well-referenced page', () => {
    const result = analyzeCitations(goodHtml);
    expect(result.passed).toBe(5);
    expect(result.score).toBe(8);
  });

  it('should fail most checks for minimal page', () => {
    const result = analyzeCitations(minimalHtml);
    expect(result.passed).toBe(0);
    expect(result.score).toBe(0);
  });

  it('should return zero for null HTML', () => {
    const result = analyzeCitations(null);
    expect(result.score).toBe(0);
    expect(result.total).toBe(5);
  });
});
