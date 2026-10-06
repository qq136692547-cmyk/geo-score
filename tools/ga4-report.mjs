#!/usr/bin/env node
/**
 * ga4-report.mjs — pull the M2 acceptance numbers straight from the GA4 Data API.
 *
 * WHY THIS FILE EXISTS
 * The M2 acceptance metric is "share of audit_started events whose entry_point
 * is a tool page". Reading that off the GA4 UI means re-configuring a custom
 * report every single time. This script makes it one command and, more
 * importantly, makes the number reproducible — the output is written next to
 * the study data so a later run can be diffed against it.
 *
 * WHY IT NEEDS A SERVICE ACCOUNT KEY
 * GA4 Data API v1beta requires an OAuth2 access token. With the current
 * consent-gated setup the numbers we care about are only visible to a reader
 * account, so this uses a service account JSON key.
 *   API used: POST https://analyticsdata.googleapis.com/v1beta/properties/{id}:runReport
 *   Missing/invalid key => the API answers 401 UNAUTHENTICATED (verified).
 *
 * ⚠️  THE KEY MUST STAY OUT OF GIT.  `secrets/` is in .gitignore. The key can
 *     read all of this property's data; never commit it or paste it anywhere.
 *
 * SETUP (once)
 *   1. Google Cloud console -> project "My Project 60228" (cogent-tide-361602)
 *      -> IAM & Admin -> Service Accounts -> drive-uploader
 *   2. Grant it Viewer on the GA4 property (GA4 admin -> Property access
 *      management -> Add user -> the service account email).
 *   3. Keys -> Add key -> JSON. Save it as  secrets/ga4-reader.json
 *   4. `node tools/ga4-report.mjs`
 *
 * Usage
 *   node tools/ga4-report.mjs                        # default ranges
 *   node tools/ga4-report.mjs --start 2026-10-05 --end 2026-10-11
 *   node tools/ga4-report.mjs --key path/to.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEY_PATH = join(REPO, 'secrets', 'ga4-reader.json');
// Property ID, from Admin -> 媒体资源设置 -> 媒体资源详情 (top right).
// NOT to be confused with the Measurement ID (G-98LLHZ0GDM) or the account
// number that appears in the GA4 URL query string.
const PROPERTY_ID = process.env.GA4_PROPERTY_ID || '546156702';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const KEY_FILE = arg('--key', KEY_PATH);
const START = arg('--start', '7daysAgo');
const END = arg('--end', 'today');

// --- auth ------------------------------------------------------------------
// Google's own SDKs handle this JWT dance; we do it inline so the script keeps
// working with nothing but Node built-ins, same as the other tools/ scripts.
function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: TOKEN_URI,
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${base64url(signer.sign(key.private_key))}`;

  const res = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`token endpoint returned ${res.status}: ${JSON.stringify(body).slice(0, 400)}`);
  }
  return body.access_token;
}

// --- query -----------------------------------------------------------------
async function runReport(token, body) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`runReport ${res.status}: ${JSON.stringify(json).slice(0, 600)}`);
  }
  return json;
}

function rows(report) {
  const headers = (report.dimensionHeaders || []).map((h) => h.name);
  const metrics = (report.metricHeaders || []).map((h) => h.name);
  return (report.rows || []).map((r) => {
    const o = {};
    // GA4 echoes the dimension back as `customEvent:entry_point`; show `entry_point`.
    headers.forEach((h, i) => (o[h.replace(/^customEvent:/, '')] = r.dimensionValues[i].value));
    metrics.forEach((m, i) => (o[m] = r.metricValues[i].value));
    return o;
  });
}

// --- main ------------------------------------------------------------------
let key;
try {
  key = JSON.parse(readFileSync(KEY_FILE, 'utf8'));
} catch (e) {
  console.error(`Cannot read the service account key at ${KEY_FILE}`);
  console.error('  ->', e.message);
  console.error('\nSee the SETUP block at the top of tools/ga4-report.mjs.');
  process.exit(1);
}
if (key.type !== 'service_account') {
  console.error(`This key is a "${key.type}", not a "service_account". Wrong file.`);
  process.exit(1);
}
console.log(`Key loaded: ${key.client_email}`);
console.log(`Property:   ${PROPERTY_ID}`);
console.log(`Range:      ${START} .. ${END}\n`);

const token = await getAccessToken(key);
console.log('Access token acquired.\n');

const RANGE = { startDate: START, endDate: END };

// 1. The M2 metric itself: how audits start, split by declared entry point.
const byEntry = rows(
  await runReport(token, {
    dateRanges: [RANGE],
    dimensions: [{ name: 'customEvent:entry_point' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: { matchType: 'EXACT', value: 'audit_started' },
      },
    },
  })
);

// 2. Same event split by the target's registrable domain, to sanity-check that
//    entry_point and source_type do not contradict each other.
const byDomain = rows(
  await runReport(token, {
    dateRanges: [RANGE],
    dimensions: [{ name: 'customEvent:url_domain' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: { matchType: 'EXACT', value: 'audit_started' },
      },
    },
    limit: 20,
  })
);

// 3. All event names with counts, so we can see what is actually arriving.
const allEvents = rows(
  await runReport(token, {
    dateRanges: [RANGE],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    limit: 50,
  })
);

// 4. Consented-user count for context. This is NOT the consent rate — the
//    denominator (people who saw the banner) is invisible by design, see
//    public/scripts/consent.js.
const activeUsers = await runReport(token, {
  dateRanges: [RANGE],
  metrics: [{ name: 'totalUsers' }, { name: 'sessions' }],
});

const toolPage = byEntry.filter((r) => r.entry_point === 'tool_page');
const toolEvents = toolPage.reduce((s, r) => s + Number(r.eventCount), 0);
const totalEvents = byEntry.reduce((s, r) => s + Number(r.eventCount), 0);
const share = totalEvents ? ((toolEvents / totalEvents) * 100).toFixed(1) : 'n/a';

console.log('=== audit_started by entry_point ===');
console.log('  entry_point'.padEnd(20) + 'events'.padStart(8) + 'users'.padStart(8));
for (const r of byEntry) {
  console.log('  ' + String(r.entry_point).padEnd(18) + String(r.eventCount).padStart(8) + String(r.totalUsers).padStart(8));
}
console.log(`  tool_page share: ${toolEvents}/${totalEvents} = ${share}%`);
if (totalEvents < 30) {
  console.log('  ⚠️  Under 30 events — treat as directional only, not an acceptance number.');
}

console.log('\n=== audit_started by url_domain (top 20) ===');
for (const r of byDomain) {
  console.log('  ' + String(r.url_domain).padEnd(28) + String(r.eventCount).padStart(6));
}

console.log('\n=== all events ===');
console.log('  event'.padEnd(24) + 'count'.padStart(8) + 'users'.padStart(8));
for (const r of allEvents) {
  console.log('  ' + String(r.eventName).padEnd(22) + String(r.eventCount).padStart(8) + String(r.totalUsers).padStart(8));
}

const au = activeUsers.rows?.[0]?.metricValues || [];
console.log(`\n=== consented users in range ===`);
console.log(`  totalUsers ${au[0]?.value ?? 'n/a'} | sessions ${au[1]?.value ?? 'n/a'}`);

const out = {
  generatedAt: new Date().toISOString(),
  propertyId: PROPERTY_ID,
  serviceAccount: key.client_email,
  range: { start: START, end: END },
  toolPageSharePct: share === 'n/a' ? null : Number(share),
  toolPageEvents: toolEvents,
  totalAuditStartedEvents: totalEvents,
  byEntryPoint: byEntry,
  byUrlDomain: byDomain,
  allEvents,
  consentedUsers: au[0]?.value ?? null,
  sessions: au[1]?.value ?? null,
  caveat: 'Consented users only. The consent-rate denominator is invisible by design.',
};

mkdirSync(join(REPO, 'data'), { recursive: true });
const OUT = join(REPO, 'data', 'ga4-m2.json');
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`\nWritten to data/ga4-m2.json`);
