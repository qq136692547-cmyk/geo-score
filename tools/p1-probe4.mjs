#!/usr/bin/env node
/**
 * p1-probe4.mjs — 查 09-27 / 09-28 这两天为什么占了 62/111 会话。
 *
 * Q10 发现的异常：direct 会话高度集中在 09-27(29) 与 09-28(33)，这两天合计
 * 62 个会话（56%），而 engagedSessions 只有 1+1。分布这么集中、互动率这么低，
 * 高度可疑是自动化流量（爬虫 / 预览环境反复抓取 / 我们自己的测试）而非真人。
 *
 * 若成立，则"109 用户里 96 个不互动"这个前提是假的 —— 真实样本可能只有
 * 40 来个，互动率的结论要重算。
 *
 * 判别手段：
 *  a) hostName —— 测试/预览流量通常在 *.pages.dev 或 localhost，正式口径是 geoscore.help
 *  b) landingPage —— 爬虫会遍历全站，真人不会均匀落在每个页面
 *  c) scroll 行为 —— GA4 自动采集，爬虫不产生
 *  d) sessionSource / medium
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROPERTY_ID = process.env.GA4_PROPERTY_ID || '546156702';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

const key = JSON.parse(readFileSync(join(REPO, 'secrets', 'ga4-reader.json'), 'utf8'));
const b64 = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
async function token() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const c = b64(JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: TOKEN_URI, iat: now, exp: now + 3600 }));
  const s = createSign('RSA-SHA256'); s.update(`${h}.${c}`);
  const r = await fetch(TOKEN_URI, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${h}.${c}.${b64(s.sign(key.private_key))}` }) });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300));
  return j.access_token;
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
const TWO_DAYS = { startDate: '2026-09-27', endDate: '2026-09-28' };
const ALL = { startDate: '28daysAgo', endDate: 'today' };

// --- Q13: 09-27/28 的 hostName 分布 --------------------------------------
console.log('=== Q13: 09-27~09-28 按 hostName（测试流量会露在 pages.dev / 127.0.0.1）===');
{
  const r = await report({
    dateRanges: [TWO_DAYS],
    dimensions: [{ name: 'hostName' }],
    metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }, { name: 'eventCount' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  });
  let tot = 0;
  for (const row of rows(r)) {
    tot += Number(row.sessions);
    console.log(`  ${String(row.hostName).padEnd(28)} sessions=${String(row.sessions).padStart(4)} views=${String(row.screenPageViews).padStart(4)} events=${String(row.eventCount).padStart(4)}`);
  }
  console.log(`  ${'TOTAL'.padEnd(28)} sessions=${tot}`);
}

// --- Q14: 那两天的落地页分布 --------------------------------------------
console.log('\n=== Q14: 09-27~09-28 landingPage 分布（爬虫会均匀遍历，真人会集中在少数页）===');
{
  const r = await report({
    dateRanges: [TWO_DAYS],
    dimensions: [{ name: 'landingPage' }],
    metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }, { name: 'engagedSessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 40,
  });
  for (const row of rows(r)) {
    console.log(`  ${String(row.landingPage).padEnd(46)} sess=${String(row.sessions).padStart(3)} views=${String(row.screenPageViews).padStart(3)} eng=${row.engagedSessions}`);
  }
}

// --- Q15: 那两天有没有 scroll / 真实交互 ---------------------------------
console.log('\n=== Q15: 09-27~09-28 全部事件构成 ===');
{
  const r = await report({
    dateRanges: [TWO_DAYS],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }, { name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 30,
  });
  for (const row of rows(r)) {
    console.log(`  ${String(row.eventName).padEnd(24)} events=${String(row.eventCount).padStart(4)} sessions=${String(row.sessions).padStart(4)}`);
  }
}

// --- Q16: 只看 geoscore.help 正式流量的漏斗（剔除测试 host）---------------
console.log('\n=== Q16: 只看 geoscore.help 正式流量的漏斗（剔除测试 host）===');
{
  const sess = await report({
    dateRanges: [ALL],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }, { name: 'engagedSessions' }],
    dimensionFilter: { filter: { fieldName: 'hostName', stringFilter: { matchType: 'EXACT', value: 'geoscore.help' } } },
  });
  const S = rows(sess)[0];
  const s = Number(S.sessions), e = Number(S.engagedSessions);
  console.log(`  geoscore.help: users=${S.totalUsers} sessions=${s} views=${S.screenPageViews} engaged=${e} rate=${((e / s) * 100).toFixed(1)}%`);
  // 按 hostName 分组后再客户端求和，避免依赖 andFilter 语法
  for (const name of ['audit_started', 'audit_completed', 'audit_failed', 'result_viewed']) {
    const r = await report({
      dateRanges: [ALL],
      dimensions: [{ name: 'hostName' }, { name: 'pageLocation' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: ev(name),
      limit: 30,
    });
    console.log(`  ${name}:`);
    for (const row of rows(r)) {
      console.log(`      ${String(row.hostName).padEnd(24)} ${decodeURIComponent(row.pageLocation).slice(0, 90)}`);
    }
  }
}

// --- Q17: 我们的自有 QA 流量识别 ------------------------------------------
// Q1 查到唯一一条 src=tool_page 的审计，目标域名是 ttcalc.shop —— 那是项目
// 自有的联调站点（Layout.astro 里的 data-cross-site 链接），不可能是真人访问。
// 用它反推：GA4 里有多少事件属于我们自己/ 被我们排除的流量。
console.log('\n=== Q17: 可识别的非真人流量标记 ===');
{
  const r = await report({
    dateRanges: [ALL],
    dimensions: [{ name: 'url_domain' }, { name: 'hostName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: { filter: { fieldName: 'customEvent:url_domain', stringFilter: { matchType: 'CONTAINS', value: 'ttcalc' } } },
    limit: 20,
  });
  const rs = rows(r);
  console.log(`  url_domain 含 ttcalc 的事件：${rs.reduce((a, b) => a + Number(b.eventCount), 0)}`);
  for (const row of rs) console.log(`      ${row.hostName} ${row.url_domain} = ${row.eventCount}`);
  console.log('\n  被我们自己的浏览器验证产生的会话，GA4 侧无法与真人区分 —— 无 sourceType 维度可分。');
}