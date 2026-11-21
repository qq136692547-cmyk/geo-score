/**
 * GeoScore Chrome Extension - Side Panel Controller
 *
 * Implements full bilingual rendering, reactive state management,
 * CSP-compliant event delegation, and seamless communication with the background worker.
 */

import {
  createTranslator,
  detectBrowserLang,
  resolveLang,
  setLangPreference,
  getLangPreference,
  DIMENSION_LABELS_EN,
  DIMENSION_LABELS_ZH,
  LEVEL_LABELS_EN,
  LEVEL_LABELS_ZH,
} from '../shared/i18n.js';
import { buildCursorFixPrompt } from '../shared/promptBuilder.js';
import { buildSmokeTestData } from '../shared/smokeTest.js';
import { detectTechStack, getStackGuidance } from '../shared/stackDetector.js';
import { getSettings, saveSettings, clearAuditHistory, computeAuditDiff } from '../shared/storage.js';
import { exportMarkdown, exportJson } from '../../../src/lib/export.js';
import { parseBadgeDomain, renderBadgeSvg, buildBadgeEmbedSnippets } from '../../../src/lib/badgeSvg.js';

// --- State Variables ---
let currentTabId = null;
let currentTabUrl = '';
let currentTabOrigin = '';
let currentAuditState = null;
let lockedReportState = null;
let activeTabInfo = { tabId: null, url: '', title: '', restricted: false, hasUrlAccess: false };
let currentLang = 'en';
let activeFixTab = 'llms';
let activeXRayTarget = null;

function getHostname(urlStr) {
  if (!urlStr) return '';
  try {
    const u = new URL(urlStr);
    return u.hostname;
  } catch {
    return urlStr;
  }
}

function normalizeUrl(urlStr) {
  if (!urlStr) return '';
  return urlStr.replace(/#.*$/, '').replace(/\/$/, '').toLowerCase();
}

// Safe HTML Escape
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Toast notification helper
function showToast(message, icon = '✓') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  const iconEl = document.getElementById('toast-icon');
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  if (iconEl) iconEl.textContent = icon;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// Download helper via Blob & object URL
function downloadFile(filename, content, mimeType = 'text/plain') {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(currentLang === 'zh_CN' ? `已下载 ${filename}` : `Downloaded ${filename}`);
  } catch (err) {
    showToast(currentLang === 'zh_CN' ? '下载失败' : 'Download failed', '⚠️');
  }
}

// Copy to clipboard helper
async function copyToClipboard(text, successMsgEn, successMsgZh) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(currentLang === 'zh_CN' ? successMsgZh : successMsgEn);
  } catch (err) {
    showToast(currentLang === 'zh_CN' ? '复制失败' : 'Copy failed', '⚠️');
  }
}

// Switch main view state
function showViewState(stateName) {
  const states = ['view-standby', 'view-scanning', 'view-restricted', 'view-needs-permission', 'view-error', 'view-report'];
  for (const s of states) {
    const el = document.getElementById(s);
    if (el) {
      if (s === `view-${stateName}`) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    }
  }

  // Update URL Bar status dot
  const dot = document.getElementById('status-dot');
  if (dot) {
    dot.className = 'status-dot';
    if (stateName === 'scanning') dot.classList.add('scanning');
    else if (stateName === 'report') dot.classList.add('active');
    else if (stateName === 'error') dot.classList.add('error');
    else if (stateName === 'standby') dot.classList.add('standby');
  }
}

function updateStandbyCard() {
  const targetUrlEl = document.getElementById('standby-target-url');
  if (!targetUrlEl) return;
  const isZh = currentLang === 'zh_CN';
  if (activeTabInfo.url) {
    targetUrlEl.textContent = activeTabInfo.url;
    targetUrlEl.title = activeTabInfo.url;
  } else if (activeTabInfo.title) {
    targetUrlEl.textContent = activeTabInfo.title;
    targetUrlEl.title = activeTabInfo.title;
  } else {
    targetUrlEl.textContent = isZh ? '未授权读取网址（点击下方按钮直接扫描）' : 'URL not accessible without permission';
    targetUrlEl.title = '';
  }
}

function updateLockedTabBanner() {
  const banner = document.getElementById('locked-tab-banner');
  const bannerText = document.getElementById('locked-tab-text');
  const scanSwitchedBtnLabel = document.getElementById('label-scan-switched');
  if (!banner) return;

  const isZh = currentLang === 'zh_CN';

  // Only display when lockedReportState?.status === 'ready'
  if (!lockedReportState || lockedReportState.status !== 'ready') {
    banner.style.display = 'none';
    return;
  }

  // If current active tab is restricted, don't show the banner
  if (activeTabInfo.restricted) {
    banner.style.display = 'none';
    return;
  }

  // Check if active tab differs from locked report
  const isDifferentTab = activeTabInfo.tabId && activeTabInfo.tabId !== lockedReportState.tabId;
  const isDifferentUrl = Boolean(
    activeTabInfo.url &&
    lockedReportState.url &&
    normalizeUrl(activeTabInfo.url) !== normalizeUrl(lockedReportState.url)
  );

  if (isDifferentTab || isDifferentUrl) {
    banner.style.display = 'flex';

    const lockedHost = getHostname(lockedReportState.url) || lockedReportState.title || `Tab #${lockedReportState.tabId}`;
    const activeHost = getHostname(activeTabInfo.url);

    if (bannerText) {
      bannerText.textContent = isZh ? `📌 当前锁定报告：${lockedHost}` : `📌 Locked: ${lockedHost}`;
      bannerText.title = lockedReportState.url || lockedHost;
    }

    if (scanSwitchedBtnLabel) {
      if (activeHost) {
        scanSwitchedBtnLabel.textContent = isZh ? `🎯 扫描当前标签页 (${activeHost})` : `🎯 Scan Tab (${activeHost})`;
      } else {
        scanSwitchedBtnLabel.textContent = isZh ? '🎯 扫描当前标签页' : '🎯 Scan Current Tab';
      }
    }
  } else {
    banner.style.display = 'none';
  }
}

