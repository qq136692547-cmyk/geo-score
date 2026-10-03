/**
 * Side-by-side v1 / v2 comparison for the GeoScore study.
 *
 * v1 = data/geo-audit-merged.csv  (baseline, pre-RFC-9309 robots fix)
 * v2 = data/geo-audit-v2.csv      (re-run after the fix)
 *
 * To keep the denominators identical, the v1 figures are computed on the
 * INTERSECTION: only hosts that also audited successfully (ok=1) in v2.
 *
 * Level thresholds are copied from src/lib/scoring.js computeScore():
 *   >= 86 Excellent | >= 68 Good | >= 36 Basic | otherwise Critical
 *
 * Usage:
 *   node tools/compare-v1-v2.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V1 = path.resolve(REPO, 'data/geo-audit-merged.csv');
const V2 = path.resolve(REPO, 'data/geo-audit-v2.csv');

function parseCsv(text) {
  const rows = []; let i = 0, f = '', row = [], q = false;
  while (i < text.length) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; } f += c; i++; continue; }
    if (c === '"') { q = true; i++; continue; }
    if (c === ',') { row.push(f); f = ''; i++; continue; }
    if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; i++; continue; }
    f += c; i++;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, j) => [h, r[j]])));
}

const num = v => (v === '' || v === undefined || v === null ? null : Number(v));
const pct = (a, b) => (b === 0 ? null : (100 * a / b));
const f1 = v => (v === null ? '--' : v.toFixed(1));

const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Mirrors src/lib/scoring.js computeScore() lines 41-45.
function levelOf(score) {
  if (score >= 86) return 'Excellent';
  if (score >= 68) return 'Good';
  if (score >= 36) return 'Basic';
  return 'Critical';
}

function load(file) {
  const all = parseCsv(fs.readFileSync(file, 'utf8'));
  return all.filter(r => r.ok === '1' && num(r.score) !== null);
}

const v2 = load(V2);
const v1All = load(V1);
const v2Hosts = new Set(v2.map(r => r.host));
const v1 = v1All.filter(r => v2Hosts.has(r.host));

const out = [];
const say = s => { out.push(s); console.log(s); };

say('='.repeat(72));
say('DENOMINATORS');
say('='.repeat(72));
say(`v2 file                     : data/geo-audit-v2.csv`);
say(`v2 ok=1 rows                : ${v2.length}`);
say(`v1 file                     : data/geo-audit-merged.csv`);
say(`v1 ok=1 rows (all)          : ${v1All.length}`);
say(`v1 rows kept (∩ v2 success) : ${v1.length}`);
say(`v1 rows dropped (v2 failed) : ${v1All.length - v1.length}`);
say('');
say('v1 figures below are on the INTERSECTION so both columns share one denominator.');

function block(label, rows) {
  const scores = rows.map(r => num(r.score));
  const n = rows.length;
  say('');
  say('='.repeat(72));
  say(label);
  say('='.repeat(72));
  say(`n           : ${n}`);
  if (!n) { say('(no rows)'); return; }
  say(`median      : ${f1(median(scores))}`);
  say(`mean        : ${f1(mean(scores))}`);
  say(`max         : ${Math.max(...scores)}`);
  say(`min         : ${Math.min(...scores)}`);

  say('');
  say('levels (recomputed from score via src/lib/scoring.js thresholds):');
  for (const lv of ['Excellent', 'Good', 'Basic', 'Critical']) {
    const c = rows.filter(r => levelOf(num(r.score)) === lv).length;
    say(`  ${lv.padEnd(10)} ${String(c).padStart(4)}  ${f1(pct(c, n))}%`);
  }
  const mismatch = rows.filter(r => r.level && r.level !== levelOf(num(r.score)));
  say(`  (rows where CSV 'level' disagrees with recomputed: ${mismatch.length})`);

  say('');
  say('llms.txt:');
  const withL = rows.filter(r => num(r.hasLlmsTxt) === 1);
  const withoutL = rows.filter(r => num(r.hasLlmsTxt) !== 1);
  say(`  has llms.txt    : ${withL.length}  (${f1(pct(withL.length, n))}%)  mean=${f1(mean(withL.map(r => num(r.score))))}  median=${f1(median(withL.map(r => num(r.score))))}`);
  say(`  no llms.txt     : ${withoutL.length}  (${f1(pct(withoutL.length, n))}%)  mean=${f1(mean(withoutL.map(r => num(r.score))))}  median=${f1(median(withoutL.map(r => num(r.score))))}`);

  say('');
  say('robots.txt presence (all n):');
  const withR = rows.filter(r => num(r.hasRobotsTxt) === 1);
  const withoutR = rows.filter(r => num(r.hasRobotsTxt) !== 1);
  say(`  has robots.txt  : ${withR.length}  (${f1(pct(withR.length, n))}%)`);
  say(`  no robots.txt   : ${withoutR.length}  (${f1(pct(withoutR.length, n))}%)`);

  say('');
  say('AI crawler blocking — denominator = sites WITH robots.txt only:');
  const anyAi = withR.filter(r => num(r.robotsBlocksAnyAi) === 1).length;
  const gpt = withR.filter(r => num(r.robotsBlocksGptbot) === 1).length;
  say(`  blocks >=1 AI bot   : ${anyAi} / ${withR.length}  (${f1(pct(anyAi, withR.length))}%)`);
  say(`  blocks GPTBot       : ${gpt} / ${withR.length}  (${f1(pct(gpt, withR.length))}%)`);
  say('');
  say('same counts with denominator = ALL audited sites (for contrast):');
  say(`  blocks >=1 AI bot   : ${anyAi} / ${n}  (${f1(pct(anyAi, n))}%)`);
  say(`  blocks GPTBot       : ${gpt} / ${n}  (${f1(pct(gpt, n))}%)`);
}

block('V2  (post-fix re-run, data/geo-audit-v2.csv)', v2);
block('V1  (baseline, intersected with v2 successes)', v1);

say('');
say('='.repeat(72));
say('V1 vs V2  — same hosts, same denominator (intersection)');
say('='.repeat(72));
const s1 = v1.map(r => num(r.score));
const s2 = v2.map(r => num(r.score));
say(`n                 : ${v1.length}`);
say(`median            : v1=${f1(median(s1))}   v2=${f1(median(s2))}`);
say(`mean              : v1=${f1(mean(s1))}   v2=${f1(mean(s2))}`);
say(`max               : v1=${Math.max(...s1)}   v2=${Math.max(...s2)}`);
say('');
say('level mix shift:');
for (const lv of ['Excellent', 'Good', 'Basic', 'Critical']) {
  const a = v1.filter(r => levelOf(num(r.score)) === lv).length;
  const b = v2.filter(r => levelOf(num(r.score)) === lv).length;
  say(`  ${lv.padEnd(10)} v1=${String(a).padStart(4)} (${f1(pct(a, v1.length))}%)   v2=${String(b).padStart(4)} (${f1(pct(b, v2.length))}%)`);
}
say('');
say('aiCrawlability dimension (out of 12):');
const d1 = v1.map(r => num(r.aiCrawlability)).filter(v => v !== null && !Number.isNaN(v));
const d2 = v2.map(r => num(r.aiCrawlability)).filter(v => v !== null && !Number.isNaN(v));
say(`  v1 mean=${f1(mean(d1))} median=${f1(median(d1))}   n=${d1.length}`);
say(`  v2 mean=${f1(mean(d2))} median=${f1(median(d2))}   n=${d2.length}`);
say(`  v1 scoring 12/12: ${d1.filter(v => v === 12).length}   v2 scoring 12/12: ${d2.filter(v => v === 12).length}`);
say('');
say('robots "blocks AI" flag (the column that fed the 33.2% claim):');
const r1 = v1.filter(r => num(r.hasRobotsTxt) === 1);
const r2 = v2.filter(r => num(r.hasRobotsTxt) === 1);
const a1 = r1.filter(r => num(r.robotsBlocksAnyAi) === 1).length;
const a2 = r2.filter(r => num(r.robotsBlocksAnyAi) === 1).length;
say(`  v1: ${a1}/${r1.length} with-robots sites flagged blocked (${f1(pct(a1, r1.length))}%)`);
say(`  v2: ${a2}/${r2.length} with-robots sites flagged blocked (${f1(pct(a2, r2.length))}%)`);
say(`  v1 hasRobotsTxt=1 count=${r1.length}   v2 hasRobotsTxt=1 count=${r2.length}`);
say('');
say('per-host score delta (v2 - v1) on the intersection:');
const byHost = new Map(v1.map(r => [r.host, num(r.score)]));
const deltas = v2.map(r => num(r.score) - byHost.get(r.host)).filter(v => !Number.isNaN(v));
say(`  min=${Math.min(...deltas)}  max=${Math.max(...deltas)}  mean=${f1(mean(deltas))}  median=${f1(median(deltas))}`);
say(`  sites that went DOWN: ${deltas.filter(v => v < 0).length}   UP: ${deltas.filter(v => v > 0).length}   unchanged: ${deltas.filter(v => v === 0).length}`);

fs.writeFileSync(path.resolve(REPO, 'data/compare-v1-v2.txt'), out.join('\n') + '\n', 'utf8');
console.error(`\nwritten: data/compare-v1-v2.txt`);
