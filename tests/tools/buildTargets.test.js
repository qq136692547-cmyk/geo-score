import { describe, it, expect } from 'vitest';
import {
  HEADER,
  pickTopDefect,
  buildEvidence,
  buildRow,
  buildMarkdown,
  readHosts,
  parseCsv,
  toCsvLine,
  robotsEvidenceLine,
  llmsEvidenceLine,
  normalizeHost,
} from '../../tools/build-targets.mjs';

/**
 * Fixtures are hand-written objects shaped exactly like the analyzer output, so
 * these tests never touch the network and never depend on a live site. The
 * shapes are copied from src/lib/analyzers/{robots,llmstxt,schema}.js — see the
 * comments on each fixture for the detail that matters.
 */

// --- dimension builders -----------------------------------------------------

/** aiCrawlability as analyzeRobots() emits it: 20 checks, id/label/passed/weight. */
function crawlability(blockedIds = [], passedIds = ['claudebot']) {
  const labels = {
    gptbot: 'GPTBot (OpenAI/ChatGPT)',
    'oai-searchbot': 'OAI-SearchBot (OpenAI Search)',
    claudebot: 'ClaudeBot (Anthropic/Claude)',
    perplexity: 'PerplexityBot (Perplexity)',
    ccbot: 'CCBot (Common Crawl)',
  };
  const checks = [
    ...blockedIds.map((id) => ({ id, label: labels[id], passed: false, weight: id === 'ccbot' ? 2 : 3 })),
    ...passedIds.map((id) => ({ id, label: labels[id], passed: true, weight: 3 })),
  ];
  const earned = checks.filter((c) => c.passed).reduce((s, c) => s + c.weight, 0);
  const max = checks.reduce((s, c) => s + c.weight, 0);
  return { score: Math.round((earned / max) * 12), maxScore: 12, checks };
}

/**
 * aiGuidance as analyzeLlmstxt() emits it when /llms.txt is MISSING. The
 * analyzer pushes exists:false (weight 1) AND structure:false (weight 4) in that
 * branch, so the heaviest failure is 'structure', not 'exists'. That is why
 * evidence routing keys off the dimension and not the check id.
 */
function guidanceMissing() {
  return {
    score: 0,
    maxScore: 12,
    checks: [
      { id: 'exists', label: 'llms.txt exists at root', passed: false, weight: 1 },
      { id: 'structure', label: 'Has H1 + blockquote structure', passed: false, weight: 4 },
      { id: 'areas', label: 'Has 2+ area sections', passed: false, weight: 3 },
      { id: 'links', label: 'Has descriptive links', passed: false, weight: 3 },
      { id: 'length', label: 'Under 200 lines', passed: false, weight: 1 },
    ],
  };
}

/** aiGuidance for a well-formed llms.txt. */
function guidanceOk() {
  return {
    score: 12,
    maxScore: 12,
    checks: [
      { id: 'exists', label: 'llms.txt exists at root', passed: true, weight: 1 },
      { id: 'structure', label: 'Has H1 + blockquote structure', passed: true, weight: 4 },
      { id: 'areas', label: 'Has 2 area section(s) (need 2+)', passed: true, weight: 3 },
      { id: 'links', label: 'Has descriptive links', passed: true, weight: 3 },
      { id: 'length', label: 'Under 200 lines (20)', passed: true, weight: 1 },
    ],
  };
}

/** structuredData as analyzeSchema() emits it. */
function schemaWithGaps() {
  return {
    score: 3,
    maxScore: 14,
    checks: [
      { id: 'org', label: 'Organization schema present', passed: true, weight: 3 },
      { id: 'article', label: 'Article schema on blog posts', passed: false, weight: 3 },
      { id: 'faq', label: 'FAQPage schema on Q&A content', passed: false, weight: 3 },
      { id: 'howto', label: 'HowTo schema present', passed: false, weight: 2 },
      { id: 'props', label: 'Avg 2 properties per schema (need 5+)', passed: false, weight: 3 },
    ],
  };
}

