#!/usr/bin/env node
// 拉取 GA4 全部事件计数（90 天），看变现漏斗到底有没有信号。
// 输出：事件名 / 次数 / 用户数，按次数降序。
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const KEY = JSON.parse(readFileSync('secrets/ga4-reader.json', 'utf8'));
const PROPERTY_ID = '546156702';
const DAYS = Number((process.argv.find((a) => a.startsWith('--days=')) || '--days=90').split('=')[1]);

const iso = (d) => d.toISOString().slice(0, 10);
const end = new Date(Date.now() - 1 * 864e5);
const start = new Date(end.getTime() - (DAYS - 1) * 864e5);

const b64 = (b) => Buffer.from(b).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const hdr = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' +
  b64(JSON.stringify({ iss: KEY.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now }));
const sig = createSign('RSA-SHA256').update(hdr).sign(KEY.private_key, 'base64url');
const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${hdr}.${sig}`,
})).json();
const auth = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' };

async function report(body) {
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`, {
    method: 'POST', headers: auth, body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`runReport ${r.status}: ${JSON.stringify(j).slice(0, 400)}`);
  return j;
}

console.log(`窗口 ${iso(start)} → ${iso(end)}（${DAYS} 天，GA4 属性 ${PROPERTY_ID}）`);
console.log('口径提醒：GA4 只看得见点了"同意"的用户 —— 这是同意者子集，不是全量\n');

const r = await report({
  dateRanges: [{ startDate: iso(start), endDate: iso(end) }],
  dimensions: [{ name: 'eventName' }],
  metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
  orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
  limit: 60,
});
const rows = r.rows || [];
if (!rows.length) { console.log('(无数据)'); process.exit(0); }
console.log('  次数  用户数  事件名');
for (const x of rows) {
  console.log(`  ${String(x.metricValues[0].value).padStart(5)}  ${String(x.metricValues[1].value).padStart(5)}  ${x.dimensionValues[0].value}`);
}
const monet = rows.filter((x) => /upgrade|pricing|pay|subscribe|billing|checkout/i.test(x.dimensionValues[0].value));
console.log('\n=== 变现相关事件 ===');
if (!monet.length) {
  console.log('  一条都没有。90 天里没有任何一次付费 CTA 点击（upgrade_cta_clicked 等）。');
} else {
  for (const x of monet) console.log(`  ${x.metricValues[0].value} 次 / ${x.metricValues[1].value} 人  ${x.dimensionValues[0].value}`);
}
