// 页面 × 查询词 交叉：确认每个词实际落在哪个页面上，避免改错页面
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const KEY = JSON.parse(readFileSync('secrets/ga4-reader.json', 'utf8'));
const DAYS = Number((process.argv.find((a) => a.startsWith('--days=')) || '--days=90').split('=')[1]);

const iso = (d) => d.toISOString().slice(0, 10);
const end = new Date(Date.now() - 2 * 864e5);
const start = new Date(end.getTime() - (DAYS - 1) * 864e5);

const b64 = (b) => Buffer.from(b).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const hdr = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' +
  b64(JSON.stringify({ iss: KEY.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now }));
const sig = createSign('RSA-SHA256').update(hdr).sign(KEY.private_key, 'base64url');
const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${hdr}.${sig}`,
})).json();
const auth = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' };

const SITE = 'https://geoscore.help/';
const r = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({ startDate: iso(start), endDate: iso(end), dimensions: ['page', 'query'], rowLimit: 200 }),
});
const j = await r.json();
if (!r.ok) { console.error('ERR', r.status, JSON.stringify(j).slice(0, 300)); process.exit(1); }

const rows = (j.rows || []).map((x) => ({ page: x.keys[0].replace('https://geoscore.help', ''), q: x.keys[1], imp: x.impressions, pos: x.position }));
console.log(`窗口 ${iso(start)} → ${iso(end)}  (${DAYS} 天)  共 ${rows.length} 组 page×query\n`);

// 只列展示 >= 3 的，按展示降序
rows.filter((r) => r.imp >= 3).sort((a, b) => b.imp - a.imp).forEach((r) => {
  console.log(`${String(r.imp).padStart(4)} 均排 ${r.pos.toFixed(1).padStart(5)}  ${r.q.padEnd(34)} → ${r.page}`);
});

// 按页面汇总
const byPage = {};
rows.forEach((r) => { (byPage[r.page] = byPage[r.page] || []).push(r); });
console.log('\n=== 各页面词数 / 展示小计（该页 top 词）===');
Object.entries(byPage).sort((a, b) => b[1].reduce((s, x) => s + x.imp, 0) - a[1].reduce((s, x) => s + x.imp, 0)).slice(0, 10).forEach(([p, arr]) => {
  const tot = arr.reduce((s, x) => s + x.imp, 0);
  const top = arr.sort((a, b) => b.imp - a.imp).slice(0, 3).map((x) => `${x.q}(${x.imp}/排${x.pos.toFixed(0)})`).join(', ');
  console.log(`${String(tot).padStart(4)}  ${p || '/'}  [${arr.length}词]  ${top}`);
});
