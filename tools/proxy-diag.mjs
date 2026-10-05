#!/usr/bin/env node
/**
 * proxy-diag.mjs — 判断 4 个"失败"代理到底是全局死亡，还是仅中国大陆不可达。
 *
 * 为什么必须先查这个：上一轮 tools/proxy-health.mjs 从本机（重庆）测出
 * allorigins ×2 / codetabs 15s 超时、corsproxy 返回 null，结论是"4 个代理已死"。
 * 但本机的网络出口在中国大陆，超时很可能是 GFW 丢包，而不是服务下线。
 * 站点面向海外用户 —— 若贸然移除这 4 个代理，等于砍掉海外用户唯一的备用路径。
 * 所以在动手改代码之前，必须区分：
 *
 *   DNS 解析失败 / 连接超时(ETIMEDOUT) / TLS 握手失败  => 网络层，可能是地域屏蔽
 *   HTTP 4xx-5xx                                      => 服务还活着，是调用方式变了
 *
 * 只读，不改任何文件。
 */
const PROBES = [
  { name: 'allorigins/get', url: 'https://api.allorigins.win/get?url=' },
  { name: 'allorigins/raw', url: 'https://api.allorigins.win/raw?url=' },
  { name: 'codetabs', url: 'https://api.codetabs.com/v1/proxy/?quest=' },
  { name: 'corsproxy', url: 'https://corsproxy.io/?url=' },
  { name: '自建 geo-score-proxy', url: 'https://geo-score-proxy.pages.dev/api/proxy?url=' },
];
const TARGET = 'https://example.com';

function classify(err) {
  const c = err && err.cause;
  const code = (c && c.code) || err.code || '';
  const msg = String((c && c.message) || err.message || err);
  if (/ENOTFOUND|EAI_AGAIN/.test(code)) return `DNS 解析失败 (${code})`;
  if (/ETIMEDOUT|TIMEDOUT|aborted/.test(code + msg)) return `连接超时 (${code || 'timeout'})`;
  if (/ECONNREFUSED/.test(code)) return `连接被拒 (${code})`;
  if (/ECONNRESET/.test(code)) return `连接被重置 (${code}) — 典型 GFW 特征`;
  if (/CERT|TLS|SSL/.test(msg)) return `TLS 失败: ${msg.slice(0, 50)}`;
  return `${code || 'ERR'}: ${msg.slice(0, 60)}`;
}

console.log('=== 逐代理诊断（目标 ' + TARGET + '）===\n');
for (const p of PROBES) {
  const full = p.url + encodeURIComponent(TARGET);
  const host = new URL(p.url).host;
  let dns = '-';
  try {
    const { promises } = await import('node:dns');
    const addrs = await promises.resolve(host);
    dns = addrs.join(', ');
  } catch (e) {
    dns = '解析失败 ' + (e.code || '');
  }
  const t0 = Date.now();
  let verdict;
  try {
    const res = await fetch(full, { signal: AbortSignal.timeout(12000) });
    const body = (await res.text()).slice(0, 120).replace(/\s+/g, ' ');
    verdict = `HTTP ${res.status}  ${Date.now() - t0}ms  体: ${JSON.stringify(body)}`;
  } catch (e) {
    verdict = `失败  ${Date.now() - t0}ms  ${classify(e)}`;
  }
  console.log(`${p.name.padEnd(24)} host=${host}`);
  console.log(`   DNS: ${dns}`);
  console.log(`   ${verdict}\n`);
}

console.log('=== 判读口径 ===');
console.log('连接超时/重置 + DNS 正常  => 网络层不可达，海外可能正常，不能删');
console.log('HTTP 4xx/5xx             => 服务活着但调用方式变了，可以修');
console.log('DNS 解析失败             => 域名已下线，可以删');