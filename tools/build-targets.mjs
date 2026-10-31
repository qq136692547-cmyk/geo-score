/**
 * build-targets.mjs — turn a list of candidate domains into a sales evidence table.
 *
 * WHY THIS EXISTS
 *   A cold email only works if it contains something the recipient can check in
 *   five seconds. "Your site scores 41/100" is an opinion. "Your robots.txt tells
 *   GPTBot to go away, here is the line" is a fact with a URL attached. This
 *   script produces exactly that, one row per host: the single worst defect, a
 *   URL that shows it, and the line of text that proves it.
 *
 * WHY IT IMPORTS THE PRODUCT ANALYZER
 *   Same reason tools/run-audit.mjs does: the number in the email has to be the
 *   number geoscore.help shows the recipient when they run the free audit
 *   themselves. A second scoring path would drift, and eventually a sales email
 *   would quote a score the product contradicts.
 *
 * THE ONE RULE
 *   Nothing is invented. Every field is either read out of the audit result or
 *   written as `unknown`. A made-up robots.txt line would be caught by the
 *   recipient in one click, which loses the sale and the reputation with it.
 *
 * Usage:
 *   node tools/build-targets.mjs --in data/targets-candidates.csv --out data/targets-scored.csv
 *        [--md data/targets-scored.md] [--concurrency 5] [--timeout 15000] [--resume]
 *
 * Input:  CSV whose FIRST column is a host, with or without https://. Any other
 *         columns are ignored; a `host` header row is skipped.
 * Output: CSV with the fixed HEADER order below. stdout stays empty, progress
 *         goes to stderr, results go to --out (and --md when asked).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditUrl } from '../src/lib/node-scanner.js';
import { ROBOTS_CHECKS } from '../src/lib/analyzers/robots.js';
import { DIMENSION_WEIGHTS } from '../src/lib/scoring.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Fixed output column order. Everything downstream (mail merge, sheet) relies on it. */
export const HEADER = [
  'host', 'ok', 'score', 'level', 'hasLlmsTxt', 'robotsBlocksAnyAi', 'robotsBlocksGptbot',
  'blockedCrawlers', 'blockedCount', 'topDefect', 'topDefectWeight', 'evidenceUrl', 'evidenceLine',
  'error',
];

/** Column name -> index, so no reader has to count commas. */
const IDX = Object.fromEntries(HEADER.map((h, i) => [h, i]));

/**
 * The 11 dimensions in the product's own order, taken from the scoring table
 * rather than hardcoded here. Order matters twice: it decides tie-breaks in
 * pickTopDefect, and it keeps this file honest if a dimension is ever added.
 */
const DIMENSION_KEYS = Object.keys(DIMENSION_WEIGHTS);

/**
 * check id -> the User-agent token that check is about, e.g. gptbot -> "GPTBot".
 * Derived from the analyzer's own labels ("GPTBot (OpenAI/ChatGPT)") so there is
 * no second list of crawler names to fall out of sync. If a label ever stops
 * starting with the UA token, the lookup misses and the evidence line degrades
 * to `unknown` — the safe direction, never a wrong quote.
 */
const CRAWLER_UA = new Map(
  ROBOTS_CHECKS.map((c) => [c.id, String(c.label).split(' (')[0].trim()])
);

/* ------------------------------------------------------------------------- *
 * Pure logic — no network, no fs. tests/tools/buildTargets.test.js covers this.
 * ------------------------------------------------------------------------- */

/**
 * Which failing check leads the email.
 *
 * NOT the heaviest weight. The weight table answers "how many points is this
 * gap worth inside the audit"; the email has to answer a different question:
 * which single fact makes a stranger click a link and care?
 *
 * A blocked crawler wins because it is verifiable in one click (open
 * /robots.txt), counter-intuitive (most owners do not know they did it), and
 * expensive (invisible to ChatGPT, Claude, Perplexity answers). "Your llms.txt
 * is missing an H1" scores more points but reads like a nitpick, so it can
 * never outrank a block. Same reasoning for the rest of the ladder:
 *
 *   tier 0  aiCrawlability        a crawler is blocked
 *   tier 1  aiGuidance, discovery llms.txt / AI endpoint gaps
 *   tier 2  structuredData        schema gaps
 *   tier 3  everything else       by weight
 *
 * Inside a tier: heavier first, then the earlier dimension, then the earlier
 * check, so identical input always yields an identical row.
 *
 * Returns { id, label, weight, dimension } or null when nothing fails.
 */