// --- Main State Rendering ---
export function renderAuditState(state) {
  currentAuditState = state;
  const isZh = currentLang === 'zh_CN';
  const t = createTranslator(currentLang);

  if (!state) {
    showViewState('standby');
    updateStandbyCard();
    updateLockedTabBanner();
    return;
  }

  if (state.status === 'ready') {
    lockedReportState = state;
  }

  // Update URL Bar
  const urlText = document.getElementById('url-text');
  if (urlText) {
    const displayUrl = (lockedReportState && lockedReportState.status === 'ready' ? lockedReportState.url : (state.url || activeTabInfo.url || currentTabUrl)) || 'about:blank';
    urlText.textContent = displayUrl;
    urlText.title = displayUrl;
    try {
      const u = new URL(displayUrl);
      currentTabOrigin = u.origin;
    } catch {}
  }

  // Handle Different Statuses
  if (state.status === 'standby') {
    lockedReportState = null;
    showViewState('standby');
    updateStandbyCard();
    updateLockedTabBanner();
    return;
  }

  if (state.status === 'scanning') {
    showViewState('scanning');
    const scanText = document.getElementById('scanning-status-text');
    if (scanText) {
      scanText.textContent = isZh
        ? '正在跨 11 维度审计页面 GEO 就绪度...'
        : 'Auditing page GEO readiness across 11 dimensions...';
    }
    updateLockedTabBanner();
    return;
  }

  if (state.status === 'restricted') {
    showViewState('restricted');
    updateLockedTabBanner();
    return;
  }

  if (state.status === 'needs_permission') {
    showViewState('needs_permission');
    const grantBtn = document.getElementById('btn-grant-permission');
    if (grantBtn) {
      if (currentTabOrigin && !currentTabOrigin.startsWith('chrome') && !currentTabOrigin.startsWith('about')) {
        grantBtn.style.display = 'inline-flex';
        grantBtn.textContent = isZh
          ? `授权 ${currentTabOrigin} 并重扫`
          : `Grant access for ${currentTabOrigin} & Rescan`;
      } else {
        grantBtn.style.display = 'none';
      }
    }
    updateLockedTabBanner();
    return;
  }

  if (state.status === 'error') {
    showViewState('error');
    const errText = document.getElementById('error-message-text');
    if (errText) {
      errText.textContent = state.error || (isZh ? '审计时发生未知错误' : 'Unknown error during audit');
    }
    updateLockedTabBanner();
    return;
  }

  // Status === 'ready'
  showViewState('report');
  updateLockedTabBanner();
  const data = state.data || {};
  const result = data.result || {};
  const ssrDiff = data.ssrDiff || {};
  const soft404Map = data.soft404Map || {};
  const authenticatedFallback = data.authenticatedFallback || false;
  const diff = data.diff || null;
  const smokeTestData = data.smokeTest || null;
  const fixFiles = data.fixFiles || {};

  // 1. Authenticated Staging Banner
  const stagingBadge = document.getElementById('staging-badge');
  const bannerAuth = document.getElementById('banner-auth');
  const bannerAuthText = document.getElementById('banner-auth-text');
  if (authenticatedFallback) {
    if (stagingBadge) stagingBadge.style.display = 'inline-block';
    if (bannerAuth) {
      bannerAuth.style.display = 'flex';
      bannerAuthText.textContent = isZh
        ? '已启用认证测试环境模式（使用当前浏览器会话 Cookie 完成 SSR 与 DOM 双轨审计）'
        : 'Authenticated Staging Mode: Audited with current session cookies for SSR vs DOM.';
    }
  } else {
    if (stagingBadge) stagingBadge.style.display = 'none';
    if (bannerAuth) bannerAuth.style.display = 'none';
  }

  // 2. JS Trap Alert Banner
  const bannerJsTrap = document.getElementById('banner-jstrap');
  const bannerJsTrapText = document.getElementById('banner-jstrap-text');
  if (ssrDiff && ssrDiff.jsTrapTriggered) {
    if (bannerJsTrap) bannerJsTrap.style.display = 'flex';
    if (bannerJsTrapText) {
      bannerJsTrapText.innerHTML = isZh
        ? `<strong>⚠️ 客户端 JS 渲染盲区：</strong> 页面关键正文丢失率高达 ${ssrDiff.wordLossPercent}%，或 Schema 仅在客户端 JS 执行后存在。非渲染型 AI 爬虫无法索引！`
        : `<strong>⚠️ JS Rendering Trap:</strong> High content loss (${ssrDiff.wordLossPercent}%) or schemas only exist in client DOM. Non-rendering AI crawlers will miss it!`;
    }
  } else {
    if (bannerJsTrap) bannerJsTrap.style.display = 'none';
  }

  // 3. Soft 404 Alert Banner
  const bannerSoft404 = document.getElementById('banner-soft404');
  const bannerSoft404Text = document.getElementById('banner-soft404-text');
  const soft404Entries = Object.entries(soft404Map).filter(([_, item]) => item && item.isSoft404);
  if (soft404Entries.length > 0) {
    if (bannerSoft404) bannerSoft404.style.display = 'flex';
    if (bannerSoft404Text) {
      const endpoints = soft404Entries.map(([ep]) => ep).join(', ');
      bannerSoft404Text.innerHTML = isZh
        ? `<strong>软 404 伪响应告警：</strong> 端点 ${endpoints} 返回了 HTTP 200，但实际响应体为 HTML 兜底页面。`
        : `<strong>Soft 404 Detected:</strong> Endpoints (${endpoints}) returned HTTP 200 with HTML SPA shells.`;
    }
  } else {
    if (bannerSoft404) bannerSoft404.style.display = 'none';
  }

  // 4. Score Circle Gauge & Level Badge
  const scoreVal = result.total ?? (result.score ?? 0);
  const scoreEl = document.getElementById('score-value');
  if (scoreEl) scoreEl.textContent = scoreVal;

  const gaugeProgress = document.getElementById('gauge-progress');
  if (gaugeProgress) {
    const radius = 58;
    const circumference = 2 * Math.PI * radius; // ~364.4
    const offset = circumference - (scoreVal / 100) * circumference;
    gaugeProgress.style.strokeDashoffset = String(offset);

    let strokeColor = '#22c55e';
    if (scoreVal < 36) strokeColor = '#ef4444';
    else if (scoreVal < 68) strokeColor = '#eab308';
    else if (scoreVal < 86) strokeColor = '#3b82f6';
    gaugeProgress.setAttribute('stroke', strokeColor);
  }

  const levelBadge = document.getElementById('level-badge');
  if (levelBadge) {
    const level = result.level || (scoreVal >= 86 ? 'Excellent' : scoreVal >= 68 ? 'Good' : scoreVal >= 36 ? 'Basic' : 'Critical');
    const levelLabel = isZh ? (LEVEL_LABELS_ZH[level] || level) : (LEVEL_LABELS_EN[level] || level);
    levelBadge.textContent = levelLabel;

    let badgeBg = '#22c55e';
    if (level === 'Critical' || scoreVal < 36) badgeBg = '#ef4444';
    else if (level === 'Basic' || scoreVal < 68) badgeBg = '#eab308';
    else if (level === 'Good' || scoreVal < 86) badgeBg = '#3b82f6';
    levelBadge.style.background = badgeBg;
  }

  // 5. Diff Badge & Details Drawer
  const diffBadge = document.getElementById('diff-badge');
  const diffDrawer = document.getElementById('diff-drawer');
  const diffList = document.getElementById('diff-list');
  if (diff && typeof diff.delta === 'number') {
    if (diffBadge) {
      diffBadge.style.display = 'inline-block';
      const sign = diff.delta > 0 ? `+${diff.delta}` : `${diff.delta}`;
      const emoji = diff.delta > 0 ? '🎉' : diff.delta < 0 ? '📉' : (isZh ? '持平' : 'No change');
      diffBadge.textContent = `${diff.previousScore} ➔ ${diff.currentScore} (${sign} pts) ${emoji}`;
    }

    if (diffList) {
      diffList.innerHTML = '';
      if (diff.newlyPassedChecks && diff.newlyPassedChecks.length > 0) {
        for (const check of diff.newlyPassedChecks) {
          const li = document.createElement('li');
          li.className = 'diff-item';
          li.innerHTML = `<span>✓</span> <span>${escapeHtml(check.label || check.id)} (+${check.weight || 1} pts)</span>`;
          diffList.appendChild(li);
        }
      } else {
        const li = document.createElement('li');
        li.style.color = '#94a3b8';
        li.textContent = isZh ? '与上一次快照相比无新通过项' : 'No newly fixed checks since last audit';
        diffList.appendChild(li);
      }
    }
  } else {
    if (diffBadge) diffBadge.style.display = 'none';
    if (diffDrawer) diffDrawer.style.display = 'none';
  }

  // 6. Quick Stats
  let totalPassed = 0;
  let totalChecksCount = 0;
  const dimensions = result.dimensions || {};
  for (const dim of Object.values(dimensions)) {
    if (dim && Array.isArray(dim.checks)) {
      totalChecksCount += dim.checks.length;
      totalPassed += dim.checks.filter((c) => c.passed).length;
    }
  }
  const statChecks = document.getElementById('stat-checks');
  if (statChecks) statChecks.textContent = `${totalPassed} / ${totalChecksCount || 85}`;

  const statSurvival = document.getElementById('stat-survival');
  if (statSurvival) {
    const survivalRate = ssrDiff.overallSurvivalRate ?? 100;
    statSurvival.textContent = `${survivalRate}%`;
    statSurvival.style.color = survivalRate >= 85 ? '#4ade80' : survivalRate >= 60 ? '#facc15' : '#f87171';
  }

  const statDuration = document.getElementById('stat-duration');
  if (statDuration) {
    statDuration.textContent = `${data.durationMs || 120}ms`;
  }

  // 7. SSR vs CSR Dual-Track Card
  const statSsrWords = document.getElementById('stat-ssr-words');
  const statCsrWords = document.getElementById('stat-csr-words');
  const statSsrSchemas = document.getElementById('stat-ssr-schemas');
  const statCsrSchemas = document.getElementById('stat-csr-schemas');
  const survivalRateBadge = document.getElementById('survival-rate-badge');
  const jsTrapAlert = document.getElementById('js-trap-alert');
  const jsTrapDetail = document.getElementById('js-trap-detail');

  if (statSsrWords) statSsrWords.textContent = ssrDiff.ssrWords ?? 0;
  if (statCsrWords) statCsrWords.textContent = ssrDiff.csrWords ?? 0;
  if (statSsrSchemas) statSsrSchemas.textContent = ssrDiff.ssrSchemaCount ?? 0;
  if (statCsrSchemas) statCsrSchemas.textContent = ssrDiff.csrSchemaCount ?? 0;

  if (survivalRateBadge) {
    const overallRate = ssrDiff.overallSurvivalRate ?? 100;
    survivalRateBadge.textContent = isZh ? `${overallRate}% AI 可见度` : `${overallRate}% AI Visibility`;
    if (overallRate < 60) {
      survivalRateBadge.style.background = 'rgba(239, 68, 68, 0.15)';
      survivalRateBadge.style.color = '#f87171';
    } else if (overallRate < 85) {
      survivalRateBadge.style.background = 'rgba(234, 179, 8, 0.15)';
      survivalRateBadge.style.color = '#facc15';
    } else {
      survivalRateBadge.style.background = 'rgba(34, 197, 94, 0.15)';
      survivalRateBadge.style.color = '#4ade80';
    }
  }

  if (jsTrapAlert && jsTrapDetail) {
    if (ssrDiff.jsTrapTriggered) {
      jsTrapAlert.style.display = 'block';
      let missingInfo = '';
      if (ssrDiff.csrOnlySchemaTypes && ssrDiff.csrOnlySchemaTypes.length > 0) {
        missingInfo = isZh
          ? `仅在客户端存在的结构化数据: <code>${escapeHtml(ssrDiff.csrOnlySchemaTypes.join(', '))}</code>。`
          : `CSR-only Schema types: <code>${escapeHtml(ssrDiff.csrOnlySchemaTypes.join(', '))}</code>.`;
      }
      jsTrapDetail.innerHTML = isZh
        ? `⚠️ <strong>检测到 JS 客户端渲染盲区陷阱：</strong> 页面正文有 ${ssrDiff.wordLossPercent}% 未在初始 HTML 直出输出。${missingInfo}建议将核心文本与 JSON-LD 移至服务端直出！`
        : `⚠️ <strong>JS Client-Side Trap Detected:</strong> ${ssrDiff.wordLossPercent}% of text is missing from raw server HTML. ${missingInfo}Render primary content and Schema on server!`;
    } else {
      jsTrapAlert.style.display = 'none';
    }
  }

  // 8. Soft 404 Warnings List
  const soft404Card = document.getElementById('soft404-card');
  const soft404List = document.getElementById('soft404-list');
  if (soft404Card && soft404List) {
    if (soft404Entries.length > 0) {
      soft404Card.style.display = 'flex';
      soft404List.innerHTML = '';
      for (const [ep, item] of soft404Entries) {
        const div = document.createElement('div');
        div.style.padding = '6px 8px';
        div.style.background = 'rgba(234, 179, 8, 0.1)';
        div.style.border = '1px solid rgba(234, 179, 8, 0.25)';
        div.style.borderRadius = '6px';
        div.innerHTML = `<strong>${escapeHtml(ep)}</strong>: ${escapeHtml(item.reason || (isZh ? '服务器对静态端点返回了 HTML 兜底页面（软 404）' : 'Returned HTTP 200 with HTML shell'))}`;
        soft404List.appendChild(div);
      }
    } else {
      soft404Card.style.display = 'none';
    }
  }

  // 9. 11 Dimensions Accordion
  renderDimensionsList(result);

  // 10. Remediation Fix Files
  renderFixFiles(fixFiles, result);

  // 11. AI Smoke Test Launcher
  renderSmokeTest(smokeTestData, result);

  // 12. Live SVG Badge Embed Card
  renderLiveBadgeCard(result);

  // 13. Dynamic Funnel Links with URL params & score-based pinning
  updateFunnelLinks(result.url || currentTabUrl, scoreVal);
}

