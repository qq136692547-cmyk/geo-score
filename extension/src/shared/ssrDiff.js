/**
 * GeoScore Chrome Extension - SSR vs. CSR Difference Analyzer
 *
 * Compares raw server-rendered HTML (fetched directly via background worker)
 * with the browser's live DOM (CSR) to detect JavaScript rendering traps and
 * content/schema loss that affects AI search crawlers.
 */

import { countWords } from '../../../src/lib/text-utils.js';
import { extractJsonLd } from '../../../src/lib/analyzers/eeat.js';

export function extractRenderableText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<template\b[^<]*(?:(?!<\/template>)<[^<]*)*<\/template>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function flattenSchemaTypes(blocks) {
  const types = [];

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }

    if (Array.isArray(node['@graph'])) {
      for (const item of node['@graph']) walk(item);
    }

    if (node['@type']) {
      if (Array.isArray(node['@type'])) {
        for (const t of node['@type']) {
          if (typeof t === 'string' && t.trim()) types.push(t.trim());
        }
      } else if (typeof node['@type'] === 'string' && node['@type'].trim()) {
        types.push(node['@type'].trim());
      }
    }

    // Also inspect common sub-properties that could contain nested schemas
    for (const key of ['author', 'publisher', 'mainEntity', 'itemListElement']) {
      if (node[key] && typeof node[key] === 'object') {
        walk(node[key]);
      }
    }
  }

  walk(blocks);
  return Array.from(new Set(types));
}

export function computeSsrCsrDiff({
  ssrHtml = '',
  csrHtml = '',
  ssrStatus = 200,
  authenticatedFallback = false,
} = {}) {
  const ssrText = extractRenderableText(ssrHtml);
  const csrText = extractRenderableText(csrHtml);

  const ssrWords = countWords(ssrText);
  const csrWords = countWords(csrText);

  let textSurvivalRate = 100;
  let wordLossPercent = 0;

  if (csrWords > 0) {
    textSurvivalRate = Math.min(100, Math.max(0, Math.round((ssrWords / csrWords) * 100)));
    if (csrWords > ssrWords) {
      wordLossPercent = Math.min(100, Math.max(0, Math.round(((csrWords - ssrWords) / csrWords) * 100)));
    } else {
      wordLossPercent = 0;
    }
  }

  const ssrRawJsonLd = extractJsonLd(ssrHtml);
  const csrRawJsonLd = extractJsonLd(csrHtml);

  const ssrSchemaTypes = flattenSchemaTypes(ssrRawJsonLd);
  const csrSchemaTypes = flattenSchemaTypes(csrRawJsonLd);

  const ssrSchemaCount = ssrSchemaTypes.length;
  const csrSchemaCount = csrSchemaTypes.length;

  const ssrSchemaSet = new Set(ssrSchemaTypes);
  const csrOnlySchemaTypes = csrSchemaTypes.filter((type) => !ssrSchemaSet.has(type));

  let schemaSurvivalRate = 100;
  if (csrSchemaCount > 0) {
    schemaSurvivalRate = Math.min(100, Math.max(0, Math.round((ssrSchemaCount / csrSchemaCount) * 100)));
  }

  const jsTrapTriggered = Boolean(
    (csrWords >= 40 && wordLossPercent > 30) ||
    csrOnlySchemaTypes.length > 0 ||
    (csrSchemaCount > 0 && ssrSchemaCount === 0)
  );

  let overallSurvivalRate = textSurvivalRate;
  if (csrSchemaCount > 0) {
    overallSurvivalRate = Math.min(100, Math.max(0, Math.round(textSurvivalRate * 0.7 + schemaSurvivalRate * 0.3)));
  }

  return {
    ssrStatus,
    authenticatedFallback,
    ssrWords,
    csrWords,
    textSurvivalRate,
    wordLossPercent,
    ssrSchemaCount,
    csrSchemaCount,
    ssrSchemaTypes,
    csrSchemaTypes,
    csrOnlySchemaTypes,
    schemaSurvivalRate,
    jsTrapTriggered,
    overallSurvivalRate,
  };
}
