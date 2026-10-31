/**
 * tools/diagnose.mjs — the paste-ready diagnosis paragraph.
 *
 * This text goes straight into a Fiverr message to a stranger who asked for a
 * quote, so the failure modes are not cosmetic:
 *   - quoting an "evidence line" that does not exist would be inventing a fact
 *     about someone else's website;
 *   - promising a citation would create a dispute on a $49 order;
 *   - a paragraph that is too long does not get read at all.
 *
 * Ranking comes from tools/build-targets.mjs, so these fixtures also pin the
 * sales priority: a blocked crawler must outrank a heavier-but-duller defect.
 * Everything here is offline — no fixture touches the network.
 */
import { describe, it, expect } from 'vitest';
import { buildDiagnosis, pickDefects, maskUnsellable, unfetchableNotice } from '../../tools/diagnose.mjs';

/** A page whose robots.txt blocks ClaudeBot at the root, and has no llms.txt. */
const BLOCKED = {
  url: 'https://example.com/',
  score: 44,
  level: 'Critical',
  dimensions: {
    aiCrawlability: {
      score: 9, maxScore: 12, checks: [
        { id: 'gptbot', label: 'GPTBot (OpenAI/ChatGPT)', passed: true, weight: 1 },
        { id: 'claudebot', label: 'ClaudeBot (Anthropic/Claude)', passed: false, weight: 3 },
      ],
    },
    aiGuidance: {
      score: 0, maxScore: 12, checks: [
        { id: 'llms-txt-exists', label: 'llms.txt exists', passed: false, weight: 1 },
      ],
    },
    structuredData: {
      score: 0, maxScore: 14, checks: [
        { id: 'props', label: 'Product properties complete', passed: false, weight: 4 },
      ],
    },
    discoveryEndpoints: { score: 0, maxScore: 6, checks: [] },
    freshness: { score: 2, maxScore: 4, checks: [] },
  },
  raw: {
    robotsTxt: 'User-agent: *\nDisallow:\n\nUser-agent: ClaudeBot\nDisallow: /',
    llmsTxt: null,
  },
};

/** robots.txt was never captured — so there is no line to quote. */
const NO_ROBOTS_CAPTURED = {
  ...BLOCKED,
  raw: { robotsTxt: null, llmsTxt: null },
};

/** Nothing fails anywhere. */
const CLEAN = {
  url: 'https://clean.example/',
  score: 92,
  level: 'Excellent',
  dimensions: {
    aiCrawlability: { score: 12, maxScore: 12, checks: [{ id: 'gptbot', label: 'GPTBot', passed: true, weight: 1 }] },
    aiGuidance: { score: 12, maxScore: 12, checks: [{ id: 'llms-txt-exists', label: 'llms.txt exists', passed: true, weight: 1 }] },
    structuredData: { score: 14, maxScore: 14, checks: [{ id: 'props', label: 'Product properties', passed: true, weight: 4 }] },
  },
  raw: { robotsTxt: 'User-agent: *\nAllow: /', llmsTxt: '# Clean' },
};

const EN_PROMISES = /\bI guarantee\b|\bguaranteed\b|will improve|will rank|rank #1|will get you cited|ensures? (citations?|rankings?)/i;

/**
 * Modelled on the real geoscore.help run that exposed two bugs.
 *
 * citationReadiness measures 8/8 while carrying 14 failing checks — a
 * zero-cost failure. brandEntity is 6/8 with `about-page` failing, and its label
 * reads "About page link found". Both were promoted to "the first thing to fix"
 * on a 94/100 site, which is both wrong and unsellable: the $49 pack does not
 * touch either dimension.
 */
