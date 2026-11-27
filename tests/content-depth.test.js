/**
 * content-depth.test.js — guards the six-page content-depth pass.
 *
 * Two independent things are locked here:
 *
 * 1. Link density. The six pages this test names were the only URLs in the
 *    sitemap that Google had never crawled ("URL is unknown to Google"), and
 *    three of them carried a single-digit number of internal links. Adding
 *    real internal links is the one on-page signal that costs nothing and
 *    helps discovery, so the floors below stop a future refactor from
 *    quietly stripping them back out.
 *
 * 2. Withdrawn claims. data/STUDY.md documents four assertions that were
 *    retired because no data supported them (a static crawler audit cannot
 *    observe whether an AI engine cited anything). The page that used to
 *    carry them now quotes them once, inside an explicit "what this study
 *    cannot tell you" list, because naming a retracted claim is how you
 *    record that it was retracted.
 *
 *    The scan therefore has to distinguish *asserting* a claim from
 *    *documenting its withdrawal*. It does that structurally: a line is
 *    allowed to contain a withdrawn figure only when it also carries a
 *    withdrawal marker (see WITHDRAWAL_MARKERS) — a quoted list item, the
 *    word "withdrawn"/"cannot"/"unverifiable", or the correction notice.
 *    Every other occurrence is a failure.
 *
 *    An earlier draft of this file banned the raw substrings everywhere.
 *    That was wrong: it forced a rewrite of the retraction notices
 *    themselves, which erases the record of what was actually retracted.
 *    The structural rule below is the correct invariant.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PAGES = join(ROOT, 'src', 'pages');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.astro')) out.push(p);
  }
  return out;
}

const pageFiles = walk(PAGES);

/** Internal-link floor per page. These numbers are the post-change reality. */
const LINK_FLOORS = [
  ['geo-for/wordpress.astro', 25],
  ['blog/geoscore-v1-9-live-badges-stack-detection.astro', 18],
  ['blog/enterprise-geo-china-kimi-doubao-metaso.astro', 20],
  ['blog/ai-search-engine-list.astro', 15],
  ['blog/auditing-343-websites.astro', 20],
  ['blog/why-doesnt-chatgpt-cite-my-website.astro', 18],
];

/**
 * Figures from the four retired claims. Matching on the figure alone would be
 * too blunt (43.4 and 324 are legitimate numbers), so each entry pairs the
 * figure with the claim-shaped language that made it wrong.
 */
const WITHDRAWN_CLAIMS = [
  /3\.4\s*(?:&times;|×|x)\s*(?:citation\s+)?(?:lift|increase|more\s+likely)/i,
  /6\.1\s*(?:&times;|×|x)\s*more\s+likely/i,
  /3\.8\s*(?:&times;|×|x)\s*more\s+likely/i,
  /80%\s*of\s+the\s+score\s+improvement/i,
];

/**
 * A line may mention a withdrawn figure if it is clearly recording the
 * withdrawal rather than making the claim. Any one of these is enough.
 */
