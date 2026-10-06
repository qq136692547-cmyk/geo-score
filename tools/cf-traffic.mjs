#!/usr/bin/env node
// Cloudflare Web Analytics traffic profile for geoscore.help.
//
// WHY THIS EXISTS
//   Raw totals from Cloudflare are not usable as a traffic baseline on this
//   site. A single automated run dumped 255 pageviews into one day (2026-10-03,
//   all from Japan, 116 of them inside one hour, hitting 21 distinct paths with
//   an empty referer). That is 80% of a 30-day total. Any "30 days = 320 pv"
//   headline built on it is meaningless.
//
//   So this script does not report a total. It splits the window into days,
//   reports the shape of each day, and flags the ones whose shape looks like a
//   script rather than a person.
//
// THE BURST TEST (and why these numbers)
//   Real browsing on this site, on the days that also have a matching GA4
//   consented user, looks like 1-3 pv/hour spread across several hours, mixed
//   countries, a handful of paths.
//   The automated run looks like a single hour holding most of the day's total,
//   one country, and near-total path coverage.
//
//   A day is flagged BURST when peakHour >= 10 AND (peakShare >= 0.4 OR
//   pathCount >= 8):
//     - peakHour >= 10: no human day here has ever put 10 pv in one hour.
//     - peakShare >= 0.4: one hour dominating the day is not browsing.
//     - pathCount >= 8: near-total path coverage in one day means a crawl.
//
//   WHY peakShare ALONE IS WRONG -- read this before "simplifying" the test.
//   The first version used peakShare >= 0.5 by itself and did NOT flag
//   2026-10-03, the one day that is unambiguously a script: its 255 pv were
//   spread over 5 hours with a peak of 116, so peakShare was 0.455 and it
//   slipped under the threshold -- landing 80% of the month's traffic in the
//   "human" bucket and producing a nonsense 29.9 pv/day average. An absolute
//   peak term is required, not just a ratio.
//
//   This is a heuristic, not a proof. It is meant to be re-run and argued with,
//   not trusted blindly. Days it flags are excluded from the HUMAN-ish total,
//   and both numbers are printed so the gap is never hidden.
//
// HARD LIMIT
//   Cloudflare rejects any query wider than 13w2d (93 days) with
//   "cannot request a time range wider than...". Query per-day to stay under it.
//
// USAGE (proxy prefix required on this machine -- see MEMORY.md)
//   set -a && . secrets/cf.env && set +a
//   HTTP_PROXY=http://127.0.0.1:10809 HTTPS_PROXY=http://127.0.0.1:10809 \
//     NODE_USE_ENV_PROXY=1 node tools/cf-traffic.mjs [--days 30] [--json]

import { readFileSync, existsSync } from 'node:fs';
import { classifyDay } from './cf-burst.js';

// Minimal .env reader so the caller does not have to remember to source it.
// An already-set process env always wins.
function loadEnv(path = 'secrets/cf.env') {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const TOKEN = process.env.CF_API_TOKEN;
const ACCT = process.env.CF_ACCOUNT_TAG;
// The Analytics API keys on this, NOT on the tag in the page's data-cf-beacon
// attribute. They differ, and using the beacon one silently returns 0 rows for
// every window, which reads as "Cloudflare has no data".
const TAG = process.env.CF_SITE_TAG || 'aae87fe93a3041d6b528a41c3ec00c29';

if (!TOKEN || !ACCT) {
  console.error('Missing CF_API_TOKEN / CF_ACCOUNT_TAG. Put them in secrets/cf.env (gitignored).');
  process.exit(1);
}

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const DAYS = Number(arg('--days', '30'));
const AS_JSON = process.argv.includes('--json');

async function groups(filter, dims, limit = 200) {
  const query = `{viewer{accounts(filter:{accountTag:"${ACCT}"}){
    rumPageloadEventsAdaptiveGroups(limit:${limit},orderBy:[count_DESC],
    filter:{siteTag:"${TAG}" ${filter}}){count dimensions{${dims}}}}}}`;
  const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(j.errors[0]?.message || JSON.stringify(j.errors));
  return (j?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups) || [];
}

const iso = (d) => new Date(d).toISOString().slice(0, 10);
// End yesterday: today is partial and a partial day skews the per-day shape.
const end = new Date(Date.now() - 864e5);
const start = new Date(end.getTime() - (DAYS - 1) * 864e5);
const dayList = [];
for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 864e5)) dayList.push(iso(d));

