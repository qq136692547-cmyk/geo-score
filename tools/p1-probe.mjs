#!/usr/bin/env node
/**
 * p1-probe.mjs — 三个决定性查询，检验"工具页零转化"这个结论是否成立。
 *
 * 背景：boot.js:159-164，工具页没有 #loading-section / #report-section，
 * 所以点 Check Now 会 window.location.href = '/?audit=<url>&src=tool_page'
 * 整页跳到首页再跑审计。若属实，则工具页发起的审计在 GA4 里 pagePath 是 '/'，
 * 而不是 '/tools/xxx/' —— 我之前"工具页 20 次浏览 0 次审计"的说法可能是错的。
 *
 * 判别方法：跳转 URL 带 &src=tool_page，GA4 的 pageLocation 维度含完整
 * query string，所以 audit_started 按 pageLocation 聚合就能看出 src 值。
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
const b64 = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

async function token() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const c = b64(JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: TOKEN_URI, iat: now, exp: now + 3600 }));
  const s = createSign('RSA-SHA256');
  s.update(`${h}.${c}`);
  const r = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${h}.${c}.${b64(s.sign(key.private_key))}` }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300));
  return j.access_token;
}

const tok = await token();

async function report(body) {
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${r.status}: ${JSON.stringify(j).slice(0, 400)}`);
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

const ev = (name) => ({ filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: name } } });

// --- Q1: audit_started 的完整 URL（pageLocation 含 query string）--------------
// 若工具页跳转真的发生过，这里的 URL 里会出现 &src=tool_page。
console.log('=== Q1: audit_started 完整 URL（pageLocation）===');
{
  const r = await report({
    dateRanges: [RANGE],
    dimensions: [{ name: 'pageLocation' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    dimensionFilter: ev('audit_started'),
    limit: 50,
  });
  const rs = rows(r);
  if (!rs.length) console.log('  (无数据)');
  for (const row of rs) {
    const loc = decodeURIComponent(row.pageLocation);
    const src = /[?&]src=([^&]*)/.exec(loc);
    console.log(`  src=${(src ? src[1] : '(none)').padEnd(12)} count=${String(row.eventCount).padStart(3)} users=${String(row.totalUsers).padStart(3)}  ${loc.slice(0, 120)}`);
  }
  const toolSrc = rs.filter((x) => /[?&]src=tool_page/.test(decodeURIComponent(x.pageLocation)));
  const total = rs.reduce((a, b) => a + Number(b.eventCount), 0);
  const toolTotal = toolSrc.reduce((a, b) => a + Number(b.eventCount), 0);
  console.log(`\n  => audit_started 总数 ${total}，其中 src=tool_page ${toolTotal}`);
}

// --- Q2: 所有 page_view 的 URL 里有多少带 src=tool_page ---------------------
// 这是工具页"真的把人送走了"的独立证据（不依赖 audit_started 是否上报）。
console.log('\n=== Q2: page_view URL 中 src=tool_page 的出现次数 ===');
{
  const r = await report({
    dateRanges: [RANGE],
    dimensions: [{ name: 'pageLocation' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
    dimensionFilter: {
      filter: { fieldName: 'pageLocation', stringFilter: { matchType: 'CONTAINS', value: 'src=tool_page' } },
    },
    limit: 50,
  });
  const rs = rows(r);
  const total = rs.reduce((a, b) => a + Number(b.screenPageViews), 0);
  console.log(`  命中 page_view 行数=${rs.length}，合计曝光=${total}`);
  for (const row of rs) console.log(`    ${decodeURIComponent(row.pageLocation).slice(0, 130)}`);
  if (!total) console.log('  => 28 天内没有任何一次工具页跳转被记录。工具页从未把用户送进审计流程。');
}

// --- Q3: 互动会话率 —— 分来源 ------------------------------------------------
// 13.5% 是全站数字。若 direct 占绝大多数，样本量太小，这个数字本身不可靠。
console.log('\n=== Q3: sessions / engagedSessions 按 sessionSource ===');
{
  const r = await report({
    dateRanges: [RANGE],
    dimensions: [{ name: 'sessionSource' }],
    metrics: [
      { name: 'sessions' },
      { name: 'engagedSessions' },
      { name: 'totalUsers' },
      { name: 'screenPageViews' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 25,
  });
  console.log('  source'.padEnd(28) + 'sessions'.padStart(9) + 'engaged'.padStart(9) + 'rate'.padStart(8) + 'users'.padStart(8) + 'views'.padStart(7));
  let S = 0, E = 0;
  for (const row of rows(r)) {
    const s = Number(row.sessions), e = Number(row.engagedSessions);
    S += s; E += e;
    console.log(
      '  ' + String(row.sessionSource || '(none)').padEnd(26) +
      String(s).padStart(9) + String(e).padStart(9) +
      ((s ? ((e / s) * 100).toFixed(1) : '?') + '%').padStart(8) +
      String(row.totalUsers).padStart(8) + String(row.screenPageViews).padStart(7)
    );
  }
  console.log('  ' + 'TOTAL'.padEnd(26) + String(S).padStart(9) + String(E).padStart(9) + (((E / S) * 100).toFixed(1) + '%').padStart(8));
}

// --- Q4: 工具页流量的会话后续行为 ------------------------------------------
// 工具页浏览过的人，同一会话里有没有回到首页并发起审计？
// 用 session 级指标做不到"同一会话"，改用：这些用户的会话里 engagedSessions。
console.log('\n=== Q4: 工具页 landing 的会话质量 ===');
{
  const r = await report({
    dateRanges: [RANGE],
    dimensions: [{ name: 'landingPage' }],
    metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }, { name: 'bounceRate' }, { name: 'userEngagementDuration' }],
    dimensionFilter: {
      filter: { fieldName: 'landingPage', stringFilter: { matchType: 'CONTAINS', value: '/tools/' } },
    },
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  });
  console.log('  landing'.padEnd(42) + 'sess'.padStart(6) + 'eng'.padStart(6) + 'bounce'.padStart(8) + 'avgSec'.padStart(8));
  for (const row of rows(r)) {
    const u = Number(row.activeUsers) || Number(row.sessions) || 1;
    console.log(
      '  ' + String(row.landingPage || '(none)').padEnd(40) +
      String(row.sessions).padStart(6) + String(row.engagedSessions).padStart(6) +
      String(row.bounceRate).padStart(8) +
      String(Math.round(Number(row.userEngagementDuration) / u)).padStart(8)
    );
  }
}