const HIGH_SCORER = {
  url: 'https://geoscore.help/',
  score: 94,
  level: 'Excellent',
  dimensions: {
    aiCrawlability: { score: 12, maxScore: 12, checks: [{ id: 'gptbot', label: 'GPTBot (OpenAI/ChatGPT)', passed: true, weight: 3 }] },
    aiGuidance: { score: 12, maxScore: 12, checks: [{ id: 'exists', label: 'llms.txt exists at root', passed: true, weight: 1 }] },
    structuredData: { score: 14, maxScore: 14, checks: [{ id: 'props', label: 'Avg 9 properties per schema (need 5+)', passed: true, weight: 3 }] },
    discoveryEndpoints: { score: 6, maxScore: 6, checks: [{ id: 'ai-txt', label: '.well-known/ai.txt endpoint', passed: true, weight: 2 }] },
    brandEntity: {
      score: 6, maxScore: 8, checks: [
        { id: 'about-page', label: 'About page link found', passed: false, weight: 2 },
      ],
    },
    citationReadiness: {
      score: 8, maxScore: 8, checks: [
        { id: 'quotes', label: 'Expert quotations with attribution', passed: false, weight: 2 },
        { id: 'cite-tags', label: 'Citation markup (cite/blockquote)', passed: false, weight: 1 },
      ],
    },
  },
  raw: { robotsTxt: 'User-agent: *\nAllow: /', llmsTxt: '# Fine' },
};

/** Sellable dimension that lost points, with a label phrased as a measurement. */
const PARTIAL_SCHEMA = {
  url: 'https://shop.example/',
  score: 61,
  level: 'Needs work',
  dimensions: {
    structuredData: {
      score: 6, maxScore: 14, checks: [
        { id: 'props', label: 'Avg 2 properties per schema (need 5+)', passed: false, weight: 3 },
        { id: 'org', label: 'Organization schema present', passed: true, weight: 3 },
      ],
    },
    citationReadiness: {
      score: 8, maxScore: 8, checks: [{ id: 'quotes', label: 'Expert quotations with attribution', passed: false, weight: 2 }],
    },
  },
  raw: { robotsTxt: 'User-agent: *\nAllow: /', llmsTxt: '# Shop' },
};

describe('pickDefects', () => {
  it('ranks a blocked crawler above a heavier structured-data defect', () => {
    const [first, second] = pickDefects(BLOCKED.dimensions, 2);
    expect(first.dimension).toBe('aiCrawlability');
    expect(first.id).toBe('claudebot');
    // weight 4 on structuredData loses to tier 0 on aiCrawlability
    expect(second.dimension).toBe('aiGuidance');
  });

  it('never returns the same defect twice', () => {
    const picked = pickDefects(BLOCKED.dimensions, 3);
    const ids = picked.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns nothing when every check passed', () => {
    expect(pickDefects(CLEAN.dimensions, 2)).toEqual([]);
  });
});

describe('buildDiagnosis — evidence', () => {
  it('quotes the real robots.txt rule when it was captured', () => {
    const text = buildDiagnosis(BLOCKED, { host: 'example.com' });
    expect(text).toContain('ClaudeBot');
    expect(text).toContain('https://example.com/robots.txt');
    expect(text).toContain('User-agent: ClaudeBot Disallow: /');
    expect(text).toContain('44/100');
  });

  it('does not invent a quoted rule when robots.txt was not captured', () => {
    const text = buildDiagnosis(NO_ROBOTS_CAPTURED, { host: 'example.com' });
    expect(text).toContain('https://example.com/robots.txt');
    // The URL is still the place to verify; the quote is not there to be made up.
    expect(text).not.toContain('the rule reads');
    expect(text).not.toContain('Disallow: /');
  });

  it('does not claim a 404 it never observed', () => {
    // The fetcher returns null for any 4xx (403, 429, 451), any 5xx, a timeout
    // and an empty 200 — so "404" would be a status we did not see, and the
    // merchant can disprove it by opening the URL.
    const text = buildDiagnosis(BLOCKED, { host: 'example.com' });
    expect(text).toContain('nothing came back from /llms.txt');
    expect(text).toContain('https://example.com/llms.txt');
    expect(text).not.toContain('404');
  });

  it('refuses to sell anything when the site has no defects', () => {
    const text = buildDiagnosis(CLEAN, { host: 'clean.example' });
    expect(text).toMatch(/should not take your \$49/i);
    expect(text).not.toMatch(/The first thing to fix/i);
    expect(text).not.toMatch(/Second:/);
  });

  it('returns an empty string when there is no result to diagnose', () => {
    expect(buildDiagnosis(null, { host: 'x.com' })).toBe('');
    expect(buildDiagnosis({ url: 'https://x.com/' }, { host: 'x.com' })).toBe('');
  });
});