const rows = [];
for (const d of dayList) {
  const hours = await groups(`datetime_geq:"${d}T00:00:00Z" datetime_leq:"${d}T23:59:59Z"`, 'datetimeHour', 60);
  const total = hours.reduce((a, x) => a + x.count, 0);
  const peak = hours.reduce((m, x) => Math.max(m, x.count), 0);
  const countries = await groups(`datetime_geq:"${d}T00:00:00Z" datetime_leq:"${d}T23:59:59Z"`, 'countryName', 20);
  const paths = await groups(`datetime_geq:"${d}T00:00:00Z" datetime_leq:"${d}T23:59:59Z"`, 'requestPath', 50);
  rows.push({
    date: d,
    pv: total,
    peakHour: peak,
    peakShare: total ? peak / total : 0,
    activeHours: hours.length,
    countries: countries.map((x) => [x.dimensions.countryName, x.count]).sort((a, b) => b[1] - a[1]),
    pathCount: paths.length,
  });
}

// Thresholds live in cf-burst.js so they can be tested without the network.
const windowTotal = rows.reduce((a, r) => a + r.pv, 0);
for (const r of rows) {
  const { burst, reasons } = classifyDay({ pv: r.pv, peakHour: r.peakHour, pathCount: r.pathCount, windowTotal });
  r.burst = burst;
  r.reasons = reasons.map((s) =>
    s.replace(/^single hour (\d+) pv = (\d+)% of day$/, '单小时 $1 pv 占当日 $2%')
     .replace(/^(\d+) paths in one day$/, '单日覆盖 $1 个路径')
     .replace(/^day = (\d+)% of window$/, '单日占窗口总量 $1%（自检，不看阈值）')
  );
}

const totalPv = rows.reduce((a, r) => a + r.pv, 0);
const burstRows = rows.filter((r) => r.burst);
const humanRows = rows.filter((r) => !r.burst);
const burstPv = burstRows.reduce((a, r) => a + r.pv, 0);
const humanPv = humanRows.reduce((a, r) => a + r.pv, 0);
const firstData = rows.find((r) => r.pv > 0);

if (AS_JSON) {
  console.log(JSON.stringify({ window: { start: dayList[0], end: dayList[dayList.length - 1], days: DAYS }, totalPv, burstPv, humanPv, firstDataDay: firstData?.date ?? null, rows }, null, 2));
  process.exit(0);
}

console.log(`\n窗口 ${dayList[0]} → ${dayList[dayList.length - 1]}（${DAYS} 天，UTC 自然日，截止昨天）`);
console.log(`siteTag ${TAG}\n`);
console.log('日期          pv   峰值小时  活跃小时  路径数  国家           判定');
for (const r of rows) {
  const top = r.countries.slice(0, 2).map(([c, n]) => `${c}:${n}`).join(' ') || '—';
  console.log(
    r.date,
    String(r.pv).padStart(5),
    String(r.peakHour).padStart(8),
    String(r.activeHours).padStart(8),
    String(r.pathCount).padStart(6),
    '  ' + top.padEnd(14),
    r.burst ? 'BURST' : ''
  );
}

console.log('\n--- 汇总 ---');
console.log(`总 pv            : ${totalPv}`);
console.log(`BURST 日 pv      : ${burstPv}（${burstRows.length} 天：${burstRows.map((r) => r.date).join(', ') || '无'}）`);
console.log(`非 BURST 日 pv   : ${humanPv}（${humanRows.length} 天）`);
console.log(`日均（非 BURST） : ${(humanPv / (humanRows.length || 1)).toFixed(1)}`);
console.log(`\n本窗口首个有数据的日期: ${firstData?.date ?? '无数据'}`);
console.log('⚠️  Cloudflare 侧数据起点早于本窗口时，本窗口的"30 天"并非真的 30 天 —— 用更长的 --days 复验。');

if (burstRows.length) {
  console.log('\nBURST 判定理由（人工核对用）：');
  for (const r of burstRows) console.log(`  ${r.date} (${r.pv} pv) — ${r.reasons.join('；')}`);
}
const maxDay = rows.reduce((m, r) => (r.pv > m.pv ? r : m), rows[0] ?? { pv: 0 });
if (windowTotal > 0 && maxDay.pv / windowTotal > 0.4) {
  console.log(`\n🚨 ${maxDay.date} 一天占窗口总量 ${((maxDay.pv / windowTotal) * 100).toFixed(0)}%。`);
  console.log('   本窗口的"总量"和"日均"描述的其实是那一天，不是这个站的流量。不要引用。');
}

// The one number nobody should quote without this caveat attached.
console.log('\n口径说明：');
console.log('  · pv = rumPageloadEventsAdaptiveGroups 的 count，JS 信标，排除无 JS 流量');
console.log('  · CF 用 UTC 自然日；GA4 属性为 Asia/Shanghai（UTC+8），跨系统对齐时窗口要平移');
console.log('  · BURST 是启发式判据，不是证据。被标记的日应人工核对路径/来源后再下结论');
console.log('  · 30 天总量不可作为流量基线引用：本脚本存在的理由就是它会被脚本流量吃掉 80%');
