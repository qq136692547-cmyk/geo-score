/**
 * Read-only probe: how long does one audit take when the CORS-proxy chain is
 * NOT involved (Node, server-side, direct fetch with a browser-ish UA)?
 *
 * Purpose: separate "our fetch pipeline is slow" from "the browser has to go
 * through proxies". The browser measured ~30s for one audit; this script tells
 * us how much of that is the proxy chain and how much is inherent.
 *
 * It also derives, from the per-request timeline, what the pre-7a1d013
 * (two sequential batches) and post-7a1d013 (optional fetches started up
 * front) orderings would cost. That part is DERIVED, not measured — see
 * deriveOrderings() for the arithmetic and its one assumption.
 *
 * Usage: node tools/p4-ab-node.mjs [url ...]
 */
import { auditUrl } from '../src/lib/node-scanner.js';

const TARGETS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['https://geoscore.help/', 'https://n8n.io/', 'https://example.com/'];

const PROXY_HOSTS = ['allorigins', 'codetabs', 'corsproxy', 'geo-score-proxy'];

const t0 = Date.now();
const log = [];
let seq = 0;

const realFetch = globalThis.fetch;
globalThis.fetch = async function (input, init) {
  const url = typeof input === 'string' ? input : input && input.url ? input.url : String(input);
  const id = ++seq;
  const start = Date.now() - t0;
  const rec = { id, url, start, viaProxy: PROXY_HOSTS.some((h) => url.includes(h)) };
  log.push(rec);
  try {
    const res = await realFetch(input, init);
    rec.end = Date.now() - t0;
    rec.ms = rec.end - rec.start;
    rec.status = res.status;
    rec.outcome = res.ok ? 'ok' : `http${res.status}`;
    return res;
  } catch (err) {
    rec.end = Date.now() - t0;
    rec.ms = rec.end - rec.start;
    rec.outcome = `err:${err && err.name ? err.name : err}`;
    throw err;
  }
};

function label(url) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 58);
}

function deriveOrderings(records, pageHtmlEnd) {
  // Batch 1 (core): robots.txt, llms.txt, page HTML — started at t=0 in BOTH
  // orderings, so it finishes at the same moment either way.
  // Batch 2 (optional): ai.txt, ai/summary.json, ai/faq.json, sitemap.xml,
  // /about, content-page.
  //   OLD: starts only after batch 1 resolves.
  //   NEW: five of the six start at t=0; the content page still needs pageHtml.
  const optional = records.filter((r) => !r.core);
  const contentPage = optional.filter((r) => r.isContentPage);
  const rest = optional.filter((r) => !r.isContentPage);
  if (!optional.length) return null;
  const batch1End = records.filter((r) => r.core).reduce((m, r) => Math.max(m, r.end), 0);
  const oldEnd = optional.reduce((m, r) => Math.max(m, r.end), 0);
  const restEnd = rest.length ? rest.reduce((m, r) => Math.max(m, r.end), 0) : 0;
  const contentStart = contentPage.length
    ? contentPage.reduce((m, r) => Math.min(m, r.start), Infinity)
    : Infinity;
  // Assumption: under the new ordering each optional request keeps the same
  // duration it had here; only its start time moves to t=0 (or to pageHtml for
  // the content page). Durations are dominated by server/proxy latency and are
  // not affected by how many siblings are in flight.
  const contentEndNew = contentPage.length
    ? pageHtmlEnd + contentPage.reduce((m, r) => Math.max(m, r.ms), 0)
    : 0;
  const newEnd = Math.max(batch1End, restEnd, contentEndNew);
  return {
    batch1End,
    oldEnd,
    newEnd,
    savedMs: oldEnd - newEnd,
    contentStart,
    pageHtmlEnd,
  };
}

for (const target of TARGETS) {
  log.length = 0;
  seq = 0;
  const runStart = Date.now();
  let outcome = 'ok';
  let score = null;
  try {
    const r = await auditUrl(target);
    score = r.score;
  } catch (err) {
    outcome = `THREW: ${err.message.slice(0, 90)}`;
  }
  const wall = Date.now() - runStart;

  // Classify the requests this run made. Proxy requests are unwrapped first so
  // that a /about fetched through a proxy is still recognised as /about.
  const origin = new URL(target.startsWith('http') ? target : `https://${target}`).origin;
  const OPTIONAL_SUFFIXES = [
    '/robots.txt',
    '/llms.txt',
    '/ai/summary.json',
    '/ai/faq.json',
    '/sitemap.xml',
    '/.well-known/ai.txt',
    '/about',
  ];
  function actualUrl(r) {
    if (!r.viaProxy) return r.url;
    const m = r.url.match(/[?&](?:url|quest)=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : r.url;
  }
  const pageUrl = target.replace(/\/$/, '');
  for (const r of log) {
    const u = actualUrl(r);
    r.core = u === `${origin}/robots.txt` || u === `${origin}/llms.txt` || u === pageUrl;
    r.isContentPage = !r.core && !OPTIONAL_SUFFIXES.some((s) => u.endsWith(s));
  }
  const pageHtmlRec = log.find((r) => r.core && !r.url.endsWith('.txt'));
  const derived = deriveOrderings(log, pageHtmlRec ? pageHtmlRec.end : 0);

  console.log(`\n=== ${target} — ${outcome}${score !== null ? ` (score ${score})` : ''} ===`);
  console.log(`wall clock: ${wall}ms   requests: ${log.length}   via proxy: ${log.filter((r) => r.viaProxy).length}`);
  console.log('  #   start     ms   via   outcome  url');
  for (const r of [...log].sort((a, b) => a.start - b.start)) {
    console.log(
      `  ${String(r.id).padStart(2)}  ${String(r.start).padStart(6)}  ${String(r.ms).padStart(5)}  ${r.viaProxy ? 'PROXY' : '  -  '}  ${String(r.outcome).padEnd(8)} ${label(r.url)}${r.core ? '  [core]' : ''}`
    );
  }
  if (derived) {
    console.log(
      `  derived: batch1 ends ${derived.batch1End}ms | OLD total ${derived.oldEnd}ms | NEW total ${derived.newEnd}ms | saved ${derived.savedMs}ms`
    );
  }
}

globalThis.fetch = realFetch;