const DEFECT_TIER = new Map([
  ['aiCrawlability', 0],
  ['aiGuidance', 1],
  ['discoveryEndpoints', 1],
  ['structuredData', 2],
]);
const DEFAULT_TIER = 3;

function tierOf(dimension) {
  return DEFECT_TIER.has(dimension) ? DEFECT_TIER.get(dimension) : DEFAULT_TIER;
}

function outranks(a, b) {
  if (a.tier !== b.tier) return a.tier < b.tier;
  if (a.weight !== b.weight) return a.weight > b.weight;
  if (a.dimIndex !== b.dimIndex) return a.dimIndex < b.dimIndex;
  return a.checkIndex < b.checkIndex;
}

export function pickTopDefect(dimensions) {
  const dims = dimensions || {};
  let best = null;
  let bestRank = null;
  for (let dimIndex = 0; dimIndex < DIMENSION_KEYS.length; dimIndex++) {
    const key = DIMENSION_KEYS[dimIndex];
    const dim = dims[key];
    if (!dim || !Array.isArray(dim.checks)) continue;
    const tier = tierOf(key);
    for (let checkIndex = 0; checkIndex < dim.checks.length; checkIndex++) {
      const check = dim.checks[checkIndex];
      if (!check || check.passed !== false) continue;
      const weight = typeof check.weight === 'number' ? check.weight : 0;
      const rank = { tier, weight, dimIndex, checkIndex };
      if (bestRank === null || outranks(rank, bestRank)) {
        best = { id: check.id, label: check.label, weight, dimension: key };
        bestRank = rank;
      }
    }
  }
  return best;
}

/**
 * Pull the verbatim robots.txt lines that block this crawler.
 *
 * Returns the `User-agent:` line naming the bot plus the first rule line under
 * it, joined into one line — at most two lines, as the mail body needs one.
 * Comments are ignored when matching so a "# GPTBot is fine" note cannot be
 * mistaken for a rule.
 *
 * Returns 'unknown' when robots.txt was not captured, or when it does not name
 * the bot at all. That second case is real: a site can block GPTBot with a bare
 * `User-agent: *` group, and then there is no line containing "GPTBot" to
 * quote. Saying so is better than paraphrasing the wildcard group as if it were
 * about this bot.
 */
