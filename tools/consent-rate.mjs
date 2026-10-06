#!/usr/bin/env node
/**
 * consent-rate.mjs — what share of visitors accept the GA consent banner?
 *
 * WHY THIS EXISTS
 * The consent gate is strict opt-in: gtag() is only defined after the visitor
 * accepts, so GA4 literally cannot see anyone who declined. That makes the
 * acceptance rate unmeasurable from GA4 alone. Cloudflare Web Analytics is
 * injected at the edge and is NOT gated by consent.js (verified: consent.js
 * never touches the cf beacon), so it counts everyone. Ratio of the two is the
 * acceptance rate.
 *
 * THE ONE THING THAT IS EASY TO GET WRONG
 * Cloudflare's "visit" is NOT a unique visitor. Per Cloudflare's own docs:
 *   "A visit is defined simply as a successful page view that has an HTTP
 *    referer that doesn't match the hostname of the request."
 *   "A visit has slightly different semantics from a 'unique'..."
 * So visits exclude direct/bookmark traffic entirely, and dividing GA4 *users*
 * by CF *visits* produces nonsense (frequently > 100%).
 *
 * Both sides are JS beacons, so both exclude non-JS traffic — that shared
 * exclusion is what makes the pageview-vs-pageview ratio defensible.
 *
 * PRIMARY METRIC:  GA4 screenPageViews / CF rum pageload count
 * The visits/sessions row is printed only as a warning, never as the answer.
 *
 * Credentials:
 *   GA4   secrets/ga4-reader.json (gitignored) — already present
 *   CF    CF_API_TOKEN + CF_ACCOUNT_TAG env vars — NOT present, see README below
 *
 * Usage:
 *   node tools/consent-rate.mjs                 # last 28 days
 *   node tools/consent-rate.mjs --days 7
 *
 * If CF credentials are missing the script still reports the GA4 side and says
 * plainly that the rate is uncomputable. It does not guess.
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROPERTY_ID = process.env.GA4_PROPERTY_ID || '546156702';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

// Hosts that are the real site. 127.0.0.1 is local dev and is excluded on both
// sides so numerator and denominator cover the same population.
const HOSTS = ['geoscore.help', 'www.geoscore.help', 'geoscore-532.pages.dev'];

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const DAYS = Number(arg('days', 28));

const key = JSON.parse(readFileSync(join(REPO, 'secrets', 'ga4-reader.json'), 'utf8'));

function b64(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function gaToken() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const c = b64(JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: TOKEN_URI, iat: now, exp: now + 3600 }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${h}.${c}`);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: `${h}.${c}.${b64(signer.sign(key.private_key))}`,
  });
  return (await (await fetch(TOKEN_URI, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })).json()).access_token;
}

const tok = await gaToken();

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}
// GA4 and CF window must be identical. End at yesterday: "today" is partial on
// both sides but not partial by the same amount (different timezones).
// Normalise to a UTC midnight first, otherwise the offset below carries the
// current wall-clock time into the CF bounds.
const end = new Date(Date.now() - 864e5);
end.setUTCHours(0, 0, 0, 0);
const start = new Date(end.getTime() - (DAYS - 1) * 864e5);
const GA_RANGE = { startDate: isoDay(start), endDate: isoDay(end) };

async function report(body) {
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`GA4 ${r.status}: ${JSON.stringify(j).slice(0, 400)}`);
  return j;
}

// GA4 reports whole days in the property timezone; CF reports in UTC. Without
// aligning them the two 28-day windows are offset by the timezone gap and the
// boundary days land in different buckets on each side.
async function propertyTz() {
  try {
    const r = await fetch(`https://analyticsadmin.googleapis.com/v1beta/properties/${PROPERTY_ID}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    return (await r.json()).timeZone || 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

const tz = await propertyTz();

function tzOffsetHours(tzName, at) {
  if (tzName === 'UNKNOWN') return 0;
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tzName, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const g = (t) => Number(p.find((x) => x.type === t).value);
  const asUTC = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second'));
  return (asUTC - Math.floor(at.getTime() / 1000) * 1000) / 3600000;
}

const OFF = tzOffsetHours(tz, start);
// Shift the CF window so it starts/ends at the same wall-clock moment GA4 did.
const cfStart = new Date(start.getTime() - OFF * 3600e3);
const cfEnd = new Date(end.getTime() - OFF * 3600e3 + 86399e3);

// ---------- numerator: GA4, consented users only ----------
const ga = await report({
  dateRanges: [GA_RANGE],
  dimensions: [{ name: 'hostName' }],
  metrics: [
    { name: 'screenPageViews' },
    { name: 'sessions' },
    { name: 'totalUsers' },
  ],
});

let gaPv = 0, gaSessions = 0, gaUsers = 0;
const gaByHost = [];
for (const row of ga.rows || []) {
  const host = row.dimensionValues[0].value;
  const pv = Number(row.metricValues[0].value);
  const se = Number(row.metricValues[1].value);
  const us = Number(row.metricValues[2].value);
  gaByHost.push([host, pv, se, us]);
  if (HOSTS.includes(host)) {
    gaPv += pv; gaSessions += se; gaUsers += us;
  }
}

// ---------- denominator: Cloudflare Web Analytics, everyone ----------
const CF_TOKEN = process.env.CF_API_TOKEN;
const ACCOUNT_TAG = process.env.CF_ACCOUNT_TAG;
// The siteTag MUST come from the Analytics API, not from the page beacon.
//
// The old default was scraped out of the injected data-cf-beacon attribute on
// the live homepage and was simply WRONG: filtering on it returned 0 rows for
// every window, which looked like "Cloudflare has no data" for two rounds.
//
// Correct value (2026-10-07, from an unfiltered rumPageloadEventsAdaptiveGroups
// query listing siteTag per requestHost):
//   geoscore.help -> aae87fe93a3041d6b528a41c3ec00c29
// The account also hosts ag.anan.lat / cpa.anan.lat under a different tag, so
// guessing the tag from a page is not safe here.
const SITE_TAG = process.env.CF_SITE_TAG || 'aae87fe93a3041d6b528a41c3ec00c29';

let cf = null;
if (!CF_TOKEN || !ACCOUNT_TAG) {
  cf = { error: 'missing CF_API_TOKEN and/or CF_ACCOUNT_TAG' };
} else {
  const query = `{ viewer { accounts(filter: { accountTag: "${ACCOUNT_TAG}" }) {
    rumPageloadEventsAdaptiveGroups(
      limit: 5000
      orderBy: [count_DESC]
      filter: { siteTag: "${SITE_TAG}"
                datetime_geq: "${cfStart.toISOString().replace(/\.\d+Z$/, '')}Z"
                datetime_leq: "${cfEnd.toISOString().replace(/\.\d+Z$/, '')}Z" }
    ) { count dimensions { requestHost } } } } }`;

  const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const j = await r.json();
  // CF returns query-level failures as HTTP 200 with an errors array.
  if (j.errors) {
    cf = { error: `CF GraphQL errors: ${JSON.stringify(j.errors).slice(0, 400)}` };
  } else {
    const groups = j?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups || [];
    let pv = 0;
    const byHost = [];
    for (const g of groups) {
      const host = g.dimensions?.requestHost || '(none)';
      byHost.push([host, g.count]);
      if (HOSTS.includes(host)) pv += g.count;
    }
    cf = { pv, byHost };
  }
}

// ---------- output ----------
console.log(`\n窗口 ${isoDay(start)} → ${isoDay(end)}（${DAYS} 天，截止昨天）`);
console.log(`GA4 属性时区: ${tz}（UTC${OFF >= 0 ? '+' : ''}${OFF}）  |  CF 侧为 UTC`);
console.log(`CF 窗口已按 ${OFF}h 平移对齐为：${cfStart.toISOString()} → ${cfEnd.toISOString()}\n`);

console.log('=== 分子 GA4（仅同意者） ===');
for (const [host, pv, se, us] of gaByHost) {
  console.log(`  ${host.padEnd(24)} pv=${String(pv).padStart(5)} sessions=${String(se).padStart(4)} users=${String(us).padStart(4)}`);
}
console.log(`  ${'计入小计'.padEnd(22)} pv=${String(gaPv).padStart(5)} sessions=${String(gaSessions).padStart(4)} users=${String(gaUsers).padStart(4)}`);

console.log('\n=== 分母 Cloudflare Web Analytics（全站，不受同意门控） ===');
if (cf.error) {
  console.log(`  未取得：${cf.error}`);
} else {
  for (const [host, c] of cf.byHost) console.log(`  ${host.padEnd(24)} pv=${String(c).padStart(5)}`);
  console.log(`  ${'计入小计'.padEnd(22)} pv=${String(cf.pv).padStart(5)}`);
}

console.log('\n=== 同意率 ===');
if (cf.error) {
  console.log('  无法计算 —— 缺 Cloudflare 凭证。见本文件顶部 README。');
  console.log(`  （GA4 分子已就绪：${gaPv} pv，${DAYS} 天）`);
} else if (cf.pv === 0) {
  console.log('  无法计算 —— CF 分母为 0。');
} else {
  const rate = (gaPv / cf.pv) * 100;
  console.log(`  主口径（pv/pv）： ${gaPv} / ${cf.pv} = ${rate.toFixed(1)}%`);
  console.log('');
  console.log('  ⚠️ 下面这行不是答案，CF 的 visit 不是唯一访客（见文件头注释）：');
  console.log(`     sessions/visits 口径仅供参考，勿直接引用`);
}
console.log('');
