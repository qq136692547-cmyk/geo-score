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

const chineseTableHtml = `<!DOCTYPE html>
<html lang="zh-CN"><head>
  <meta name="author" content="爱看盘团队">
  <title>今日涨停板复盘</title>
</head><body>
  <h1>今日涨停板复盘</h1>
  <main><article>
    <p>今日A股涨停数量明显增加，市场情绪回暖。投资者需要结合成交额、板块持续性和个股位置判断行情强弱，不能只看单一指标。</p>
    <p>半导体、通信设备和医疗服务方向表现活跃。市场热度上升时仍需注意分化风险，尤其是高位股的成交变化和资金承接情况。</p>
    <table><tr><th>股票</th><th>涨跌幅</th></tr><tr><td>示例科技</td><td>10.00%</td></tr><tr><td>示例通信</td><td>9.98%</td></tr></table>
  </article></main>
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

  it('should not flag normal Chinese table content as keyword stuffing', () => {
    const result = analyzeNegativeSignals(chineseTableHtml);
    const stuffing = result.checks.find((check) => check.id === 'keyword-stuffing');
    expect(stuffing.passed).toBe(true);
  });
});
