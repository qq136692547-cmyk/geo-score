/**
 * GeoScore Chrome Extension - MV3 Background Service Worker
 *
 * Coordinates:
 * - Extension action clicks (instant side panel open + audit initiation)
 * - Anti-race session handshake with the Side Panel UI via chrome.storage.session
 * - Dynamic Badge score / status rendering
 * - Optional auto-badge monitoring on page navigation
 * - DOM inspection message proxying (In-Page X-Ray)
 */

import { analyzeAuditPayload } from '../../../src/lib/auditEngine.js';
import { generateFixFiles } from '../../../src/lib/fixGenerator.js';
import { inspectFetchedResource } from '../shared/soft404.js';
import { computeSsrCsrDiff } from '../shared/ssrDiff.js';
import { buildSmokeTestData } from '../shared/smokeTest.js';
import {
  saveAuditSnapshot,
  getAuditHistory,
  computeAuditDiff,
  getSettings,
} from '../shared/storage.js';
import { resolveLang } from '../shared/i18n.js';

export function isRestrictedUrl(url = '') {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith('chrome://') ||
    trimmed.startsWith('chrome-extension://') ||
    trimmed.startsWith('edge://') ||
    trimmed.startsWith('about:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('view-source:') ||
    trimmed.startsWith('devtools://')
  ) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return true;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'chromewebstore.google.com' ||
      hostname === 'chrome.google.com'
    ) {
      return true;
    }
  } catch {
    return true;
  }
  return false;
}

export function sessionKeyForTab(tabId) {
  return `tabAudit:${tabId}`;
}

export function badgeColorForScore(score) {
  const num = typeof score === 'number' ? score : Number(score) || 0;
  if (num >= 86) return '#16a34a';
  if (num >= 68) return '#2563eb';
  if (num >= 36) return '#ca8a04';
  return '#dc2626';
}

export async function updateTabBadge(tabId, text, color) {
  if (typeof chrome === 'undefined' || !chrome.action) return;
  try {
    if (typeof chrome.action.setBadgeText === 'function') {
      await chrome.action.setBadgeText({ tabId, text: text != null ? String(text) : '' });
    }
    if (color && typeof chrome.action.setBadgeBackgroundColor === 'function') {
      await chrome.action.setBadgeBackgroundColor({ tabId, color });
    }
  } catch {}
}

export async function getSessionState(tabId) {
  if (typeof chrome === 'undefined' || !chrome.storage?.session) return null;
  const key = sessionKeyForTab(tabId);
  return new Promise((resolve) => {
    chrome.storage.session.get([key], (res) => {
      resolve(res && res[key] !== undefined ? res[key] : null);
    });
  });
}

export async function setSessionState(tabId, state) {
  if (typeof chrome === 'undefined' || !chrome.storage?.session) return;
  const key = sessionKeyForTab(tabId);
  return new Promise((resolve) => {
    chrome.storage.session.set(
      { [key]: state, latestManualAuditTabId: tabId, latestManualAuditAt: Date.now() },
      () => {
        resolve();
      }
    );
  });
}

export async function removeSessionState(tabId) {
  if (typeof chrome === 'undefined' || !chrome.storage?.session) return;
  const key = sessionKeyForTab(tabId);
  return new Promise((resolve) => {
    chrome.storage.session.remove([key], () => {
      resolve();
    });
  });
}

export async function getActiveTab() {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return null;
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs && tabs.length > 0 ? tabs[0] : null);
    });
  });
}

