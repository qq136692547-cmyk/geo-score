#!/usr/bin/env node
// Google Search Console query/page data for geoscore.help.
//
// WHY THIS IS THE ONLY DATA SOURCE WITH A USABLE SAMPLE HERE
//   Cloudflare shows ~14 human pageviews over 11 days and GA4 shows 4 consented
//   users. Neither can support a decision. GSC has 1,126 impressions over three
//   months -- small, but two orders of magnitude more signal than the pv counts.
//   Impressions tell us what people search for before they see us, which is the
//   only part of the funnel with enough volume to read.
//
// SETUP (one time, done in the GSC web UI -- cannot be done from here)
//   The service account in secrets/ga4-reader.json is not a user of any GSC
//   property yet. Until it is added, this script exits with instructions.
//
//   1. https://search.google.com/search-console
//   2. Select the geoscore.help property
//   3. Settings (齿轮) -> Users and permissions -> Add user
//   4. Email: the client_email printed by --whoami (run this script with
//      --whoami if you do not have it)
//   5. Permission: "Restricted" is enough (this only reads)
//
// USAGE (proxy prefix required on this machine -- see MEMORY.md)
//   HTTP_PROXY=http://127.0.0.1:10809 HTTPS_PROXY=http://127.0.0.1:10809 \
//     NODE_USE_ENV_PROXY=1 node tools/gsc-queries.mjs [--days 90] [--limit 25]
//
//   --whoami   print the service account email that needs adding

import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { winnable, winnableShare } from './gsc-winnable.js';

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const DAYS = Number(arg('--days', '90'));
const LIMIT = Number(arg('--limit', '25'));

const key = JSON.parse(readFileSync('secrets/ga4-reader.json', 'utf8'));
const b64 = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

async function token() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const c = b64(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }));
  const s = createSign('RSA-SHA256');
  s.update(`${h}.${c}`);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: `${h}.${c}.${b64(s.sign(key.private_key))}`,
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('token failed: ' + JSON.stringify(j).slice(0, 300));
  return j.access_token;
}

if (process.argv.includes('--whoami')) {
  console.log(key.client_email);
  process.exit(0);
}

