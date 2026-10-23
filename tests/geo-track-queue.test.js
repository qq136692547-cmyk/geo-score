/**
 * geoTrack 事件队列（P0.2, 2026-10-23）—— 行为锁。
 *
 * 回归背景：geoTrack 过去是 `if (typeof gtag === 'function')` 的空操作，
 * 而 gtag 要等同意后才由 consent.js 注入，**没有队列、没有重放**。
 * 于是解析期触发的事件（pricing_viewed / fixpack_viewed）对所有访客都丢失：
 * 首次访问因为还没同意，已同意的回访因为 consent.js 是 defer、解析期 gtag 还不存在。
 * 这两个事件正是付费漏斗顶端的度量口径，丢了整个漏斗就没法看。
 *
 * 修复：gtag 不可用时入队，gtag 一旦可用按序补发；从不同意的访客永不补发
 *（这是合规要求，不是缺陷）。
 *
 * Layout.astro 是 .astro 文件，里面是内联脚本，不能直接 import。
 * 这里沿用仓库里已验证的做法（tests/result-viewed-consent.test.js、
 * tests/consent-gating.test.js）：从磁盘读出**出货源码**，切出那一段，在最小
 * stub 里真跑一遍。断言的是出货代码本身。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const LAYOUT_EN = fs.readFileSync(
  fileURLToPath(new URL('../src/layouts/Layout.astro', import.meta.url)),
  'utf8'
);
const LAYOUT_ZH = fs.readFileSync(
  fileURLToPath(new URL('../src/layouts/LayoutZh.astro', import.meta.url)),
  'utf8'
);
const CONSENT_JS = fs.readFileSync(
  fileURLToPath(new URL('../public/scripts/consent.js', import.meta.url)),
  'utf8'
);

// 切出 geoAuthed + 队列 + geoTrack 三块（到 geoCrossSource 之前结束）
const SLICE_START = 'function geoAuthed() {';
const SLICE_END = 'function geoCrossSource() {';

function slice(src) {
  const a = src.indexOf(SLICE_START);
  const b = src.indexOf(SLICE_END);
  if (a < 0 || b < 0 || b < a) throw new Error('切不出 geoTrack 段 —— 源码结构变了？');
  return src.slice(a, b);
}

/** 起一个最小环境：window / localStorage / 可选的 gtag / 记录器 */
function makeEnv({ withGtag = false, token = null } = {}) {
  const sent = [];
  const win = {};
  const ctx = {
    window: win,
    localStorage: { getItem: (k) => (k === 'geoscore_token' && token ? token : null) },
    sent,
  };
  if (withGtag) {
    ctx.gtag = function (kind, action, params) {
      sent.push({ kind, action, params });
    };
    win.gtag = ctx.gtag;
  }
  vm.createContext(ctx);
  vm.runInContext(slice(LAYOUT_EN), ctx);
  return { ctx, win, sent };
}

