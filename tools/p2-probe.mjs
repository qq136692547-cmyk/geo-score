#!/usr/bin/env node
/**
 * p2-probe.mjs — 查 audit_failed 的 3 次失败到底是什么原因。
 *
 * 已确认的代码事实（不需要再查）：
 * - src/lib/scanner.js:37-41 是 auditUrl 唯一的 throw 路径：
 *     if (!pageHtml) throw new Error("Could not fetch " + normalized + ". ...")
 * - src/lib/fetcher.js 的 fetchResource / fetchPageWithHeaders 所有失败路径都
 *   resolve(null)，从不 reject ⇒ 除上述之外没有其他硬失败
 * - src/scripts/boot.js:49-57 geoErrorCode() 把 "Could not fetch" 判为 'fetch_failed'
 *   （message 里含 "fetch"）
 *
 * 但 GA4 侧读不到 error_code（该自定义维度未注册），只能读 url_domain。
 *
 * 本探针要证实的 bug：boot.js:228 写的是 geoUrlDomain(url)，而 url 是
 * #url-input 的原始值（没有 https:// 前缀）。boot.js:195 才给 targetUrl 补前缀，
 * 且 :197/:201 都用 geoUrlDomain(targetUrl)。所以 :228 里 new URL("example.com")
 * 会抛异常，geoUrlDomain 的 catch 返回 '' ⇒ audit_failed 的 url_domain 恒为空。
 *
 * 若 GA4 显示 audit_failed 的 url_domain 全是 (not set)，而 audit_started /
 * audit_completed 有真实域名，即证实该 bug。
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

// --- Q21: 三个事件各自的 url_domain 是否为空 ------------------------------
console.log('=== Q21: audit_* 事件的 url_domain（验证 boot.js:228 的 bug）===');
for (const name of ['audit_started', 'audit_completed', 'audit_failed']) {
  const r = await report({
    dateRanges: [ALL],
    dimensions: [{ name: 'customEvent:url_domain' }, { name: 'date' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: ev(name),
    limit: 30,
  });
  const rs = rows(r);
  const tot = rs.reduce((a, b) => a + Number(b.eventCount), 0);
  const empty = rs.filter((x) => x.url_domain === '(not set)' || x.url_domain === '');
  console.log(`\n  ${name}  共 ${tot} 次`);
  for (const row of rs) console.log(`      ${row.date}  url_domain=${JSON.stringify(row.url_domain)}  x${row.eventCount}`);
  console.log(`      => 空值 ${empty.reduce((a, b) => a + Number(b.eventCount), 0)}/${tot}`);
}

// --- Q22: audit_failed 的其它可用维度 -----------------------------------
console.log('\n=== Q22: audit_failed 能读到的其它维度 ===');
for (const d of ['source_type', 'authed', 'entry_point']) {
  try {
    const r = await report({
      dateRanges: [ALL],
      dimensions: [{ name: `customEvent:${d}` }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: ev('audit_failed'),
      limit: 15,
    });
    const rs = rows(r);
    console.log(`  ${d.padEnd(14)} ${rs.length ? rs.map((x) => `${x[d]}=${x.eventCount}`).join('  ') : '(无行)'}`);
  } catch (e) {
    console.log(`  ${d.padEnd(14)} 查询失败: ${String(e.message).slice(0, 60)}`);
  }
}

// --- Q23: 失败发生的日期，与成功/失败的对比 ------------------------------
console.log('\n=== Q23: 逐日 audit_started / completed / failed ===');
{
  const r = await report({
    dateRanges: [ALL],
    dimensions: [{ name: 'date' }, { name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: ['audit_started', 'audit_completed', 'audit_failed'] } } },
    limit: 100,
  });
  const by = {};
  for (const row of rows(r)) {
    by[row.date] = by[row.date] || {};
    by[row.date][row.eventName] = Number(row.eventCount);
  }
  console.log('  date'.padEnd(12) + 'started'.padStart(9) + 'completed'.padStart(11) + 'failed'.padStart(8));
  for (const d of Object.keys(by).sort()) {
    if (!by[d].audit_started) continue;
    console.log('  ' + d.padEnd(10) + String(by[d].audit_started || 0).padStart(9) + String(by[d].audit_completed || 0).padStart(11) + String(by[d].audit_failed || 0).padStart(8));
  }
}