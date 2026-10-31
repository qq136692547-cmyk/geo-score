/**
 * One-off: recompute the headline numbers for the 324-site study from the
 * audited CSV. Written as a file rather than a `node -e` one-liner because the
 * quoted CSV parser is too easy to mangle inline, and these numbers are going
 * into a published post — they have to be reproducible with one command.
 *
 * Usage: node tools/study-stats.mjs [data/geo-audit-v2-final.csv]
 */
import fs from 'node:fs';

const IN = process.argv[2] || 'data/geo-audit-v2-final.csv';

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
  return rows.filter((r) => r.length > 1 && r[0]);
}

const rows = parseCsv(fs.readFileSync(IN, 'utf8'));
const hdr = rows[0];
const data = rows.slice(1);
const col = (n) => hdr.indexOf(n);
const num = (row, n) => {
  const v = row[col(n)];
  if (v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const flag = (row, n) => row[col(n)] === '1';

const scores = data.map((r) => num(r, 'score')).filter((v) => v !== null).sort((a, b) => a - b);
const sum = scores.reduce((a, b) => a + b, 0);
const mean = sum / scores.length;
const median = scores.length % 2
  ? scores[(scores.length - 1) / 2]
  : (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2;
const pct = (n) => ((n / data.length) * 100).toFixed(1) + '%';
const band = (lo, hi) => scores.filter((s) => s >= lo && s < hi).length;

const noLlms = data.filter((r) => !flag(r, 'hasLlmsTxt')).length;
const blocksAny = data.filter((r) => flag(r, 'robotsBlocksAnyAi')).length;
const blocksGpt = data.filter((r) => flag(r, 'robotsBlocksGptbot')).length;
const noRobots = data.filter((r) => !flag(r, 'hasRobotsTxt')).length;
const noLlmsAndBlocks = data.filter((r) => !flag(r, 'hasLlmsTxt') && flag(r, 'robotsBlocksAnyAi')).length;
const noLlmsNoRobots = data.filter((r) => !flag(r, 'hasLlmsTxt') && !flag(r, 'hasRobotsTxt')).length;

const DIMS = [
  'aiCrawlability', 'aiGuidance', 'structuredData', 'metaSocial', 'contentQuality',
  'eeat', 'brandEntity', 'citationReadiness', 'discoveryEndpoints', 'agentFriendliness', 'freshness',
];

console.log(`source: ${IN}`);
console.log(`sites audited: ${data.length}`);
console.log('');
console.log('--- score distribution ---');
console.log(`mean   ${mean.toFixed(1)}`);
console.log(`median ${median}`);
console.log(`min    ${scores[0]}   max ${scores[scores.length - 1]}`);
console.log(`  <30    ${band(0, 30)}  (${pct(band(0, 30))})`);
console.log(`  30-49  ${band(30, 50)}  (${pct(band(30, 50))})`);
console.log(`  50-69  ${band(50, 70)}  (${pct(band(50, 70))})`);
console.log(`  70-84  ${band(70, 85)}  (${pct(band(70, 85))})`);
console.log(`  85+    ${band(85, 101)}  (${pct(band(85, 101))})`);
console.log('');
console.log('--- machine-readability gaps ---');
console.log(`no llms.txt                 ${noLlms}  (${pct(noLlms)})`);
console.log(`no robots.txt at all        ${noRobots}  (${pct(noRobots)})`);
console.log(`robots.txt blocks >=1 AI    ${blocksAny}  (${pct(blocksAny)})`);
console.log(`robots.txt blocks GPTBot    ${blocksGpt}  (${pct(blocksGpt)})`);
console.log(`no llms.txt AND blocks AI   ${noLlmsAndBlocks}  (${pct(noLlmsAndBlocks)})`);
console.log(`no llms.txt AND no robots   ${noLlmsNoRobots}  (${pct(noLlmsNoRobots)})`);
console.log('');
console.log('--- dimension means (out of each dimension max) ---');
for (const d of DIMS) {
  const v = data.map((r) => num(r, d)).filter((x) => x !== null);
  if (!v.length) { console.log(`  ${d.padEnd(20)} (no data)`); continue; }
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  console.log(`  ${d.padEnd(20)} ${m.toFixed(1)}`);
}
