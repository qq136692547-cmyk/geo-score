#!/usr/bin/env node
/**
 * p1-probe3.mjs — 用 GA4 官方口径重测停留时长，并区分"真人秒退"与"机器人"。
 *
 * 两个必须纠正的问题：
 * 1) probe1/probe2 里我自己用 userEngagementDuration / sessions 算出的 avgSec
 *    与探针2早先的 / = 60.9 秒 差一个数量级。自算比值不可靠，改用 GA4 官方
 *    指标 averageSessionDuration，不再自己除。
 * 2) /pricing 17 会话、/terms 4、/privacy 3，合计 24/111 会话（22%），
 *    自算停留 0-1 秒。要判断这是真人秒退还是机器人爬，需要看这些会话
 *    有没有 scroll / user_engagement 行为 —— 真人不滚动就走的可能性极低。
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

// --- Q9: 官方口径的每页停留 ---------------------------------------------
console.log('=== Q9: per-page 官方 averageSessionDuration / engagedSessions ===');
{
  const r = await report({
    dateRanges: [RANGE],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'engagedSessions' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' },
    ],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 30,
  });
  console.log('  path'.padEnd(38) + 'views'.padStart(6) + 'users'.padStart(6) + 'sess'.padStart(6) + 'eng'.padStart(5) + 'avgSessSec'.padStart(12) + 'bounce'.padStart(8));
  for (const row of rows(r)) {
    console.log(
      '  ' + String(row.pagePath || '(none)').padEnd(36) +
      String(row.screenPageViews).padStart(6) + String(row.activeUsers).padStart(6) +
      String(row.sessions).padStart(6) + String(row.engagedSessions).padStart(5) +
      String(Math.round(Number(row.averageSessionDuration))).padStart(12) +
      String(row.bounceRate).padStart(8)
    );
  }
}

// --- Q10: 按天看 direct 会话 —— 判断是机器人还是真人 --------------------
// 如果某一天 direct 会话集中爆发且全部零 scroll，那是爬虫；
// 如果均匀分散在28 天里，那是真人。
console.log('\n=== Q10: direct 会话按天分布 + 当日是否有 scroll 行为 ===');
{
  const r = await report({
    dateRanges: [RANGE],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }, { name: 'engagedSessions' }, { name: 'eventCount' }],
    dimensionFilter: direct,
    orderBys: [{ dimension: { dimensionName: 'date' } }],
    limit: 40,
  });
  console.log('  date'.padEnd(12) + 'sess'.padStart(6) + 'views'.padStart(6) + 'eng'.padStart(5) + 'allEvents'.padStart(11));
  for (const row of rows(r)) {
    console.log('  ' + String(row.date).padEnd(10) + String(row.sessions).padStart(6) + String(row.screenPageViews).padStart(6) + String(row.engagedSessions).padStart(5) + String(row.eventCount).padStart(11));
  }
}

// --- Q11: 有多少会话真的滚动了 ------------------------------------------
// scroll / user_engagement 是真人行为的强信号（GA4 自动采集，非我们埋点）。
console.log('\n=== Q11: 行为证据 —— scroll / user_engagement 的会话覆盖 ===');
{
  const all = await report({ dateRanges: [RANGE], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }] });
  const scr = await report({ dateRanges: [RANGE], metrics: [{ name: 'sessions' }], dimensionFilter: ev('scroll') });
  const eng = await report({ dateRanges: [RANGE], metrics: [{ name: 'sessions' }], dimensionFilter: ev('user_engagement') });
  const A = rows(all)[0], S = rows(scr)[0], E = rows(eng)[0];
  const s = Number(A.sessions), sc = Number(S.sessions), en = Number(E.sessions);
  console.log(`  全部会话              ${s}`);
  console.log(`  有 scroll 的会话      ${sc}  (${((sc / s) * 100).toFixed(1)}%)`);
  console.log(`  有 user_engagement 的${String(en).padStart(4)}  (${((en / s) * 100).toFixed(1)}%)`);
  console.log(`  零 scroll 的会话${String(s - sc).padStart(6)}  (${(((s - sc) / s) * 100).toFixed(1)}%)  <- 这批人连滚动都没发生过`);
}

// --- Q12: 那批零 scroll 会话落在哪些页面 --------------------------------
console.log('\n=== Q12: 零 scroll 的会话 —— 用 pagePath 反查是谁 ===');
{
  const r = await report({
    dateRanges: [RANGE],
    dimensions: [{ name: 'pagePath' }, { name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 60,
  });
  const per = {};
  for (const row of rows(r)) {
    const k = row.pagePath || '(none)';
    per[k] = per[k] || {};
    per[k][row.eventName] = Number(row.eventCount);
  }
  console.log('  path'.padEnd(38) + 'page_view'.padStart(10) + 'scroll'.padStart(8) + 'noScrollShare');
  for (const [p, m] of Object.entries(per)) {
    const pv = m.page_view || 0;
    const sc = m.scroll || 0;
    const share = pv ? (((pv - sc) / pv) * 100).toFixed(0) + '%' : '-';
    console.log('  ' + String(p).padEnd(36) + String(pv).padStart(10) + String(sc).padStart(8) + share.padStart(14));
  }
}