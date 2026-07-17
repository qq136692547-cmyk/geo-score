import { describe, it, expect } from 'vitest';
import { analyzeNegativeSignals } from '../../src/lib/analyzers/negativeSignals.js';

const cleanHtml = `<!DOCTYPE html>
<html><head>
  <meta name="author" content="Jane Smith">
  <title>Full Article — Detailed Guide on GEO</title>
</head><body>
  <h1>Comprehensive Guide to Generative Engine Optimization</h1>
  <main>
    <article>
      <p>This is a thorough article with sufficient content to avoid thin content penalties. Generative Engine Optimization (GEO) is the practice of optimizing content specifically for AI-powered search engines and large language models. Unlike traditional SEO which targets keyword rankings on search engine results pages, GEO focuses on making content easily discoverable and citable by AI systems like ChatGPT, Claude, Gemini, and Perplexity.</p>
      <p>Key aspects of GEO include structured data markup that helps AI understand entity relationships, LLMs.txt files that provide direct instructions to AI crawlers, and proper robots.txt configuration that allows AI crawlers like OAI-SearchBot and CCBot to access your content. By implementing these techniques, websites can significantly improve their visibility in AI-generated responses and citations.</p>
      <p>The GEO Score system evaluates websites across twelve dimensions including AI crawlability, structured data quality, content quality, E-E-A-T signals, brand presence, citation readiness, and more. Each dimension contributes to a 100-point scoring scale that reflects how well a site is positioned for the AI-driven search landscape.</p>
    </article>
  </main>
  <nav><a href="/">Home</a><a href="/about">About</a></nav>
  <footer>&copy; 2026 Acme Corp</footer>
</body></html>`;

const spammyHtml = `<!DOCTYPE html>
<html><head>
  <title>Buy Now</title>
</head><body>
  <h1>Buy Now Cheap Deals</h1>
  <p>buy now buy now buy now buy now buy now buy now buy now cheap cheap cheap cheap cheap cheap cheap cheap cheap cheap deals deals deals deals deals deals deals Subscribe Subscribe Subscribe Subscribe Subscribe Subscribe Free Trial Free Trial Free Trial Free Trial Get Started Get Started Get Started Get Started Shop Now Shop Now Shop Now Shop Now Contact Us Contact Us Contact Us</p>
  <div class="modal overlay popup">Special offer!</div>
  <div class="modal overlay popup">Another popup!</div>
  <div class="modal overlay popup">Subscribe now!</div>
  <a href="#">empty</a>
  <a href="#">broken</a>
  <a href="#">dead</a>
  <a href="#">also dead</a>
  <a href="#">too many</a>
</body></html>`;

describe('analyzeNegativeSignals', () => {
  it('should find no negative signals for clean page', () => {
    const result = analyzeNegativeSignals(cleanHtml);
    expect(result.deductions.length).toBeLessThanOrEqual(2); // may flag boilerplate
    expect(result.passed).toBeGreaterThanOrEqual(6);
  });

  it('should find multiple negative signals for spammy page', () => {
    const result = analyzeNegativeSignals(spammyHtml);
    expect(result.deductions.length).toBeGreaterThanOrEqual(3);
    expect(result.passed).toBeLessThanOrEqual(4);
  });

  it('should return zero score for null HTML', () => {
    const result = analyzeNegativeSignals(null);
    expect(result.score).toBe(0);
    expect(result.total).toBe(8);
  });
});
