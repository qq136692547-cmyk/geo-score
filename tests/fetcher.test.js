/**
 * fetcher.test.js — 代理竞速的行为契约。
 *
 * 为什么要有这个文件：fetchResource 的结果正确性靠肉眼就能看出来，真正容易
 * 悄悄退化的是**耗时**。旧实现用 Promise.race，而 race 是在第一个 *settle*
 * 的 promise 上兑现，不是第一个 *成功* 的 —— 于是"自建代理 350ms 快速失败"
 * 这种最常见的情况会把整个请求拖进等待其余代理的 15s 超时，即使某个慢速代理
 * 本来能返回可用内容。结果没变，但用户要多等十几秒才看到结果或失败页。
 *
 * 所以这里的断言既测返回值，也测 resolve 的时机。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchResource, PROXIES } from '../src/lib/fetcher.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/**
 * 用受控的假 fetch 替掉网络。每个请求 URL 前缀对应一条规则：
 *   { ms, status, body }  — 延迟 ms 后以 status/body 兑现
 *   { ms, fail: true }    — 延迟 ms 后 reject（等价于连接超时）
 *
 * 注意 fetchResource 会先对目标站做一次**直连** fetch 再回落到代理，
 * 所以未匹配规则的请求必须快速失败（默认 40ms），否则每个用例都会先
 * 空等一个默认超时窗口，把被测的代理竞速完全掩盖掉。
 * 需要"慢速代理"的用例请显式写 { ms: 15000, fail: true }。
 */
function stubFetch(rules) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const key = Object.keys(rules).find((k) => String(url).startsWith(k));
      const rule = key ? rules[key] : { ms: 40, fail: true };
      await new Promise((r) => setTimeout(r, rule.ms));
      if (rule.fail) throw new Error('boom');
      return {
        ok: rule.status >= 200 && rule.status < 300,
        status: rule.status,
        text: async () => rule.body,
        json: async () => JSON.parse(rule.body),
      };
    })
  );
}

const SELF_HOSTED = PROXIES[0].url;
const WRAPPED = PROXIES.find((p) => p.type === 'json-wrap').url;
const REST = PROXIES.filter((p) => p.url !== SELF_HOSTED && p.url !== WRAPPED).map((p) => p.url);

describe('fetchResource 代理竞速', () => {
  it('自建代理成功时直接返回它的内容', async () => {
    stubFetch({ [SELF_HOSTED]: { ms: 50, status: 200, body: 'page-html' } });
    await expect(fetchResource('https://example.com')).resolves.toBe('page-html');
  });

  it('关键场景：快速失败 + 慢速成功，应在慢速代理兑现时就返回，而不是等其余代理超时', async () => {
    // 这是本文件的核心用例。旧实现的 Promise.race 在第一个 *settle* 的
    // promise 上兑现，所以自建代理 50ms 的快速失败会把整个请求推进
    // "等所有代理" 分支，一路等满其余代理的 15s 超时 —— 即便慢速代理
    // 在 800ms 时已经拿到可用内容。结果一样，但用户多等十几秒。
    stubFetch({
      [SELF_HOSTED]: { ms: 50, fail: true },
      [WRAPPED]: { ms: 800, status: 200, body: JSON.stringify({ contents: 'slow-but-good' }) },
      ...Object.fromEntries(REST.map((u) => [u, { ms: 15000, fail: true }])),
    });

    const t0 = Date.now();
    const value = await fetchResource('https://example.com');
    const elapsed = Date.now() - t0;

    expect(value).toBe('slow-but-good');
    expect(elapsed).toBeLessThan(3000);
  });

  it('全部代理失败时返回 null', async () => {
    stubFetch({
      [SELF_HOSTED]: { ms: 20, fail: true },
      [WRAPPED]: { ms: 40, fail: true },
      ...Object.fromEntries(REST.map((u) => [u, { ms: 60, fail: true }])),
    });
    await expect(fetchResource('https://example.com')).resolves.toBeNull();
  });

  it('代理返回 4xx 时立即返回 null，不等其余代理', async () => {
    stubFetch({
      [SELF_HOSTED]: { ms: 20, status: 404, body: '' },
      [WRAPPED]: { ms: 900, status: 200, body: JSON.stringify({ contents: 'would-have-worked' }) },
      ...Object.fromEntries(REST.map((u) => [u, { ms: 15000, fail: true }])),
    });

    const t0 = Date.now();
    const value = await fetchResource('https://example.com');
    const elapsed = Date.now() - t0;

    // 4xx 意味着资源确实不存在，慢速代理不会找到别的东西。
    expect(value).toBeNull();
    expect(elapsed).toBeLessThan(500);
  });

  it('json-wrap 代理按 contents 字段解包', async () => {
    stubFetch({
      [SELF_HOSTED]: { ms: 20, fail: true },
      [WRAPPED]: {
        ms: 60,
        status: 200,
        body: JSON.stringify({ contents: 'unwrapped-html' }),
      },
      ...Object.fromEntries(REST.map((u) => [u, { ms: 15000, fail: true }])),
    });
    await expect(fetchResource('https://example.com')).resolves.toBe('unwrapped-html');
  });

  it('corsproxy.io 已从代理列表中移除（它对每个请求都返回 401 需要 API key）', () => {
    expect(PROXIES.some((p) => p.url.includes('corsproxy.io'))).toBe(false);
  });
});