export function robotsEvidenceLine(robotsTxt, crawlerId) {
  if (typeof robotsTxt !== 'string' || !robotsTxt.trim()) return 'unknown';
  const ua = CRAWLER_UA.get(crawlerId);
  if (!ua) return 'unknown';

  const lines = robotsTxt.split(/\r?\n/);
  const needle = ua.toLowerCase();
  const start = lines.findIndex((l) => l.replace(/#.*$/, '').toLowerCase().includes(needle));
  if (start < 0) return 'unknown';

  const picked = [lines[start]];
  for (let i = start + 1; i < lines.length; i++) {
    const stripped = lines[i].replace(/#.*$/, '').trim();
    if (!stripped) continue;
    if (/^user-agent\s*:/i.test(stripped)) break; // next group begins, stop here
    if (/^(allow|disallow)\s*:/i.test(stripped)) { picked.push(lines[i]); break; }
  }
  return picked.map((s) => s.trim()).filter(Boolean).join(' ');
}

/**
 * Evidence line for a /llms.txt defect.
 *
 * Only the missing case has a line we can stand behind: the analyzer hands us
 * null exactly when the fetch produced no body, which for /llms.txt means a 4xx
 * (the fetcher returns null on 4xx and on empty). A file that exists but is
 * malformed gets 'unknown' — writing "404" there would be a lie, and the
 * topDefect label already says what is wrong with it.
 */
export function llmsEvidenceLine(llmsTxt) {
  const missing = llmsTxt === null || llmsTxt === undefined
    || (typeof llmsTxt === 'string' && llmsTxt.trim() === '');
  return missing ? 'GET /llms.txt -> 404' : 'unknown';
}

/**
 * Where a human can verify the defect, and the one line that proves it.
 *
 * Routing is by dimension, not by check id, because check ids repeat across
 * analyzers: 'structure' in aiGuidance and 'props' in structuredData would
 * otherwise be indistinguishable from the id alone.
 */
export function buildEvidence(host, topDefect, raw) {
  const h = String(host == null ? '' : host).trim();
  const root = 'https://' + h + '/';
  const source = raw || {};

  if (!topDefect) return { evidenceUrl: root, evidenceLine: 'unknown' };

  if (topDefect.dimension === 'aiCrawlability') {
    return {
      evidenceUrl: 'https://' + h + '/robots.txt',
      evidenceLine: robotsEvidenceLine(source.robotsTxt, topDefect.id),
    };
  }

  if (topDefect.dimension === 'aiGuidance') {
    return {
      evidenceUrl: 'https://' + h + '/llms.txt',
      evidenceLine: llmsEvidenceLine(source.llmsTxt),
    };
  }

  // structuredData (schema) and everything else: the missing markup belongs on
  // the page we audited, and there is no second URL to point at.
  return { evidenceUrl: root, evidenceLine: 'unknown' };
}

/**
 * One CSV record, in HEADER order.
 *
 * Pass a null `result` to build the failure record — then every audit-derived
 * field is empty and the evidence line is 'unknown'. A failed audit produces no
 * claim at all, which is the only defensible thing to put in a sales email.
 */
export function buildRow(host, result, error) {
  if (!result) {
    const msg = String((error && error.message) || error || '').slice(0, 80);
    return [host, '0', '', '', '', '', '', '', '', '', '', '', 'unknown', msg];
  }

  const dims = result.dimensions || {};
  const aiChecks = (dims.aiCrawlability && Array.isArray(dims.aiCrawlability.checks))
    ? dims.aiCrawlability.checks
    : [];
  // Read the product's own verdict instead of re-parsing robots.txt here; a
  // second parser would contradict the product (see src/lib/analyzers/robots.js).
  const blocked = aiChecks.filter((c) => c && c.passed === false).map((c) => c.id);
  const top = pickTopDefect(dims);
  const ev = buildEvidence(host, top, result.raw);

  return [
    host,
    '1',
    result.score ?? '',
    result.level ?? '',
    result.raw && result.raw.llmsTxt ? '1' : '0',
    blocked.length ? '1' : '0',
    blocked.includes('gptbot') ? '1' : '0',
    blocked.join(';'),
    blocked.length,
    top ? top.label : '',
    top ? top.weight : '',
    ev.evidenceUrl,
    ev.evidenceLine,
    '',
  ];
}

/** CSV field escaping. Same rules as tools/run-audit.mjs. */
export function esc(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsvLine(fields) {
  return fields.map(esc).join(',');
}

/**
 * Minimal CSV parser (quoted fields, doubled quotes, CRLF).
 *
 * Deliberately NOT run-audit.mjs's copy: that one ends with
 * `rows.filter(r => r.length > 1 && r[0] !== 'host')`, which silently drops
 * every row of a one-column `host` file — the exact shape of a candidate list.
 * Here the caller decides what to keep.
 */
export function parseCsv(text) {
  const src = String(text === null || text === undefined ? '' : text)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n');
  const rows = [];
  let i = 0, field = '', row = [], q = false;
  while (i < src.length) {
    const c = src[i];
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        q = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { q = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** "https://Example.com/path?x=1" -> "example.com". Keeps www: that is where we audited. */
export function normalizeHost(raw) {
  let s = String(raw === null || raw === undefined ? '' : raw).trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^https?:\/\//, '');
  s = s.split(/[/?#]/)[0];
  s = s.replace(/\.+$/, '');
  return s;
}

/** First column of every row, header skipped, duplicates collapsed, input order kept. */
export function readHosts(csvText) {
  const out = [];
  const seen = new Set();
  for (const row of parseCsv(csvText)) {
    const host = normalizeHost(row[0]);
    if (!host || host === 'host') continue;
    if (seen.has(host)) continue;
    seen.add(host);
    out.push(host);
  }
  return out;
}

function mdCell(v) {
  return String(v === null || v === undefined ? '' : v).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/**
 * Human-readable table for eyeballing a batch before it goes into emails.
 * Ratios are over successfully audited hosts only: a site we failed to reach
 * is not evidence that it blocks crawlers, and counting it as "not blocked"
 * would quietly understate the pitch.
 */
export function buildMarkdown(rows) {
  const total = rows.length;
  const okRows = rows.filter((r) => r[IDX.ok] === '1');
  const scores = okRows.map((r) => Number(r[IDX.score])).filter((n) => Number.isFinite(n));
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const counts = okRows.map((r) => Number(r[IDX.blockedCount]) || 0);
  const avgBlocked = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
  const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) + '%' : 'n/a');
  const blocked = okRows.filter((r) => r[IDX.robotsBlocksAnyAi] === '1').length;
  const noLlms = okRows.filter((r) => r[IDX.hasLlmsTxt] === '0').length;

  const lines = [];
  lines.push('# Target evidence — ' + total + ' host(s)');
  lines.push('');
  lines.push(
    'audited ok ' + okRows.length + '/' + total
    + ' · avg score ' + avg.toFixed(1)
    + ' · blocked by >=1 AI crawler ' + pct(blocked, okRows.length) + ' (' + blocked + '/' + okRows.length + ')'
    + ' · avg crawlers blocked ' + avgBlocked.toFixed(1)
    + ' · missing /llms.txt ' + pct(noLlms, okRows.length) + ' (' + noLlms + '/' + okRows.length + ')'
  );
  lines.push('');
  lines.push('| host | score | topDefect | evidenceUrl |');
  lines.push('|---|---|---|---|');
  for (const r of rows) {
    const defect = r[IDX.ok] === '1' ? r[IDX.topDefect] : '(audit failed)';
    lines.push('| ' + [r[IDX.host], r[IDX.score], defect, r[IDX.evidenceUrl]].map(mdCell).join(' | ') + ' |');
  }
  return lines.join('\n') + '\n';
}

/* ------------------------------------------------------------------------- *
 * CLI
 * ------------------------------------------------------------------------- */

function isMain() {
  try {
    if (!process.argv[1]) return false;
    return path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
  } catch (_) {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name, dflt) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
  };
  const IN = path.resolve(REPO, opt('--in', 'data/targets-candidates.csv'));
  const OUT = path.resolve(REPO, opt('--out', 'data/targets-scored.csv'));
  const MD = opt('--md', '') ? path.resolve(REPO, opt('--md', '')) : '';
  const CONCURRENCY = Number(opt('--concurrency', '5'));
  const TIMEOUT = Number(opt('--timeout', '15000'));
  const RESUME = args.includes('--resume');

  if (!fs.existsSync(IN)) {
    console.error('input not found: ' + IN);
    process.exitCode = 1;
    return;
  }

  const candidates = readHosts(fs.readFileSync(IN, 'utf8'));
  if (!candidates.length) {
    console.error('no hosts found in ' + IN + ' (first column must be the host)');
    process.exitCode = 1;
    return;
  }

  const done = new Set();
  if (RESUME && fs.existsSync(OUT)) {
    for (const row of parseCsv(fs.readFileSync(OUT, 'utf8'))) {
      const host = normalizeHost(row[0]);
      if (host && host !== 'host') done.add(host);
    }
    console.error('resume: ' + done.size + ' already audited');
  }
  const todo = candidates.filter((h) => !done.has(h));
  console.error(
    'candidates=' + candidates.length + ' todo=' + todo.length
    + ' concurrency=' + CONCURRENCY + ' timeout=' + TIMEOUT + 'ms'
  );

  // A fresh run must truncate. run-audit.mjs learned this the hard way: the
  // header was computed but never written, so an old file kept its first row and
  // every reader treated the header as data.
  if (RESUME && fs.existsSync(OUT)) {
    const existing = fs.readFileSync(OUT, 'utf8');
    fs.writeFileSync(OUT, existing.endsWith('\n') ? existing : existing + '\n', 'utf8');
    console.error('append mode: keeping ' + done.size + ' existing rows');
  } else {
    fs.writeFileSync(OUT, HEADER.join(',') + '\n', 'utf8');
    console.error('fresh run: header written, ' + OUT + ' truncated');
  }

  let cursor = 0, ok = 0, fail = 0, finished = 0;
  const t0 = Date.now();

  async function one(host) {
    try {
      const r = await Promise.race([
        auditUrl('https://' + host),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT)),
      ]);
      return buildRow(host, r, null);
    } catch (e) {
      return buildRow(host, null, e);
    }
  }

  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= todo.length) return;
      const fields = await one(todo[i]);
      if (fields[IDX.ok] === '1') ok++; else fail++;
      finished++;
      if (finished % 25 === 0 || finished === todo.length) {
        const secs = (Date.now() - t0) / 1000;
        console.error(
          '[' + finished + '/' + todo.length + '] ok=' + ok + ' fail=' + fail
          + ' ' + (finished / secs).toFixed(1) + '/s elapsed=' + secs.toFixed(0) + 's'
        );
      }
      // Append as we go so a long run is never lost.
      fs.appendFileSync(OUT, toCsvLine(fields) + '\n');
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (MD) {
    // Build the report from the finished file, not from this run's counters, so
    // --resume produces a table covering everything in --out.
    const rows = parseCsv(fs.readFileSync(OUT, 'utf8')).filter((r) => r.length >= HEADER.length && r[0] !== 'host');
    fs.writeFileSync(MD, buildMarkdown(rows), 'utf8');
    console.error('markdown: ' + MD + ' (' + rows.length + ' rows)');
  }

  console.error('\ndone. ok=' + ok + ' fail=' + fail + ' out=' + OUT);
}

if (isMain()) {
  await main();
}
