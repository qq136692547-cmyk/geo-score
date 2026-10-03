/**
 * Analyse the audit results and print only numbers that are actually in the data.
 *
 * Design rule: every figure printed here must be computed from data/geo-audit.csv.
 * Nothing is carried over from the previous blog post's prose. If a statistic
 * cannot be derived from these columns, it is not reported at all — that is why
 * the "citation lift" claims have no equivalent here: static auditing cannot
 * observe whether an AI engine cited a site.
 * Usage:
 *   node tools/analyse-study.mjs --in data/geo-audit-v2.csv [--out data/study-report-v2.txt]
 * Defaults to the v1 baseline so existing invocations keep working. With no --out
 * the report goes to stdout only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const _args = process.argv.slice(2);
const _opt = (name, dflt) => {
  const i = _args.indexOf(name);
  return i >= 0 && _args[i + 1] ? _args[i + 1] : dflt;
};
if (_args.includes('--help') || _args.includes('-h')) {
  console.log('usage: node tools/analyse-study.mjs --in <csv> [--out <txt>]');
  process.exit(0);
}
const FILE = path.resolve(REPO, _opt('--in', 'data/geo-audit-merged.csv'));
const OUT = _opt('--out', null);
if (OUT) {
  const fd = fs.openSync(path.resolve(REPO, OUT), 'w');
  const stdout = console.log.bind(console);
  console.log = (...a) => { fs.writeSync(fd, a.join(' ') + '\n'); stdout(...a); };
  process.on('exit', () => { try { fs.closeSync(fd); } catch { /* already closed */ } });
}
const DIM_KEYS = ['aiCrawlability', 'aiGuidance', 'structuredData', 'metaSocial', 'contentQuality',
  'eeat', 'brandEntity', 'citationReadiness', 'discoveryEndpoints', 'agentFriendliness', 'freshness'];
const DIM_LABEL = {
  aiCrawlability: 'AI Crawlability', aiGuidance: 'AI Guidance', structuredData: 'Structured Data',
  metaSocial: 'Meta & Social', contentQuality: 'Content Quality', eeat: 'E-E-A-T',
  brandEntity: 'Brand & Entity', citationReadiness: 'Citation Readiness',
  discoveryEndpoints: 'Discovery', agentFriendliness: 'Agent Friendly', freshness: 'Freshness',
};
const MAX = { aiCrawlability: 12, aiGuidance: 8, structuredData: 12, metaSocial: 8, contentQuality: 12,
  eeat: 10, brandEntity: 8, citationReadiness: 10, discoveryEndpoints: 8, agentFriendliness: 8, freshness: 4 };

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

const all = parseCsv(fs.readFileSync(FILE, 'utf8'));
const ok = all.filter(r => r.ok === '1' && r.score !== '');
const failed = all.filter(r => r.ok !== '1');
const num = v => (v === '' || v === undefined ? null : Number(v));

const pct = (a, b) => (b === 0 ? null : (100 * a / b));

console.log('='.repeat(64));
console.log('SAMPLE');
console.log('='.repeat(64));
console.log(`rows in file        : ${all.length}`);
console.log(`audited ok          : ${ok.length}`);
console.log(`failed              : ${failed.length}`);
console.log(`scored (used below) : ${ok.length}`);
console.log(`failure rate        : ${pct(failed.length, all.length)?.toFixed(1)}%`);
if (failed.length) {
  const byErr = {};
  for (const f of failed) {
    const k = (f.error || '(empty)').replace(/[^a-zA-Z ]/g, ' ').trim().slice(0, 40) || '(empty)';
    byErr[k] = (byErr[k] || 0) + 1;
  }
  console.log('\nfailure reasons:');
  for (const [k, v] of Object.entries(byErr).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`  ${String(v).padStart(4)}  ${k}`);
  }
}

if (ok.length < 100) {
  console.log(`\n!! Only ${ok.length} scored samples. The project's red line is 100; ` +
    `do NOT publish findings from this run.`);
  process.exit(0);
}

console.log('\n' + '='.repeat(64));
console.log('SCORE DISTRIBUTION');
console.log('='.repeat(64));
const scores = ok.map(r => num(r.score)).sort((a, b) => a - b);
const q = p => scores[Math.min(scores.length - 1, Math.floor(p / 100 * scores.length))];
const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
const median = q(50);
console.log(`n      : ${scores.length}`);
console.log(`min    : ${scores[0]}`);
console.log(`p25    : ${q(25)}`);
console.log(`median : ${median}`);
console.log(`p75    : ${q(75)}`);
console.log(`max    : ${scores[scores.length - 1]}`);
console.log(`mean   : ${mean.toFixed(1)}`);

const levels = {};
for (const r of ok) levels[r.level] = (levels[r.level] || 0) + 1;
console.log('\nlevel distribution:');
for (const [k, v] of Object.entries(levels).sort((a, b) => b[1] - a[1])) {
  const bar = '#'.repeat(Math.round(v / ok.length * 40));
  console.log(`  ${k.padEnd(10)} ${String(v).padStart(4)}  ${pct(v, ok.length).toFixed(1).padStart(5)}%  ${bar}`);
}

