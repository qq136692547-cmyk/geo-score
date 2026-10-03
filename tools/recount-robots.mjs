/**
 * Re-measure the AI-crawler verdict on the existing corpus, old rule vs new.
 *
 * Why this exists: the 2026-10-04 audit recorded robotsBlocksAnyAi /
 * robotsBlocksGptbot computed by a throwaway helper inside run-audit.mjs, and
 * the product's own analyzer (src/lib/analyzers/robots.js) disagreed with it on
 * most sites. The helper is now gone and its verdict was never written down, so
 * the only way to measure the effect of fixing the analyzer is to re-fetch
 * robots.txt for the same hosts and score every bot under both rules.
 *
 * This only downloads /robots.txt (one small request per host), not the full
 * page, so it is far cheaper than re-running the whole audit.
 *
 * Usage:
 *   node tools/recount-robots.mjs --in data/geo-audit-merged.csv
 *                                --out data/robots-recount.csv
 *                                [--concurrency 8] [--timeout 10000]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROBOTS_CHECKS } from '../src/lib/analyzers/robots.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const IN = path.resolve(REPO, opt('--in', 'data/geo-audit-merged.csv'));
const OUT = path.resolve(REPO, opt('--out', 'data/robots-recount.csv'));
const CONCURRENCY = Number(opt('--concurrency', '8'));
const TIMEOUT = Number(opt('--timeout', '10000'));

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
  const head = rows.shift();
  return { head, rows: rows.filter(r => r.length > 1) };
}

const { head, rows } = parseCsv(fs.readFileSync(IN, 'utf8'));
const hostIdx = head.indexOf('host');
const okIdx = head.indexOf('ok');
const targets = rows.filter(r => r[hostIdx] && r[okIdx] === '1').map(r => r[hostIdx]);
console.error(`corpus rows=${rows.length} previously-ok=${targets.length} concurrency=${CONCURRENCY}`);

const BOT_IDS = ROBOTS_CHECKS.map(c => ({ id: c.id, label: c.label, weight: c.weight, check: c.check }));

/** The pre-fix rule, reproduced verbatim from the comment run-audit.mjs carried. */
function oldVerdict(robotsTxt, ua) {
  const txt = String(robotsTxt || '');
  if (!txt.trim()) return true; // treated "no robots.txt" as blocked
  const groups = [];
  let cur = null;
  for (const raw of txt.split(/\r?\n/)) {
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
  for (const g of groups) {
    if (!g.uas.includes(ua) && !g.uas.includes('*')) continue;
    if (g.disallows.includes('')) return false;
    for (const d of g.disallows) if (d === '/' || d === '*') return true;
  }
  return false;
}

function weighted(passes) {
  const total = BOT_IDS.reduce((s, b) => s + b.weight, 0);
  const earned = BOT_IDS.filter((b, i) => passes[i]).reduce((s, b) => s + b.weight, 0);
  return { total, earned, score: Math.round((earned / total) * 12) };
}

const esc = v => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const outHead = ['host', 'httpStatus', 'bytes', 'hasRobots', 'newPassed', 'newScore',
  'oldPassed', 'oldScore', 'anyAiBlockedNew', 'anyAiBlockedOld',
  'gptbotBlockedNew', 'gptbotBlockedOld', 'attempts', 'error'];
fs.writeFileSync(OUT, outHead.join(',') + '\n', 'utf8');
console.error(`fresh run: header written, ${OUT} truncated`);

async function fetchOnce(host) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(`https://${host}/robots.txt`, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; GeoScoreStudy/1.0)' },
    });
    if (!res.ok) return { status: res.status, txt: '', err: '' };
    return { status: res.status, txt: await res.text(), err: '' };
  } catch (e) {
    return { status: 0, txt: '', err: String(e && e.name ? e.name : e).slice(0, 40) };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Fetch robots.txt, retrying once.
 *
 * The retry is not paranoia: a first pass over this corpus returned 15 bytes for
 * github.com where a manual fetch moments earlier had returned 16,739. Scoring a
 * truncated or empty body as "this site publishes no robots.txt" would silently
 * turn a network failure into a passing grade, so an empty body is retried and,
 * if it stays empty, reported as httpStatus 0 with an error rather than as a
 * genuine "no robots.txt".
 */
async function fetchRobots(host) {
  let last = await fetchOnce(host);
  let attempts = 1;
  if (last.status === 200 && !last.txt.trim()) {
    await new Promise(r => setTimeout(r, 1500));
    last = await fetchOnce(host);
    attempts = 2;
  }
  if (!last.status || last.err) return { ...last, attempts, usable: false };
  // 4xx (incl. 404) genuinely means "no robots.txt here". 5xx and 200-with-empty
  // do not, and must not be scored as permissive.
  const usable = last.status === 200 ? true : (last.status >= 400 && last.status < 500);
  return { ...last, attempts, usable };
}

let cursor = 0, done = 0, blockedNew = 0, blockedOld = 0, noRobots = 0, errs = 0;
const t0 = Date.now();

async function worker() {
  for (;;) {
    const i = cursor++;
    if (i >= targets.length) return;
    const host = targets[i];
    let line;
    try {
      const { txt, status, attempts, usable, err } = await fetchRobots(host);
      if (!usable) throw Object.assign(new Error(err || `HTTP ${status}`), { status, attempts });

      const hasRobots = txt.trim() ? 1 : 0;
      if (!hasRobots) noRobots++;

      const newPasses = BOT_IDS.map(b => b.check(txt));
      const oldPasses = BOT_IDS.map(b => oldVerdict(txt, b.label.split(' ')[0].toLowerCase()));

      const nw = weighted(newPasses);
      const ow = weighted(oldPasses);
      if (nw.earned !== nw.total) blockedNew++;
      if (ow.earned !== ow.total) blockedOld++;

      line = [host, status, txt.length, hasRobots, newPasses.filter(Boolean).length, nw.score,
        oldPasses.filter(Boolean).length, ow.score,
        nw.earned === nw.total ? 0 : 1, ow.earned === ow.total ? 0 : 1,
        newPasses[0] ? 0 : 1, oldPasses[0] ? 0 : 1, attempts, ''].map(esc).join(',');
    } catch (e) {
      errs++;
      line = [host, e.status || '', '', '', '', '', '', '', '', '', '', '', e.attempts || 1,
        esc(String(e && e.message ? e.message : e).slice(0, 40))].map(esc).join(',');
    }
    fs.appendFileSync(OUT, line + '\n');
    done++;
    if (done % 25 === 0 || done === targets.length) {
      const el = ((Date.now() - t0) / 1000).toFixed(0);
      console.error(`[${done}/${targets.length}] ${(done / ((Date.now() - t0) / 1000)).toFixed(1)}/s elapsed=${el}s`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.error(`\ndone. ${done} fetched, scored=${done - errs}, no-robots=${noRobots}, unusable=${errs}`);
console.error(`sites with at least one AI bot blocked: new=${blockedNew} old=${blockedOld}`);