export function inspectCollectedEndpoints(endpoints = {}, origin = '') {
  const robots = inspectFetchedResource({
    url: endpoints.robots?.finalUrl || `${origin}/robots.txt`,
    status: endpoints.robots?.status ?? 0,
    ok: endpoints.robots?.ok,
    contentType: endpoints.robots?.contentType || '',
    body: endpoints.robots?.body || '',
    expectedType: 'text',
  });

  const llms = inspectFetchedResource({
    url: endpoints.llms?.finalUrl || `${origin}/llms.txt`,
    status: endpoints.llms?.status ?? 0,
    ok: endpoints.llms?.ok,
    contentType: endpoints.llms?.contentType || '',
    body: endpoints.llms?.body || '',
    expectedType: 'text',
  });

  const sitemap = inspectFetchedResource({
    url: endpoints.sitemap?.finalUrl || `${origin}/sitemap.xml`,
    status: endpoints.sitemap?.status ?? 0,
    ok: endpoints.sitemap?.ok,
    contentType: endpoints.sitemap?.contentType || '',
    body: endpoints.sitemap?.body || '',
    expectedType: 'xml',
  });

  const aiTxt = inspectFetchedResource({
    url: endpoints.aiTxt?.finalUrl || `${origin}/.well-known/ai.txt`,
    status: endpoints.aiTxt?.status ?? 0,
    ok: endpoints.aiTxt?.ok,
    contentType: endpoints.aiTxt?.contentType || '',
    body: endpoints.aiTxt?.body || '',
    expectedType: 'text',
  });

  const aiSummary = inspectFetchedResource({
    url: endpoints.aiSummary?.finalUrl || `${origin}/ai/summary.json`,
    status: endpoints.aiSummary?.status ?? 0,
    ok: endpoints.aiSummary?.ok,
    contentType: endpoints.aiSummary?.contentType || '',
    body: endpoints.aiSummary?.body || '',
    expectedType: 'json',
  });

  const aiFaq = inspectFetchedResource({
    url: endpoints.aiFaq?.finalUrl || `${origin}/ai/faq.json`,
    status: endpoints.aiFaq?.status ?? 0,
    ok: endpoints.aiFaq?.ok,
    contentType: endpoints.aiFaq?.contentType || '',
    body: endpoints.aiFaq?.body || '',
    expectedType: 'json',
  });

  return {
    robots,
    llms,
    sitemap,
    aiTxt,
    aiSummary,
    aiFaq,
  };
}

export async function runAuditForTab(tab) {
  if (!tab || !tab.id) return null;

  const tabId = tab.id;
  const rawUrl = tab.url || '';

  // 1. Restricted URL check
  if (isRestrictedUrl(rawUrl)) {
    const restrictedState = {
      tabId,
      status: 'restricted',
      url: rawUrl,
      updatedAt: Date.now(),
    };
    await setSessionState(tabId, restrictedState);
    await updateTabBadge(tabId, '—', '#64748b');
    return restrictedState;
  }

  // 2. Write scanning state
  const scanningState = {
    tabId,
    status: 'scanning',
    url: rawUrl,
    title: tab.title || '',
    updatedAt: Date.now(),
  };
  await setSessionState(tabId, scanningState);
  await updateTabBadge(tabId, '...', '#94a3b8');

  const startTime = Date.now();

  try {
    // 3. Script injection & message collection
    if (chrome.scripting && typeof chrome.scripting.executeScript === 'function') {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
    }

    const resp = await chrome.tabs.sendMessage(tabId, { type: 'COLLECT_GEO_DATA' });
    if (!resp || !resp.ok || !resp.payload) {
      throw new Error(resp?.error || 'Failed to collect DOM data from page');
    }

    const payload = resp.payload;
    const csrHtml = payload.csrHtml || '';
    const targetUrl = payload.url || rawUrl;
    const title = payload.title || tab.title || '';
    const ssrRes = payload.ssr || {};
    const endpoints = payload.endpoints || {};

    // Soft 404 inspections on non-HTML endpoints
    const soft404Map = inspectCollectedEndpoints(endpoints, payload.origin);

    const authenticatedFallback = Boolean(
      ssrRes.usedAuthFallback ||
      Object.values(endpoints).some((e) => e && e.usedAuthFallback)
    );

    const ssrFetchError = ssrRes.error || (ssrRes.status && !ssrRes.ok ? `HTTP ${ssrRes.status}` : null);
    const ssrHtml = ssrRes.body || '';

    // Settings & language preference
    const settings = await getSettings();
    const lang = resolveLang(settings?.langPref);

    // Run pure audit engine
    const result = analyzeAuditPayload({
      url: targetUrl,
      pageHtml: csrHtml,
      responseHeaders: ssrRes.headers || {},
      robotsTxt: soft404Map.robots.valid ? soft404Map.robots.cleanBody : null,
      llmsTxt: soft404Map.llms.valid ? soft404Map.llms.cleanBody : null,
      sitemapXml: soft404Map.sitemap.valid ? soft404Map.sitemap.cleanBody : null,
      aiTxt: soft404Map.aiTxt.valid ? soft404Map.aiTxt.cleanBody : null,
      aiSummary: soft404Map.aiSummary.valid ? soft404Map.aiSummary.cleanBody : null,
      aiFaq: soft404Map.aiFaq.valid ? soft404Map.aiFaq.cleanBody : null,
      aboutHtml: endpoints.about && endpoints.about.ok ? endpoints.about.body : null,
      contentHtml: endpoints.content && endpoints.content.ok ? endpoints.content.body : null,
      lang,
      rawHtmlLimit: 12000,
    });

    // Compute SSR vs CSR Diff
    const ssrDiff = computeSsrCsrDiff({
      ssrHtml,
      csrHtml,
      ssrStatus: ssrRes.status || 200,
      authenticatedFallback,
    });

    // Generate fix files & smoke test
    const fixFiles = generateFixFiles(result);
    const smokeTest = buildSmokeTestData({ html: csrHtml, url: targetUrl, lang });

    // Historical diffing
    const history = await getAuditHistory(result.url);
    const prev = history && history.length > 0 ? history[0] : null;
    const diff = prev ? computeAuditDiff(prev, result) : null;

    await saveAuditSnapshot({
      url: result.url,
      timestamp: Date.now(),
      score: result.score,
      level: result.level,
      dimensions: result.dimensions,
    });

    const durationMs = Date.now() - startTime;

    // Update Badge
    await updateTabBadge(tabId, String(result.score), badgeColorForScore(result.score));

    // Save ready state in session storage
    const readyState = {
      tabId,
      status: 'ready',
      url: result.url,
      title,
      updatedAt: Date.now(),
      data: {
        result,
        ssrDiff,
        soft404Map,
        authenticatedFallback,
        ssrFetchError,
        diff,
        smokeTest,
        fixFiles,
        durationMs,
      },
    };

    await setSessionState(tabId, readyState);
    return readyState;
  } catch (err) {
    const isPermissionError = /permission|cannot access|missing host permission|access denied/i.test(
      err?.message || ''
    );
    const status = isPermissionError ? 'needs_permission' : 'error';
    const errorState = {
      tabId,
      status,
      url: rawUrl,
      title: tab.title || '',
      error: err ? err.message : 'Audit failed',
      updatedAt: Date.now(),
    };

    await updateTabBadge(tabId, '!', isPermissionError ? '#ca8a04' : '#dc2626');
    await setSessionState(tabId, errorState);
    return errorState;
  }
}

