import { describe, it, expect } from 'vitest';
import { countWords, hasAuthorSignal, tokenizeWords } from '../src/lib/text-utils.js';

describe('text-utils', () => {
  it('counts Chinese content as words instead of one whitespace token', () => {
    const text = '今日A股涨停数量明显增加，市场情绪回暖。投资者需要关注成交额和板块持续性。';
    expect(countWords(text)).toBeGreaterThan(10);
    expect(tokenizeWords(text).length).toBeGreaterThan(5);
  });

  it('detects English and Chinese author signals', () => {
    expect(hasAuthorSignal('<meta name="author" content="Jane Smith">')).toBe(true);
    expect(hasAuthorSignal('作者：爱看盘团队')).toBe(true);
    expect(hasAuthorSignal('<script type="application/ld+json">{"author":{"@type":"Organization"}}</script>')).toBe(true);
  });
});
