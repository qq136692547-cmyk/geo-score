/**
 * Check the llms.txt and robots.txt of a list of domains, and write the raw
 * evidence to CSV.
 *
 * WHY THIS EXISTS
 * src/pages/fixpack.astro claims, in a sales paragraph, that we checked the
 * llms.txt and robots.txt of 20 well-known DTC stores ourselves and that every
 * llms.txt was either Shopify's stock template, a 65-byte broken file, or
 * missing. That claim had no artefact behind it — no list, no output, nothing a
 * buyer could ask to see. On a page that asks for $49, an unverifiable specific
 * is the same defect as the invented competitor price we removed.
 *
 * So this script produces the artefact. It records what each domain actually
 * returns, and the page copy is written from its output rather than from
 * memory. Re-run it and diff the CSV before repeating the claim.
 *
 * It deliberately does NOT score anything — the claim is about two files, so it
 * measures two files. Use tools/build-targets.mjs for scoring.
 *
 * Usage:
 *   node tools/dtc-llms-check.mjs --in data/dtc-stores.txt --out data/dtc-llms-check.csv
 *                                [--concurrency 5] [--timeout 12000]
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const IN = opt('--in', 'data/dtc-stores.txt');
const OUT = opt('--out', 'data/dtc-llms-check.csv');
const CONCURRENCY = Number(opt('--concurrency', '5'));
const TIMEOUT = Number(opt('--timeout', '12000'));

// A plain browser UA. Several of these sites 403 anything that looks scripted,
// and a 403 tells us nothing about their llms.txt.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'anthropic-ai', 'PerplexityBot', 'Google-Extended', 'CCBot', 'Bytespider'];

const domains = fs
  .readFileSync(IN, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => l.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase());

async function get(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, redirect: 'follow', signal: ctrl.signal });
    const body = await res.text();
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: '', error: (e && e.message) || String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Shopify now auto-generates an llms.txt for every store. It is NOT a summary
 * of the store's catalogue — it is an integration guide for the Universal
 * Commerce Protocol: how an agent should call the Shop skill, where the MCP
 * endpoint lives, how to build a cart, how to respect rate limits. Verified
 * against allbirds.com on 2026-11-01 (5,767 bytes, text/markdown).
 *
 * That distinction is the whole sales argument, so the verdict has to name it
 * precisely instead of calling it "has content". Matching on the protocol
 * vocabulary is stabler than matching a byte count, which will drift.
 */
const PLATFORM_TEMPLATE = /Agent Instructions|Universal Commerce Protocol|ucp\.dev|shop\.com\/SKILL|WebMCP/i;

/** A route that 200s but serves the storefront HTML is a soft 404, not content. */
function isHtml(body) {
  return /^\s*<(!DOCTYPE|html)/i.test(body);
}

function looksLikeStockTemplate(body) {
  const lower = body.toLowerCase();
  const hasProductFacts =
    /\$\s?\d/.test(body) ||           // a price
    /\b(in stock|out of stock)\b/.test(lower) ||
    /\/products\//.test(lower);       // a product URL
  const hasStoreNameHeading = /^#\s+/m.test(body);
  return hasStoreNameHeading && !hasProductFacts;
}

/** Which AI bots appear in robots.txt, and whether any is disallowed at root. */
function robotsVerdict(body) {
  if (!body) return { mentioned: '', disallowed: '', blocksRoot: 0 };
  const lines = body.split(/\r?\n/);
  const mentioned = new Set();
  const disallowed = new Set();
  let currentAgents = [];

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = /^user-agent\s*:\s*(.+)$/i.exec(line);
    if (m) {
      currentAgents = m[1].split(/\s+/).map((s) => s.trim());
      for (const a of currentAgents) {
        const hit = AI_BOTS.find((b) => b.toLowerCase() === a.toLowerCase());
        if (hit) mentioned.add(hit);
      }
      continue;
    }
    const d = /^disallow\s*:\s*(.*)$/i.exec(line);
    if (d) {
      const p = d[1].trim();
      // Only "/" (or nothing after Disallow:) blocks the whole site. A named
      // bot with Disallow: / is the case worth reporting.
      if (p === '/' || p === '') {
        for (const a of currentAgents) {
          const hit = AI_BOTS.find((b) => b.toLowerCase() === a.toLowerCase());
          if (hit) disallowed.add(hit);
        }
      }
    }
  }
  return {
    mentioned: [...mentioned].join(';'),
    disallowed: [...disallowed].join(';'),
    blocksRoot: disallowed.size > 0 ? 1 : 0,
  };
}

const esc = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const header = [
  'domain', 'llms_status', 'llms_bytes', 'llms_verdict', 'llms_first_line',
  'robots_status', 'robots_bytes', 'ai_bots_mentioned', 'ai_bots_disallowed_at_root', 'blocks_root',
];
fs.writeFileSync(OUT, header.join(',') + '\n', 'utf8');

let cursor = 0;
let done = 0;
const t0 = Date.now();

async function one(domain) {
  const [llms, robots] = await Promise.all([
    get(`https://${domain}/llms.txt`),
    get(`https://${domain}/robots.txt`),
  ]);

  let verdict;
  if (llms.status === 404) verdict = 'missing-404';
  else if (llms.status === 0) verdict = 'unreachable';
  else if (llms.status !== 200) verdict = `http-${llms.status}`;
  else if (isHtml(llms.body)) verdict = `soft-404-html-${llms.body.length}b`;
  else if (!llms.body.trim()) verdict = 'empty';
  else if (llms.body.length < 200) verdict = `broken-${llms.body.length}b`;
  else if (PLATFORM_TEMPLATE.test(llms.body)) verdict = 'platform-agent-template';
  else if (looksLikeStockTemplate(llms.body)) verdict = 'stock-template-no-product-facts';
  else verdict = 'catalog-content';

  const firstLine = (llms.body.split(/\r?\n/).find((l) => l.trim()) || '').slice(0, 80);
  const rv = robotsVerdict(robots.body);

  return [
    domain,
    llms.status || 'ERR',
    llms.status === 200 ? llms.body.length : '',
    verdict,
    llms.status === 200 ? firstLine : '',
    robots.status || 'ERR',
    robots.status === 200 ? robots.body.length : '',
    rv.mentioned,
    rv.disallowed,
    robots.status === 200 ? rv.blocksRoot : '',
  ].map(esc).join(',');
}

async function worker() {
  for (;;) {
    const i = cursor++;
    if (i >= domains.length) return;
    const line = await one(domains[i]);
    fs.appendFileSync(OUT, line + '\n');
    done++;
    if (done % 5 === 0 || done === domains.length) {
      const el = ((Date.now() - t0) / 1000).toFixed(0);
      console.error(`[${done}/${domains.length}] ${el}s`);
    }
  }
}

console.error(`domains=${domains.length} concurrency=${CONCURRENCY} timeout=${TIMEOUT}ms -> ${OUT}`);
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.error(`done. out=${OUT}`);