// Render Dimensions List & Checks
function renderDimensionsList(result) {
  const container = document.getElementById('dimensions-container');
  if (!container) return;
  container.innerHTML = '';

  const isZh = currentLang === 'zh_CN';
  const dimLabels = isZh ? DIMENSION_LABELS_ZH : DIMENSION_LABELS_EN;
  const dimensions = result.dimensions || {};

  const locatableCheckIds = new Set([
    'h1', 'headings', 'images-alt', 'question-headings',
    'passage-density', 'lists', 'data-tables', 'blockquote-count',
    'cite-tags', 'faq-schema', 'excessive-cta', 'popups',
    'broken-links', 'hidden-text', 'system-instructions',
    'ignore-instructions', 'mixed-signals'
  ]);

  for (const [dimKey, dim] of Object.entries(dimensions)) {
    if (!dim) continue;
    const dimScore = dim.score ?? 0;
    const dimMax = dim.maxScore ?? 10;
    const pct = dim.percentage ?? Math.round((dimScore / (dimMax || 1)) * 100);
    const checks = Array.isArray(dim.checks) ? dim.checks : [];
    const hasDeductions = dimScore < dimMax;

    const dimItem = document.createElement('div');
    dimItem.className = `dim-item ${hasDeductions ? 'expanded' : ''}`;
    dimItem.id = `dim-${dimKey}`;

    let progressColor = '#22c55e';
    if (pct < 40) progressColor = '#ef4444';
    else if (pct < 75) progressColor = '#eab308';
    else if (pct < 95) progressColor = '#3b82f6';

    const dimTitle = dimLabels[dimKey] || dim.label || dimKey;

    // Header
    const header = document.createElement('div');
    header.className = 'dim-header';
    header.innerHTML = `
      <div class="dim-title-group">
        <span class="dim-chevron">▶</span>
        <span class="dim-name" title="${escapeHtml(dimTitle)}">${escapeHtml(dimTitle)}</span>
      </div>
      <div class="dim-score-group">
        <div class="dim-progress-track">
          <div class="dim-progress-fill" style="width: ${pct}%; background: ${progressColor};"></div>
        </div>
        <span class="dim-score-text">${dimScore}/${dimMax}</span>
      </div>
    `;

    // Toggle expand/collapse
    header.addEventListener('click', () => {
      dimItem.classList.toggle('expanded');
    });

    // Body
    const body = document.createElement('div');
    body.className = 'dim-body';

    for (const check of checks) {
      const checkRow = document.createElement('div');
      checkRow.className = 'check-row';

      const isPassed = Boolean(check.passed);
      const isLocatable = !isPassed && (locatableCheckIds.has(check.id) || check.locatable);

      const statusIcon = isPassed
        ? '<span style="color: #22c55e; font-weight: bold;">✓</span>'
        : '<span style="color: #ef4444; font-weight: bold;">✕</span>';

      const checkLabelText = escapeHtml(check.label || check.id);
      const checkWeight = check.weight ? `<span class="check-weight">(${check.weight} pts)</span>` : '';

      let xrayBtnHtml = '';
      if (isLocatable) {
        xrayBtnHtml = `<button class="btn-xray" data-target-id="${escapeHtml(check.id)}">🔍 ${isZh ? '页面定位' : 'Highlight'}</button>`;
      }

      checkRow.innerHTML = `
        <div class="check-info">
          <span class="check-status-icon">${statusIcon}</span>
          <span class="check-label">${checkLabelText} ${checkWeight}</span>
        </div>
        ${xrayBtnHtml}
      `;

      // Attach X-Ray click listener
      if (isLocatable) {
        const btn = checkRow.querySelector('.btn-xray');
        if (btn) {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            triggerXRayHighlight(check.id, check.label || check.id, dimKey);
          });
        }
      }

      body.appendChild(checkRow);
    }

    dimItem.appendChild(header);
    dimItem.appendChild(body);
    container.appendChild(dimItem);
  }

  // Negative Signals / Prompt Injection section (if any deductions)
  if (result.negativeSignals && Array.isArray(result.negativeSignals.deductions) && result.negativeSignals.deductions.length > 0) {
    const negItem = document.createElement('div');
    negItem.className = 'dim-item expanded';
    negItem.innerHTML = `
      <div class="dim-header" style="background: rgba(239, 68, 68, 0.1);">
        <div class="dim-title-group">
          <span class="dim-chevron">▶</span>
          <span class="dim-name" style="color: #f87171;">⚠️ ${isZh ? '负向信号与隐藏违规扣分' : 'Negative Signals & Violations'}</span>
        </div>
        <span class="dim-score-text" style="color: #f87171;">-${result.negativeSignals.score ?? result.negativeSignals.totalDeduction ?? 0} pts</span>
      </div>
      <div class="dim-body">
        ${result.negativeSignals.deductions.map((d) => `
          <div class="check-row">
            <div class="check-info">
              <span class="check-status-icon" style="color: #ef4444;">✕</span>
              <span class="check-label" style="color: #fca5a5;">${escapeHtml(d.label || d.id)} (-${d.deduction} pts)</span>
            </div>
            <button class="btn-xray" data-target-id="${escapeHtml(d.id || 'negative-signals')}" data-target-label="${escapeHtml(d.label || d.id || 'Negative Signal')}">🔍 ${isZh ? '页面定位' : 'Highlight'}</button>
          </div>
        `).join('')}
      </div>
    `;

    // Attach listeners
    negItem.querySelectorAll('.btn-xray').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerXRayHighlight(btn.dataset.targetId, btn.dataset.targetLabel || 'Negative Signal', 'negativeSignals');
      });
    });

    container.appendChild(negItem);
  }

  // Prompt Injection Security Flags section (if any flags)
  if (result.promptInjection && Array.isArray(result.promptInjection.flags) && result.promptInjection.flags.length > 0) {
    const piWeights = { critical: 4, high: 3, medium: 2, low: 1 };
    const piTotal = result.promptInjection.flags.reduce((sum, f) => sum + (piWeights[f.severity] || 1), 0);
    const piItem = document.createElement('div');
    piItem.className = 'dim-item expanded';
    piItem.innerHTML = `
      <div class="dim-header" style="background: rgba(239, 68, 68, 0.14);">
        <div class="dim-title-group">
          <span class="dim-chevron">▶</span>
          <span class="dim-name" style="color: #f87171;">🛡️ ${isZh ? 'Prompt 注入安全警报' : 'Prompt Injection Security Alerts'}</span>
        </div>
        <span class="dim-score-text" style="color: #f87171;">-${piTotal} pts</span>
      </div>
      <div class="dim-body">
        ${result.promptInjection.flags.map((f) => {
          const pts = piWeights[f.severity] || 1;
          const canHighlight = ['hidden-text', 'system-instructions', 'ignore-instructions'].includes(f.id);
          return `
            <div class="check-row">
              <div class="check-info">
                <span class="check-status-icon" style="color: #ef4444;">✕</span>
                <span class="check-label" style="color: #fca5a5;">[${escapeHtml(String(f.severity || 'high').toUpperCase())}] ${escapeHtml(f.label || f.id)} (-${pts} pts)</span>
              </div>
              ${canHighlight ? `<button class="btn-xray" data-target-id="${escapeHtml(f.id)}" data-target-label="${escapeHtml(f.label || f.id)}">🔍 ${isZh ? '页面定位' : 'Highlight'}</button>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;

    const piHeader = piItem.querySelector('.dim-header');
    if (piHeader) {
      piHeader.addEventListener('click', () => {
        piItem.classList.toggle('expanded');
      });
    }
    piItem.querySelectorAll('.btn-xray').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerXRayHighlight(btn.dataset.targetId, btn.dataset.targetLabel || 'Prompt Injection', 'promptInjection');
      });
    });

    container.appendChild(piItem);
  }
}

// X-Ray Highlight Trigger
function triggerXRayHighlight(targetId, targetLabel, dimensionKey = '') {
  activeXRayTarget = targetId;
  const isZh = currentLang === 'zh_CN';
  const targetTabId = lockedReportState?.tabId || currentTabId;

  chrome.runtime.sendMessage(
    {
      type: 'XRAY_HIGHLIGHT',
      tabId: targetTabId,
      target: {
        checkId: targetId,
        dimensionKey,
        label: targetLabel || targetId,
        isZh,
      },
    },
    (resp) => {
      if (resp && resp.ok) {
        const xrayBar = document.getElementById('xray-bar');
        const xrayStatus = document.getElementById('xray-status-text');
        if (xrayBar) xrayBar.classList.add('active');
        if (xrayStatus) {
          xrayStatus.textContent = isZh
            ? `🔍 正在页面高亮: ${targetLabel || targetId}`
            : `🔍 Highlighting on page: ${targetLabel || targetId}`;
        }
        showToast(
          isZh
            ? `已切回原标签页并高亮定位 ${targetLabel || targetId}`
            : `Switched to tab and highlighted ${targetLabel || targetId}`
        );
      } else if (resp && resp.errorCode === 'tab_closed') {
        showToast(
          isZh ? '原页面标签页已关闭，无法高亮' : 'Target tab has been closed, unable to highlight',
          '⚠️'
        );
      } else if (resp && resp.errorCode === 'needs_permission') {
        showToast(
          isZh
            ? '权限不足或页面已刷新，请点击工具栏图标重新授权'
            : 'Permission needed or page reloaded. Click toolbar icon to re-authorize.',
          '⚠️'
        );
      } else {
        showToast(
          isZh ? `高亮定位失败: ${resp?.error || '未知错误'}` : `Highlight failed: ${resp?.error || 'Unknown error'}`,
          '⚠️'
        );
      }
    }
  );
}

// Clear X-Ray Highlight
function clearXRayHighlight() {
  activeXRayTarget = null;
  const isZh = currentLang === 'zh_CN';
  const targetTabId = lockedReportState?.tabId || currentTabId;

  chrome.runtime.sendMessage(
    {
      type: 'XRAY_CLEAR',
      tabId: targetTabId,
    },
    () => {
      const xrayBar = document.getElementById('xray-bar');
      if (xrayBar) xrayBar.classList.remove('active');
      showToast(isZh ? '已清除页面高亮' : 'Cleared in-page highlights');
    }
  );
}

// Render Remediation Fix Files
function renderFixFiles(fixFiles = {}, result = {}) {
  const codeEl = document.getElementById('fix-code-preview');
  const pathHintEl = document.getElementById('fix-file-path-hint');
  const robotsDisclaimer = document.getElementById('robots-disclaimer');
  const isZh = currentLang === 'zh_CN';

  // Extract file content
  const llmsData = fixFiles.llmsTxt || { filename: 'llms.txt', content: '# Site LLMs Guidance\n> Add summary here', path: '/llms.txt' };
  const robotsData = fixFiles.robotsTxt || { filename: 'robots.txt', content: '# robots.txt\nUser-agent: *\nAllow: /', path: '/robots.txt' };
  const jsonLdData = fixFiles.jsonLd || { filename: 'json-ld-schema.html', content: '<!-- JSON-LD snippet -->', path: '<head> snippet' };

  let currentFile = llmsData;
  if (activeFixTab === 'robots') currentFile = robotsData;
  else if (activeFixTab === 'jsonld') currentFile = jsonLdData;

  if (codeEl) codeEl.textContent = currentFile.content || '';
  if (pathHintEl) {
    const rawPath = String(currentFile.path || currentFile.filename || '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    pathHintEl.textContent = isZh
      ? `部署位置: ${rawPath}`
      : `Placement: ${rawPath}`;
  }

  if (robotsDisclaimer) {
    robotsDisclaimer.style.display = activeFixTab === 'robots' ? 'block' : 'none';
  }

  // Tech stack detection & platform deployment guidance
  const stackCallout = document.getElementById('stack-guide-callout');
  if (stackCallout) {
    const detectedStack = detectTechStack(result.raw?.pageHtml || '', result.url || currentTabUrl);
    const guidance = getStackGuidance(detectedStack, isZh);
    if (guidance) {
      stackCallout.style.display = 'flex';
      const badgeEl = document.getElementById('stack-guide-badge');
      const hintEl = document.getElementById('stack-guide-hint');
      const summaryEl = document.getElementById('stack-guide-summary');
      const linkEl = document.getElementById('stack-guide-link');

      if (badgeEl) {
        badgeEl.textContent = isZh
          ? `检测到技术栈：${guidance.name}`
          : `Detected Stack: ${guidance.name}`;
      }
      if (hintEl) {
        if (guidance.showFixPackHint) {
          hintEl.style.display = 'inline-block';
          hintEl.textContent = isZh ? '支持 Fix Pack 代部署' : 'Fix Pack Available';
        } else {
          hintEl.style.display = 'none';
        }
      }
      if (summaryEl) summaryEl.textContent = guidance.summary;
      if (linkEl) {
        linkEl.href = guidance.guideUrl;
        linkEl.textContent = isZh
          ? `查看 ${guidance.name} 完整 GEO 指南 ↗`
          : `View Full ${guidance.name} GEO Guide ↗`;
      }
    } else {
      stackCallout.style.display = 'none';
    }
  }
}

// Render AI Smoke Test Launcher
function renderSmokeTest(smokeTestData, result) {
  const isZh = currentLang === 'zh_CN';
  const brandEl = document.getElementById('smoke-brand');
  const topicEl = document.getElementById('smoke-topic');
  const container = document.getElementById('smoke-prompts-container');
  const disclaimerEl = document.getElementById('smoke-disclaimer');

  if (!smokeTestData) {
    // Generate fallback data if not provided in background payload
    smokeTestData = buildSmokeTestData({
      html: result.raw?.pageHtml || '',
      url: result.url || currentTabUrl,
      lang: currentLang,
    });
  }

  if (brandEl) brandEl.textContent = smokeTestData.brand || 'Target Brand';
  if (topicEl) topicEl.textContent = smokeTestData.topic || 'Domain Service';
  if (disclaimerEl) disclaimerEl.textContent = smokeTestData.disclaimer || '';

  if (container) {
    container.innerHTML = '';
    const prompts = smokeTestData.prompts || [];

    for (const p of prompts) {
      const box = document.createElement('div');
      box.className = 'smoke-prompt-box';

      box.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="smoke-prompt-title">${escapeHtml(p.title || 'Prompt')}</span>
          <button class="btn-secondary btn-copy-smoke" style="padding: 2px 6px; font-size: 10px;">
            ${isZh ? '复制 Prompt' : 'Copy'}
          </button>
        </div>
        <p class="smoke-prompt-text">"${escapeHtml(p.query)}"</p>
        <div class="smoke-launcher-row">
          <a href="${escapeHtml(p.targets?.chatgpt || '#')}" target="_blank" rel="noopener noreferrer" class="launcher-btn">
            ChatGPT ↗
          </a>
          <a href="${escapeHtml(p.targets?.perplexity || '#')}" target="_blank" rel="noopener noreferrer" class="launcher-btn">
            Perplexity ↗
          </a>
          <a href="${escapeHtml(p.targets?.claude || '#')}" target="_blank" rel="noopener noreferrer" class="launcher-btn">
            Claude ↗
          </a>
        </div>
      `;

      const copyBtn = box.querySelector('.btn-copy-smoke');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          copyToClipboard(p.query, 'Prompt copied to clipboard!', '测试 Prompt 已复制到剪贴板！');
        });
      }

      container.appendChild(box);
    }
  }
}

