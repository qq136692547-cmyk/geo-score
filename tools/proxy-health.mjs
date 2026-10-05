#!/usr/bin/env node
/**
 * proxy-health.mjs — 实测审计的抓取链路健康度。
 *
 * 为什么测这个：auditUrl() 只有一个硬失败路径（src/lib/scanner.js:37-41，
 * pageHtml 为空时抛 "Could not fetch"）。而 pageHtml 由
 * fetchPageWithHeaders()（src/lib/fetcher.js:78-92）产出，它先直连、
 * 再回落到 fetchResource() 的 5 个代理竞速（fetcher.js:6-14）。
 * 所以 audit_failed 的本质是：直连 + 5 个代理全部拿不到页面。
 *
 * 本脚本用与生产完全相同的 URL 和超时参数，逐个测 6 条路径，
 * 看是"全站都挂"还是"某些站点挂"，以及第一条（自建代理）是否还活着。
 *
 * 只读，不改任何文件。
 */
const PROXIES = [
  { url: 'https://geo-score-proxy.pages.dev/api/proxy?url=', type: 'raw' },
  { url: 'https://api.allorigins.win/get?url=', type: 'json-wrap' },
  { url: 'https://api.allorigins.win/raw?url=', type: 'raw' },
  { url: 'https://api.codetabs.com/v1/proxy/?quest=', type: 'raw' },
  { url: 'https://corsproxy.io/?url=', type: 'raw' },
];

// 覆盖不同画像的目标站：大站 / 静态站 / 可能被墙 / 明显不存在
const TARGETS = [
  'https://example.com',
  'https://n8n.io',
  'https://geoscore.help',
  'https://www.baidu.com',
  'https://this-domain-definitely-does-not-exist-9f8a7b.com',
];

async function timed(label, fn) {
  const t0 = Date.now();
  try {
    const v = await fn();
    return { label, ok: !!v, ms: Date.now() - t0, note: v ? String(v).length + 'B' : 'null' };
  } catch (e) {
    return { label, ok: false, ms: Date.now() - t0, note: String(e.message).slice(0, 40) };
  }
}

async function direct(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: 'follow' });
  if (res.ok) return await res.text();
  if (res.status >= 400 && res.status < 500) return null;
  return null;
}

async function viaProxy(p, url) {
  const proxyUrl = p.url + encodeURIComponent(url);
  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    if (res.status >= 400 && res.status < 500) return { value: null, status: 'notfound' };
    throw new Error('proxy ' + res.status);
  }
  const text = p.type === 'json-wrap'
    ? ((await res.json()) || {}).contents
    : await res.text();
  if (!text || text.length === 0) throw new Error('empty response');
  return { value: text, status: 'ok' };
}

console.log('=== 抓取链路健康度实测 ===\n');
for (const target of TARGETS) {
  console.log(`目标: ${target}`);
  const jobs = [timed('direct', () => direct(target))];
  for (const [i, p] of PROXIES.entries()) {
    jobs.push(timed(`proxy#${i} ${new URL(p.url).host}`, () => viaProxy(p, target).then((r) => (r && r.status === 'ok' ? r.value : null))));
  }
  const rs = await Promise.all(jobs);
  for (const r of rs) {
    console.log(`   ${r.ok ? 'OK  ' : 'FAIL'} ${r.label.padEnd(34)} ${String(r.ms).padStart(6)}ms  ${r.note}`);
  }
  const okCount = rs.filter((r) => r.ok).length;
  console.log(`   => ${okCount}/6 条路径可用${okCount === 0 ? '   <<< 该站点会让 auditUrl 抛错，即 audit_failed' : ''}\n`);
}

console.log('=== 结论口径 ===');
console.log('auditUrl 只要 pageHtml 非空就能出报告（scanner.js:37），');
console.log('所以 6 条路径全挂才会 audit_failed。上面 0/6 的行才是失败样本。');