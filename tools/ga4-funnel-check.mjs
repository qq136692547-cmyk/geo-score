#!/usr/bin/env node
/**
 * Funnel coherence check for the three audit events.
 *
 * WHY THIS EXISTS
 * HANDOVER-ROUND2 listed "audit_completed 22 > audit_started 21" as a hard
 * defect. Investigating it on 2026-11-02 showed the excess is entirely a
 * historical artefact: before 2026-10-23 geoTrack() was a silent no-op
 * (no queue, no replay), so an audit_started fired before gtag.js initialised
 * was dropped while the audit_completed fired seconds later got through.
 * Every day after the queue shipped shows started == completed.
 *
 * That means the number must not be "fixed" in code, but it also must not be
 * re-investigated from scratch every time somebody rediscovers it. This tool
 * turns the investigation into a repeatable check: run it after any analytics
 * change, or on a schedule, and it names the offending day.
 *
 * THE INVARIANT
 *   audit_started >= audit_completed >= result_viewed
 * A visitor cannot finish an audit they never started, and cannot see a report
 * for an audit that never completed. Any day violating this chain is either a
 * real regression or a day that predates the fix.
 *
 * Usage:
 *   node tools/ga4-funnel-check.mjs
 *   node tools/ga4-funnel-check.mjs --start 2026-10-23 --end today
 *   node tools/ga4-funnel-check.mjs --since-fix      # only days the queue existed
 *
 * Exit code 1 when a violation is found inside the requested window, so this
 * can be wired into a schedule. Never commits credentials.
 */
import fs from 'node:fs';
import { createSign } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEY_PATH = join(REPO, 'secrets', 'ga4-reader.json');
const PROPERTY_ID = process.env.GA4_PROPERTY_ID || '546156702';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

/**
 * The date the analytics queue shipped (commit e0b11b0, deployed 2026-10-23).
 * Days before it are allowed to violate the chain; days from it onwards are not.
 */
export const QUEUE_SHIPPED = '20261023';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const SINCE_FIX = args.includes('--since-fix');
const START = opt('--start', SINCE_FIX ? '2026-10-23' : '30daysAgo');
const END = opt('--end', 'today');

const EVENTS = ['audit_started', 'audit_completed', 'result_viewed'];

/**
 * Check the chain on one day's counts.
 *
 * Returns an array of human-readable violations. Pure so it can be tested
 * without touching the network.
 */
export function checkDay(date, counts) {
  const started = counts.audit_started || 0;
  const completed = counts.audit_completed || 0;
  const viewed = counts.result_viewed || 0;
  const out = [];

  if (completed > started) {
    out.push(`completed ${completed} > started ${started} (finished an audit never started)`);
  }
  if (viewed > completed) {
    out.push(`viewed ${viewed} > completed ${completed} (saw a report for an unfinished audit)`);
  }
  return out;
}

/** Dates are GA4's YYYYMMDD. Compare as strings — they sort correctly. */
export function isAfterFix(date) {
  return String(date) >= QUEUE_SHIPPED;
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: TOKEN_URI, iat: now, exp: now + 3600 })
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${base64url(signer.sign(key.private_key))}`;
  const res = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`token: ${JSON.stringify(body).slice(0, 300)}`);
  return body.access_token;
}

/** Group a runReport response into { date: { event: count } }. Pure. */
export function groupByDate(rows) {
  const byDate = {};
  for (const r of rows || []) {
    const date = r.dimensionValues[0].value;
    const event = r.dimensionValues[1].value;
    byDate[date] = byDate[date] || {};
    byDate[date][event] = Number(r.metricValues[0].value);
  }
  return byDate;
}

async function main() {
  if (!fs.existsSync(KEY_PATH)) {
    console.error(`missing ${KEY_PATH} (service-account key with Viewer on the GA4 property)`);
    process.exit(2);
  }
  const key = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
  const token = await getAccessToken(key);

  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate: START, endDate: END }],
      dimensions: [{ name: 'date' }, { name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: EVENTS } } },
      limit: 1000,
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`runReport: ${JSON.stringify(json.error).slice(0, 400)}`);

  const byDate = groupByDate(json.rows);
  const dates = Object.keys(byDate).sort();

  let currentViolations = 0;
  let historicalViolations = 0;

  console.log(`window ${START} .. ${END}`);
  console.log('date        started  completed  viewed   verdict');

  for (const d of dates) {
    const c = byDate[d];
    const s2 = c.audit_started || 0;
    const cp = c.audit_completed || 0;
    const vw = c.result_viewed || 0;
    if (!s2 && !cp && !vw) continue;

    const problems = checkDay(d, c);
    let verdict = 'ok';
    if (problems.length) {
      if (isAfterFix(d)) {
        verdict = 'VIOLATION';
        currentViolations++;
      } else {
        verdict = 'pre-fix (expected)';
        historicalViolations++;
      }
    }
    console.log(
      `${d}      ${String(s2).padStart(2)}       ${String(cp).padStart(2)}       ${String(vw).padStart(2)}    ` +
        (problems.length ? `${verdict}: ${problems.join(' / ')}` : verdict)
    );
  }

  console.log('');
  if (historicalViolations) {
    console.log(`${historicalViolations} pre-fix day(s) violate the chain. Expected: geoTrack() had no queue before ${QUEUE_SHIPPED}.`);
  }
  if (currentViolations) {
    console.log(`${currentViolations} day(s) violate the chain AFTER the queue shipped — this is a real regression.`);
    console.log('Check that audit_started and audit_completed are still emitted as a pair in src/scripts/boot.js.');
    process.exit(1);
  }
  console.log('No violations after the queue shipped. Analytics chain is coherent.');
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('ga4-funnel-check.mjs')) {
  try {
    await main();
  } catch (e) {
    console.error(`failed: ${e.message}`);
    process.exit(2);
  }
}