// Render Live SVG Badge Embed Card
function renderLiveBadgeCard(result = {}) {
  const card = document.getElementById('live-badge-card');
  if (!card) return;

  const isZh = currentLang === 'zh_CN';
  let hostname = '';
  try {
    if (result.url) hostname = new URL(result.url).hostname;
  } catch {}

  const validDomain = parseBadgeDomain(hostname);
  if (!validDomain) {
    card.style.display = 'none';
    return;
  }

  const snippets = buildBadgeEmbedSnippets(validDomain);
  if (!snippets) {
    card.style.display = 'none';
    return;
  }

  const scoreVal = typeof result.score === 'number' ? result.score : result.total;
  const isReady = typeof scoreVal === 'number' && scoreVal >= 80;

  card.style.display = 'flex';
  if (isReady) {
    card.classList.add('live-badge-ready');
  } else {
    card.classList.remove('live-badge-ready');
  }

  const titleEl = document.getElementById('label-live-badge-title');
  if (titleEl) {
    titleEl.textContent = isZh ? '嵌入实时 GeoScore 徽章' : 'Embed Live GeoScore Badge';
  }

  const descEl = document.getElementById('label-live-badge-desc');
  if (descEl) {
    if (isReady) {
      descEl.textContent = isZh
        ? '您的站点已达到 AI 友好标准！建议将此实时徽章嵌入页脚或 GitHub README。'
        : 'Your site meets AI-ready standards! Embed this live badge in your site footer or GitHub README.';
    } else {
      descEl.textContent = isZh
        ? '可将实时 GeoScore 状态徽章嵌入网站页脚或 GitHub README（分数将自动同步更新）。'
        : 'Embed your live GeoScore badge in your site footer or GitHub README (updates automatically).';
    }
  }

  const previewEl = document.getElementById('live-badge-preview');
  if (previewEl) {
    const svgString = renderBadgeSvg({ score: scoreVal, level: result.level });
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
      const svgNode = doc && doc.documentElement;
      if (svgNode && svgNode.nodeName.toLowerCase() === 'svg') {
        previewEl.replaceChildren(document.importNode(svgNode, true));
      } else {
        previewEl.textContent = '';
      }
    } else {
      previewEl.textContent = '';
    }
  }

  const mdCodeEl = document.getElementById('badge-md-code');
  if (mdCodeEl) mdCodeEl.textContent = snippets.markdown;

  const htmlCodeEl = document.getElementById('badge-html-code');
  if (htmlCodeEl) htmlCodeEl.textContent = snippets.html;
}

