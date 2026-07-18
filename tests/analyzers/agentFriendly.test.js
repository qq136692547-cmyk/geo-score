import { describe, it, expect } from 'vitest';
import { analyzeAgentFriendly } from '../../src/lib/analyzers/agentFriendly.js';

const goodHtml = `<!DOCTYPE html>
<html><head>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite"}</script>
</head><body>
  <a href="/api/docs">API Documentation</a>
  <a href="/sitemap.xml">Sitemap</a>
  <p>X-RateLimit-Remaining: 100</p>
  <p>Our REST API uses GraphQL endpoints.</p>
</body></html>`;

const minimalHtml = `<!DOCTYPE html><html><head><title>Page</title></head><body><p>Hello</p></body></html>`;

describe('analyzeAgentFriendly', () => {
  it('should pass all agent-friendliness checks', () => {
    const result = analyzeAgentFriendly(goodHtml);
    expect(result.passed).toBe(4);
    expect(result.score).toBe(4);
  });

  it('should fail most checks for minimal page', () => {
    const result = analyzeAgentFriendly(minimalHtml);
    expect(result.passed).toBe(0);
    expect(result.score).toBe(0);
  });

  it('should return zero for null HTML', () => {
    const result = analyzeAgentFriendly(null);
    expect(result.score).toBe(0);
    expect(result.total).toBe(4);
  });
});