/** A clean pass across the dimensions we assert on. */
function allPassing() {
  return {
    aiCrawlability: crawlability([], ['gptbot', 'claudebot']),
    aiGuidance: guidanceOk(),
    structuredData: {
      score: 14,
      maxScore: 14,
      checks: [{ id: 'org', label: 'Organization schema present', passed: true, weight: 3 }],
    },
  };
}

const GPTBOT_ROBOTS = [
  '# robots.txt for example-shop.test',
  'User-agent: *',
  'Allow: /',
  '',
  'User-agent: GPTBot',
  'Disallow: /',
  '',
  'Sitemap: https://example-shop.test/sitemap.xml',
].join('\n');

// --- pickTopDefect ---------------------------------------------------------

describe('pickTopDefect — which gap goes in the email', () => {
  it('returns the heaviest failing check, with the dimension it came from', () => {
    const top = pickTopDefect({ aiCrawlability: crawlability(['gptbot']) });
    expect(top).toEqual({
      id: 'gptbot',
      label: 'GPTBot (OpenAI/ChatGPT)',
      weight: 3,
      dimension: 'aiCrawlability',
    });
  });

  it('a crawler block outranks a HEAVIER llms.txt failure — the block is the hook', () => {
    // This is the whole reason the ordering is not plain weight. The analyzer
    // prices llms.txt structure at 4 and a tier-1 crawler at 3, so weight would
    // put "your llms.txt has no H1" in the email. Nobody clicks that. "Your
    // robots.txt blocks GPTBot" is verifiable in one click, counter-intuitive
    // and expensive, so crawlability is tier 0 and wins regardless of weight.
    const top = pickTopDefect({
      aiCrawlability: crawlability(['gptbot']),
      aiGuidance: guidanceMissing(),
    });
    expect(top.id).toBe('gptbot');
    expect(top.weight).toBe(3);
    expect(top.dimension).toBe('aiCrawlability');
  });

  it('a crawler block also outranks a heavier defect outside the priority ladder', () => {
    // Synthetic weight-4 contentQuality check: no such weight exists today, but
    // it pins the rule that tier 0 beats any weight from tier 3.
    const top = pickTopDefect({
      aiCrawlability: crawlability(['gptbot']),
      contentQuality: {
        score: 0,
        maxScore: 12,
        checks: [{ id: 'wordcount', label: 'Content 120 words (need 600+)', passed: false, weight: 4 }],
      },
      structuredData: schemaWithGaps(),
    });
    expect(top.id).toBe('gptbot');
  });

  it('orders the lower tiers: llms.txt gap > schema gap > everything else', () => {
    const other = {
      freshness: {
        score: 0,
        maxScore: 4,
        checks: [{ id: 'recent-content', label: 'Content references recent dates', passed: false, weight: 1.5 }],
      },
    };
    expect(pickTopDefect(other).dimension).toBe('freshness');

    const withSchema = { ...other, structuredData: schemaWithGaps() };
    expect(pickTopDefect(withSchema).dimension).toBe('structuredData');

    const withLlms = { ...withSchema, aiGuidance: guidanceMissing() };
    expect(pickTopDefect(withLlms).dimension).toBe('aiGuidance');
  });

  it('inside the crawler tier, the heavier check wins', () => {
    // ccbot is weight 2 and comes first in the analyzer's check list; gptbot is
    // weight 3. Weight has to beat declaration order.
    const top = pickTopDefect({ aiCrawlability: crawlability(['ccbot', 'gptbot']) });
    expect(top.id).toBe('gptbot');
    expect(top.weight).toBe(3);
  });

  it('ignores checks that passed', () => {
    const top = pickTopDefect({ aiCrawlability: crawlability([], ['gptbot', 'claudebot']) });
    expect(top).toBeNull();
  });

  it('returns null when every dimension is clean', () => {
    expect(pickTopDefect(allPassing())).toBeNull();
  });

  it('returns null for missing or malformed input instead of throwing', () => {
    expect(pickTopDefect(null)).toBeNull();
    expect(pickTopDefect({ aiCrawlability: {} })).toBeNull();
    expect(pickTopDefect({ aiCrawlability: { checks: 'nope' } })).toBeNull();
  });

  it('crawlability still wins when the weights are equal', () => {
    // gptbot (3) and article (3) weigh the same, so this is a pure tier test:
    // tier 0 against tier 2.
    const top = pickTopDefect({
      aiCrawlability: crawlability(['gptbot']),
      structuredData: schemaWithGaps(),
    });
    expect(top.id).toBe('gptbot');
  });
});

