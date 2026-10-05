/**
 * showAuditOrigin (src/scripts/boot.js) — 工具页跳转的来源标识。
 *
 * 回归背景：工具页没有 #loading-section / #report-section，所以从工具页发起的
 * 审计会整页跳到首页执行。headed 浏览器实测确认了两件事：跳转只要 329ms
 * （不是流失主因），而落地页**没有任何来源线索** —— h1 变了、导航高亮切到
 * Home、扫描面板是通用 GEO 步骤，`anySrcIndicatorInReport = false`。
 * 用户在这几秒里唯一合理的解读是"点错了"。
 *
 * 本文件断言 showAuditOrigin 把线索补上，同时守住它引入的新风险：
 * slug 来自 URL 查询串，属于用户可控输入，若直接拼进 innerHTML 就是一个
 * XSS。所以实现只认白名单内的 slug，且全程用 textContent。
 *
 * boot.js 是带 import 的 ES module 且在加载时就碰 document（本仓库没有 jsdom），
 * 无法直接 import。沿用 tests/result-viewed-consent.test.js 已验证的做法：
 * 从磁盘读真实源码、切出目标片段、在最小 stub 里真跑。断言的是要上线的代码。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOOT_SRC = fs.readFileSync(join(REPO, 'src', 'scripts', 'boot.js'), 'utf8');

const START = BOOT_SRC.indexOf('var TOOL_PAGE_NAMES');
const END = BOOT_SRC.indexOf('// --- Bootstrap: attach click listeners');
if (START < 0 || END < 0) throw new Error('找不到 showAuditOrigin 片段，切片失效');
const SLICE = BOOT_SRC.slice(START, END);

function makeEl(tag) {
  return {
    tag,
    className: '',
    textContent: '',
    children: [],
    classList: {
      removed: [],
      remove(c) { this.removed.push(c); },
    },
    appendChild(child) { this.children.push(child); return child; },
  };
}

function run({ hostId, slug, lang }) {
  const host = makeEl('div');
  const ctx = {
    document: {
      getElementById: (id) => (id === hostId ? host : null),
      createElement: makeEl,
      createTextNode: (text) => ({ nodeType: 3, textContent: text }),
    },
    t: (en, zh) => (lang === 'zh' ? zh : en),
  };
  vm.createContext(ctx);
  vm.runInContext(SLICE, ctx);
  ctx.showAuditOrigin(slug);
  return { host, ctx };
}

describe('showAuditOrigin', () => {
  it('已知 slug 会渲染来源标识并取消隐藏', () => {
    const { host } = run({ hostId: 'audit-origin', slug: 'llms-txt-checker', lang: 'en' });
    expect(host.classList.removed).toContain('hidden');
    expect(host.children.length).toBe(1);
    const box = host.children[0];
    expect(box.textContent).toBe('');
    // 文案 + 工具名都进了子树
    const flat = JSON.stringify(box.children);
    expect(flat).toContain('llms.txt Checker');
    expect(flat).toContain('Audit started from ');
  });

  it('中文站用中文引导文案', () => {
    const { host } = run({ hostId: 'audit-origin', slug: 'ai-readiness-score', lang: 'zh' });
    const flat = JSON.stringify(host.children[0].children);
    expect(flat).toContain('本次审计发起自');
    expect(flat).toContain('AI Readiness Score');
  });

  it('未知 slug 一律不渲染 —— 这是 XSS 防线，不是可选项', () => {
    for (const slug of ['<img src=x onerror=alert(1)>', '', 'home', 'llms-txt-checker%22', '../../etc/passwd']) {
      const { host } = run({ hostId: 'audit-origin', slug, lang: 'en' });
      expect(host.children.length, `slug=${slug} 不该渲染`).toBe(0);
      expect(host.classList.removed).toEqual([]);
    }
  });

  it('容器不存在时静默返回，不抛错', () => {
    expect(() => run({ hostId: 'nope', slug: 'llms-txt-checker', lang: 'en' })).not.toThrow();
  });

  it('实现里不出现 innerHTML（全程 textContent）', () => {
    expect(SLICE).not.toMatch(/innerHTML/);
    expect(SLICE).toMatch(/textContent/);
  });
});

describe('工具页跳转 URL 带上来源 slug', () => {
  it('bounce 分支拼出 &tool=', () => {
    // 没有这个参数，首页就无从得知审计来自哪个工具页
    expect(BOOT_SRC).toMatch(/\?audit=' \+ encodeURIComponent\(url\) \+ '&src=tool_page&tool='/);
  });
});