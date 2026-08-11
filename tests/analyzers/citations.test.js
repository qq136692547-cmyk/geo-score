import { describe, it, expect } from 'vitest';
import { analyzeCitations } from '../../src/lib/analyzers/citations.js';

const goodHtml = `<!DOCTYPE html>
<html lang="en"><head>
<title>Research</title>
<meta name="description" content="Original research on web standards">
<meta name="author" content="Jane Smith">
<meta property="article:published_time" content="2026-01-15">
</head><body>
  <article>
  <h1>Web Standards Research 2026</h1>
  <p>Published: January 15, 2026</p>
  <p>According to our 2026 survey, 67% of developers use semantic HTML. Revenue increased by $2.5M. This is a 3x improvement.</p>
  <p>"Semantic HTML is the foundation" — Jane Smith, W3C, 2026.</p>
  <blockquote cite="https://w3.org/standards">HTML5 provides better semantics.</blockquote>
  <p>Original research from our 2025 study shows significant improvement.</p>
  <a href="https://example.edu/research">Edu study</a>
  <a href="https://whitehouse.gov/report">Gov report</a>
  <a href="https://w3.org/standards">W3C</a>
  <a href="https://github.com/example">GitHub</a>
  <a href="/about">About</a>
  <a href="/blog/research">Research blog</a>
  <a href="/contact">Contact</a>
  <h2>Comparison: HTML4 vs HTML5</h2>
  <p>HTML5 is better than HTML4 for accessibility. Compared to HTML4, HTML5 provides 2x more semantic elements.</p>
  <h2>Case Study: Example Corp</h2>
  <p>For example, Example Corp saw a 45% improvement after adopting semantic HTML.</p>
  <h2>Definitions</h2>
  <p>Semantic HTML means using HTML tags to convey meaning.</p>
  <h2>Steps</h2>
  <ol>
    <li>Choose appropriate tags</li>
    <li>Validate your markup</li>
    <li>Test with screen readers</li>
  </ol>
  <table>
    <tr><th>Feature</th><th>HTML4</th><th>HTML5</th></tr>
    <tr><td>Semantic tags</td><td>5</td><td>30+</td></tr>
  </table>
  <img src="chart.png" alt="Bar chart showing 67% adoption rate of semantic HTML in 2026">
  <details>
    <summary>What is semantic HTML?</summary>
    <p>Using HTML elements to convey document meaning.</p>
  </details>
  <time datetime="2026-01-15">January 15, 2026</time>
  </article>
</body></html>`;

const minimalHtml = `<!DOCTYPE html><html><head><title>Page</title></head><body><p>Hello world</p></body></html>`;

describe('analyzeCitations', () => {
  it('should pass most citation checks for well-referenced page', () => {
    const result = analyzeCitations(goodHtml);
    expect(result.total).toBe(15);
    expect(result.score).toBe(8);
    expect(result.passed).toBeGreaterThanOrEqual(10);
  });

  it('should fail most checks for minimal page', () => {
    const result = analyzeCitations(minimalHtml);
    expect(result.total).toBe(15);
    expect(result.score).toBe(0);
  });

  it('should return zero for null HTML', () => {
    const result = analyzeCitations(null);
    expect(result.score).toBe(0);
    expect(result.total).toBe(15);
  });
});
