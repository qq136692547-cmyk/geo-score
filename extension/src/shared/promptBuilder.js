/**
 * GeoScore Chrome Extension - Cursor / AI Agent Remediation Prompt Generator
 *
 * Formats full audit results, rendering trap warnings, soft 404 detections,
 * and fix files into actionable markdown instructions for Cursor, Claude, or Copilot.
 */

import { DIMENSION_LABELS_EN, DIMENSION_LABELS_ZH, LEVEL_LABELS_ZH, LEVEL_LABELS_EN } from './i18n.js';

export function buildCursorFixPrompt({
  result = {},
  ssrDiff = null,
  soft404Map = {},
  fixFiles = {},
  lang = 'en',
} = {}) {
  const isZh = lang === 'zh_CN' || lang === 'zh';
  const url = result.url || 'Target Website';
  const score = result.total ?? (result.score ?? 0);
  const level = result.level || (score >= 86 ? 'Excellent' : score >= 68 ? 'Good' : score >= 36 ? 'Basic' : 'Critical');
  const levelText = isZh ? (LEVEL_LABELS_ZH[level] || level) : (LEVEL_LABELS_EN[level] || level);

  const sections = [];

  // 1. Header & Executive Summary
  if (isZh) {
    sections.push(
      `# GeoScore GEO 智能体修复指令 (针对 ${url})\n\n` +
      `**当前评分**: ${score}/100 (${levelText})\n` +
      `**审计目标**: ${url}\n` +
      `**任务目标**: 修复以下检查不通过项，消除客户端渲染陷阱与软 404，提升 AI 搜索引擎（ChatGPT, Perplexity, Claude, Google SGE）的内容引用就绪度。`
    );
  } else {
    sections.push(
      `# GeoScore Remediation Prompt for ${url}\n\n` +
      `**Current Score**: ${score}/100 (${levelText})\n` +
      `**Target URL**: ${url}\n` +
      `**Goal**: Fix the failed audit checks below, eliminate JavaScript rendering traps and soft 404s, and maximize citation readiness for AI search engines (ChatGPT, Perplexity, Claude, Gemini).`
    );
  }

  // 2. SSR/CSR Rendering Trap Alert
  if (ssrDiff && ssrDiff.jsTrapTriggered) {
    if (isZh) {
      sections.push(
        `## 🚨 致命告警：检测到客户端渲染盲区 (JS Rendering Trap)\n\n` +
        `- **正文文字丢失率**: ${ssrDiff.wordLossPercent}% (SSR 仅含 ${ssrDiff.ssrWords} 词，CSR 页面含 ${ssrDiff.csrWords} 词)\n` +
        (ssrDiff.csrOnlySchemaTypes && ssrDiff.csrOnlySchemaTypes.length > 0
          ? `- **仅在 CSR 存在的结构化数据**: ${ssrDiff.csrOnlySchemaTypes.join(', ')}\n`
          : '') +
        `- **风险说明**: 不少 AI 爬虫抓取器在默认抓取模式下不执行重度客户端 JavaScript。当关键内容依赖 CSR 时，抓取器只能看到空白或骨架壳。\n` +
        `- **修复方案**: 将核心正文内容与 JSON-LD 结构化数据移至服务端初始 HTML (SSR / SSG / Pre-rendering) 中直出输出。`
      );
    } else {
      sections.push(
        `## 🚨 CRITICAL: JavaScript Client-Side Rendering Trap Detected\n\n` +
        `- **Content Loss**: ${ssrDiff.wordLossPercent}% word loss (SSR rendered ${ssrDiff.ssrWords} words, CSR rendered ${ssrDiff.csrWords} words)\n` +
        (ssrDiff.csrOnlySchemaTypes && ssrDiff.csrOnlySchemaTypes.length > 0
          ? `- **CSR-Only Schema Types**: ${ssrDiff.csrOnlySchemaTypes.join(', ')}\n`
          : '') +
        `- **Risk**: Fast AI crawlers often fetch pages without running full JavaScript evaluation. Relying on CSR means AI engines index empty SPA shells.\n` +
        `- **Remediation**: Render the primary body text and Schema markup in the initial server HTML response (SSR/SSG).`
      );
    }
  }

  // 3. Soft 404 Endpoint Detections
  const soft404Endpoints = Object.entries(soft404Map || {})
    .filter(([_, item]) => item && item.isSoft404);

  if (soft404Endpoints.length > 0) {
    const list = soft404Endpoints
      .map(([ep, item]) => `- \`${ep}\` (${item.url || ep}): ${item.reason || 'Returned HTTP 200 with HTML SPA shell'}`)
      .join('\n');

    if (isZh) {
      sections.push(
        `## ⚠️ 软 404 端点伪响应告警 (Soft 404 Warnings)\n\n` +
        `以下端点返回了 HTTP 200，但实际内容为 HTML / SPA 单页壳工程，导致 AI 爬虫无法正确解析：\n` +
        list + '\n\n' +
        `**修复方案**: 在反向代理（如 Nginx, Caddy, Cloudflare, Netlify, Vercel）中为上述静态端点配置独立路由或正确返回 HTTP 404，禁止通配重定向至 \`index.html\`。`
      );
    } else {
      sections.push(
        `## ⚠️ Soft 404 Endpoint Warnings\n\n` +
        `The server returned HTTP 200 with HTML/SPA body instead of proper text/json/xml for the following endpoints:\n` +
        list + '\n\n' +
        `**Remediation**: Adjust your web server / CDN rewrite rules so static discovery files are served with proper MIME types, or return HTTP 404 instead of falling back to \`index.html\`.`
      );
    }
  }

  // 4. Failed Checks sorted by weight descending
  const failedChecks = [];
  const dimensions = result.dimensions || {};
  const dimLabels = isZh ? DIMENSION_LABELS_ZH : DIMENSION_LABELS_EN;

  for (const [dimKey, dim] of Object.entries(dimensions)) {
    if (!dim || !Array.isArray(dim.checks)) continue;
    for (const check of dim.checks) {
      if (!check.passed) {
        failedChecks.push({
          dimKey,
          dimLabel: dimLabels[dimKey] || dimKey,
          id: check.id,
          label: check.label,
          weight: check.weight || 1,
        });
      }
    }
  }

  // Sort by weight descending
  failedChecks.sort((a, b) => b.weight - a.weight);

  if (failedChecks.length > 0) {
    if (isZh) {
      sections.push(
        `## 🛠️ 待优化与修复项清单 (按权重由高到低排序)\n\n` +
        failedChecks.map((c, i) => `${i + 1}. **[权重 ${c.weight}]** \`${c.id}\` (${c.dimLabel}): ${c.label}`).join('\n')
      );
    } else {
      sections.push(
        `## 🛠️ Prioritized Action Items (Sorted by Weight Descending)\n\n` +
        failedChecks.map((c, i) => `${i + 1}. **[Weight ${c.weight}]** \`${c.id}\` (${c.dimLabel}): ${c.label}`).join('\n')
      );
    }
  }

  // 5. Negative Signals & Prompt Injection Alerts
  const deductions = result.negativeSignals?.deductions || result.negative?.deductions || [];
  const piFlags = result.promptInjection?.flags || [];

  if (deductions.length > 0 || piFlags.length > 0) {
    const alerts = [];
    for (const d of deductions) {
      alerts.push(`- Deducted ${d.deduction} pts: ${d.label || d.id || 'Negative SEO signal'}`);
    }
    for (const pi of piFlags) {
      alerts.push(`- [Severity: ${pi.severity || 'high'}] Prompt Injection Risk: ${pi.label || pi.details}`);
    }

    if (isZh) {
      sections.push(`## ⚠️ 负向惩罚与安全警报\n\n` + alerts.join('\n'));
    } else {
      sections.push(`## ⚠️ Negative Signals & Security Flags\n\n` + alerts.join('\n'));
    }
  }

  // 6. Remediation Artifacts (Fix Files)
  const artifacts = [];
  const getFixText = (entry) => (typeof entry === 'string' ? entry : entry?.content || '');
  const llmsContent = getFixText(fixFiles.llmsTxt);
  const robotsContent = getFixText(fixFiles.robotsTxt);
  const jsonLdRaw = typeof fixFiles.jsonLd === 'string'
    ? fixFiles.jsonLd
    : (fixFiles.jsonLd && typeof fixFiles.jsonLd.content === 'string')
      ? fixFiles.jsonLd.content
      : (fixFiles.jsonLd ? JSON.stringify(fixFiles.jsonLd, null, 2) : '');

  if (llmsContent) {
    artifacts.push(
      `### 1. \`llms.txt\`\n\n` +
      `Place at \`/llms.txt\` on your website root:\n\n` +
      '```markdown\n' +
      llmsContent.trim() +
      '\n```'
    );
  }

  if (robotsContent) {
    const note = isZh
      ? `> **诊断提示 (遵循 RFC 9309)**: 以下规则为针对主流 AI 抓取器（GPTBot, PerplexityBot, ClaudeBot 等）的推荐配置，请审慎与现有规则合并，不强制覆盖您已有的人工屏蔽策略。\n\n`
      : `> **Diagnostic Recommendation (RFC 9309 Compliant)**: Recommended directives for AI user-agents (GPTBot, PerplexityBot, ClaudeBot). Merge carefully without overriding intentional access policies.\n\n`;

    artifacts.push(
      `### 2. \`robots.txt\`\n\n` +
      note +
      '```txt\n' +
      robotsContent.trim() +
      '\n```'
    );
  }

  if (jsonLdRaw) {
    const jsonSnippet = /<script\b/i.test(jsonLdRaw)
      ? jsonLdRaw.trim()
      : `<script type="application/ld+json">\n${jsonLdRaw.trim()}\n</script>`;

    artifacts.push(
      `### 3. \`JSON-LD Structured Data\`\n\n` +
      `Inject inside the \`<head>\` tag of your page HTML:\n\n` +
      '```html\n' +
      jsonSnippet +
      '\n```'
    );
  }

  if (artifacts.length > 0) {
    if (isZh) {
      sections.push(`## 📦 自动生成的修复配置文件\n\n` + artifacts.join('\n\n'));
    } else {
      sections.push(`## 📦 Generated Remediation Files\n\n` + artifacts.join('\n\n'));
    }
  }

  return sections.join('\n\n');
}
