#!/usr/bin/env node
/**
 * ga4-probe.mjs — ad-hoc GA4 probes, one query per invocation.
 *
 * WHY: the answers to "which of these two explanations is true" need different
 * dimension combinations, and cramming them into one runReport gets unreadable.
 * Each probe is independent so a failure in one does not hide the others.
 *
 * Credentials: secrets/ga4-reader.json (gitignored). Same setup as ga4-report.mjs.
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROPERTY_ID = process.env.GA4_PROPERTY_ID || '546156702';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const RANGE = { startDate: '28daysAgo', endDate: 'today' };

const key = JSON.parse(readFileSync(join(REPO, 'secrets', 'ga4-reader.json'), 'utf8'));

function b64(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function token() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const c = b64(
    JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: TOKEN_URI, iat: now, exp: now + 3600 })
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${h}.${c}`);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: `${h}.${c}.${b64(signer.sign(key.private_key))}`,
  });
  const r = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return (await r.json()).access_token;
}

const tok = await token();

async function report(body) {
  const r = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  const j = await r.json();
  if (!r.ok) throw new Error(`${r.status}: ${JSON.stringify(j).slice(0, 500)}`);
  return j;
}

function rows(rep) {
  const dims = (rep.dimensionHeaders || []).map((h) => h.name.replace(/^customEvent:/, ''));
  const mets = (rep.metricHeaders || []).map((h) => h.name);
  return (rep.rows || []).map((r) => {
    const o = {};
    dims.forEach((d, i) => (o[d] = r.dimensionValues[i].value));
    mets.forEach((m, i) => (o[m] = r.metricValues[i].value));
    return o;
  });
}

const ev = (name) => ({
  filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: name } },
});
// IN_LIST is not a stringFilter match_type in the REST API — it is its own filter
// kind, `inListFilter`, with a `values` list. Confirmed against the runReport
// reference: dimensionFilter.filter = { fieldName, inListFilter: { values: [...] } }.
const evList = (names) => ({
  filter: { fieldName: 'eventName', inListFilter: { values: names } },
});

const AUDIT_EVENTS = ['audit_started', 'audit_completed', 'audit_failed', 'result_viewed'];

// --- probe 1: per-day funnel -------------------------------------------------
// Question: did result_viewed ever fire on a day that had audit_completed?
// If a day shows completed>0 and viewed=0 consistently, the event is broken,
// not merely delayed.
console.log('=== PROBE 1: audit funnel per day (28 days) ===');
{
  const r = await report({
    dateRanges: [RANGE],
    dimensions: [{ name: 'date' }, { name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: evList(AUDIT_EVENTS),
    limit: 300,
  });
  const byDay = {};
  for (const row of rows(r)) {
    const d = row.date;
    byDay[d] = byDay[d] || {};
    byDay[d][row.eventName] = Number(row.eventCount);
  }
  const head = 'date'.padEnd(10) + AUDIT_EVENTS.map((e) => e.padStart(16)).join('');
  console.log(head);
  const totals = {};
  for (const d of Object.keys(byDay).sort()) {
    console.log(
      d.padEnd(10) +
        AUDIT_EVENTS.map((e) => String(byDay[d][e] || 0).padStart(16)).join('')
    );
    for (const e of AUDIT_EVENTS) totals[e] = (totals[e] || 0) + (byDay[d][e] || 0);
  }
  console.log(
    'TOTAL'.padEnd(10) + AUDIT_EVENTS.map((e) => String(totals[e] || 0).padStart(16)).join('')
  );
  const daysWithCompleted = Object.values(byDay).filter((d) => d.audit_completed > 0).length;
  const daysWithViewed = Object.values(byDay).filter((d) => d.result_viewed > 0).length;
  console.log(`\n  days with audit_completed : ${daysWithCompleted}`);
  console.log(`  days with result_viewed  : ${daysWithViewed}`);
  if (daysWithViewed === 0) {
    console.log('  => result_viewed NEVER fired in 28 days. Not a reporting-delay question.');
  }
}

// --- probe 2: engagement by page --------------------------------------------
// Question: is the 13.5% engagement rate uniform, or is one page dragging it?
console.log('\n=== PROBE 2: per-page engagement ===');
{
  const r = await report({
    dateRanges: [RANGE],
    dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'activeUsers' },
      { name: 'userEngagementDuration' },
      { name: 'bounceRate' },
    ],
    limit: 30,
  });
  console.log('  path'.padEnd(34) + 'views'.padStart(7) + 'users'.padStart(7) + 'avgSec'.padStart(8) + 'bounce'.padStart(8));
  for (const row of rows(r)) {
    const d = Number(row.userEngagementDuration) || 0;
    const u = Number(row.activeUsers) || 0;
    const avg = u ? (d / u).toFixed(0) : '?';
    console.log(
      '  ' + String(row.pagePath || '(none)').padEnd(32) +
      String(row.screenPageViews).padStart(7) +
      String(row.activeUsers).padStart(7) +
      String(avg).padStart(8) +
      String(row.bounceRate).padStart(8)
    );
  }
}

// --- probe 3: landing page vs audit start -----------------------------------
// Question: pages that get views but never start an audit. If /tools/* has views
// but no audit_started row on the same path, the tool page is not converting.
console.log('\n=== PROBE 3: page_view on /tools/* vs audit_started there ===');
{
  const views = await report({
    dateRanges: [RANGE],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
    dimensionFilter: {
      filter: {
        fieldName: 'pagePath',
        stringFilter: { matchType: 'CONTAINS', value: '/tools/' },
      },
    },
    limit: 20,
  });
  const starts = await report({
    dateRanges: [RANGE],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'audit_started' } },
    },
    limit: 20,
  });
  console.log('  tool page views:');
  for (const row of rows(views)) {
    console.log(`    ${String(row.pagePath).padEnd(36)} views=${row.screenPageViews} users=${row.activeUsers}`);
  }
  console.log('  audit_started by path:');
  const byPath = rows(starts);
  if (!byPath.length) console.log('    (audit_started carries no pagePath dimension — it is not in the report)');
  for (const row of byPath) {
    console.log(`    ${String(row.pagePath).padEnd(36)} starts=${row.eventCount}`);
  }
}

// --- probe 4: error_code on failures ----------------------------------------
// Question: are the 3 audit_failed events carrying an error_code?
// NOTE: `error_code` is NOT registered in GA4 (it returns 400 with a
// "Did you mean cta_id" hint), even though boot.js sends it. So we cannot read
// it yet. `entry_point`/`url_domain`/`cta_id` ARE registered and return 200.
console.log('\n=== PROBE 4: which custom dimensions actually exist? ===');
{
  for (const d of [
    'entry_point',
    'url_domain',
    'cta_id',
    'billing_period',
    'transport_type',
    'target_site',
    'tool_name',
    'error_code',
    'format',
    'file',
    'authed',
    'source_type',
    'score_bucket',
    // 这三个是 boot.js 真正在上报、但此前从未核对过注册状态的。
    // duration_ms 最关键：审计耗时全靠它，读不到就只能靠一次性探针。
    'duration_ms',
    'score',
    'level',
  ]) {
    let verdict;
    try {
      const r = await report({
        dateRanges: [RANGE],
        dimensions: [{ name: `customEvent:${d}` }],
        metrics: [{ name: 'eventCount' }],
        limit: 8,
      });
      const rs = rows(r);
      const real = rs.filter((x) => x[d] !== '(not set)');
      verdict =
        'REGISTERED  ' +
        (real.length
          ? real.map((x) => `${x[d]}=${x.eventCount}`).join('  ')
          : `all rows (not set)  [${rs.length} rows]`);
    } catch (e) {
      verdict = 'NOT REGISTERED  ' + String(e.message).slice(0, 70);
    }
    console.log(`  ${d.padEnd(16)} ${verdict}`);
  }
}

// --- probe 5: hostName split -------------------------------------------------
// Question: how much of the traffic is on non-canonical hosts? A data stream
// only receives what its host receives, so this caps what the numbers can mean.
console.log('\n=== PROBE 5: hostName split (all events) ===');
{
  const r = await report({
    dateRanges: [RANGE],
    dimensions: [{ name: 'hostName' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    limit: 20,
  });
  for (const row of rows(r)) {
    console.log(`  ${String(row.hostName).padEnd(30)} events=${String(row.eventCount).padStart(5)} users=${row.totalUsers}`);
  }
}