// --- buildEvidence: robots -------------------------------------------------

describe('buildEvidence — blocked crawler', () => {
  it('points at robots.txt and quotes the real User-agent + Disallow lines', () => {
    const top = pickTopDefect({ aiCrawlability: crawlability(['gptbot']) });
    const ev = buildEvidence('example-shop.test', top, { robotsTxt: GPTBOT_ROBOTS });

    expect(ev.evidenceUrl).toBe('https://example-shop.test/robots.txt');
    expect(ev.evidenceLine).toBe('User-agent: GPTBot Disallow: /');
    // The quote has to be findable in the file we actually fetched.
    expect(GPTBOT_ROBOTS).toContain('User-agent: GPTBot');
    expect(GPTBOT_ROBOTS).toContain('Disallow: /');
  });

  it('never returns more than one line', () => {
    const top = pickTopDefect({ aiCrawlability: crawlability(['gptbot']) });
    const ev = buildEvidence('example-shop.test', top, { robotsTxt: GPTBOT_ROBOTS });
    expect(ev.evidenceLine).not.toContain('\n');
    expect(ev.evidenceLine.split('\n')).toHaveLength(1);
  });

  it('does not match a crawler name that only appears in a comment', () => {
    // A note saying "GPTBot is welcome" must not be quoted as evidence that
    // GPTBot is blocked.
    const txt = ['# we like GPTBot', 'User-agent: *', 'Allow: /'].join('\n');
    expect(robotsEvidenceLine(txt, 'gptbot')).toBe('unknown');
  });

  it('does not quote the wildcard group as if it were about GPTBot', () => {
    // Real case: `User-agent: *` + `Disallow: /` blocks GPTBot under RFC 9309,
    // but no line in the file names GPTBot. There is nothing truthful to quote
    // for that bot, so the line is 'unknown' rather than a paraphrase.
    const txt = ['User-agent: *', 'Disallow: /'].join('\n');
    expect(robotsEvidenceLine(txt, 'gptbot')).toBe('unknown');
  });

  it('is unknown when robotsTxt was not captured — it is never invented', () => {
    // THE rule this file exists to protect. The audit says GPTBot is blocked
    // (say, a transient fetch failure lost the body); without the body there is
    // no line to quote, so we say so.
    const top = pickTopDefect({ aiCrawlability: crawlability(['gptbot']) });
    for (const raw of [{ robotsTxt: null }, {}, { robotsTxt: '' }, { robotsTxt: 42 }]) {
      const ev = buildEvidence('example-shop.test', top, raw);
      expect(ev.evidenceUrl).toBe('https://example-shop.test/robots.txt');
      expect(ev.evidenceLine).toBe('unknown');
    }
  });

  it('is unknown for a crawler id the analyzer does not know', () => {
    expect(robotsEvidenceLine(GPTBOT_ROBOTS, 'made-up-bot')).toBe('unknown');
  });

  it('matches the crawler name case-insensitively, as robots.txt matching is', () => {
    const txt = ['user-agent: gptbot', 'disallow: /'].join('\n');
    expect(robotsEvidenceLine(txt, 'gptbot')).toBe('user-agent: gptbot disallow: /');
  });
});

// --- buildEvidence: llms.txt ----------------------------------------------

