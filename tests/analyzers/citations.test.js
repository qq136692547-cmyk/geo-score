import { describe, it, expect } from 'vitest';
import { analyzeCitations } from '../../src/lib/analyzers/citations.js';

const goodHtml = `<!DOCTYPE html>
<html lang="en"><head>
<title>Research</title>
<meta name="description" content="Original research on web standards">
<meta name="author" content="Jane Smith">
<meta property="article:published_time" content="2026-01-15">
<script type="application/ld+json">{"@type":"Article","headline":"Test"}</script>
</head><body>
  <header>Site header</header>
  <nav>Navigation</nav>
  <main>
  <article>
  <h1>Web Standards Research 2026</h1>
  <p>Published: January 15, 2026</p>
  <p>According to our 2026 survey, 67% of developers use semantic HTML. Revenue increased by $2.5M. This is a 3x improvement.</p>
  <p>"Semantic HTML is the foundation" — Jane Smith, W3C, 2026.</p>
  <blockquote cite="https://w3.org/standards">HTML5 provides better semantics.</blockquote>
  <p>Original research from our 2025 study shows significant improvement. However, there are limitations to this approach. Moreover, the trade-off between simplicity and completeness should be noted. Therefore, we recommend a balanced strategy. Furthermore, it should be noted that these findings have caveats.</p>
  <p>This paragraph contains a very long passage of text that exceeds one hundred and fifty words in total length. The purpose of this paragraph is to test the passage density check which looks for dense informational paragraphs that contain at least one hundred and fifty words. We need to fill this paragraph with enough meaningful content to pass the threshold. Semantic HTML is a cornerstone of modern web development providing structure and meaning to content. When developers use appropriate HTML elements they improve accessibility for screen reader users and enable search engines to better understand the content hierarchy. The benefits extend to AI systems as well since language models can parse well structured documents more effectively. In our research we found that sixty seven percent of surveyed developers already use semantic HTML elements in their daily work. This represents a significant increase from previous years. Additionally we observed that teams adopting semantic HTML reported fewer accessibility issues and better SEO outcomes overall. The data clearly supports the continued adoption of these practices across the industry worldwide.</p>
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
  <h2>What is semantic HTML?</h2>
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
  <section id="references">
    <h2>References</h2>
    <p>W3C HTML5 Specification, 2026.</p>
  </section>
  <p>Customer review: 5 stars — "Excellent tool!" Verified purchase.</p>
  </article>
  </main>
  <footer>Footer content</footer>
</body></html>`;

const minimalHtml = `<!DOCTYPE html><html><head><title>Page</title></head><body><p>Hello world</p></body></html>`;

describe('analyzeCitations', () => {
  it('should pass most citation checks for well-referenced page', () => {
    const result = analyzeCitations(goodHtml);
    expect(result.total).toBe(25);
    expect(result.score).toBe(8);
    expect(result.passed).toBeGreaterThanOrEqual(15);
  });

  it('should fail most checks for minimal page', () => {
    const result = analyzeCitations(minimalHtml);
    expect(result.total).toBe(25);
    expect(result.score).toBe(0);
  });

  it('should return zero for null HTML', () => {
    const result = analyzeCitations(null);
    expect(result.score).toBe(0);
    expect(result.total).toBe(25);
  });

  it('should detect blockquote elements', () => {
    const result = analyzeCitations('<blockquote>Quote</blockquote>');
    const check = result.checks.find(c => c.id === 'blockquote-count');
    expect(check.passed).toBe(true);
  });

  it('should detect Article JSON-LD schema', () => {
    const result = analyzeCitations('<script type="application/ld+json">{"@type":"Article"}</script>');
    const check = result.checks.find(c => c.id === 'article-schema');
    expect(check.passed).toBe(true);
  });

  it('should detect question-format headings', () => {
    const result = analyzeCitations('<h2>What is GEO?</h2><p>Answer</p>');
    const check = result.checks.find(c => c.id === 'question-headings');
    expect(check.passed).toBe(true);
  });

  it('should detect reference section', () => {
    const result = analyzeCitations('<section id="references"><h2>References</h2></section>');
    const check = result.checks.find(c => c.id === 'reference-section');
    expect(check.passed).toBe(true);
  });

  it('should detect nuance signals', () => {
    const result = analyzeCitations('<p>However, there are limitations to this approach.</p>');
    const check = result.checks.find(c => c.id === 'nuance-signals');
    expect(check.passed).toBe(true);
  });

  it('should detect social proof', () => {
    const result = analyzeCitations('<p>Rated 5 stars by users</p>');
    const check = result.checks.find(c => c.id === 'social-proof');
    expect(check.passed).toBe(true);
  });

  it('should detect ARIA landmarks', () => {
    const result = analyzeCitations('<header></header><nav></nav><main></main>');
    const check = result.checks.find(c => c.id === 'accessibility-aria');
    expect(check.passed).toBe(true);
  });

  it('should detect authoritative links', () => {
    const result = analyzeCitations('<a href="https://w3.org/standards">W3C</a><a href="https://mozilla.org/docs">Mozilla</a>');
    const check = result.checks.find(c => c.id === 'authoritative-links');
    expect(check.passed).toBe(true);
  });

  it('should detect logical connectives', () => {
    const result = analyzeCitations('<p>However, this is true. Moreover, the data supports it. Therefore, we conclude.</p>');
    const check = result.checks.find(c => c.id === 'connective-words');
    expect(check.passed).toBe(true);
  });
});
