/**
 * GeoScore sample builder — deterministic source list for the "1,200 audits" study.
 *
 * Why this file exists: the blog post src/pages/blog/auditing-1200-websites.astro
 * claims 1,200 audited sites. The production D1 database holds 3 audit rows covering
 * 1 distinct URL, and the earliest row (2026-08-23) post-dates the post's stated
 * publish date (2026-07-21), so the claim has no traceable origin. This script
 * produces a reproducible sample instead of asserting one.
 *
 * Sampling rule (must stay stable so the study can be re-run and compared):
 *   - Source: GitHub Search API, repositories, sorted by stars descending.
 *   - Stratified: 12 star bands, each contributing the top 100 repos.
 *     Bands are fixed constants; they are not derived from the data.
 *   - Only repos with a non-empty `homepage` are kept, because a site is required.
 *   - Deduplicated by registrable host, so one company is counted once.
 *   - The resulting list is written to data/geo-corpus.csv with a stable order.
 *
 * Usage:  node tools/build-corpus.mjs [--max N] [--per-band N] [--out PATH]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'geoscoretudy/1.0 (one-off reproducible sample; contact: repo owner)';

// Fixed, documented sampling bands. Changing these invalidates comparison with
// any previously published number, so they are intentionally hard-coded.
const STAR_BANDS = [
  'stars:>=50000', 'stars:20000..49999', 'stars:10000..19999', 'stars:5000..9999',
  'stars:2000..4999', 'stars:1000..1999', 'stars:600..999', 'stars:400..599',
  'stars:250..399', 'stars:150..249', 'stars:80..149', 'stars:50..79',
];

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const PER_BAND = Number(opt('--per-band', '100'));
const MAX = Number(opt('--max', '1200'));
const OUT = path.resolve(REPO, opt('--out', 'data/geo-corpus.csv'));

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Strip scheme, path, "www.", and trailing dots so a company counts once. */
function registrableHost(raw) {
  let h = String(raw || '').trim().toLowerCase();
  if (!h) return null;
  if (!/^https?:\/\//.test(h)) h = 'http://' + h;
  try {
    const u = new URL(h);
    h = u.hostname;
  } catch {
    // Try the first path-ish token, e.g. "example.com/docs".
    const m = String(raw).trim().match(/^([a-z0-9.-]+\.[a-z]{2,})/i);
    if (!m) return null;
    h = m[1].toLowerCase();
  }
  h = h.replace(/^www\./, '').replace(/\.+$/, '');
  if (!h.includes('.')) return null;
  if (!/^[a-z0-9.-]+$/.test(h)) return null;
  if (h.endsWith('.github.io') || h.endsWith('.gitlab.io') || h.endsWith('.vercel.app')
      || h.endsWith('.netlify.app') || h.endsWith('.pages.dev') || h.endsWith('.herokuapp.com')) {
    return null; // hosting placeholder, not the company's own site
  }
  return h;
}

async function fetchBand(band, perBand) {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(band)}`
    + `&sort=stars&order=desc&per_page=${perBand}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/vnd.github+json' } });
    if (res.status === 403 || res.status === 429) {
      // Search API is 10 requests/minute unauthenticated. Back off and retry.
      await sleep(20000 + attempt * 15000);
      continue;
    }
    if (!res.ok) throw new Error(`${band}: HTTP ${res.status}`);
    const j = await res.json();
    return Array.isArray(j.items) ? j.items : [];
  }
  return [];
}

const seenHost = new Map();
const rows = [];
let fetched = 0;

for (const band of STAR_BANDS) {
  if (rows.length >= MAX) break;
  const need = Math.min(PER_BAND, MAX - rows.length);
  const items = await fetchBand(band, need);
  fetched += items.length;
  let kept = 0;
  for (const it of items) {
    if (rows.length >= MAX) break;
    const host = registrableHost(it.homepage);
    if (!host) continue;
    if (seenHost.has(host)) continue;
    seenHost.set(host, it.full_name);
    rows.push({
      host,
      repo: it.full_name,
      stars: it.stargazers_count,
      band,
      description: (it.description || '').replace(/[\r\n,]/g, ' ').slice(0, 160),
    });
    kept++;
  }
  console.error(`band ${band.padEnd(16)} fetched=${String(items.length).padStart(3)} kept=${kept}`);
  await sleep(7000); // stay under 10 req/min for the search API
}

rows.sort((a, b) => b.stars - a.stars || a.host.localeCompare(b.host));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const esc = v => `"${String(v).replace(/"/g, '""')}"`;
const csv = ['host,repo,stars,band,description']
  .concat(rows.map(r => [esc(r.host), esc(r.repo), r.stars, esc(r.band), esc(r.description)].join(',')))
  .join('\n') + '\n';
fs.writeFileSync(OUT, csv, 'utf8');

console.error(`\nfetched=${fetched} unique-hosts=${rows.length} out=${OUT}`);
console.error(`bands=${STAR_BANDS.length} rule=GitHub search, sorted by stars desc, top ${PER_BAND} per band, deduped by registrable host`);