describe('buildDiagnosis — honesty and length', () => {
  it('carries the no-promise sentence in English', () => {
    const text = buildDiagnosis(BLOCKED, { host: 'example.com' });
    expect(text).toMatch(/nobody can promise this gets you cited or ranked/i);
    expect(text).not.toMatch(EN_PROMISES);
  });

  it('carries the no-promise sentence in Chinese', () => {
    const text = buildDiagnosis(BLOCKED, { host: 'example.com', zh: true });
    expect(text).toContain('没有人能承诺');
    expect(text).not.toMatch(/保证你|一定能|必定/);
  });

  it('stays within a length a stranger will actually read', () => {
    const en = buildDiagnosis(BLOCKED, { host: 'example.com' });
    const words = en.trim().split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThanOrEqual(120);
    expect(words).toBeLessThanOrEqual(200);

    // Chinese has no word boundaries, so length is measured in characters.
    const zh = buildDiagnosis(BLOCKED, { host: 'example.com', zh: true });
    expect(zh.length).toBeGreaterThanOrEqual(150);
    expect(zh.length).toBeLessThanOrEqual(400);
  });

  it('names the files it would change, matching what actually failed', () => {
    const text = buildDiagnosis(BLOCKED, { host: 'example.com' });
    expect(text).toContain('robots.txt snippet');
    expect(text).toContain('llms.txt');
    // structuredData failed third, so it is not in the top two and must not be
    // offered as work to do.
    expect(text).not.toContain('Product JSON-LD');
  });
});

describe('maskUnsellable — only speak about gaps the pack can close', () => {
  it('silences a dimension that lost no points, even when checks inside it failed', () => {
    const masked = maskUnsellable(HIGH_SCORER.dimensions);
    // 8/8 with 14 failing checks: the failures cost nothing, so there is no gap.
    expect(masked.citationReadiness.checks.every((c) => c.passed)).toBe(true);
    expect(pickDefects(masked, 5).some((d) => d.dimension === 'citationReadiness')).toBe(false);
  });

  it('silences a dimension the $49 pack cannot change', () => {
    const masked = maskUnsellable(HIGH_SCORER.dimensions);
    // brandEntity really did lose 2 points — we still must not sell the fix.
    expect(HIGH_SCORER.dimensions.brandEntity.score).toBeLessThan(HIGH_SCORER.dimensions.brandEntity.maxScore);
    expect(pickDefects(masked, 5).some((d) => d.dimension === 'brandEntity')).toBe(false);
  });

  it('keeps a sellable dimension that genuinely lost points', () => {
    const picked = pickDefects(maskUnsellable(PARTIAL_SCHEMA.dimensions), 2);
    expect(picked.map((d) => d.dimension)).toEqual(['structuredData']);
  });

  it('does not mutate the caller\'s dimensions', () => {
    maskUnsellable(HIGH_SCORER.dimensions);
    expect(HIGH_SCORER.dimensions.citationReadiness.checks[0].passed).toBe(false);
    expect(HIGH_SCORER.dimensions.brandEntity.checks[0].passed).toBe(false);
  });
});