export async function runSilentBadgeCheckForTab(tab) {
  if (!tab || !tab.id || !tab.url || isRestrictedUrl(tab.url)) return null;
  const tabId = tab.id;

  try {
    if (chrome.scripting && typeof chrome.scripting.executeScript === 'function') {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
    }

    const resp = await chrome.tabs.sendMessage(tabId, { type: 'COLLECT_GEO_DATA' });
    if (!resp || !resp.ok || !resp.payload) return null;

    const payload = resp.payload;
    const csrHtml = payload.csrHtml || '';
    const targetUrl = payload.url || tab.url;
    const ssrRes = payload.ssr || {};
    const endpoints = payload.endpoints || {};

    const soft404Map = inspectCollectedEndpoints(endpoints, payload.origin);

    const settings = await getSettings();
    const lang = resolveLang(settings?.langPref);

    const result = analyzeAuditPayload({
      url: targetUrl,
      pageHtml: csrHtml,
      responseHeaders: ssrRes.headers || {},
      robotsTxt: soft404Map.robots.valid ? soft404Map.robots.cleanBody : null,
      llmsTxt: soft404Map.llms.valid ? soft404Map.llms.cleanBody : null,
      sitemapXml: soft404Map.sitemap.valid ? soft404Map.sitemap.cleanBody : null,
      aiTxt: soft404Map.aiTxt.valid ? soft404Map.aiTxt.cleanBody : null,
      aiSummary: soft404Map.aiSummary.valid ? soft404Map.aiSummary.cleanBody : null,
      aiFaq: soft404Map.aiFaq.valid ? soft404Map.aiFaq.cleanBody : null,
      aboutHtml: endpoints.about && endpoints.about.ok ? endpoints.about.body : null,
      contentHtml: endpoints.content && endpoints.content.ok ? endpoints.content.body : null,
      lang,
      rawHtmlLimit: 12000,
    });

    await updateTabBadge(tabId, String(result.score), badgeColorForScore(result.score));
    return result;
  } catch {
    return null;
  }
}

// User clicked extension action icon
if (typeof chrome !== 'undefined' && chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener((tab) => {
    // MUST call sidePanel.open synchronously on line 1 without await to preserve user gesture
    if (chrome.sidePanel && typeof chrome.sidePanel.open === 'function' && tab?.windowId) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
    }
    if (tab) {
      runAuditForTab(tab).catch(() => {});
    }
  });
}

