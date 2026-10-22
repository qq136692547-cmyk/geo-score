import { describe, it, expect } from 'vitest';
import { generateRobotsTxt, generateJsonLd } from '../src/lib/fixGenerator.js';
import { analyzeLlmstxt } from '../src/lib/analyzers/llmstxt.js';
import { analyzeAgentFriendly } from '../src/lib/analyzers/agentFriendly.js';
import { analyzePromptInjection } from '../src/lib/analyzers/promptInjection.js';
import { analyzeSchema } from '../src/lib/analyzers/schema.js';

/**
 * Regression locks for the A-tier fixes of 2026-10-22/23.
 * Each test encodes the acceptance criterion from review/ROADMAP-2026-10-22.md,
 * so the specific failure mode cannot come back silently.
 */

const site = (robotsTxt = '', pageHtml = '<html><head><title>Acme</title></head><body></body></html>') => ({
  url: 'https://acme.test/',
  raw: { robotsTxt, pageHtml },
});

describe('A6 — generated robots.txt must not unlock a site that closed itself', () => {
  it('returns a deliberate site-wide block unchanged instead of adding Allow: /', () => {
    const out = generateRobotsTxt(site('User-agent: *\nDisallow: /\n'));
    // The old implementation prefixed "User-agent: * / Allow: /" before the
    // preserved rules; equal-length Allow wins over Disallow in RFC 9309, so the
    // generated file opened a site that was closed on purpose.
    expect(out).not.toMatch(/^User-agent: \*\nAllow: \/$/m);
    expect(out).toContain('Disallow: /');
    expect(out).toMatch(/returned unchanged|did not add AI allowances|deliberate/i);
    // And it must not hand the AI crawlers an Allow either.
    expect(out).not.toMatch(/User-agent: GPTBot\nAllow: \//);
  });

  it('keeps a named AI-bot block blocked instead of re-allowing it', () => {
    const out = generateRobotsTxt(site('User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n'));
    expect(out).toMatch(/User-agent: GPTBot\nDisallow: \//);
    expect(out).not.toMatch(/User-agent: GPTBot\nAllow: \//);
    // Other crawlers still get an explicit allow.
    expect(out).toMatch(/User-agent: ClaudeBot\nAllow: \//);
  });

  it('still produces a usable file for an ordinary site', () => {
    const out = generateRobotsTxt(site('User-agent: *\nDisallow: /admin\n'));
    expect(out).toContain('User-agent: *');
    expect(out).toContain('Allow: /');
    expect(out).toContain('Disallow: /admin');
    expect(out).toMatch(/User-agent: PerplexityBot\nAllow: \//);
    expect(out).toContain('Sitemap: https://acme.test/sitemap.xml');
  });
});

describe('A7 — generated JSON-LD must pass our own Organization check', () => {
  it('emits a top-level Organization node (in @graph) that analyzeSchema accepts', () => {
    const snippet = generateJsonLd(site('', '<html><head><title>Acme</title><meta name="description" content="Acme builds things."></head><body></body></html>'));
    const parsed = JSON.parse(snippet.replace(/^<script[^>]*>\s*/, '').replace(/\s*<\/script>$/, ''));
    expect(parsed['@graph']).toBeTruthy();

    const schema = analyzeSchema(snippet);
    const org = schema.checks.find((c) => c.id === 'org');
    // The old output nested Organization under `publisher` on a WebSite root, so
    // a user who deployed our file still scored 0 here and lost 3 points.
    expect(org.passed).toBe(true);
  });
});

describe('A11 — an empty llms.txt must not earn free points', () => {
  it('scores an empty file at most 1 (was 5: exists 4 + length 1)', () => {
    const r = analyzeLlmstxt('');
    expect(r.score).toBeLessThanOrEqual(1);
  });

  it('scores a missing file 0', () => {
    expect(analyzeLlmstxt(null).score).toBe(0);
    expect(analyzeLlmstxt(undefined).score).toBe(0);
  });

  it('still scores a correctly written file 12/12', () => {
    const good = '# Acme\n\n> Acme builds things.\n\n## Docs\n- [Start](https://acme.test/start)\n\n## Company\n- [About](https://acme.test/about)\n';
    expect(analyzeLlmstxt(good).score).toBe(12);
  });

  it('does not pay the length point without structure', () => {
    const oneLiner = 'just some text with no structure at all';
    const r = analyzeLlmstxt(oneLiner);
    const length = r.checks.find((c) => c.id === 'length');
    expect(length.passed).toBe(false);
  });
});

describe('A12 — agentFriendliness rate-limit check must be achievable', () => {
  it('passes when the page documents a rate limit', () => {
    const html = '<html><body><h1>API</h1><p>Requests are capped at 60 per minute — see our rate limits.</p></body></html>';
    const r = analyzeAgentFriendly(html, '', '', '');
    expect(r.checks.find((c) => c.id === 'rate-limits').passed).toBe(true);
    // 324/324 sites scored 0 here while the check looked for a response header
    // name inside HTML.
    expect(r.score).toBeGreaterThan(0);
  });

  it('still fails when nothing about rate limits is documented', () => {
    const r = analyzeAgentFriendly('<html><body><h1>Plain page</h1></body></html>', '', '', '');
    expect(r.checks.find((c) => c.id === 'rate-limits').passed).toBe(false);
  });
});

describe('A8 — Tailwind responsive hiding is not hidden SEO text', () => {
  it('does not flag class="hidden md:block" with long text', () => {
    const html = `<html><body>
      <div class="hidden md:block">${'Navigation copy that is long enough to trip the fifty character threshold. '.repeat(3)}</div>
      <div class="sr-only">${'Screen reader description that is also long enough to trip the threshold. '.repeat(3)}</div>
      <h1>Visible</h1></body></html>`;
    const r = analyzePromptInjection(html);
    const hidden = r.checks.find((c) => c.id === 'hidden-text');
    expect(hidden.passed).toBe(true);
  });

  it('still flags inline display:none with substantive text', () => {
    const html = `<html><body><div style="display:none">${'Cloaked keyword text '.repeat(6)}</div><h1>Visible</h1></body></html>`;
    const r = analyzePromptInjection(html);
    expect(r.checks.find((c) => c.id === 'hidden-text').passed).toBe(false);
  });
});