// Update Funnel Links with URL params, localization & low-score pinning
function updateFunnelLinks(targetUrl, score) {
  const isZh = currentLang === 'zh_CN';
  const encodedUrl = encodeURIComponent(targetUrl || '');

  const proLink = document.getElementById('link-pro-scan');
  if (proLink) {
    const basePath = isZh ? 'https://geoscore.help/zh/' : 'https://geoscore.help/';
    proLink.href = `${basePath}?url=${encodedUrl}&utm_source=chrome_ext&action=full_scan`;
  }

  const fixPackLink = document.getElementById('link-fix-pack');
  if (fixPackLink) {
    fixPackLink.href = isZh
      ? 'https://geoscore.help/zh/fixpack/?utm_source=chrome_ext'
      : 'https://geoscore.help/fixpack/?utm_source=chrome_ext';
  }

  const pricingLink = document.getElementById('link-pricing');
  if (pricingLink) {
    pricingLink.href = isZh
      ? 'https://geoscore.help/zh/pricing/?utm_source=chrome_ext'
      : 'https://geoscore.help/pricing/?utm_source=chrome_ext';
  }

  const funnelContainer = document.querySelector('.funnel-container');
  if (funnelContainer && proLink && fixPackLink && pricingLink) {
    const prioritizeFixPack = typeof score === 'number' && score < 60;
    if (prioritizeFixPack) {
      funnelContainer.appendChild(fixPackLink);
      funnelContainer.appendChild(proLink);
      funnelContainer.appendChild(pricingLink);
      fixPackLink.classList.add('funnel-card-primary');
    } else {
      funnelContainer.appendChild(proLink);
      funnelContainer.appendChild(fixPackLink);
      funnelContainer.appendChild(pricingLink);
      fixPackLink.classList.remove('funnel-card-primary');
    }
  }
}

