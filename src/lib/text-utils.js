const CJK_CHAR_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;

let wordSegmenter = null;
try {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    wordSegmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
  }
} catch (_) {
  wordSegmenter = null;
}

function fallbackTokens(text) {
  const cjkChars = text.match(CJK_CHAR_RE) || [];
  const cjkTokens = [];
  for (let index = 0; index < cjkChars.length - 1; index += 1) {
    cjkTokens.push(cjkChars[index] + cjkChars[index + 1]);
  }
  const latinTokens = text.replace(CJK_CHAR_RE, ' ').split(/\s+/).filter(Boolean);
  return latinTokens.concat(cjkTokens);
}

function tokenizeWords(text) {
  const input = String(text || '').trim();
  if (!input) return [];
  if (wordSegmenter) {
    return Array.from(wordSegmenter.segment(input))
      .filter((segment) => segment.isWordLike)
      .map((segment) => segment.segment);
  }
  return fallbackTokens(input);
}

function countWords(text) {
  const input = String(text || '');
  if (!input.trim()) return 0;
  if (wordSegmenter) return tokenizeWords(input).length;
  const cjkChars = (input.match(CJK_CHAR_RE) || []).length;
  const latinWords = input.replace(CJK_CHAR_RE, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(latinWords, Math.round(cjkChars * 0.6));
}

function hasAuthorSignal(html) {
  return /rel=["']author["']|<meta[^>]+name=["']author["']|"author"\s*:|作者[：:]|撰稿|责任编辑|编辑[：:]/i.test(html || '');
}

export { CJK_CHAR_RE, countWords, hasAuthorSignal, tokenizeWords };
