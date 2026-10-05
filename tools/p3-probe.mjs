#!/usr/bin/env node
/**
 * p3-probe.mjs — 用 GA4 里已有的 duration_ms 判定 fa8e129 到底有没有真的提速。
 *
 * 背景：browser-verify 复测显示改后端到端 1,561ms（改前 30,016ms），但本次
 * **没有触发任何超时**（最慢请求 347ms），所以 28.5 秒的改善不能归功于我的改动 ——
 * 健康网络下并行化只省约 171ms。要判定真实效果，需要看真实用户侧的耗时分布。
 *
 * boot.js:201 已经把 duration_ms 随 audit_completed 上报，所以只要该参数在 GA4
 * 注册过，就能直接拉 fa8e129（2026-10-05 部署）前后的 p50/p95，零生产成本。
 *
 * 若未注册，则如实记录：这个指标在 GA4 侧不可用，只能靠本地 A/B。
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

// --- Q24: duration_ms 这个自定义维度注册了吗 --------------------------------
console.log('=== Q24: duration_ms 是否已注册为自定义维度 ===');
let registered = false;
{
  for (const name of ['duration_ms', 'durationMs']) {
    try {
      const r = await report({
        dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
        dimensions: [{ name: `customEvent:${name}` }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: ev('audit_completed'),
        limit: 20,
      });
      const rs = rows(r);
      console.log(`  customEvent:${name} -> 200 OK`);
      for (const row of rs) console.log(`      ${row[name]} = ${row.eventCount}`);
      registered = true;
    } catch (e) {
      console.log(`  customEvent:${name} -> 未注册 (${String(e.message).slice(0, 60)})`);
    }
  }
}

// --- Q25: 逐次 audit_completed 的耗时 --------------------------------------
console.log('\n=== Q25: 逐日 audit_completed 次数（duration_ms 可用时一并列出）===');
{
  const dims = [{ name: 'date' }];
  const mets = [{ name: 'eventCount' }];
  if (registered) dims.push({ name: 'customEvent:duration_ms' });
  const r = await report({
    dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
    dimensions: dims,
    metrics: mets,
    dimensionFilter: ev('audit_completed'),
    limit: 60,
  });
  for (const row of rows(r)) {
    const d = registered ? `  duration_ms=${row.duration_ms}` : '';
    console.log(`  ${row.date}  x${row.eventCount}${d}`);
  }
}

if (!registered) {
  console.log('\n  => duration_ms 在 GA4 侧不可读。要判定 fa8e129 的真实效果，');
  console.log('     只能用本地 A/B（src/lib/node-scanner.js + node-fetcher.js），不跑生产。');
  console.log('     或者让用户在 GA4 后台注册 duration_ms 维度，之后才有真实用户耗时分布。');
}