// --- Dynamic Text & Labels Localization ---
function updateStaticLabels() {
  const isZh = currentLang === 'zh_CN';

  // Header
  const langBtn = document.getElementById('btn-lang');
  if (langBtn) langBtn.textContent = isZh ? '中文' : 'EN';

  const rescanLabel = document.getElementById('label-rescan');
  if (rescanLabel) rescanLabel.textContent = isZh ? '重新扫描' : 'Rescan';

  // Settings Drawer
  const settingsTitle = document.getElementById('label-settings-title');
  if (settingsTitle) settingsTitle.textContent = isZh ? '设置' : 'Settings';

  const autoBadgeLabel = document.getElementById('label-auto-badge');
  if (autoBadgeLabel) autoBadgeLabel.textContent = isZh ? '浏览时自动更新角标' : 'Auto-Badge on Navigation';

  const autoBadgeDesc = document.getElementById('label-auto-badge-desc');
  if (autoBadgeDesc) {
    autoBadgeDesc.textContent = isZh
      ? '在后台自动审计所访问网页并在插件图标展示实时得分角标（需请求全部网站权限）。'
      : 'Audit visited pages in background and show real-time score badges on extension icon (requires host permission).';
  }

  const langLabel = document.getElementById('label-language');
  if (langLabel) langLabel.textContent = isZh ? '界面语言' : 'Language';

  const clearHistoryLabel = document.getElementById('label-clear-history');
  if (clearHistoryLabel) clearHistoryLabel.textContent = isZh ? '清除本地历史记录' : 'Clear Local History & Cache';

  // Restricted View
  const restTitle = document.getElementById('label-restricted-title');
  if (restTitle) restTitle.textContent = isZh ? '浏览器受限页面' : 'Restricted Browser Page';

  const restDesc = document.getElementById('label-restricted-desc');
  if (restDesc) {
    restDesc.textContent = isZh
      ? 'GeoScore 无法审计浏览器内部页面（chrome://）、扩展商店页面或空白标签页。请切换至普通网站或本地 localhost 项目后再次点击。'
      : 'GeoScore cannot audit browser internal pages (chrome://), webstore pages, or empty tabs. Please open a regular web page or localhost project.';
  }

  const openGeoBtn = document.getElementById('btn-open-geoscore');
  if (openGeoBtn) openGeoBtn.textContent = isZh ? '打开 geoscore.help 官网测试' : 'Open geoscore.help';

  // Permission View
  const permTitle = document.getElementById('label-permission-title');
  if (permTitle) permTitle.textContent = isZh ? '需要页面访问权限' : 'Access Permission Needed';

  const permDesc = document.getElementById('label-permission-desc');
  if (permDesc) {
    permDesc.textContent = isZh
      ? '请点击浏览器右上角 GeoScore 插件图标激活当前标签页审计，或点击下方按钮直接授权。'
      : 'Click the GeoScore icon in your browser toolbar or grant access below to audit this tab.';
  }

  // Error View
  const errTitle = document.getElementById('label-error-title');
  if (errTitle) errTitle.textContent = isZh ? '审计失败' : 'Audit Failed';

  const retryBtn = document.getElementById('btn-retry');
  if (retryBtn) retryBtn.textContent = isZh ? '重新审计' : 'Retry Audit';

  // Report Section Headings & Stats
  const copyPromptLabel = document.getElementById('label-copy-prompt');
  if (copyPromptLabel) copyPromptLabel.textContent = isZh ? '🤖 复制 AI 修复指令 (Cursor / Claude)' : '🤖 Copy Fix Prompt (Cursor / Claude)';

  const statChecksLabel = document.getElementById('label-stat-checks');
  if (statChecksLabel) statChecksLabel.textContent = isZh ? '通过项' : 'Passed Checks';

  const statSurvivalLabel = document.getElementById('label-stat-survival');
  if (statSurvivalLabel) statSurvivalLabel.textContent = isZh ? 'AI 爬虫可见度' : 'AI Visibility';

  const statDurationLabel = document.getElementById('label-stat-duration');
  if (statDurationLabel) statDurationLabel.textContent = isZh ? '审计耗时' : 'Duration';

  const ssrTitleLabel = document.getElementById('label-ssr-title');
  if (ssrTitleLabel) ssrTitleLabel.textContent = isZh ? 'SSR 源码 vs 实时 DOM (AI 爬虫视角)' : 'SSR vs. Live DOM (AI Crawler View)';

  const ssrWordsLabel = document.getElementById('label-ssr-words');
  if (ssrWordsLabel) ssrWordsLabel.textContent = isZh ? 'SSR 原始词数' : 'SSR Raw Words';

  const csrWordsLabel = document.getElementById('label-csr-words');
  if (csrWordsLabel) csrWordsLabel.textContent = isZh ? '实时 DOM 词数' : 'Live DOM Words';

  const ssrSchemasLabel = document.getElementById('label-ssr-schemas');
  if (ssrSchemasLabel) ssrSchemasLabel.textContent = isZh ? 'SSR 结构化类型' : 'SSR Schema Types';

  const csrSchemasLabel = document.getElementById('label-csr-schemas');
  if (csrSchemasLabel) csrSchemasLabel.textContent = isZh ? '实时 DOM 结构化类型' : 'Live DOM Schema Types';

  const dimHeading = document.getElementById('label-dimensions-heading');
  if (dimHeading) dimHeading.textContent = isZh ? '11 审计维度 (85 项检测)' : '11 Audit Dimensions (85 Checks)';

  const fixFilesHeading = document.getElementById('label-fix-files-title');
  if (fixFilesHeading) fixFilesHeading.textContent = isZh ? '三大 GEO 修复文件生成' : 'Generated Remediation Files';

  const smokeHeading = document.getElementById('label-smoke-title');
  if (smokeHeading) smokeHeading.textContent = isZh ? 'AI 搜索引擎真机联调烟测' : 'AI Engine Live Smoke Test';

  const newlyFixedLabel = document.getElementById('label-newly-fixed');
  if (newlyFixedLabel) newlyFixedLabel.textContent = isZh ? '本次新修复项:' : 'Newly Fixed Checks:';

  const soft404Title = document.getElementById('label-soft404-title');
  if (soft404Title) soft404Title.textContent = isZh ? '软 404 端点告警' : 'Soft 404 Endpoint Warnings';

  const copyFixBtn = document.getElementById('btn-copy-fix');
  if (copyFixBtn) copyFixBtn.textContent = isZh ? '复制' : 'Copy';

  const downloadFixBtn = document.getElementById('btn-download-fix');
  if (downloadFixBtn) downloadFixBtn.textContent = isZh ? '下载' : 'Download';

  const robotsDisclaimer = document.getElementById('robots-disclaimer');
  if (robotsDisclaimer) {
    robotsDisclaimer.textContent = isZh
      ? '提示：robots.txt 建议会保留您原有的自定义屏蔽规则，仅提供 AI 爬虫放行诊断参考。'
      : 'Note: robots.txt recommendations preserve custom rules and only advise AI agent permissions without overreaching guarantees.';
  }

  const clearXrayBtn = document.getElementById('btn-clear-xray');
  if (clearXrayBtn) clearXrayBtn.textContent = isZh ? '清除高亮' : 'Clear';

  const exportMdBtn = document.getElementById('btn-export-md');
  if (exportMdBtn) exportMdBtn.textContent = isZh ? '导出 MD' : 'Export MD';

  const exportJsonBtn = document.getElementById('btn-export-json');
  if (exportJsonBtn) exportJsonBtn.textContent = isZh ? '导出 JSON' : 'Export JSON';

  // Funnel Headings
  const proTitle = document.getElementById('label-pro-title');
  if (proTitle) proTitle.textContent = isZh ? '全站 Sitemap 深度扫描与每周监控' : 'Full Site Sitemap Scan & Monitoring';

  const proDesc = document.getElementById('label-pro-desc');
  if (proDesc) {
    proDesc.textContent = isZh
      ? '单页高分不代表全站安全。一键扫描全站 XML Sitemap 并开启每周 AI 引用分数追踪。'
      : 'Single page score doesn\'t guarantee domain readiness. Scan all URLs via XML Sitemap and track weekly score trends.';
  }

  const fixpackTitle = document.getElementById('label-fixpack-title');
  if (fixpackTitle) fixpackTitle.textContent = isZh ? 'AI 可见度 Fix Pack（人工代做）' : 'Done-For-You AI Visibility Fix Pack';

  const fixpackBadge = document.getElementById('label-fixpack-badge');
  if (fixpackBadge) fixpackBadge.textContent = isZh ? '$49 一次性 · 48h' : '$49 One-Time · 48h';

  const fixpackDesc = document.getElementById('label-fixpack-desc');
  if (fixpackDesc) {
    fixpackDesc.textContent = isZh
      ? '按店铺真实目录定制 llms.txt、显式 AI 爬虫 robots.txt、畅销品 Product schema 与部署后复检，48 小时交付。'
      : 'Custom llms.txt from your real catalog, explicit AI-crawler robots.txt, best-seller Product schema & post-deploy re-audit in 48h.';
  }

  // Live SVG Badge Labels
  const liveBadgeTitle = document.getElementById('label-live-badge-title');
  if (liveBadgeTitle) liveBadgeTitle.textContent = isZh ? '嵌入实时 GeoScore 徽章' : 'Embed Live GeoScore Badge';

  const copyBadgeMdBtn = document.getElementById('btn-copy-badge-md');
  if (copyBadgeMdBtn) copyBadgeMdBtn.textContent = isZh ? '复制 Markdown' : 'Copy Markdown';

  const copyBadgeHtmlBtn = document.getElementById('btn-copy-badge-html');
  if (copyBadgeHtmlBtn) copyBadgeHtmlBtn.textContent = isZh ? '复制 HTML' : 'Copy HTML';

  const pricingTitle = document.getElementById('label-pricing-title');
  if (pricingTitle) pricingTitle.textContent = isZh ? 'PDF 报告导出与 30 天云端历史' : 'PDF Report Export & 30-Day History';

  const pricingDesc = document.getElementById('label-pricing-desc');
  if (pricingDesc) {
    pricingDesc.textContent = isZh
      ? '支持导出审计 PDF 报告、监控多达 5 个域名并在分数下降时自动告警。'
      : 'Export audit PDF reports, monitor up to 5 domains with weekly alerts, and access 30-day cloud audit history.';
  }

  // Standby View
  const standbyTitle = document.getElementById('label-standby-title');
  if (standbyTitle) standbyTitle.textContent = isZh ? '准备开始审计' : 'Ready to Audit';

  const standbyDesc = document.getElementById('label-standby-desc');
  if (standbyDesc) {
    standbyDesc.textContent = isZh
      ? '一键深度检测 11 维度 GEO 评分、SSR/CSR 渲染盲区，支持页面原位高亮与修复文件生成。'
      : 'Audit this page across 11 GEO dimensions, detect JS rendering traps, and generate AI-ready fix files.';
  }

  const standbyTargetLabel = document.getElementById('label-standby-target');
  if (standbyTargetLabel) standbyTargetLabel.textContent = isZh ? '当前页面：' : 'Current Page:';

  const scanCurrentLabel = document.getElementById('label-scan-current');
  if (scanCurrentLabel) scanCurrentLabel.textContent = isZh ? '开始扫描当前页面' : 'Scan Current Page';

  updateStandbyCard();
  updateLockedTabBanner();
}

