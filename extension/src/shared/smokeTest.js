/**
 * GeoScore Chrome Extension - AI Engine Smoke Test Generator
 *
 * Extracts brand and topic signals from page metadata and builds standardized
 * test prompts with direct deep links to ChatGPT, Perplexity, and Claude for manual verification.
 */

import { extractJsonLd } from '../../../src/lib/analyzers/eeat.js';
import { flattenSchemaTypes } from './ssrDiff.js';

export function extractBrandAndTopic(html = '', url = '') {
  let brand = '';
  let topic = '';

  // 1. Try JSON-LD Organization or WebSite name
  try {
    const jsonLdBlocks = extractJsonLd(html);
    function findOrgName(item) {
      if (!item || typeof item !== 'object') return null;
      if (Array.isArray(item)) {
        for (const it of item) {
          const res = findOrgName(it);
          if (res) return res;
        }
      }
      if (Array.isArray(item['@graph'])) {
        for (const it of item['@graph']) {
          const res = findOrgName(it);
          if (res) return res;
        }
      }
      const type = item['@type'];
      const matchesType = type === 'Organization' || type === 'WebSite' || type === 'SoftwareApplication';
      if (matchesType && item.name && typeof item.name === 'string') {
        return item.name.trim();
      }
      return null;
    }

    const orgName = findOrgName(jsonLdBlocks);
    if (orgName) brand = orgName;
  } catch {}

  // 2. Try og:site_name
  if (!brand) {
    const ogSiteMatch = html.match(/<meta[^>]+(?:property|name)=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:site_name["']/i);
    if (ogSiteMatch && ogSiteMatch[1]) {
      brand = ogSiteMatch[1].trim();
    }
  }

  // 3. Extract <title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

  if (!brand && rawTitle) {
    // Check for delimiter: "Title | Brand" or "Title - Brand" or "Brand: Title"
    if (rawTitle.includes('|')) {
      const parts = rawTitle.split('|').map((s) => s.trim()).filter(Boolean);
      brand = parts[parts.length - 1];
      topic = parts.slice(0, -1).join(' ');
    } else if (rawTitle.includes(' - ')) {
      const parts = rawTitle.split(' - ').map((s) => s.trim()).filter(Boolean);
      brand = parts[parts.length - 1];
      topic = parts.slice(0, -1).join(' ');
    } else if (rawTitle.includes(':')) {
      const parts = rawTitle.split(':').map((s) => s.trim()).filter(Boolean);
      brand = parts[0];
      topic = parts.slice(1).join(' ');
    }
  }

  // 4. Fallback brand from URL hostname if still empty
  if (!brand && url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./i, '');
      const parts = host.split('.');
      brand = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : host;
    } catch {}
  }

  // 5. Topic extraction: from <h1>, description, or remaining title
  if (!topic) {
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      topic = h1Match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  if (!topic) {
    const descMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i);
    if (descMatch && descMatch[1]) {
      topic = descMatch[1].trim();
    }
  }

  if (!topic && rawTitle) {
    topic = rawTitle;
  }

  if (!brand) brand = 'Product / Service';
  if (!topic) topic = brand;

  return { brand, topic };
}

export function buildSmokeTestData({ html = '', url = '', lang = 'en' } = {}) {
  const isZh = lang === 'zh_CN' || lang === 'zh';
  const { brand, topic } = extractBrandAndTopic(html, url);

  const prompts = isZh
    ? [
        {
          id: 'prompt-1',
          title: '品牌认知与核心定位',
          query: `${brand} 是什么？它的主要功能和解决的核心痛点是什么？`,
        },
        {
          id: 'prompt-2',
          title: '竞品对比与核心优势',
          query: `在 ${topic} 领域，${brand} 与其他竞品解决方案相比有哪些独特优势和核心特点？`,
        },
        {
          id: 'prompt-3',
          title: '商业定价与最新功能',
          query: `${brand} 的收费定价、核心功能与最新使用方式是什么？`,
        },
      ]
    : [
        {
          id: 'prompt-1',
          title: 'Brand Overview & Core Function',
          query: `What is ${brand} and what core problem does it solve for users?`,
        },
        {
          id: 'prompt-2',
          title: 'Competitive Differentiation',
          query: `How does ${brand} compare to alternatives in the ${topic} space? What are its key advantages?`,
        },
        {
          id: 'prompt-3',
          title: 'Features & Pricing Structure',
          query: `What are the key features, pricing, and latest updates of ${brand}?`,
        },
      ];

  const queriesWithLinks = prompts.map((p) => {
    const encoded = encodeURIComponent(p.query);
    return {
      ...p,
      targets: {
        chatgpt: `https://chatgpt.com/?q=${encoded}`,
        perplexity: `https://www.perplexity.ai/search?q=${encoded}`,
        claude: `https://claude.ai/new?q=${encoded}`,
      },
    };
  });

  return {
    brand,
    topic,
    disclaimer: isZh
      ? '辅助人工一键跳转 AI 引擎进行真实收录与答案验证，不伪造自动流量数据。'
      : 'Assists manual verification across AI search engines. Does not simulate synthetic live traffic.',
    prompts: queriesWithLinks,
  };
}