const tok = await token();
const hdr = { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' };

const sitesRes = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites', { headers: hdr });
const sites = ((await sitesRes.json()).siteEntry) || [];

if (!sites.length) {
  console.error('\n该 service account 还没有任何 GSC 属性权限（API 返回空列表，HTTP 200）。\n');
  console.error('在 GSC 网页端加一次用户即可：');
  console.error('  https://search.google.com/search-console');
  console.error('  → 选 geoscore.help 属性 → 设置 → 用户和权限 → 添加用户');
  console.error(`  → Email: ${key.client_email}`);
  console.error('  → 权限: 受限（只读够了）\n');
  process.exit(2);
}

// Prefer the domain property (sc-domain:) over the URL-prefix one.
const site = sites.find((s) => s.siteUrl.startsWith('sc-domain:')) || sites[0];
console.log(`属性: ${site.siteUrl}  （可用: ${sites.map((s) => s.siteUrl).join(', ')}）`);

const end = new Date(Date.now() - 864e5);
const start = new Date(end.getTime() - (DAYS - 1) * 864e5);
const iso = (d) => d.toISOString().slice(0, 10);

async function query(dimensions, startRow = 0, rowLimit = LIMIT) {
  const r = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site.siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST', headers: hdr,
      body: JSON.stringify({
        startDate: iso(start), endDate: iso(end),
        dimensions, rowLimit, startRow,
      }),
    }
  );
  const j = await r.json();
  if (!r.ok) throw new Error(`${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j.rows || [];
}

// Page through every row. WHY: GSC sorts by clicks descending, and this site has
// ~2 clicks total, so a plain top-N cut is ordered by an almost-constant key and
// can silently drop the rows that matter. Only a full walk makes the winnable
// screen below trustworthy.
async function queryAll(dimensions, pageSize = 250, cap = 20000) {
  const all = [];
  let startRow = 0;
  while (startRow < cap) {
    const rows = await query(dimensions, startRow, pageSize);
    all.push(...rows);
    if (rows.length < pageSize) break;
    startRow += pageSize;
  }
  return all;
}

console.log(`窗口 ${iso(start)} → ${iso(end)}（${DAYS} 天）\n`);

// Denominator first: an empty dimensions array returns the window aggregate.
// Every number below must be readable against this, never on its own.
const totalRows = await query([]);
const windowImpressions = totalRows.length ? Number(totalRows[0].impressions) : 0;
if (totalRows.length) {
  const t = totalRows[0];
  console.log(
    `窗口总计：展示 ${t.impressions}  点击 ${t.clicks}  ` +
      `CTR ${t.ctr ? (t.ctr * 100).toFixed(2) + '%' : '—'}  均排 ${t.position ? t.position.toFixed(1) : '—'}`
  );
  console.log('（下面各维度只取 top N，是总计的子集，不能直接相加当作总量）\n');
}

let queryRows = [];
for (const [label, dim] of [['查询词', ['query']], ['页面', ['page']], ['国家', ['country']]]) {
  const rows = dim[0] === 'query' ? await queryAll(dim) : await query(dim);
  if (dim[0] === 'query') queryRows = rows;
  console.log(`=== ${label} ${dim[0] === 'query' ? '全量' : 'top'} ${rows.length} ===`);
  if (!rows.length) { console.log('  （无数据）\n'); continue; }
  console.log('  展示'.padStart(7) + '点击'.padStart(6) + 'CTR'.padStart(7) + '均排'.padStart(7) + '   ' + label);
  for (const r of rows) {
    const ctr = r.ctr ? (r.ctr * 100).toFixed(1) + '%' : '—';
    const pos = r.position ? r.position.toFixed(1) : '—';
    console.log(
      String(r.impressions).padStart(7) +
      String(r.clicks).padStart(6) +
      ctr.padStart(7) + pos.padStart(7) + '   ' + (r.keys[0] || '').slice(0, 70)
    );
  }
  console.log();
}

// The decision-grade output: which queries are close enough that a rewrite
// could actually move them. Everything else is noise at this volume.
console.log('=== 可赢词（均排 <= 30 且展示 >= 3）===');
const win = winnable(queryRows);
if (!win.length) {
  console.log('  没有。全部查询词均排都在 30 名以外。');
  console.log('  ⇒ 改标题 / 改 meta 对这站目前无效，别在这上面花时间。\n');
} else {
  console.log('  展示'.padStart(7) + '点击'.padStart(6) + '均排'.padStart(7) + '   查询词');
  for (const r of win) {
    console.log(
      String(r.impressions).padStart(7) +
      String(r.clicks).padStart(6) +
      (r.position ? r.position.toFixed(1) : '—').padStart(7) + '   ' + (r.keys[0] || '').slice(0, 70)
    );
  }
  console.log();
}
const share = winnableShare(queryRows, windowImpressions);
if (share) {
  console.log(
    `可赢词展示 ${share.sum} / 窗口总展示 ${share.total} = ${(share.share * 100).toFixed(1)}%` +
      `（查询词共 ${queryRows.length} 条，已全量分页取回）`
  );
}
console.log('口径：可赢词按"整窗口平均排名"筛选；一个词若只在某天排到第 5、其余时间在第 60，');
console.log('      平均值仍会被拉高而落选 —— 所以这是**下界**，不是全部机会。\n');

console.log('口径：');
console.log('  · GSC 展示/点击与 CF/GA4 的 pv 完全不同源，不可相除、不可对比趋势');
console.log('  · 均排是"平均排名"，长尾词会把它拉低；单看均排会低估前几名的表现');
console.log('  · GSC 数据有 2–3 天延迟，最近几天会缺失');
console.log('  · CTR 在展示数极小时无意义（1 次点击 / 3 次展示 = 33%，不代表真实点击率）');
