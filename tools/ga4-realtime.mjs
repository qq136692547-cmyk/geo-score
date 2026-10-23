#!/usr/bin/env node
/**
 * ga4-realtime.mjs — 查 GA4 实时（最近 30 分钟）事件，用于确认自定义事件是否真的入账。
 * 复现：node tools/ga4-realtime.mjs
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const KEY_PATH = 'secrets/ga4-reader.json';
const PROPERTY_ID = process.env.GA4_PROPERTY_ID || '546156702';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

const key = JSON.parse(readFileSync(KEY_PATH, 'utf8'));

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: key.client_email, scope: SCOPE, aud: TOKEN_URI,
    iat: now, exp: now + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const assertion = `${header}.${claim}.${b64url(signer.sign(key.private_key))}`;
  const res = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error('token 失败: ' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

const token = await getToken();
const MODE = process.argv[2] || 'realtime';
const url = MODE === 'realtime'
  ? `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runRealtimeReport`
  : `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`;
const body = MODE === 'realtime'
  ? { dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], limit: 100 }
  : {
      dateRanges: [{ startDate: 'today', endDate: 'today' }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      limit: 100,
    };

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
});
const j = await res.json();
if (!j.rows) {
  console.log('实时报告无数据:', JSON.stringify(j).slice(0, 400));
} else {
  const rows = j.rows.map((r) => [r.dimensionValues[0].value, r.metricValues[0].value]);
  rows.sort((a, b) => Number(b[1]) - Number(a[1]));
  console.log('=== GA4 ' + (MODE === 'realtime' ? '实时（最近 30 分钟）' : '今日（today..today）') + '事件 ===');
  rows.forEach(([n, c]) => console.log(`  ${n.padEnd(30)} ${c}`));
  const want = ['pricing_viewed', 'checkout_started', 'result_cta_impression', 'fixpack_viewed', 'fixpack_cta_clicked', 'page_view', 'audit_started'];
  console.log('\n=== 本次关心的 5 个新事件 ===');
  for (const w of want) {
    const hit = rows.find((r) => r[0] === w);
    console.log(`  ${w.padEnd(26)} ${hit ? '✅ ' + hit[1] : '❌ 未出现'}`);
  }
}
