/**
 * fetcher-proxies.test.js — 三份 PROXIES 的隐私护栏。
 *
 * PROXIES 在三个模块里各存一份（浏览器 / node / worker），历史上 worker 那份
 * 漂移过（多留了一个已死的 corsproxy.io）。任何一份被加回公共 CORS 代理，都
 * 意味着被审计站点的 URL 会被明文送到第三方 —— 这正是 privacy.astro §2 否认的
 * 行为。
 *
 * 单独成文件而不是写进 fetcher.test.js：后者在模块顶层 PROXIES.push 了两个
 * test.invalid 假代理，共享同一个数组引用，断言长度会被污染。
 *
 * 断言用「域名白名单」而不是「长度必须为 1」：长度是当前状态的偶然事实，将来
 * 加一条自建容灾代理就会误红；白名单钉的才是真正的不变量 —— 允许的只有我们自己
 * 的域名，新增任何域名都必须是一次有意识的改动。
 */
import { describe, it, expect } from 'vitest';
import { PROXIES as browserProxies } from '../src/lib/fetcher.js';
import { PROXIES as nodeProxies } from '../src/lib/node-fetcher.js';
import { PROXIES as workerProxies } from '../worker/lib/node-fetcher.js';

const COPIES = [
  ['src/lib/fetcher.js', browserProxies],
  ['src/lib/node-fetcher.js', nodeProxies],
  ['worker/lib/node-fetcher.js', workerProxies],
];

// 只允许自建代理。新增域名必须改这里 —— 有意识的动作，不是顺手放过。
const ALLOWED_HOSTS = ['geo-score-proxy.pages.dev'];

describe('PROXIES 隐私护栏', () => {
  it.each(COPIES)('%s 的代理全部落在自建域白名单内', (_file, list) => {
    expect(list.length).toBeGreaterThan(0);
    for (const proxy of list) {
      expect(ALLOWED_HOSTS).toContain(new URL(proxy.url).hostname);
    }
  });
});
