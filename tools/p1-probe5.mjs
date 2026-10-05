#!/usr/bin/env node
/**
 * p1-probe5.mjs — 收尾两个问题：
 *
 * Q18: 工具页那 19 次浏览从哪来？（来源 / 落地 / 是否 consent 后的真人）
 *      若来源也是 direct 且 referrer 为空，说明工具页没有可复制获客渠道进来。
 *
 * Q19: first_visit=100/100 users —— 全站 28 天零回访，这正常吗？
 *      关键怀疑：GA4 库在同意后才注入，gtag 首次加载时 GA4 拿不到此前的
 *      _ga cookie，会分配一个全新 client_id 并补发 first_visit。
 *      若是如此，"100 个用户全部是首次访问"就不是流量特征，而是同意门控的
 *      副作用 —— 那么用 first_visit 判断流量质量会得出完全错误的结论。
 *      验证办法：看 sessions/user。若人均 1.0 次且 first_visit≈users，
 *      说明每个用户只留下一个 session，无法区分"真回访"与"被重置"。
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROPERTY_ID = process.env.GA4_PROPERTY_ID || '546156702';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const ALL = { startDate: '28daysAgo', endDate: 'today' };
const HOST = { filter: { fieldName: 'hostName', stringFilter: { matchType: 'EXACT', value: 'geoscore.help' } } };
const CE = (n) => ({ filter: { fieldName: 'customEvent:' + n, stringFilter: { matchType: 'EXACT', value: n } } });

const key = JSON.parse(readFileSync(join(REPO, 'secrets', 'ga4-reader.json'), 'utf8'));
const b64 = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
async function token() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const c = b64(JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: TOKEN_URI, iat: now, exp: now + 3600 }));
  const s = createSign('RSA-SHA256'); s.update(`${h}.${c}`);
  const r = await fetch(TOKEN_URI, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${h}.${c}.${b64(s.sign(key.private_key))}` }) });
  if (!r.ok) throw new Error(JSON.stringify(await r.json()).slice(0, 300));
  return (await r.json()).access_token;
}
const tok = await token();
async function report(body) {
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`, {
    method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
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
const ev = (n) => ({ filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: n } } });

// --- Q18: 工具页流量的来源 ------------------------------------------------
console.log('=== Q18: 工具页浏览的 sessionSource / sessionMedium ===');
{
  const r = await report({
    dateRanges: [ALL],
    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }, { name: 'landingPage' }],
    metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }],
    dimensionFilter: { filter: { fieldName: 'landingPage', stringFilter: { matchType: 'CONTAINS', value: '/tools/' } } },
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 20,
  });
  for (const row of rows(r)) {
    console.log(`  ${String(row.sessionSource).padEnd(14)} ${String(row.sessionMedium).padEnd(12)} ${String(row.landingPage).padEnd(34)} sess=${String(row.sessions).padStart(3)} views=${String(row.screenPageViews).padStart(3)}`);
  }
}

// --- Q19: first_visit 是否为同意门控的副作用 ------------------------------
console.log('\n=== Q19: first_visit / session_start / users 对照 ===');
{
  for (const name of ['first_visit', 'session_start', 'page_view']) {
    const r = await report({ dateRanges: [ALL], metrics: [{ name: 'eventCount' }, { name: 'sessions' }, { name: 'totalUsers' }], dimensionFilter: ev(name) });
    const o = rows(r)[0] || {};
    console.log(`  ${String(name).padEnd(15)} events=${String(o.eventCount).padStart(4)} sessions=${String(o.sessions).padStart(4)} users=${String(o.totalUsers).padStart(4)}`);
  }
  const g = await report({ dateRanges: [ALL], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'sessionsPerUser' }] });
  const G = rows(g)[0] || {};
  console.log(`\n  全站 sessions=${G.sessions} users=${G.totalUsers} sessionsPerUser=${Number(G.sessionsPerUser).toFixed(2)}`);
  console.log('  人均 ≈1.0 且 first_visit 次数 ≈ users ⇒ 无法区分"真回访"与"同意后才首次被 GA4 看见"。');
  console.log('  结论：first_visit 数量在同意门控站点上不可用作流量质量指标。');
}

// --- Q20: 同意门控是否真的会让 GA4 重新分配 client_id -------------------
// 这不是能从 API 直接读的事实，而是可从 consent.js 逻辑推出的结构结论。
// 这里做的是把结构性事实写清楚，供报告引用。
console.log('\n=== Q20: 结构性事实（代码可证）===');
console.log('  consent.js:26GA_ID 常量');
console.log('  consent.js:97-111 loadAnalytics() —— 注入 googletagmanager + gtag(config)');
console.log('  consent.js:133-137 applyConsent() —— 仅当 state.analytics 为 true 才调用 loadAnalytics()');
console.log('  ⇒ GA4 的 _ga cookie 在同意之前从不存在。同意那一刻 GA4 拿到的是全新 client_id，');
console.log('    并补发 first_visit。所以 first_visit 的计数≈ 同意人数，而非"新访客数"。');