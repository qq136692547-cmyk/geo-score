#!/usr/bin/env node
// Which pages actually get pageviews? Per-day, grouped by requestPath.
//
// WHY PER-DAY (do not "simplify" into one wide query)
//   Same reason as cf-referrers.mjs: a multi-day query on this site returned
//   270 pv in 6 buckets where per-day queries returned 320 pv in 21. The missing
//   50 were all small-value buckets, dropped by count_DESC ordering. On a quiet
//   site the small buckets ARE the signal.
//
// WHY THIS SCRIPT EXISTS
//   "Should the Chinese half of the site be finished or cut?" was being answered
//   from an assumption ("/zh/ gets a few pageviews"). This turns that into a
//   measured number, and shows whether the tool pages pull their weight.
//   It also separates /zh/ from the tool pages, which no existing tool does.

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

console.log(`窗口 ${iso(start)} → ${iso(end)}（${DAYS} 天，逐日查询）`);
console.log('注意：CF Web Analytics 数据起点是 2026-09-26，此前的日子查询恒为 0，不是没流量\n');

const byPath = {};
const perDay = [];
let grand = 0;

// Normalise a path so /zh/ and its children roll up together.
function bucket(p) {
  const path = (p || '/').split('?')[0];
  if (path === '/zh' || path === '/zh/' || path.startsWith('/zh/')) return { key: 'zh', path };
  return { key: 'en', path };
}

for (const d of dayList) {
  const f = `datetime_geq:"${d}T00:00:00Z" datetime_leq:"${d}T23:59:59Z"`;
  const rows = await groups(f, 'requestPath', 200);
  const total = rows.reduce((a, x) => a + x.count, 0);
  grand += total;
  let zh = 0;
  let en = 0;
  for (const r of rows) {
    const p = (r.dimensions?.requestPath ?? '/');
    const { key } = bucket(p);
    if (key === 'zh') zh += r.count; else en += r.count;
    byPath[p] = (byPath[p] || 0) + r.count;
  }
  perDay.push({ d, total, zh, en });
}

console.log('date'.padEnd(12) + 'total'.padStart(7) + 'en'.padStart(6) + 'zh'.padStart(6));
for (const x of perDay) {
  console.log(x.d.padEnd(12) + String(x.total).padStart(7) + String(x.en).padStart(6) + String(x.zh).padStart(6));
}

const zhTotal = perDay.reduce((a, x) => a + x.zh, 0);
const enTotal = perDay.reduce((a, x) => a + x.en, 0);
const zhPaths = Object.keys(byPath).filter((p) => bucket(p).key === 'zh');

console.log(`\n窗口总 pv ${grand}`);
console.log(`  英文路径 ${enTotal}（${((enTotal / grand) * 100).toFixed(1)}%）`);
console.log(`  中文路径 ${zhTotal}（${zhTotal ? ((zhTotal / grand) * 100).toFixed(1) : '0.0'}%）`);
console.log(`  中文页面被访问过 ${zhPaths.length} 个：${zhPaths.slice(0, 10).join(' ') || '—'}`);

console.log('\n=== 全部路径（pv 降序）===');
for (const [p, c] of Object.entries(byPath).sort((a, b) => b[1] - a[1]).slice(0, 30)) {
  console.log('  ' + String(c).padStart(5) + '  ' + (bucket(p).key === 'zh' ? '[zh] ' : '     ') + p);
}

console.log('\n口径：');
console.log('  · 这里全部是 CF 信标，不受 GA4 同意门控影响 —— 是全量而不是同意者子集');
console.log('  · 但 11 天普查已知 96% 的 pv 是脚本/突发，所以路径分布里也混着爬虫');
console.log('  · 判断 /zh/ 去留要看 zh 那一列的量级，不要用百分比单独下结论');
