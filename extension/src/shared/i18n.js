/**
 * GeoScore Chrome Extension - i18n & Localization
 */

export const DIMENSION_LABELS_EN = {
  aiCrawlability: 'AI Crawlability (Robots.txt)',
  aiGuidance: 'AI Guidance (llms.txt)',
  structuredData: 'Structured Data (Schema / JSON-LD)',
  metaSocial: 'Meta & Social Tags',
  contentQuality: 'Content Quality & Structure',
  eeat: 'E-E-A-T Signals',
  brandEntity: 'Brand & Entity',
  citationReadiness: 'Citation Readiness',
  discoveryEndpoints: 'Discovery Endpoints',
  agentFriendliness: 'Agent-Friendliness',
  freshness: 'Freshness & Timestamps',
};

export const DIMENSION_LABELS_ZH = {
  aiCrawlability: 'AI 爬虫抓取 (Robots.txt)',
  aiGuidance: 'AI 内容引导 (llms.txt)',
  structuredData: '结构化数据 (JSON-LD / Schema)',
  metaSocial: 'Meta 元数据与社交标签',
  contentQuality: '内容质量与结构',
  eeat: 'E-E-A-T 可信度信号',
  brandEntity: '品牌与实体权威性',
  citationReadiness: 'AI 引用就绪度',
  discoveryEndpoints: '发现端点 (Sitemap / ai.txt)',
  agentFriendliness: 'Agent 代理友好度',
  freshness: '内容时效性与更新频率',
};

export const LEVEL_LABELS_ZH = {
  Excellent: '优秀',
  Good: '良好',
  Basic: '基础',
  Critical: '急需优化',
};

export const LEVEL_LABELS_EN = {
  Excellent: 'Excellent',
  Good: 'Good',
  Basic: 'Basic',
  Critical: 'Critical',
};

