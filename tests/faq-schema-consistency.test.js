import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// FAQPage 结构化数据有一条硬规定：每个 Question 的文本必须在**用户可见的正文**里
// 出现（通常是 h2/h3）。只在 schema 里写、页面上不显示，属于不一致，会丢掉
// 富媒体结果资格。这个测试就是防"只改一边"的回归。

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PAGES = join(ROOT, 'src', 'pages');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.astro')) out.push(p);
  }
  return out;
}

// 抓 `'@type': 'Question', name: '...'`（单行或折行都覆盖）
function questions(src) {
  const re = /'@type':\s*'Question',\s*name:\s*'((?:[^'\\]|\\.)*)'/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) out.push(m[1].replace(/\\'/g, "'"));
  return out;
}

// 抓页面上可见的标题文本（h2/h3），去掉标签与 HTML 实体
function headings(src) {
  const re = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) {
    out.push(
      m[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&mdash;/g, '—').replace(/&rsquo;|&#39;/g, "'").replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim()
    );
  }
  return out;
}

// 保留所有语言的字母与数字（\p{L}\p{N}），否则中文标题会被整段剥空，
// 让 zh/ 页面的比对永远失败——那是测试的 bug，不是页面的 bug。
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();

const files = walk(PAGES);
const withFaq = files
  .map((f) => ({ f, rel: relative(ROOT, f).replace(/\\/g, '/'), src: readFileSync(f, 'utf8') }))
  .map((x) => ({ ...x, qs: questions(x.src), hs: headings(x.src).map(norm) }))
  .filter((x) => x.qs.length > 0);

describe('FAQPage schema matches visible content', () => {
  it('finds at least one page with FAQ schema (guards against the scanner silently matching nothing)', () => {
    expect(withFaq.length).toBeGreaterThan(0);
  });

  for (const page of withFaq) {
    it(`${page.rel}: every Question appears as a visible heading`, () => {
      const missing = page.qs.filter((q) => !page.hs.some((h) => h === norm(q) || h.includes(norm(q))));
      expect(missing, `not visible on the page: ${missing.join(' | ')}`).toEqual([]);
    });
  }
});
