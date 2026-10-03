/**
 * GeoScore bulk auditor — runs the existing scanner over a corpus CSV.
 *
 * This does NOT reimplement scoring. It imports the product's own analyzer
 * (src/lib/node-scanner.js) via a small in-process bridge, so the numbers in the
 * study are the numbers the product produces. A separate scoring path would make
 * the study worthless.
 *
 * The CLI (src/lib/cli.js) accepts exactly one URL by design, so the loop lives
 * here instead of widening the product's CLI surface for a one-off study.
 *
 * Usage:
 *   node tools/run-audit.mjs --in data/geo-corpus.csv --out data/geo-audit.csv
 *                            [--concurrency 5] [--timeout 12000] [--resume]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditUrl } from '../src/lib/node-scanner.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const IN = path.resolve(REPO, opt('--in', 'data/geo-corpus.csv'));
const OUT = path.resolve(REPO, opt('--out', 'data/geo-audit.csv'));
const CONCURRENCY = Number(opt('--concurrency', '5'));
const TIMEOUT = Number(opt('--timeout', '12000'));
const RESUME = args.includes('--resume');

function parseCsv(text) {
  const rows = [];
  let i = 0, field = '', row = [], q = false;
  while (i < text.length) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
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
  return rows.filter(r => r.length > 1 && r[0] !== 'host');
}

const corpus = parseCsv(fs.readFileSync(IN, 'utf8'));
const header = ['host', 'ok', 'score', 'level', 'aiCrawlability', 'aiGuidance', 'structuredData',
  'metaSocial', 'contentQuality', 'eeat', 'brandEntity', 'citationReadiness',
  'discoveryEndpoints', 'agentFriendliness', 'freshness', 'hasLlmsTxt', 'robotsBlocksAnyAi',
  'robotsBlocksGptbot', 'hasRobotsTxt', 'elapsedMs', 'error'];
const DIM_KEYS = ['aiCrawlability', 'aiGuidance', 'structuredData', 'metaSocial', 'contentQuality',
  'eeat', 'brandEntity', 'citationReadiness', 'discoveryEndpoints', 'agentFriendliness', 'freshness'];

const done = new Set();
if (RESUME && fs.existsSync(OUT)) {
  for (const r of parseCsv(fs.readFileSync(OUT, 'utf8'))) done.add(r[0]);
  console.error(`resume: ${done.size} already audited`);
}
const todo = corpus.filter(r => !done.has(r[0]));
console.error(`corpus=${corpus.length} todo=${todo.length} concurrency=${CONCURRENCY} timeout=${TIMEOUT}ms`);

const esc = v => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// A fresh run must truncate. Previously the header was only computed into a local
// and never written, so an existing file kept its old first row and every downstream
// tool read the header as data. Symptom: the run reported 335 ok, the analyser
// reported 0. Always rewrite, and make the truncation explicit.
if (RESUME && fs.existsSync(OUT)) {
  const existing = fs.readFileSync(OUT, 'utf8');
  fs.writeFileSync(OUT, existing.endsWith('\n') ? existing : existing + '\n', 'utf8');
  console.error(`append mode: keeping ${done.size} existing rows`);
} else {
  fs.writeFileSync(OUT, header.join(',') + '\n', 'utf8');
  console.error(`fresh run: header written, ${OUT} truncated`);
}

let cursor = 0, ok = 0, fail = 0, doneCount = 0;
const t0 = Date.now();

/** Parse robots.txt into a per-AI-crawler decision. "Blocked" = explicitly disallowed
 *  for that crawler, or a blanket `User-agent: * / Disallow: /`. Text matching on the
 *  whole file would misfire on "Disallow: /login" and similar partial rules. */
function robotsVerdict(robotsTxt) {
  const txt = String(robotsTxt || '');
  if (!txt.trim()) return { hasRobots: 0, anyAiBlocked: 1, gptbotBlocked: 1 };
  const AI = ['gptbot', 'oai-searchbot', 'claudebot', 'anthropic-ai', 'perplexitybot', 'google-extended', 'ccbot'];
  // Collect rule blocks, keeping the UA token(s) and the Disallow paths.
  const lines = txt.split(/\r?\n/);
  const groups = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === 'user-agent') {
      if (!cur || cur.disallows.length) { cur = { uas: [], disallows: [] }; groups.push(cur); }
      cur.uas.push(value.toLowerCase());
    } else if (field === 'disallow' && cur) {
      cur.disallows.push(value);
    }
  }
  const blocks = ua => {
    for (const g of groups) {
      if (!g.uas.includes(ua) && !g.uas.includes('*')) continue;
      // An empty Disallow means "allow all" and cancels the rules in the SAME group
      // only. It must not clear a block declared in an earlier group.
      if (g.disallows.includes('')) return false;
      for (const d of g.disallows) {
        if (d === '/' || d === '*') return true;
      }
    }
    return false;
  };
  return {
    hasRobots: 1,
    anyAiBlocked: AI.some(blocks) ? 1 : 0,
    gptbotBlocked: blocks('gptbot') ? 1 : 0,
  };
}

async function one(rec) {
  const host = rec[0];
  const started = Date.now();
  try {
    const r = await Promise.race([
      auditUrl('https://' + host),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT)),
    ]);
    // Verified against the real return shape: r.dimensions is an object keyed by
    // dimension name, each value { score, maxScore, checks[], ... }.
    const dims = r.dimensions || {};
    const d = DIM_KEYS.map(k => (dims[k] && typeof dims[k].score === 'number') ? dims[k].score : '');
    const rv = robotsVerdict(r.raw && r.raw.robotsTxt);
    const hasLlms = r.raw && r.raw.llmsTxt ? 1 : 0;
    return [host, '1', r.score ?? '', r.level ?? '', ...d,
      hasLlms, rv.anyAiBlocked, rv.gptbotBlocked, rv.hasRobots,
      Date.now() - started, ''].map(esc).join(',');
  } catch (e) {
    return [host, '0', '', '', ...Array(DIM_KEYS.length).fill(''), '', '', '', '',
      Date.now() - started, esc(String(e && e.message ? e.message : e).slice(0, 80))].map(esc).join(',');
  }
}

async function worker() {
  for (;;) {
    const i = cursor++;
    if (i >= todo.length) return;
    const line = await one(todo[i]);
    if (line.split(',')[1] === '1') ok++; else fail++;
    doneCount++;
    if (doneCount % 25 === 0 || doneCount === todo.length) {
      const el = ((Date.now() - t0) / 1000).toFixed(0);
      const rate = (doneCount / ((Date.now() - t0) / 1000)).toFixed(1);
      console.error(`[${doneCount}/${todo.length}] ok=${ok} fail=${fail} ${rate}/s elapsed=${el}s`);
    }
    // Append as we go so a long run is never lost.
    fs.appendFileSync(OUT, line + '\n');
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.error(`\ndone. ok=${ok} fail=${fail} out=${OUT}`);