describe('buildDiagnosis — what a high scorer receives', () => {
  it('refuses the sale instead of inventing a defect on a 94/100 site', () => {
    const text = buildDiagnosis(HIGH_SCORER, { host: 'geoscore.help' });
    expect(text).toMatch(/should not take your \$49/i);
    expect(text).toContain('94/100');
    expect(text).not.toMatch(/The first thing to fix/i);
    // The exact string that inverted the truth on the live run.
    expect(text).not.toContain('About page link found');
  });

  it('says the same in Chinese', () => {
    const text = buildDiagnosis(HIGH_SCORER, { host: 'geoscore.help', zh: true });
    expect(text).toContain('这 49 美元我不该收');
    expect(text).not.toContain('About page link found');
  });
});

describe('buildDiagnosis — labels are quoted, never asserted', () => {
  it('quotes the measurement, not the pass-state label', () => {
    const text = buildDiagnosis(PARTIAL_SCHEMA, { host: 'shop.example' });
    // The gap is described in our words, with the number the check measured.
    expect(text).toMatch(/The first thing to fix: the structured data is too thin/);
    expect(text).toContain('2 properties per schema');
    // The label itself ("... (need 5+)") must not be pasted as the defect.
    expect(text).not.toMatch(/The first thing to fix: (Avg|Expert|About|Product properties)/);
  });

  it('does the same in Chinese, where a pasted English label would read worst', () => {
    const text = buildDiagnosis(PARTIAL_SCHEMA, { host: 'shop.example', zh: true });
    expect(text).toContain('结构化数据太薄');
    expect(text).toContain('只有 2 项属性');
    // No raw label may leak into a Chinese sentence.
    expect(text).not.toContain('properties per schema');
  });

  it('turns the length label into the real count, not a pass-state claim', () => {
    // Stripe's live run produced "measured: Under 200 lines (403)" — quoting a
    // label that says "under 200" next to a number that is over 200.
    const LONG_LLMS = {
      ...PARTIAL_SCHEMA,
      dimensions: {
        aiGuidance: {
          score: 11, maxScore: 12, checks: [
            { id: 'length', label: 'Under 200 lines (403)', passed: false, weight: 1 },
          ],
        },
      },
    };
    const text = buildDiagnosis(LONG_LLMS, { host: 'stripe.com' });
    expect(text).toContain('runs to 403 lines');
    expect(text).toContain('200-line limit');
    expect(text).not.toContain('Under 200 lines');
  });

  it('never names a positive-state label as the thing to fix', () => {
    // The real shape of the bug: `structure` fails, but its label reads
    // "Has H1 + blockquote structure" — pasting that after "the first thing to
    // fix:" tells the merchant their llms.txt is fine when it just failed.
    const POSITIVE_LABEL = {
      ...PARTIAL_SCHEMA,
      dimensions: {
        aiGuidance: {
          score: 9, maxScore: 12, checks: [
            { id: 'structure', label: 'Has H1 + blockquote structure', passed: false, weight: 4 },
          ],
        },
      },
    };
    const text = buildDiagnosis(POSITIVE_LABEL, { host: 'shop.example' });
    expect(text).toContain('it fails the H1 and blockquote structure check');
    expect(text).not.toContain('Has H1 + blockquote structure');
    expect(text).not.toMatch(/The first thing to fix: Has H1/);
  });

  it('never lets an Organization label stand in for a product-data gap', () => {
    // allbirds.com in the live run: `org` failed and outranked `props`, so the
    // paragraph offered a Product file while quoting "Organization schema
    // present" — insufficient and present in the same sentence.
    const STORE_WITH_TWO_GAPS = {
      ...PARTIAL_SCHEMA,
      dimensions: {
        structuredData: {
          score: 3, maxScore: 14, checks: [
            { id: 'org', label: 'Organization schema present', passed: false, weight: 3 },
            { id: 'props', label: 'Avg 2 properties per schema (need 5+)', passed: false, weight: 3 },
          ],
        },
      },
    };
    const picked = pickDefects(maskUnsellable(STORE_WITH_TWO_GAPS.dimensions), 2);
    expect(picked.map((d) => d.id)).toEqual(['props']);

    const text = buildDiagnosis(STORE_WITH_TWO_GAPS, { host: 'allbirds.com', zh: true });
    expect(text).toContain('结构化数据太薄');
    expect(text).not.toContain('Organization schema present');
  });
});