describe('P0.2 · geoTrack 事件队列', () => {
  it('两份 Layout 的队列逻辑必须一致（EN 与 ZH 各一份，不能只改一边）', () => {
    const en = slice(LAYOUT_EN);
    const zh = slice(LAYOUT_ZH);
    // 比较关键骨架（忽略注释与空白）
    const norm = (s) =>
      s
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/\s+/g, ' ')
        .trim();
    expect(norm(zh)).toBe(norm(en));
  });

  it('gtag 不存在时：事件入队，不发送（不违反同意门控）', () => {
    const { win, sent } = makeEnv({ withGtag: false });
    win.geoTrack('pricing_viewed', { source_type: 'other' });
    expect(sent.length).toBe(0);
    expect(win.__geoPending.length).toBe(1);
    expect(win.__geoPending[0].action).toBe('pricing_viewed');
  });

  it('gtag 一旦可用：按序补发，且 authed 参数被补全', () => {
    const { ctx, win, sent } = makeEnv({ withGtag: false });
    win.geoTrack('pricing_viewed', { source_type: 'other' });
    win.geoTrack('fixpack_viewed', { source_type: 'other' });
    expect(sent.length).toBe(0);

    // 模拟 consent.js 注入 gtag 后触发补发
    const gtag = function (kind, action, params) {
      sent.push({ kind, action, params });
    };
    ctx.gtag = gtag;
    win.gtag = gtag;
    win.__geoFlushPending();

    expect(sent.length).toBe(2);
    expect(sent[0].action).toBe('pricing_viewed');
    expect(sent[1].action).toBe('fixpack_viewed');
    expect(sent[0].kind).toBe('event');
    // authed 在补发时补全（此时登录态才准）
    expect(sent[0].params.authed).toBe(false);
    expect(win.__geoPending.length).toBe(0);
  });

  it('补发不会重复：队列清空后再次触发补发是空操作', () => {
    const { ctx, win, sent } = makeEnv({ withGtag: false });
    win.geoTrack('pricing_viewed', {});
    const gtag = function (kind, action, params) { sent.push({ kind, action, params }); };
    ctx.gtag = gtag; win.gtag = gtag;
    win.__geoFlushPending();
    win.__geoFlushPending();
    expect(sent.length).toBe(1);
  });

  it('已登录时补发的 authed 为 true', () => {
    const { ctx, win, sent } = makeEnv({ withGtag: false, token: 'tok' });
    win.geoTrack('fixpack_viewed', {});
    const gtag = function (kind, action, params) { sent.push({ kind, action, params }); };
    ctx.gtag = gtag; win.gtag = gtag;
    win.__geoFlushPending();
    expect(sent[0].params.authed).toBe(true);
  });

  it('gtag 已就绪时直接发送，不入队（回访且同意过的老路径不变）', () => {
    const { win, sent } = makeEnv({ withGtag: true });
    win.geoTrack('result_cta_impression', { score: 9 });
    expect(sent.length).toBe(1);
    expect(sent[0].action).toBe('result_cta_impression');
    expect(win.__geoPending.length).toBe(0);
  });

  it('gtag 未就绪时调用补发是安全的空操作（不能抛错）', () => {
    const { win } = makeEnv({ withGtag: false });
    expect(() => win.__geoFlushPending()).not.toThrow();
    expect(win.__geoPending.length).toBe(0);
  });

  it('consent.js 在加载 GA 后会触发补发（否则队列永远不落地）', () => {
    expect(CONSENT_JS).toMatch(/__geoFlushPending/);
    const a = CONSENT_JS.indexOf('function loadAnalytics()');
    const b = CONSENT_JS.indexOf('function loadAds()');
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    const sliceGA = CONSENT_JS.slice(a, b);
    expect(sliceGA).toMatch(/__geoFlushPending/);
  });

  it('补发必须等 gtag.js 真正初始化之后，不能在 injectScript 之后立刻发', () => {
    // 实测（线上、无代理）：injectScript 之后立刻补发 → 队列清了但一个请求都没发；
    // 挂在 load 事件上补发 → 同样一个请求都没发；只有等 gtag.js 初始化完成才发得出去。
    // 可观测的初始化标志是 window.google_tag_manager（实测：page_view 发出后 45ms 出现）。
    expect(CONSENT_JS).toMatch(/injectScript\(GA_SCRIPT_ID,\s*GA_SRC,\s*null,\s*flushWhenGaReady\)/);
    expect(CONSENT_JS).toMatch(/if \(window\.google_tag_manager\)\s*\{\s*flushPending\(\);\s*return;/);
    // injectScript 必须支持 onload 回调
    expect(CONSENT_JS).toMatch(/function injectScript\(id, src, extraAttr, onload\)/);
    expect(CONSENT_JS).toMatch(/addEventListener\('load',\s*onload\)/);
    // 没有 setTimeout 的环境（测试沙箱）必须直接补发，不能静默不补发
    expect(CONSENT_JS).toMatch(/if \(typeof setTimeout !== 'function'\) \{ flushPending\(\); return; \}/);
  });
});
