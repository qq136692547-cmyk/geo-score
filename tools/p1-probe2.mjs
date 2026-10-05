#!/usr/bin/env node
/**
 * p1-probe2.mjs — 追问"direct 95 sessions / 9.5% engaged"到底是什么。
 *
 * 动机：p1-probe.mjs 的 Q3 显示 direct 占 95/111 会话但互动率仅 9.5%。
 * 但 GA4 库只在同意后才注入（consent.js:110），所以这 95 个会话**全部是
 * 已经点过"接受"的人**。看不见没同意的人 ⇒ 这个互动率不是站点互动率，
 * 而是"愿意被追踪的人的互动率"。这两件事的含义完全不同，必须分清。
 *
 * 本探针查：direct 流量落在哪些页面、每页停留多久、是否有 key event、
 * 以及那 9 个"(not set)"会话到底是什么。
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
const direct = { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'EXACT', value: '(direct)' } } };

// --- Q5: direct 流量的落地页分布 -------------------------------------------
console.log('=== Q5: (direct) 会话的落地页 + 每页浏览量 ===');
{
  const r = await report({
    dateRanges: [RANGE],
    dimensions: [{ name: 'landingPage' }],
    metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }, { name: 'engagedSessions' }, { name: 'userEngagementDuration' }],
    dimensionFilter: direct,
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 25,
  });
  console.log('  landing'.padEnd(44) + 'sess'.padStart(6) + 'views'.padStart(7) + 'eng'.padStart(6) + 'avgSec'.padStart(8));
  for (const row of rows(r)) {
    const u = Number(row.sessions) || 1;
    console.log(
      '  ' + String(row.landingPage || '(none)').padEnd(42) +
      String(row.sessions).padStart(6) + String(row.screenPageViews).padStart(7) +
      String(row.engagedSessions).padStart(6) +
      String(Math.round(Number(row.userEngagementDuration) / u)).padStart(8)
    );
  }
}

// --- Q6: 那 9 个 (not set) 会话是什么 ---------------------------------------
// Q3 里 "(not set)" 有 9 sessions 但 0 screenPageViews。有会话无页面浏览
// 只可能是"事件先于 page_view 被记进同一会话"，值得单独看。
console.log('\n=== Q6: (not set) 来源的会话 —— 有会话无 page_view ===');
{
  const r = await report({
    dateRanges: [RANGE],
    dimensions: [{ name: 'eventName' }, { name: 'hostName' }],
    metrics: [{ name: 'eventCount' }, { name: 'sessions' }],
    dimensionFilter: { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'EXACT', value: '(not set)' } } },
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 25,
  });
  for (const row of rows(r)) {
    console.log(`  ${String(row.eventName).padEnd(24)} ${String(row.hostName).padEnd(26)} events=${String(row.eventCount).padStart(4)} sessions=${row.sessions}`);
  }
}

// --- Q7: 全站事件清单 —— 到底发生过什么 ------------------------------------
// 之前所有分析都只看 4 个 audit 事件。这里列出全部事件，看漏斗外还有什么。
console.log('\n=== Q7: 28 天全部事件 ===');
{
  const r = await report({
    dateRanges: [RANGE],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 40,
  });
  let tot = 0;
  for (const row of rows(r)) {
    tot += Number(row.eventCount);
    console.log(`  ${String(row.eventName).padEnd(26)} events=${String(row.eventCount).padStart(4)} users=${String(row.totalUsers).padStart(4)}`);
  }
  console.log(`  ${'TOTAL'.padEnd(26)} events=${tot}`);
}

// --- Q8: 同意前是否真的零请求（用 G-98LLHZ0GDM 出没来交叉验证）--------------
// page_view 的存在本身就说明同意已发生。这个探针反过来说明：
// GA4 里能看到的每一个人都是同意者，看不到的就是没同意的。
console.log('\n=== Q8: consent 状态能否在 GA4 侧观测 ===');
{
  const r = await report({
    dateRanges: [RANGE],
    metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
  });
  for (const row of rows(r)) {
    console.log(`  GA4 可见：users=${row.totalUsers} sessions=${row.sessions} pageViews=${row.screenPageViews}`);
  }
  console.log('  （GA4 侧看不到未同意的访问者 —— 同意率的分母在 GA4 之外，结构性不可算）');
}