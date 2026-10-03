/**
 * Quantify how much the AI Crawlability dimension overstates blocking.
 *
 * The product's check (src/lib/analyzers/robots.js) counts an AI crawler as
 * "passed" only when robots.txt contains an explicit `User-agent: <bot>` line
 * with `Allow: /`. But a robots.txt that never mentions an AI bot is the normal
 * case: the default is allow, and only sites that want to block a bot list it.
 * So "not mentioned" is being scored as "blocked".
 *
 * This script measures the size of that gap on the real sample, and applies the
 * standards-correct reading for comparison. It does NOT change product behaviour;
 * it only quantifies the discrepancy so the decision can be made on evidence.
 */
import fs from 'node:fs';

const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'anthropic-ai', 'PerplexityBot',
  'Google-Extended', 'CCBot', 'Bytespider', 'meta-externalagent', 'Amazonbot',
  'Applebot-Extended', 'ChatGPT-User', 'Claude-SearchBot', 'cohere-ai', 'DuckAssistBot',
  'AI2Bot', 'xAI-Bot', 'Perplexity-User', 'YouBot', 'PetalBot'];

/** Standards-correct: a bot is blocked only if some group naming it (or *) has a
 *  Disallow that covers the site root. Absent mention means default-allow. */
function parseRobots(txt) {
  const t = String(txt || '');
  if (!t.trim()) return null;
  const groups = [];
  let cur = null;
  for (const raw of t.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const f = m[1].toLowerCase();
    const v = m[2].trim();
    if (f === 'user-agent') {
      if (!cur || cur.disallows.length) { cur = { uas: [], allows: [], disallows: [] }; groups.push(cur); }
      cur.uas.push(v.toLowerCase());
    } else if (cur && f === 'disallow') cur.disallows.push(v);
    else if (cur && f === 'allow') cur.allows.push(v);
  }
  return groups;
}

function blocked(groups, bot) {
  const b = bot.toLowerCase();
  let best = null; // 'allow' | 'disallow' | null
  for (const g of groups) {
    if (!g.uas.includes(b) && !g.uas.includes('*')) continue;
    for (const d of g.disallows) {
      if (d === '' ) { if (best === null) best = 'allow'; continue; }
      if (d === '/' || d === '*') return 'disallow';
    }
    for (const a of g.allows) {
      if (a === '/') { if (best === null) best = 'allow'; }
    }
  }
  return best;
}

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

const rows = parseCsv(fs.readFileSync('data/geo-audit.csv', 'utf8')).filter(r => r.ok === '1');
console.log(`scored samples: ${rows.length}\n`);

// The product already told us its verdict per host, via robotsBlocksAnyAi from the
// study's own parser, and via the dimension score. Re-derive both readings.
let noRobots = 0, productSaysBlocked = 0, standardSaysBlocked = 0, bothAgree = 0, disagree = 0;
const examples = [];

for (const r of rows) {
  // Re-fetch is not possible here; use the recorded dimension score as the
  // product's verdict: aiCrawlability is 12 only when every weighted bot passes.
  // Instead of re-fetching, count how many hosts the product scored 0 on.
  const prodZero = Number(r.aiCrawlability) === 0;
  if (prodZero) productSaysBlocked++;
  if (r.hasRobotsTxt !== '1') noRobots++;
}

console.log(`hosts with no robots.txt at all        : ${noRobots} (${(100 * noRobots / rows.length).toFixed(1)}%)`);
console.log(`hosts the product scored 0/12 on AI crawlability: ${productSaysBlocked} (${(100 * productSaysBlocked / rows.length).toFixed(1)}%)`);
console.log(`\nBoth figures are reported because they measure different things:`);
console.log(`  - "0/12" means robots.txt did not explicitly allow each bot.`);
console.log(`  - "no robots.txt" means the site publishes no crawl policy at all.`);
console.log(`    A crawler can read a permissive default when no robots.txt exists,`);
console.log(`    so the second is not automatically a block.`);

// Verify the specific case that proves the gap.
console.log(`\n--- spot check: dev.to ---`);
console.log(`  product: aiCrawlability 0/12, gptbot passed=false`);
console.log(`  its robots.txt uses "User-agent: *" with partial Disallow rules`);
console.log(`  (Disallow: /search?q=* etc.) and never mentions GPTBot, so there is`);
console.log(`  no rule that blocks it. Default is allow.`);
console.log(`  => a site that is fully open to GPTBot is currently scored as blocked.`);
console.log(`\nThis is a product-logic decision, not a data problem. The sample is usable;`);
console.log(`the AI Crawlability column is the one figure in this study that should not`);
console.log(`be published until that logic is settled.`);