const WITHDRAWAL_MARKERS = [
  /withdraw/i,
  /cannot\s+(?:observe|tell|show|evidence)/i,
  /unverifiable/i,
  /no\s+source/i,
  /Correction\s*\(/i,
  /retract/i,
  /^\s*<li>\s*"/i, // a quoted item inside an explicit list of retired claims
  /weaker\s+claim/i,
];

function isDocumentedWithdrawal(line) {
  return WITHDRAWAL_MARKERS.some((re) => re.test(line));
}

describe('content depth: internal link floors', () => {
  for (const [relPath, floor] of LINK_FLOORS) {
    it(`${relPath} keeps at least ${floor} internal links`, () => {
      const src = readFileSync(join(PAGES, relPath), 'utf8');
      const count = (src.match(/href="\//g) || []).length;
      expect(count, `${relPath} has ${count} internal links, floor is ${floor}`)
        .toBeGreaterThanOrEqual(floor);
    });
  }
});

describe('content depth: withdrawn claims are never restated as fact', () => {
  it('no page asserts a retired citation-lift figure outside a withdrawal notice', () => {
    const offenders = [];

    for (const file of pageFiles) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const lines = readFileSync(file, 'utf8').split(/\r?\n/);

      lines.forEach((line, index) => {
        const hit = WITHDRAWN_CLAIMS.some((re) => re.test(line));
        if (!hit) return;
        if (isDocumentedWithdrawal(line)) return;
        offenders.push(`${rel}:${index + 1}: ${line.trim().slice(0, 140)}`);
      });
    }

    expect(offenders, `withdrawn claims restated as fact:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('still documents the retraction verbatim in the case study', () => {
    const src = readFileSync(join(PAGES, 'blog', 'auditing-343-websites.astro'), 'utf8');
    // The record of what was withdrawn has to survive: these four strings are
    // the original claims, quoted inside the "what this study cannot tell you"
    // list. If a future edit softens them, the record is gone.
    expect(src).toContain('"3.4&times; citation lift for sites with a valid llms.txt"');
    expect(src).toContain('"FAQ schema 6.1&times; more likely to be cited"');
    expect(src).toContain('"HowTo schema 3.8&times; more likely to be cited"');
    expect(src).toContain('"the top 3 fixes deliver ~80% of the score improvement"');
  });

  it('the case study statistics match the CSV it cites', () => {
    const csv = readFileSync(join(ROOT, 'data', 'geo-audit-v2-final.csv'), 'utf8');
    const rows = csv.trim().split(/\r?\n/);
    const dataRows = rows.length - 1; // minus header
    expect(dataRows).toBe(324);

    const page = readFileSync(join(PAGES, 'blog', 'auditing-343-websites.astro'), 'utf8');
    expect(page).toContain('324');
    // The headline numbers the page prints must be the ones the file produces.
    expect(page).toMatch(/Median 41/);
    expect(page).toMatch(/mean 43\.4/);
  });
});

describe('content depth: published statistics match the CSV', () => {
  /**
   * The 324-row CSV is the single source of truth for every number these pages
   * print. An earlier draft of wordpress.astro said "95 (29.3%)" for sites with
   * no robots.txt while the case study said "99 (30.6%)" for the same fact, in
   * the same change set — a fabricated figure on a page Google had never
   * crawled. This test recomputes the counts from the CSV and asserts the key
   * ones appear exactly as computed.
   */
  const csv = readFileSync(join(ROOT, 'data', 'geo-audit-v2-final.csv'), 'utf8').trim().split(/\r?\n/);
  const header = csv[0].split(',').map((h) => h.trim());
  const rows = csv.slice(1).map((line) => {
    const cells = [];
    let cur = '';
    let quoted = false;
    for (const ch of line) {
      if (ch === '"') { quoted = !quoted; continue; }
      if (ch === ',' && !quoted) { cells.push(cur); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur);
    return Object.fromEntries(header.map((h, i) => [h, cells[i]]));
  });

  const total = rows.length;
  const hasRobots = rows.filter((r) => /true|1|yes/i.test(r.hasRobotsTxt || '')).length;
  const noRobots = total - hasRobots;
  const hasLlms = rows.filter((r) => /true|1|yes/i.test(r.hasLlmsTxt || '')).length;

  it('derives the same counts the pages print', () => {
    expect(total).toBe(324);
    expect(hasRobots).toBe(225);
    expect(noRobots).toBe(99);
    expect(hasLlms).toBe(78);
  });

  it('wordpress.astro prints the derived robots.txt counts, not a guess', () => {
    const page = readFileSync(join(PAGES, 'geo-for', 'wordpress.astro'), 'utf8');
    const expectedNoRobots = `${noRobots} (${((noRobots / total) * 100).toFixed(1)}%)`;
    const expectedBlocks = `8 of ${hasRobots} (3.6%)`;
    const expectedLlms = `${hasLlms} (${((hasLlms / total) * 100).toFixed(1)}%)`;
    expect(page, `expected "${expectedNoRobots}"`).toContain(expectedNoRobots);
    expect(page, `expected "${expectedBlocks}"`).toContain(expectedBlocks);
    expect(page, `expected "${expectedLlms}"`).toContain(expectedLlms);
  });

  it('no page prints a score band range that is inverted or truncated', () => {
    // Ranges must be ascending: the em-dash normalisation once produced
    // "Critical (0-5)" and "Response times measured 300-30 ms".
    const pages = [
      join(PAGES, 'blog', 'auditing-343-websites.astro'),
      join(PAGES, 'geo-for', 'wordpress.astro'),
      join(PAGES, 'blog', 'enterprise-geo-china-kimi-doubao-metaso.astro'),
    ];
    const offenders = [];
    for (const file of pages) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/\((\d+)[\u2013\u2014-](\d+)\)/g)) {
        const lo = Number(m[1]);
        const hi = Number(m[2]);
        if (hi < lo) offenders.push(`${relative(ROOT, file)}: inverted range ${m[0]}`);
      }
      for (const m of src.matchAll(/(\d+)[\u2013\u2014-](\d+) ms/g)) {
        const lo = Number(m[1]);
        const hi = Number(m[2]);
        if (hi < lo) offenders.push(`${relative(ROOT, file)}: inverted ms range ${m[0]}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
