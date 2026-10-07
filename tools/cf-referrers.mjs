#!/usr/bin/env node
// Where does outside traffic actually come from? Per-day, by referer host.
//
// WHY PER-DAY (do not "simplify" this into one wide query)
//   A multi-day query on this site returned 270 pv in 6 buckets where per-day
//   queries returned 320 pv in 21 buckets. The missing 50 were all small-value
//   buckets, dropped by count_DESC ordering. On a quiet site the small buckets
//   ARE the signal -- a single referral from a single post is exactly the kind
//   of row a wide query throws away.
//
// WHY THIS SCRIPT EXISTS
//   "Did the outbound push work?" cannot be answered from totals. It needs the
//   referer host list, and it needs to be re-runnable after each push so the
//   next one can be judged against a baseline instead of a feeling.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const line of readFileSync(join(REPO, 'secrets', 'cf.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const TOKEN = process.env.CF_API_TOKEN;
const ACCT = process.env.CF_ACCOUNT_TAG;
const TAG = process.env.CF_SITE_TAG || 'aae87fe93a3041d6b528a41c3ec00c29';

if (!TOKEN || !ACCT) {
  console.error('Missing CF_API_TOKEN / CF_ACCOUNT_TAG in secrets/cf.env (gitignored).');
  process.exit(1);
}

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const DAYS = Number(arg('--days', '14'));

// Anything pointing at ourselves is navigation, not acquisition.
const OWN = /geoscore\.help$|geoscore-532\.pages\.dev$/i;
const EMPTY = new Set(['', '(none)', 'null', 'undefined', '-']);

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
const end = new Date(Date.now() - 864e5);
const start = new Date(end.getTime() - (DAYS - 1) * 864e5);
const dayList = [];
for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 864e5)) dayList.push(iso(d));

console.log(`窗口 ${iso(start)} → ${iso(end)}（${DAYS} 天，逐日查询）\n`);

const byHost = {};
const perDay = [];
let grandTotal = 0;

for (const d of dayList) {
  const f = `datetime_geq:"${d}T00:00:00Z" datetime_leq:"${d}T23:59:59Z"`;
  const rows = await groups(f, 'refererHost', 200);
  const total = rows.reduce((a, x) => a + x.count, 0);
  grandTotal += total;
  let own = 0;
  let empty = 0;
  const outside = [];
  for (const r of rows) {
    const h = (r.dimensions?.refererHost ?? '').trim();
    if (EMPTY.has(h) || h === 'null') { empty += r.count; continue; }
    if (OWN.test(h)) { own += r.count; continue; }
    outside.push([h, r.count]);
    byHost[h] = (byHost[h] || 0) + r.count;
  }
  perDay.push({ d, total, own, empty, outside });
}

console.log('date'.padEnd(12) + 'total'.padStart(6) + 'own'.padStart(6) + 'empty'.padStart(7) + 'outside'.padStart(9) + '   站外来源');
for (const x of perDay) {
  console.log(
    x.d.padEnd(12) +
    String(x.total).padStart(6) +
    String(x.own).padStart(6) +
    String(x.empty).padStart(7) +
    String(x.outside.reduce((a, [, c]) => a + c, 0)).padStart(9) +
    '   ' + (x.outside.map(([h, c]) => `${h}(${c})`).join(' ') || '—')
  );
}

const hosts = Object.entries(byHost).sort((a, b) => b[1] - a[1]);
const outsideTotal = hosts.reduce((a, [, c]) => a + c, 0);
console.log(`\n窗口总 pv ${grandTotal}（逐日相加，非宽查询）`);
console.log(`站外引荐合计 ${outsideTotal}`);
console.log('\n=== 站外来源 ===');
if (!hosts.length) {
  console.log('  一个都没有。这段时间内没有任何一次访问是从站外点进来的。');
} else {
  for (const [h, c] of hosts) console.log('  ' + String(c).padStart(4) + '  ' + h);
}

console.log('\n口径：');
console.log('  · referer 为空 ≠ 站外：直接输入网址、书签、App 内打开、HTTPS→HTTP 都会丢 referer');
console.log('  · X/Twitter 经 t.co 跳转时，referer 记的是 t.co 不是 twitter.com');
console.log('  · 微信/QQ/邮件客户端打开通常完全不带 referer');
console.log('  · 所以"站外引荐 0 次"不能推出"没人从站外来" —— 只能推出"没有留下痕迹"');