/**
 * Regressions for the defects an independent review found after the first
 * version shipped green. Each one produced a sentence a merchant could refute
 * in one click, which is worse than producing nothing.
 */
describe('regressions — sentences a merchant could refute', () => {
  it('reports a crawler blocked at the root even when rounding leaves the dimension at full marks', () => {
    // Blocking one weight-1 crawler out of twenty leaves aiCrawlability at
    // 12/12. A score-based filter therefore found no defect, and the refusal
    // letter told the merchant their crawler rules were clean while robots.txt
    // was blocking PetalBot at the root.
    const ROUNDED_AWAY = {
      url: 'https://shop.example/',
      score: 92,
      level: 'Excellent',
      dimensions: {
        aiCrawlability: {
          score: 12, maxScore: 12, checks: [
            { id: 'petalbot', label: 'PetalBot (Huawei)', passed: false, weight: 1 },
            { id: 'gptbot', label: 'GPTBot (OpenAI/ChatGPT)', passed: true, weight: 3 },
          ],
        },
        aiGuidance: { score: 12, maxScore: 12, checks: [{ id: 'exists', label: 'llms.txt exists at root', passed: true, weight: 1 }] },
        structuredData: { score: 14, maxScore: 14, checks: [{ id: 'props', label: 'Avg 9 properties per schema (need 5+)', passed: true, weight: 3 }] },
      },
      raw: { robotsTxt: 'User-agent: PetalBot\nDisallow: /', llmsTxt: '# Fine' },
    };
    const text = buildDiagnosis(ROUNDED_AWAY, { host: 'shop.example' });
    expect(text).toContain('PetalBot');
    expect(text).not.toMatch(/could not find a defect/i);
    // A named crawler must never print as a bare lowercase id.
    expect(text).not.toContain('blocks petalbot');
  });

  it('still reaches the llms.txt and schema gaps when every crawler is blocked', () => {
    // Twenty failing checks in one dimension used to eat the whole search
    // budget, so the message named robots.txt and nothing else.
    const allBlocked = [];
    for (let i = 0; i < 20; i++) {
      allBlocked.push({ id: 'bot' + i, label: 'Bot ' + i, passed: false, weight: 1 });
    }
    const WALL = {
      url: 'https://walled.example/',
      score: 30,
      level: 'Critical',
      dimensions: {
        aiCrawlability: { score: 0, maxScore: 12, checks: allBlocked },
        aiGuidance: { score: 0, maxScore: 12, checks: [{ id: 'exists', label: 'llms.txt exists at root', passed: false, weight: 1 }] },
        structuredData: { score: 0, maxScore: 14, checks: [{ id: 'props', label: 'Avg 0 properties per schema (need 5+)', passed: false, weight: 3 }] },
      },
      raw: { robotsTxt: 'User-agent: *\nDisallow: /', llmsTxt: null },
    };
    const picked = pickDefects(maskUnsellable(WALL.dimensions), 2);
    expect(picked.length).toBe(2);
    expect(picked[0].dimension).toBe('aiCrawlability');
    expect(picked[1].dimension).toBe('aiGuidance');

    const text = buildDiagnosis(WALL, { host: 'walled.example' });
    expect(text).toContain('robots.txt');
    expect(text).toContain('/llms.txt');
  });

  it('says there is no JSON-LD rather than calling zero properties thin', () => {
    const NO_SCHEMA = {
      url: 'https://nue.example/',
      score: 40,
      level: 'Critical',
      dimensions: {
        structuredData: { score: 0, maxScore: 14, checks: [{ id: 'props', label: 'Avg 0 properties per schema (need 5+)', passed: false, weight: 3 }] },
      },
      raw: { robotsTxt: 'User-agent: *\nAllow: /', llmsTxt: '# Fine' },
    };
    const text = buildDiagnosis(NO_SCHEMA, { host: 'nue.example' });
    expect(text).toContain('no readable JSON-LD');
    expect(text).not.toContain('0 properties per schema');
  });

  it('gets the singular right when exactly one other crawler is blocked', () => {
    const ONE_SIBLING = {
      url: 'https://two.example/',
      score: 80,
      level: 'Good',
      dimensions: {
        aiCrawlability: {
          score: 6, maxScore: 12, checks: [
            { id: 'claudebot', label: 'ClaudeBot', passed: false, weight: 3 },
            { id: 'amazonbot', label: 'Amazonbot', passed: false, weight: 1 },
          ],
        },
      },
      raw: { robotsTxt: 'User-agent: ClaudeBot\nDisallow: /', llmsTxt: '# Fine' },
    };
    const text = buildDiagnosis(ONE_SIBLING, { host: 'two.example' });
    expect(text).toContain('and one other AI crawler is blocked the same way');
    expect(text).not.toContain('1 other AI crawler');
  });

  it('never names a dimension the pack cannot fix, even when it is the only gap', () => {
    // The review's mutation test showed adding discoveryEndpoints back to the
    // sellable set broke no test at all. This pins it.
    const ENDPOINTS_ONLY = {
      url: 'https://api.example/',
      score: 88,
      level: 'Good',
      dimensions: {
        aiCrawlability: { score: 12, maxScore: 12, checks: [{ id: 'gptbot', label: 'GPTBot', passed: true, weight: 3 }] },
        aiGuidance: { score: 12, maxScore: 12, checks: [{ id: 'exists', label: 'llms.txt exists at root', passed: true, weight: 1 }] },
        structuredData: { score: 14, maxScore: 14, checks: [{ id: 'props', label: 'Avg 9 properties per schema (need 5+)', passed: true, weight: 3 }] },
        discoveryEndpoints: {
          score: 0, maxScore: 6, checks: [
            { id: 'ai-txt', label: '.well-known/ai.txt endpoint', passed: false, weight: 2 },
            { id: 'ai-summary', label: '/ai/summary.json endpoint', passed: false, weight: 2 },
          ],
        },
      },
      raw: { robotsTxt: 'User-agent: *\nAllow: /', llmsTxt: '# Fine' },
    };
    const text = buildDiagnosis(ENDPOINTS_ONLY, { host: 'api.example' });
    expect(text).not.toContain('ai.txt');
    expect(text).not.toContain('discoveryEndpoints');
    expect(text).toMatch(/should not take your \$49/i);
  });

  it('keeps the message inside the budget for a long host, and never drops the honesty line', () => {
    const LONG_HOST = 'a-very-long-subdomain.another-subdomain.some-shop.example.com';
    const zh = buildDiagnosis(BLOCKED, { host: LONG_HOST, zh: true });
    expect(zh.length).toBeLessThanOrEqual(400);
    // The no-promise sentence is the one thing that must survive trimming.
    expect(zh).toContain('没有人能承诺');

    const en = buildDiagnosis(BLOCKED, { host: LONG_HOST });
    const words = en.trim().split(/\s+/).filter(Boolean).length;
    expect(words).toBeLessThanOrEqual(200);
    expect(en).toContain('nobody can promise');
  });
});

describe('unfetchableNotice', () => {
  it('produces a refusal, not a guess, when the page cannot be fetched', () => {
    const text = unfetchableNotice('nytimes.com', new Error('Could not fetch'), false);
    expect(text).toContain('nytimes.com');
    expect(text).toContain('No diagnosis produced');
    expect(text).not.toMatch(/The first thing to fix/i);
  });

  it('says the same thing in Chinese', () => {
    const text = unfetchableNotice('nytimes.com', new Error('timeout'), true);
    expect(text).toContain('不生成诊断');
  });
});