describe('buildEvidence — missing llms.txt', () => {
  it('points at /llms.txt and states the 404 we observed', () => {
    const top = pickTopDefect({
      aiCrawlability: crawlability([], ['gptbot']),
      aiGuidance: guidanceMissing(),
    });
    expect(top.id).toBe('structure'); // weight 4 beats exists (1)

    const ev = buildEvidence('example-shop.test', top, { llmsTxt: null });
    expect(ev.evidenceUrl).toBe('https://example-shop.test/llms.txt');
    expect(ev.evidenceLine).toBe('GET /llms.txt -> 404');
  });

  it('does not claim 404 when the file exists but is malformed', () => {
    // The fetch returned a body, so a 404 in the email would be false. The
    // topDefect label already says what is wrong with it.
    const ev = buildEvidence('example-shop.test',
      { id: 'structure', label: 'Has H1 + blockquote structure', weight: 4, dimension: 'aiGuidance' },
      { llmsTxt: 'just some text, no heading' });
    expect(ev.evidenceUrl).toBe('https://example-shop.test/llms.txt');
    expect(ev.evidenceLine).toBe('unknown');
  });

  it('llmsEvidenceLine treats null, undefined and blank as missing', () => {
    expect(llmsEvidenceLine(null)).toBe('GET /llms.txt -> 404');
    expect(llmsEvidenceLine(undefined)).toBe('GET /llms.txt -> 404');
    expect(llmsEvidenceLine('   ')).toBe('GET /llms.txt -> 404');
    expect(llmsEvidenceLine('# Title\n\n> blurb')).toBe('unknown');
  });
});

// --- buildEvidence: the rest ----------------------------------------------

describe('buildEvidence — every other defect', () => {
  it('sends schema gaps to the homepage', () => {
    const top = pickTopDefect({ structuredData: schemaWithGaps() });
    const ev = buildEvidence('example-shop.test', top, {});
    expect(ev.evidenceUrl).toBe('https://example-shop.test/');
    expect(ev.evidenceLine).toBe('unknown');
  });

  it('falls back to the homepage for an unknown dimension', () => {
    const ev = buildEvidence('example-shop.test',
      { id: 'whatever', label: 'Some other gap', weight: 2, dimension: 'freshness' }, {});
    expect(ev.evidenceUrl).toBe('https://example-shop.test/');
    expect(ev.evidenceLine).toBe('unknown');
  });

  it('produces a homepage URL and no claim when nothing failed', () => {
    const ev = buildEvidence('example-shop.test', pickTopDefect(allPassing()), {});
    expect(ev.evidenceUrl).toBe('https://example-shop.test/');
    expect(ev.evidenceLine).toBe('unknown');
  });
});

// --- buildRow -------------------------------------------------------------

describe('buildRow — the CSV record', () => {
  it('fills the fixed column order', () => {
    const result = {
      score: 41,
      level: 'Basic',
      dimensions: {
        aiCrawlability: crawlability(['gptbot', 'ccbot']),
        aiGuidance: guidanceOk(),
      },
      raw: { robotsTxt: GPTBOT_ROBOTS, llmsTxt: '# T\n\n> b' },
    };
    const row = buildRow('example-shop.test', result, null);

    expect(row).toHaveLength(HEADER.length);
    expect(row[0]).toBe('example-shop.test');
    expect(row[1]).toBe('1');
    expect(row[2]).toBe(41);
    expect(row[3]).toBe('Basic');
    expect(row[4]).toBe('1'); // hasLlmsTxt
    expect(row[5]).toBe('1'); // robotsBlocksAnyAi
    expect(row[6]).toBe('1'); // robotsBlocksGptbot
    expect(row[7]).toBe('gptbot;ccbot'); // blockedCrawlers, analyzer order
    expect(row[8]).toBe(2); // blockedCount — the number the email quotes
    expect(row[9]).toBe('GPTBot (OpenAI/ChatGPT)');
    expect(row[10]).toBe(3);
    expect(row[11]).toBe('https://example-shop.test/robots.txt');
    expect(row[12]).toBe('User-agent: GPTBot Disallow: /');
    expect(row[13]).toBe('');
  });

  it('claims nothing when the audit failed', () => {
    const row = buildRow('dead.test', null, new Error('Could not fetch https://dead.test/'));
    expect(row).toHaveLength(HEADER.length);
    expect(row[1]).toBe('0');
    expect(row[12]).toBe('unknown');
    expect(row[13]).toContain('Could not fetch');
    // Nothing that could be pasted into an email as a finding.
    expect(row[9]).toBe('');
    expect(row[11]).toBe('');
  });

  it('keeps score 0 as 0 rather than blank', () => {
    const row = buildRow('zero.test', {
      score: 0,
      level: 'Critical',
      dimensions: {},
      raw: {},
    }, null);
    expect(row[2]).toBe(0);
  });
});

// --- CSV plumbing ---------------------------------------------------------