// --- Setup Event Listeners ---
function setupEventListeners() {
  // 1. Language Toggle Button
  const langBtn = document.getElementById('btn-lang');
  if (langBtn) {
    langBtn.addEventListener('click', async () => {
      const nextLang = currentLang === 'zh_CN' ? 'en' : 'zh_CN';
      currentLang = nextLang;
      setLangPreference(nextLang);
      await saveSettings({ langPref: nextLang });
      updateStaticLabels();
      if (currentAuditState) renderAuditState(currentAuditState);
      showToast(nextLang === 'zh_CN' ? '已切换为简体中文' : 'Switched to English');
    });
  }

  // 2. Settings Drawer Toggle
  const settingsBtn = document.getElementById('btn-settings');
  const closeSettingsBtn = document.getElementById('btn-close-settings');
  const settingsDrawer = document.getElementById('settings-drawer');

  if (settingsBtn && settingsDrawer) {
    settingsBtn.addEventListener('click', () => {
      settingsDrawer.classList.toggle('open');
    });
  }
  if (closeSettingsBtn && settingsDrawer) {
    closeSettingsBtn.addEventListener('click', () => {
      settingsDrawer.classList.remove('open');
    });
  }

  // 3. Auto-Badge Toggle with Synchronous Permission Request
  const autoBadgeInput = document.getElementById('setting-auto-badge');
  if (autoBadgeInput) {
    autoBadgeInput.addEventListener('change', async (e) => {
      const isChecked = autoBadgeInput.checked;
      if (isChecked) {
        try {
          // Synchronously call permissions.request during user gesture
          const granted = await chrome.permissions.request({
            origins: ['https://*/*', 'http://*/*'],
          });
          if (!granted) {
            autoBadgeInput.checked = false;
            showToast(currentLang === 'zh_CN' ? '需要授予所有网站访问权限以开启自动角标' : 'Host permissions required for Auto-Badge', '⚠️');
            return;
          }
          await saveSettings({ autoBadge: true });
          chrome.runtime.sendMessage({ type: 'AUTO_BADGE_SETTING_CHANGED', enabled: true });
          showToast(currentLang === 'zh_CN' ? '自动角标已开启' : 'Auto-Badge enabled');
        } catch (err) {
          autoBadgeInput.checked = false;
          showToast(currentLang === 'zh_CN' ? '权限申请被取消' : 'Permission request cancelled', '⚠️');
        }
      } else {
        await saveSettings({ autoBadge: false });
        chrome.runtime.sendMessage({ type: 'AUTO_BADGE_SETTING_CHANGED', enabled: false });
        showToast(currentLang === 'zh_CN' ? '自动角标已关闭' : 'Auto-Badge disabled');
      }
    });
  }

  // 4. Language Select Input
  const langSelect = document.getElementById('setting-lang');
  if (langSelect) {
    langSelect.addEventListener('change', async () => {
      const selected = langSelect.value;
      const resolved = resolveLang(selected);
      currentLang = resolved;
      setLangPreference(selected);
      await saveSettings({ langPref: selected });
      updateStaticLabels();
      if (currentAuditState) renderAuditState(currentAuditState);
    });
  }

  // 5. Clear Local History
  const clearHistoryBtn = document.getElementById('btn-clear-history');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', async () => {
      await clearAuditHistory();
      showToast(currentLang === 'zh_CN' ? '已清空本地历史记录与快照' : 'Cleared local history & snapshots');
    });
  }

  // 6. Rescan Button
  const rescanBtn = document.getElementById('btn-rescan');
  if (rescanBtn) {
    rescanBtn.addEventListener('click', () => {
      showViewState('scanning');
      const targetId = lockedReportState?.tabId || activeTabInfo?.tabId || currentTabId;
      chrome.runtime.sendMessage({ type: 'RESCAN_ACTIVE_TAB', tabId: targetId }, (resp) => {
        if (resp) renderAuditState(resp);
      });
    });
  }

  // 7. Retry Button
  const retryBtn = document.getElementById('btn-retry');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      showViewState('scanning');
      const targetId = lockedReportState?.tabId || activeTabInfo?.tabId || currentTabId;
      chrome.runtime.sendMessage({ type: 'RESCAN_ACTIVE_TAB', tabId: targetId }, (resp) => {
        if (resp) renderAuditState(resp);
      });
    });
  }

  // Scan Current Page (from Standby view)
  const scanCurrentBtn = document.getElementById('btn-scan-current');
  if (scanCurrentBtn) {
    scanCurrentBtn.addEventListener('click', () => {
      showViewState('scanning');
      const targetId = activeTabInfo?.tabId || currentTabId;
      chrome.runtime.sendMessage({ type: 'SCAN_CURRENT_TAB', tabId: targetId }, (resp) => {
        if (resp) renderAuditState(resp);
      });
    });
  }

  // Scan Switched Tab (from Locked Tab Banner)
  const scanSwitchedBtn = document.getElementById('btn-scan-switched-tab');
  if (scanSwitchedBtn) {
    scanSwitchedBtn.addEventListener('click', () => {
      showViewState('scanning');
      const targetId = activeTabInfo?.tabId || currentTabId;
      chrome.runtime.sendMessage({ type: 'SCAN_CURRENT_TAB', tabId: targetId }, (resp) => {
        if (resp) renderAuditState(resp);
      });
    });
  }

  // 8. Open GeoScore Web
  const openGeoscoreBtn = document.getElementById('btn-open-geoscore');
  if (openGeoscoreBtn) {
    openGeoscoreBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://geoscore.help' });
    });
  }

  // 9. Grant Permission Button
  const grantPermBtn = document.getElementById('btn-grant-permission');
  if (grantPermBtn) {
    grantPermBtn.addEventListener('click', async () => {
      if (!currentTabOrigin) return;
      try {
        const granted = await chrome.permissions.request({
          origins: [`${currentTabOrigin}/*`],
        });
        if (granted) {
          showViewState('scanning');
          chrome.runtime.sendMessage({ type: 'RESCAN_ACTIVE_TAB', tabId: currentTabId }, (resp) => {
            if (resp) renderAuditState(resp);
          });
        }
      } catch (err) {
        showToast(currentLang === 'zh_CN' ? '授权失败' : 'Permission failed', '⚠️');
      }
    });
  }

  // 10. Copy Cursor / AI Fix Prompt
  const copyPromptBtn = document.getElementById('btn-copy-prompt');
  if (copyPromptBtn) {
    copyPromptBtn.addEventListener('click', async () => {
      if (!currentAuditState || !currentAuditState.data) {
        showToast(currentLang === 'zh_CN' ? '无可用审计结果' : 'No audit data available', '⚠️');
        return;
      }
      const data = currentAuditState.data;
      const prompt = buildCursorFixPrompt({
        result: data.result || {},
        ssrDiff: data.ssrDiff || null,
        soft404Map: data.soft404Map || {},
        fixFiles: data.fixFiles || {},
        lang: currentLang,
      });

      await copyToClipboard(
        prompt,
        'Copied Cursor / Claude AI Fix Prompt to clipboard!',
        '已复制 Cursor / Claude AI 一键修复指令到剪贴板！'
      );
    });
  }

  // 11. Export Markdown
  const exportMdBtn = document.getElementById('btn-export-md');
  if (exportMdBtn) {
    exportMdBtn.addEventListener('click', () => {
      if (!currentAuditState || !currentAuditState.data?.result) return;
      const md = exportMarkdown(currentAuditState.data.result);
      const filename = `geoscore-audit-${new Date().toISOString().slice(0, 10)}.md`;
      downloadFile(filename, md, 'text/markdown');
    });
  }

  // 12. Export JSON
  const exportJsonBtn = document.getElementById('btn-export-json');
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      if (!currentAuditState || !currentAuditState.data?.result) return;
      const json = exportJson(currentAuditState.data.result);
      const filename = `geoscore-audit-${new Date().toISOString().slice(0, 10)}.json`;
      downloadFile(filename, json, 'application/json');
    });
  }

  // 13. Clear X-Ray Highlight
  const clearXrayBtn = document.getElementById('btn-clear-xray');
  if (clearXrayBtn) {
    clearXrayBtn.addEventListener('click', () => {
      clearXRayHighlight();
    });
  }

  // 14. Diff Badge Expand
  const diffBadge = document.getElementById('diff-badge');
  const diffDrawer = document.getElementById('diff-drawer');
  if (diffBadge && diffDrawer) {
    diffBadge.addEventListener('click', () => {
      diffDrawer.style.display = diffDrawer.style.display === 'none' ? 'block' : 'none';
    });
  }

  // 15. Fix Files Tabs
  const tabLlms = document.getElementById('tab-llms');
  const tabRobots = document.getElementById('tab-robots');
  const tabJsonld = document.getElementById('tab-jsonld');

  function setFixTab(tabName) {
    activeFixTab = tabName;
    [tabLlms, tabRobots, tabJsonld].forEach((btn) => {
      if (btn) btn.classList.remove('active');
    });
    if (tabName === 'llms' && tabLlms) tabLlms.classList.add('active');
    if (tabName === 'robots' && tabRobots) tabRobots.classList.add('active');
    if (tabName === 'jsonld' && tabJsonld) tabJsonld.classList.add('active');

    if (currentAuditState?.data) {
      renderFixFiles(currentAuditState.data.fixFiles, currentAuditState.data.result);
    }
  }

  if (tabLlms) tabLlms.addEventListener('click', () => setFixTab('llms'));
  if (tabRobots) tabRobots.addEventListener('click', () => setFixTab('robots'));
  if (tabJsonld) tabJsonld.addEventListener('click', () => setFixTab('jsonld'));

  // 16. Copy Fix File
  const copyFixBtn = document.getElementById('btn-copy-fix');
  if (copyFixBtn) {
    copyFixBtn.addEventListener('click', () => {
      const codeEl = document.getElementById('fix-code-preview');
      if (codeEl && codeEl.textContent) {
        copyToClipboard(
          codeEl.textContent,
          `Copied ${activeFixTab} content to clipboard!`,
          `已复制 ${activeFixTab} 内容到剪贴板！`
        );
      }
    });
  }

  // 17. Download Fix File
  const downloadFixBtn = document.getElementById('btn-download-fix');
  if (downloadFixBtn) {
    downloadFixBtn.addEventListener('click', () => {
      const codeEl = document.getElementById('fix-code-preview');
      if (!codeEl || !codeEl.textContent) return;

      let filename = 'llms.txt';
      let mime = 'text/plain';
      if (activeFixTab === 'robots') {
        filename = 'robots.txt';
        mime = 'text/plain';
      } else if (activeFixTab === 'jsonld') {
        filename = 'json-ld-schema.html';
        mime = 'text/html';
      }

      downloadFile(filename, codeEl.textContent, mime);
    });
  }

  // 18. Copy Live Badge Markdown / HTML Snippets
  const copyBadgeMdBtn = document.getElementById('btn-copy-badge-md');
  if (copyBadgeMdBtn) {
    copyBadgeMdBtn.addEventListener('click', () => {
      const mdCodeEl = document.getElementById('badge-md-code');
      if (mdCodeEl && mdCodeEl.textContent) {
        copyToClipboard(
          mdCodeEl.textContent,
          'Copied Markdown badge snippet!',
          '已复制 Markdown 徽章代码！'
        );
      }
    });
  }

  const copyBadgeHtmlBtn = document.getElementById('btn-copy-badge-html');
  if (copyBadgeHtmlBtn) {
    copyBadgeHtmlBtn.addEventListener('click', () => {
      const htmlCodeEl = document.getElementById('badge-html-code');
      if (htmlCodeEl && htmlCodeEl.textContent) {
        copyToClipboard(
          htmlCodeEl.textContent,
          'Copied HTML badge snippet!',
          '已复制 HTML 徽章代码！'
        );
      }
    });
  }
}