export async function handleRuntimeMessage(msg, sender) {
  if (!msg || !msg.type) return null;

  if (msg.type === 'SIDEPANEL_READY') {
    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      return { status: 'no_active_tab' };
    }
    const existing = await getSessionState(tab.id);
    if (existing && (existing.status === 'ready' || existing.status === 'scanning')) {
      return existing;
    }
    if (tab.url && isRestrictedUrl(tab.url)) {
      return {
        tabId: tab.id,
        status: 'restricted',
        url: tab.url,
      };
    }
    return {
      tabId: tab.id,
      status: 'standby',
      url: tab.url || '',
      title: tab.title || '',
      hasUrlAccess: Boolean(tab.url),
    };
  }

  if (msg.type === 'SCAN_CURRENT_TAB') {
    let targetTab;
    if (msg.tabId && chrome.tabs?.get) {
      try {
        targetTab = await chrome.tabs.get(msg.tabId);
      } catch {}
    }
    if (!targetTab) {
      targetTab = await getActiveTab();
    }
    if (!targetTab || !targetTab.id) {
      return { status: 'no_active_tab' };
    }
    return await runAuditForTab(targetTab);
  }

  if (msg.type === 'RESCAN_ACTIVE_TAB') {
    let targetTab;
    if (msg.tabId && chrome.tabs?.get) {
      try {
        targetTab = await chrome.tabs.get(msg.tabId);
      } catch {}
    }
    if (!targetTab) {
      targetTab = await getActiveTab();
    }
    if (!targetTab || !targetTab.id) {
      return { status: 'no_active_tab' };
    }
    return await runAuditForTab(targetTab);
  }

  if (msg.type === 'GET_ACTIVE_TAB_INFO') {
    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      return { tabId: null, url: '', title: '', restricted: false };
    }
    return {
      tabId: tab.id,
      url: tab.url || '',
      title: tab.title || '',
      restricted: tab.url ? isRestrictedUrl(tab.url) : false,
    };
  }

  if (msg.type === 'XRAY_HIGHLIGHT' || msg.type === 'XRAY_CLEAR') {
    let targetTabId = msg.tabId;
    if (!targetTabId) {
      const activeTab = await getActiveTab();
      targetTabId = activeTab?.id;
    }
    if (!targetTabId) {
      return { ok: false, errorCode: 'tab_closed', error: 'No active tab found' };
    }

    let targetTab;
    try {
      if (chrome.tabs?.get) {
        targetTab = await chrome.tabs.get(targetTabId);
      }
    } catch {
      return { ok: false, errorCode: 'tab_closed', error: 'Target tab closed' };
    }
    if (!targetTab) {
      return { ok: false, errorCode: 'tab_closed', error: 'Target tab closed' };
    }

    let origin = '';
    try {
      if (targetTab.url) origin = new URL(targetTab.url).origin;
    } catch {}

    if (msg.type === 'XRAY_HIGHLIGHT') {
      const activeTab = await getActiveTab();
      if (activeTab && activeTab.id !== targetTabId) {
        try {
          if (chrome.tabs?.update) {
            await chrome.tabs.update(targetTabId, { active: true });
          }
          if (targetTab.windowId && chrome.windows?.update) {
            await chrome.windows.update(targetTab.windowId, { focused: true }).catch(() => {});
          }
        } catch {}
      }
    }

    try {
      if (chrome.scripting && typeof chrome.scripting.executeScript === 'function') {
        await chrome.scripting.executeScript({
          target: { tabId: targetTabId },
          files: ['content.js'],
        });
      }
    } catch (err) {
      return { ok: false, errorCode: 'needs_permission', origin, error: err?.message };
    }

    try {
      const resp = await chrome.tabs.sendMessage(targetTabId, msg);
      return resp || { ok: true };
    } catch (err) {
      return { ok: false, errorCode: 'needs_permission', origin, error: err?.message };
    }
  }

  if (msg.type === 'AUTO_BADGE_SETTING_CHANGED') {
    const settings = await getSettings();
    if (settings && settings.autoBadge) {
      const activeTab = await getActiveTab();
      if (activeTab && activeTab.id && activeTab.url && !isRestrictedUrl(activeTab.url)) {
        await runSilentBadgeCheckForTab(activeTab);
      }
    }
    return { ok: true };
  }

  return null;
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    handleRuntimeMessage(msg, sender)
      .then((res) => {
        sendResponse(res);
      })
      .catch((err) => {
        sendResponse({ status: 'error', error: err ? err.message : 'Internal error' });
      });
    return true; // asynchronous sendResponse
  });
}

// Optional auto-badge monitoring on completed navigations
if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onUpdated) {
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    if (!tab || !tab.url || isRestrictedUrl(tab.url)) return;

    try {
      const settings = await getSettings();
      if (!settings || !settings.autoBadge) return;

      if (!chrome.permissions || typeof chrome.permissions.contains !== 'function') return;
      const hasPermission = await chrome.permissions.contains({
        origins: ['https://*/*', 'http://*/*'],
      });
      if (!hasPermission) return;

      await runSilentBadgeCheckForTab(tab);
    } catch {}
  });
}

// Cleanup tab state on close
if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener((tabId) => {
    removeSessionState(tabId).catch(() => {});
  });
}