describe('CSV in and out', () => {
  it('reads a one-column host file — the shape of a candidate list', () => {
    // run-audit.mjs's parser ends with `r.length > 1` and would return nothing
    // here. That is the whole reason this file has its own parser.
    expect(readHosts('host\ngeoscore.help\nstripe.com\nlinear.app\n')).toEqual([
      'geoscore.help', 'stripe.com', 'linear.app',
    ]);
  });

  it('accepts hosts with a scheme, path or trailing slash and dedupes', () => {
    expect(readHosts('https://Shop.example.com/products/x\nshop.example.com\nshop.example.com/\n')).toEqual([
      'shop.example.com',
    ]);
  });

  it('skips a header row in any case and blank lines', () => {
    expect(readHosts('Host\r\n\r\nshop.example.com\r\n')).toEqual(['shop.example.com']);
  });

  it('ignores extra columns', () => {
    expect(readHosts('host,notes,email\na.test,looks good,x@y.z\n')).toEqual(['a.test']);
  });

  it('normalizeHost strips only the scheme, path and trailing dot', () => {
    expect(normalizeHost('  HTTPS://WWW.Example.COM/a?b=1  ')).toBe('www.example.com');
    expect(normalizeHost('example.com.')).toBe('example.com');
    expect(normalizeHost('')).toBe('');
  });

  it('escapes commas, quotes and newlines', () => {
    expect(toCsvLine(['a', 'b,c', 'say "hi"', 'line\nbreak']))
      .toBe('a,"b,c","say ""hi""","line\nbreak"');
  });

  it('round-trips a row with a quoted comma', () => {
    const rows = parseCsv('host,topDefect\na.test,"GPTBot (OpenAI, ChatGPT)"\n');
    expect(rows[1][1]).toBe('GPTBot (OpenAI, ChatGPT)');
  });
});

// --- markdown report ------------------------------------------------------

describe('buildMarkdown — the table a human reads', () => {
  const okRow = (host, score, hasLlms, blockedAny, blockedCount = 0) => {
    const row = new Array(HEADER.length).fill('');
    row[0] = host; row[1] = '1'; row[2] = String(score);
    row[4] = hasLlms; row[5] = blockedAny;
    row[7] = blockedCount > 0 ? 'gptbot' : '';
    row[8] = String(blockedCount);
    row[9] = 'GPTBot (OpenAI/ChatGPT)';
    row[11] = 'https://' + host + '/robots.txt';
    return row;
  };
  const failRow = (host) => {
    const row = new Array(HEADER.length).fill('');
    row[0] = host; row[1] = '0'; row[12] = 'unknown';
    return row;
  };

  it('prints the four statistics above a four-column table', () => {
    const md = buildMarkdown([
      okRow('a.test', 40, '1', '1', 3),
      okRow('b.test', 60, '0', '0', 0),
      failRow('c.test'),
    ]);
    const lines = md.split('\n');
    expect(lines[0]).toContain('3 host(s)');
    expect(lines[2]).toContain('audited ok 2/3');
    expect(lines[2]).toContain('avg score 50.0');
    expect(lines[2]).toContain('blocked by >=1 AI crawler 50% (1/2)');
    expect(lines[2]).toContain('avg crawlers blocked 1.5');
    expect(lines[2]).toContain('missing /llms.txt 50% (1/2)');
    expect(md).toContain('| host | score | topDefect | evidenceUrl |');
    expect(md).toContain('| a.test | 40 | GPTBot (OpenAI/ChatGPT) | https://a.test/robots.txt |');
    // A host we could not reach must not look like a clean bill of health.
    expect(md).toContain('| c.test |  | (audit failed) |  |');
  });

  it('does not divide by zero when every audit failed', () => {
    const md = buildMarkdown([failRow('c.test')]);
    expect(md).toContain('audited ok 0/1');
    expect(md).toContain('avg score 0.0');
    expect(md).toContain('n/a');
  });
});

// --- the English-only contract --------------------------------------------