function handleTabChange() {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
  chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB_INFO' }, (tabInfo) => {
    if (!tabInfo) return;
    activeTabInfo = {
      tabId: tabInfo.tabId,
      url: tabInfo.url || '',
      title: tabInfo.title || '',
      restricted: Boolean(tabInfo.restricted),
      hasUrlAccess: Boolean(tabInfo.url),
    };
    if (tabInfo.tabId) currentTabId = tabInfo.tabId;
    if (tabInfo.url) {
      currentTabUrl = tabInfo.url;
      try {
        currentTabOrigin = new URL(tabInfo.url).origin;
      } catch {}
    }

    if (lockedReportState && lockedReportState.status === 'ready') {
      // Report locked: preserve view completely, only refresh top banner
      updateLockedTabBanner();
    } else {
      // Standby or no report locked yet: NEVER auto-audit!
      if (activeTabInfo.restricted) {
        showViewState('restricted');
      } else {
        showViewState('standby');
        updateStandbyCard();
      }
      updateLockedTabBanner();
    }
  });
}

// --- Initialization & Message Bus Handshake ---
async function initSidePanel() {
  // 1. Load settings (language & auto-badge)
  const settings = await getSettings();
  currentLang = resolveLang(settings.langPref || 'auto');
  setLangPreference(settings.langPref || 'auto');

  const langSelect = document.getElementById('setting-lang');
  if (langSelect) langSelect.value = settings.langPref || 'auto';

  const autoBadgeInput = document.getElementById('setting-auto-badge');
  if (autoBadgeInput) autoBadgeInput.checked = Boolean(settings.autoBadge);

  updateStaticLabels();
  setupEventListeners();

  // 2. Query initial active tab info
  handleTabChange();

  // 3. Register storage listener for session updates (manual triggers only)
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'session') return;

      const hasManualPing = Boolean(changes.latestManualAuditAt || changes.latestManualAuditTabId);
      if (hasManualPing) {
        const handleManualUpdate = (manualTabId) => {
          if (!manualTabId) return;
          const key = `tabAudit:${manualTabId}`;
          if (changes[key] && changes[key].newValue) {
            const newState = changes[key].newValue;
            if (newState.status === 'ready') {
              lockedReportState = newState;
            }
            renderAuditState(newState);
          } else {
            chrome.storage.session.get([key], (res) => {
              const newState = res && res[key];
              if (newState) {
                if (newState.status === 'ready') {
                  lockedReportState = newState;
                }
                renderAuditState(newState);
              }
            });
          }
        };

        if (changes.latestManualAuditTabId && changes.latestManualAuditTabId.newValue) {
          handleManualUpdate(changes.latestManualAuditTabId.newValue);
        } else {
          chrome.storage.session.get(['latestManualAuditTabId'], (res) => {
            handleManualUpdate(res && res.latestManualAuditTabId);
          });
        }
      } else if (lockedReportState && changes[`tabAudit:${lockedReportState.tabId}`]) {
        const updated = changes[`tabAudit:${lockedReportState.tabId}`].newValue;
        if (updated) {
          if (updated.status === 'ready') {
            lockedReportState = updated;
          }
          renderAuditState(updated);
        }
      }
    });
  }

  // 4. Register tab activation listener (NO AUTO SCAN!)
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onActivated) {
    chrome.tabs.onActivated.addListener(() => {
      handleTabChange();
    });
  }

  // 5. Register tab updated listener (only active tab URL change, NO AUTO SCAN!)
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onUpdated) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (tabId === activeTabInfo.tabId && (changeInfo.url || changeInfo.status === 'complete')) {
        handleTabChange();
      }
    });
  }

  // 6. Send SIDEPANEL_READY handshake to SW (gets existing report or standby)
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ type: 'SIDEPANEL_READY' }, (resp) => {
      if (resp) {
        if (resp.status === 'ready') {
          lockedReportState = resp;
        }
        renderAuditState(resp);
      }
    });
  }
}

// Start on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSidePanel);
} else {
  initSidePanel();
}