const MESSAGES = {
  en: {
    extName: 'GeoScore: Free GEO, AEO & llms.txt Audit (AI SEO Checker)',
    extDescription: 'Audit any page or localhost across 11 GEO dimensions, detect JS rendering traps, highlight DOM issues, and generate llms.txt.',
    actionTitle: 'Audit GEO Readiness with GeoScore',
    auditRunning: 'Auditing page GEO readiness...',
    auditComplete: 'Audit completed in {ms}ms',
    totalScore: 'Total GEO Score',
    level: 'Readiness Level',
    jsTrapDetected: 'JavaScript Rendering Trap Detected!',
    jsTrapWarning: 'Content or schemas only exist after client-side JavaScript execution. AI crawlers that skip JS rendering will miss critical information.',
    soft404Detected: 'Soft 404 Detected on {endpoint}',
    soft404Warning: 'The server returned 200 OK for {endpoint}, but the response contains HTML / SPA shell rather than the expected format.',
    copyCursorPrompt: 'Copy Cursor / Copilot Remediation Prompt',
    exportReport: 'Export Markdown Audit Report',
    smokeTestTitle: 'AI Engine Real-Time Smoke Test',
    smokeTestDisclaimer: 'Assists manual verification across AI search engines. Does not simulate synthetic live traffic.',
    diffScoreUp: 'Score improved by +{delta}',
    diffScoreDown: 'Score dropped by -{delta}',
    diffScoreSame: 'Score unchanged',
    passedChecks: 'Passed Checks',
    failedChecks: 'Failed Checks',
    recommendations: 'Remediation Recommendations',
    standbyTitle: 'Ready to Audit',
    standbyDesc: 'Audit this page across 11 GEO dimensions, detect JS rendering traps, and generate AI-ready fix files.',
    standbyTarget: 'Current Page:',
    scanCurrent: 'Scan Current Page',
    noUrlAccess: 'URL not accessible without permission',
    lockedBanner: 'Locked: {host}',
    scanSwitched: 'Scan Tab ({host})',
    scanSwitchedGeneric: 'Scan Current Tab',
    xraySwitched: 'Switched to tab and highlighted {target}',
    xrayTabClosed: 'Target tab has been closed, unable to highlight',
    xrayNeedsPermission: 'Permission needed or page reloaded. Click toolbar icon to re-authorize.',
    ...DIMENSION_LABELS_EN,
  },
  zh_CN: {
    extName: 'GeoScore: 免费 GEO 审计与 llms.txt / AI 搜索优化检测工具',
    extDescription: '本地一键检测 11 维度 GEO 评分、SSR/CSR 渲染盲区、软 404，支持网页原位高亮与修复文件生成。',
    actionTitle: '使用 GeoScore 检测当前页面 GEO 就绪度',
    auditRunning: '正在检测页面 GEO 就绪度...',
    auditComplete: '检测完成，耗时 {ms}ms',
    totalScore: 'GEO 综合就绪度得分',
    level: '就绪评级',
    jsTrapDetected: '检测到 JavaScript 客户端渲染盲区陷阱！',
    jsTrapWarning: '页面关键正文或 Schema 仅在客户端 JS 执行后生成。非渲染型 AI 爬虫（如 GPTBot / Perplexity）抓取时将丢失核心信息。',
    soft404Detected: '在 {endpoint} 检测到软 404 伪响应',
    soft404Warning: '服务器对 {endpoint} 返回了 HTTP 200，但实际响应体为 HTML 兜底页面，缺少预期的纯文本或结构化数据。',
    copyCursorPrompt: '复制 Cursor / Copilot 一键修复 Prompt',
    exportReport: '导出 Markdown 审计报告',
    smokeTestTitle: 'AI 搜索引擎真机联调烟测',
    smokeTestDisclaimer: '辅助人工一键跳转 ChatGPT / Perplexity / Claude 验证收录，不伪造自动流量数据。',
    diffScoreUp: '得分提升 +{delta}',
    diffScoreDown: '得分下降 -{delta}',
    diffScoreSame: '得分持平',
    passedChecks: '已通过项',
    failedChecks: '待优化项',
    recommendations: '修复建议',
    standbyTitle: '准备开始审计',
    standbyDesc: '一键深度检测 11 维度 GEO 评分、SSR/CSR 渲染盲区，支持页面原位高亮与修复文件生成。',
    standbyTarget: '当前页面：',
    scanCurrent: '开始扫描当前页面',
    noUrlAccess: '未授权读取网址',
    lockedBanner: '当前锁定报告：{host}',
    scanSwitched: '扫描当前标签页 ({host})',
    scanSwitchedGeneric: '扫描当前标签页',
    xraySwitched: '已切回原标签页并高亮定位 {target}',
    xrayTabClosed: '原页面标签页已关闭，无法高亮',
    xrayNeedsPermission: '权限不足或页面已刷新，请点击工具栏图标重新授权',
    ...DIMENSION_LABELS_ZH,
  },
};

let currentLangPreference = 'auto';

export function detectBrowserLang() {
  try {
    if (typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getUILanguage === 'function') {
      const uiLang = chrome.i18n.getUILanguage() || '';
      if (uiLang.toLowerCase().startsWith('zh')) return 'zh_CN';
    }
  } catch {}

  try {
    if (typeof navigator !== 'undefined') {
      const navLang = navigator.language || (navigator.languages && navigator.languages[0]) || '';
      if (navLang.toLowerCase().startsWith('zh')) return 'zh_CN';
    }
  } catch {}

  return 'en';
}

export function getLangPreference() {
  return currentLangPreference;
}

export function setLangPreference(pref) {
  if (pref === 'zh' || pref === 'zh_CN' || pref === 'zh-CN') {
    currentLangPreference = 'zh_CN';
  } else if (pref === 'en') {
    currentLangPreference = 'en';
  } else {
    currentLangPreference = 'auto';
  }
  return currentLangPreference;
}

export function resolveLang(pref = currentLangPreference) {
  if (!pref || pref === 'auto') {
    return detectBrowserLang();
  }
  if (pref === 'zh' || pref === 'zh_CN' || pref === 'zh-CN') {
    return 'zh_CN';
  }
  return 'en';
}

export function createTranslator(lang = 'auto') {
  const resolved = resolveLang(lang);
  const dict = MESSAGES[resolved] || MESSAGES.en;

  return function t(key, params = {}) {
    let msg = dict[key] || MESSAGES.en[key] || key;
    if (params && typeof params === 'object') {
      for (const [k, v] of Object.entries(params)) {
        msg = msg.replaceAll(`{${k}}`, String(v));
      }
    }
    return msg;
  };
}