// Histogram in 10-point buckets, for the score-distribution chart (B-005).
console.log('\nhistogram (10-point buckets):');
const buckets = new Array(10).fill(0);
for (const s of scores) buckets[Math.min(9, Math.floor(s / 10))]++;
for (let i = 0; i < 10; i++) {
  if (buckets[i] === 0) continue;
  console.log(`  ${String(i * 10).padStart(3)}-${String(i * 10 + 9).padStart(3)}  ${String(buckets[i]).padStart(4)}  ${pct(buckets[i], ok.length).toFixed(1).padStart(5)}%  ${'#'.repeat(Math.round(buckets[i] / ok.length * 40))}`);
}

console.log('\n' + '='.repeat(64));
console.log('ROBOTS / AI CRAWLER ACCESS  (the "82%" claim)');
console.log('='.repeat(64));
const withRobots = ok.filter(r => r.hasRobotsTxt === '1');
const noRobots = ok.filter(r => r.hasRobotsTxt !== '1');
const blockedAny = ok.filter(r => r.robotsBlocksAnyAi === '1');
const blockedGpt = ok.filter(r => r.robotsBlocksGptbot === '1');
const clean = ok.filter(r => r.hasRobotsTxt === '1' && r.robotsBlocksAnyAi === '0');
console.log(`has robots.txt            : ${withRobots.length} (${pct(withRobots.length, ok.length).toFixed(1)}%)`);
console.log(`no robots.txt at all      : ${noRobots.length} (${pct(noRobots.length, ok.length).toFixed(1)}%)`);
console.log(`robots.txt blocks >=1 AI crawler : ${blockedAny.length} (${pct(blockedAny.length, ok.length).toFixed(1)}%)`);
console.log(`robots.txt blocks GPTBot  : ${blockedGpt.length} (${pct(blockedGpt.length, ok.length).toFixed(1)}%)`);
console.log(`explicitly allow at least one AI crawler : ${clean.length} (${pct(clean.length, ok.length).toFixed(1)}%)`);
console.log(`\nnote: "no robots.txt" is counted as blocked, because a crawler cannot read a`);
console.log(`      permission that does not exist. The two figures are broken out above so`);
// The claim being tested is "at least one critical issue". Restate it precisely.
console.log(`      the stricter reading (has robots AND blocks an AI crawler) is:`);
console.log(`      ${blockedAny.length} / ${ok.length} = ${pct(blockedAny.length, ok.length).toFixed(1)}%`);

console.log('\n' + '='.repeat(64));
console.log('llms.txt PRESENCE  (the "3.4x" claim was about this; presence is measurable)');
console.log('='.repeat(64));
const withLlms = ok.filter(r => r.hasLlmsTxt === '1');
console.log(`has llms.txt : ${withLlms.length} / ${ok.length} = ${pct(withLlms.length, ok.length).toFixed(1)}%`);
const sWith = withLlms.map(r => num(r.score)).filter(v => v !== null);
const sWithout = ok.filter(r => r.hasLlmsTxt !== '1').map(r => num(r.score)).filter(v => v !== null);
if (sWith.length && sWithout.length) {
  const mW = sWith.reduce((a, b) => a + b, 0) / sWith.length;
  const mO = sWithout.reduce((a, b) => a + b, 0) / sWithout.length;
  console.log(`mean score with llms.txt    : ${mW.toFixed(1)}  (n=${sWith.length})`);
  console.log(`mean score without         : ${mO.toFixed(1)}  (n=${sWithout.length})`);
  console.log(`difference                 : ${(mW - mO >= 0 ? '+' : '') + (mW - mO).toFixed(1)} points`);
  console.log(`\nThis is a correlation in a convenience sample, NOT a causal effect and NOT a`);
  console.log(`"citation lift". Sites that add llms.txt may differ in many other ways.`);
}

console.log('\n' + '='.repeat(64));
console.log('PER-DIMENSION  (share of the max score achieved, scored samples only)');
console.log('='.repeat(64));
console.log('dimension                  avg   max   n     %of max');
for (const k of DIM_KEYS) {
  const vals = ok.map(r => num(r[k])).filter(v => v !== null && !Number.isNaN(v));
  if (!vals.length) { console.log(`${DIM_LABEL[k].padEnd(24)} -- no data`); continue; }
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  console.log(`${DIM_LABEL[k].padEnd(24)} ${avg.toFixed(1).padStart(4)} ${String(MAX[k]).padStart(5)} ${String(vals.length).padStart(5)}   ${(avg / MAX[k] * 100).toFixed(0)}%`);
}

console.log('\n' + '='.repeat(64));
console.log('WHAT THIS DATA CANNOT SUPPORT');
console.log('='.repeat(64));
console.log('The previous post also claimed:');
console.log('  - "3.4x citation lift for sites with a valid llms.txt"');
console.log('  - "FAQ schema 6.1x more likely to be cited for question queries"');
console.log('  - "HowTo schema 3.8x more likely to be cited for step-by-step queries"');
console.log('  - "the top 3 fixes deliver ~80% of the score improvement"');
console.log('\nAll four are claims about whether an AI engine CITED a site. A static');
console.log('crawler audit cannot observe citation. Measuring them needs either a');
console.log('multi-engine citation crawl or the LLM simulation in worker/visibility.js,');
console.log('which is an estimate rather than a measurement. They are therefore NOT');
console.log('reproducible from this dataset and are not restated here.');