/**
 * topDefect is pasted verbatim into an English cold email, so it must never
 * come out Chinese. That is not obvious from the code: several analyzer labels
 * interpolate page content, and a store with a Chinese <title> can carry Chinese
 * into a label. This block runs the REAL analyzers (no fixtures, no network)
 * over a Chinese-language page and asserts the contract holds — the guard is
 * here rather than in the analyzers because this file is what puts a label in
 * front of a prospect.
 *
 * If this test ever fails, the fix belongs in the analyzer: either make the
 * label static or drop the interpolated page text from the failing path.
 */
describe('topDefect is always ASCII English, even for a Chinese-language site', () => {
  const ZH_HTML = '<html lang="zh-CN"><head><title>小美的店 | 手工饰品</title>'
    + '<meta property="og:site_name" content="小美的店">'
    + '<meta name="description" content="手工饰品">'
    + '</head><body><h1>手工饰品</h1>'
    + '<p>我们卖手工饰品，价格便宜，欢迎选购。我们的产品很好，质量不错，发货很快。</p>'
    + '<a href="/about">关于我们</a><a href="/contact">联系</a></body></html>';

  async function zhDimensions() {
    const { analyzeRobots } = await import('../../src/lib/analyzers/robots.js');
    const { analyzeLlmstxt } = await import('../../src/lib/analyzers/llmstxt.js');
    const { analyzeSchema } = await import('../../src/lib/analyzers/schema.js');
    const { analyzeMeta } = await import('../../src/lib/analyzers/meta.js');
    const { analyzeContent } = await import('../../src/lib/analyzers/content.js');
    const { analyzeEeat } = await import('../../src/lib/analyzers/eeat.js');
    const { analyzeBrand } = await import('../../src/lib/analyzers/brand.js');
    const { analyzeCitations } = await import('../../src/lib/analyzers/citations.js');
    const { analyzeDiscovery } = await import('../../src/lib/analyzers/discovery.js');
    const { analyzeAgentFriendly } = await import('../../src/lib/analyzers/agentFriendly.js');
    const { analyzeFreshness } = await import('../../src/lib/analyzers/freshness.js');

    const schema = analyzeSchema(ZH_HTML);
    return {
      aiCrawlability: analyzeRobots('User-agent: *\nDisallow: /'),
      aiGuidance: analyzeLlmstxt(null),
      structuredData: schema,
      metaSocial: analyzeMeta(ZH_HTML),
      contentQuality: analyzeContent(ZH_HTML),
      eeat: analyzeEeat(ZH_HTML, schema, {}),
      brandEntity: analyzeBrand(ZH_HTML, schema),
      citationReadiness: analyzeCitations(ZH_HTML),
      discoveryEndpoints: analyzeDiscovery(null, null, null),
      agentFriendliness: analyzeAgentFriendly(ZH_HTML, null, null, null),
      freshness: analyzeFreshness(ZH_HTML),
    };
  }

  it('produces a pure-ASCII label for the worst defect', async () => {
    const dims = await zhDimensions();
    const top = pickTopDefect(dims);
    expect(top).not.toBeNull();
    // eslint-disable-next-line no-control-regex
    expect(top.label).toMatch(/^[\x00-\x7F]+$/);
  });

  it('keeps every failing label ASCII, not just the winner', async () => {
    const dims = await zhDimensions();
    const failing = Object.values(dims)
      .flatMap((d) => (Array.isArray(d.checks) ? d.checks : []))
      .filter((c) => c.passed === false)
      .map((c) => c.label);
    expect(failing.length).toBeGreaterThan(0);
    // eslint-disable-next-line no-control-regex
    expect(failing.filter((l) => /[^\x00-\x7F]/.test(l))).toEqual([]);
  });

  it('only carries the page brand name on the passing side, where it cannot win', async () => {
    // 'Brand name detected (小美的店)' is the one label that does embed Chinese.
    // It only appears when the brand name was found, i.e. when the check passed,
    // and pickTopDefect ignores passing checks — which is why the contract holds.
    const dims = await zhDimensions();
    const brandCheck = dims.brandEntity.checks.find((c) => c.id === 'brand-consistent');
    expect(brandCheck.label).toContain('小美的店');
    expect(brandCheck.passed).toBe(true);
    expect(pickTopDefect({ brandEntity: dims.brandEntity }).id).not.toBe('brand-consistent');
  });
});
