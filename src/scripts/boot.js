/**
 * GeoScore boot script - Vite entry point
 * Astro will bundle all imported modules into a single file
 */
import { auditUrl } from '../lib/scanner.js';
import { addToHistory, getHistory, getUrlHistory, getComparisonData } from '../lib/history.js';
import { exportMarkdown, exportJson, exportCsv, exportHtml } from '../lib/export.js';
import { renderScoreHeader } from '../components/reportHeader.js';
import { renderRadarContainer, initRadarChart } from '../components/radarChart.js';
import { renderDimensionBreakdown } from '../components/dimensionBreakdown.js';
import { renderNegativeSignals } from '../components/negativeSignals.js';
import { renderSeoSupplement } from '../components/seoSupplement.js';
import { renderFixesPanel } from '../components/fixesPanel.js';
import { renderFixFilesPanel } from '../components/fixFilesPanel.js';
import { generateFixFiles } from '../lib/fixGenerator.js';
import { renderExportButtons } from '../components/exportButtons.js';
import { renderShareButtons } from '../components/shareButtons.js';
import { normalizeAuditUrl } from '../lib/auditUrl.js';
import { renderHistoryList } from '../components/historyList.js';
import { renderTrendContainer, initTrendChart } from '../components/trendChart.js';
import { renderComparisonPanel } from '../components/comparisonPanel.js';
import { initSitesPanel } from '../components/sitesPanel.js';
import { showToast } from './toast.js';
import { saveAuditToCloud } from '../components/auditHistory.js';
import { renderUpgradeCta } from '../components/upgradeCta.js';

var radarChartInstance = null;
var trendChartInstance = null;
var scanTimer = null;
var loadingHtml = null;

var IS_ZH = (document.documentElement.lang || 'en').toLowerCase().indexOf('zh') === 0;
function t(en, zh) { return IS_ZH ? zh : en; }

function getGeoSource() {
  return typeof window.geoSource === 'function' ? window.geoSource() : 'other';
}

function geoUrlDomain(value) {
  try { return new URL(value).hostname; } catch (e) { return ''; }
}

// Unified score buckets: <60 low / 60-67 mid / >=68 high (no overlap with 68)
function scoreBucket(score) {
  if (score < 60) return 'low';
  if (score < 68) return 'mid';
  return 'high';
}

function geoErrorCode(error) {
  var message = String(error && error.message || '').toLowerCase();
  if (message.includes('abort') || message.includes('timeout')) return 'timeout';
  if (message.includes('fetch') || message.includes('network')) return 'fetch_failed';
  if (message.includes('parse') || message.includes('json')) return 'parse_error';
  if (message.includes('rate limit') || message.includes('429')) return 'rate_limited';
  if (message.includes('server') || message.includes('500')) return 'server_error';
  return 'unknown';
}

function activateTabPanel(container, tabAttr, panelAttr, activeId, opts) {
  if (!container) return null;
  var activeTab = null;
  container.querySelectorAll('[' + tabAttr + ']').forEach(function(tab) {
    var isMatch = tab.getAttribute(tabAttr) === activeId;
    tab.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    tab.setAttribute('tabindex', isMatch ? '0' : '-1');
    if (isMatch) {
      tab.setAttribute('focusgroupstart', '');
      activeTab = tab;
    } else {
      tab.removeAttribute('focusgroupstart');
    }
  });
  container.querySelectorAll('[' + panelAttr + ']').forEach(function(panel) {
    var isMatch = panel.getAttribute(panelAttr) === activeId;
    if (isMatch) {
      panel.removeAttribute('hidden');
      if (!panel.querySelector('a[href], button, input, select, textarea')) {
        panel.setAttribute('tabindex', '0');
      } else {
        panel.removeAttribute('tabindex');
      }
    } else {
      panel.setAttribute('hidden', 'until-found');
      panel.removeAttribute('tabindex');
    }
  });
  if (activeTab && typeof activeTab.scrollIntoView === 'function') {
    try { activeTab.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
  }
  if (opts && opts.focusTab && activeTab) activeTab.focus();
  return activeTab;
}

function handleTablistKeydown(e, tabSelector, onSelect) {
  var tab = e.target.closest(tabSelector);
  if (!tab) return;
  var tablist = tab.closest('[role="tablist"]');
  if (!tablist) return;
  var tabs = Array.prototype.slice.call(tablist.querySelectorAll(tabSelector));
  var idx = tabs.indexOf(tab);
  if (idx === -1) return;
  var nextIdx = -1;
  if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
  else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
  else if (e.key === 'Home') nextIdx = 0;
  else if (e.key === 'End') nextIdx = tabs.length - 1;
  if (nextIdx === -1) return;
  e.preventDefault();
  onSelect(tabs[nextIdx]);
}

function selectHeroModeTab(mode, opts) {
  var tablist = document.getElementById("hero-mode-tablist");
  if (!tablist || !tablist.parentElement) return;
  activateTabPanel(tablist.parentElement, 'data-mode-tab', 'data-mode-panel', mode, opts);
  if (mode === 'compare') {
    populateCompareList();
  }
  if (!opts || (!opts.focusTab && opts.focusInput !== false)) {
    if (mode === 'batch') {
      var sitemapEl = document.getElementById('sitemap-url');
      if (sitemapEl) sitemapEl.focus();
    } else if (mode === 'single') {
      var urlEl = document.getElementById('url-input');
      if (urlEl) urlEl.focus();
    }
  }
}

function selectStackTab(stackId, opts) {
  var reportRoot = document.getElementById('report-section');
  if (!reportRoot) return;
  activateTabPanel(reportRoot, 'data-stack-tab', 'data-stack-panel', stackId, opts);
}

window.showBatchInput = function() {
  if (document.getElementById("hero-mode-tablist")) {
    selectHeroModeTab('batch');
    return;
  }
  var el = document.getElementById("batch-section");
  if (el) el.classList.toggle("hidden");
};

window.showComparison = function() {
  if (document.getElementById("hero-mode-tablist")) {
    selectHeroModeTab('compare');
    return;
  }
  var el = document.getElementById("compare-section");
  if (el) {
    el.style.display = el.style.display === "none" ? "block" : "none";
    if (el.style.display !== "none") populateCompareList();
  }
};

function populateCompareList() {
  var root = document.getElementById("compare-list");
  if (!root) return;
  var history = getHistory();
  if (history.length < 2) {
    root.innerHTML = '<p class="text-xs text-gray-400 py-2">' + t("Audit at least 2 sites first.", "请先审计至少 2 个站点。") + '</p>';
    return;
  }
  root.innerHTML = history.slice(0, 10).map(function(e) {
    var lc = e.level === "Excellent" ? "text-geo-500" : e.level === "Good" ? "text-brand-500" : e.level === "Basic" ? "text-warn-500" : "text-danger-500";
    return '<label class="flex items-center gap-2 py-1 px-2 card-hover rounded cursor-pointer text-sm">' +
      '<input type="checkbox" class="compare-cb" value="' + e.id + '" />' +
      '<span class="flex-1 text-gray-300 truncate">' + e.url + '</span>' +
      '<span class="font-mono text-xs font-bold ' + lc + '">' + e.score + '</span></label>';
  }).join("");
}

window.runComparison = function() {
  var cbs = document.querySelectorAll(".compare-cb:checked");
  var ids = Array.from(cbs).map(function(cb) { return cb.value; });
  var history = getHistory();
  var selected = history.filter(function(e) { return ids.indexOf(e.id) >= 0; });
  if (selected.length < 2) return;
  if (document.getElementById("hero-mode-tablist")) {
    selectHeroModeTab('single', { focusInput: false });
  } else {
    var compareSec = document.getElementById("compare-section");
    if (compareSec) compareSec.style.display = "none";
  }
  var reportRoot = document.getElementById("report-section");
  var comparisonHtml = renderComparisonPanel(selected);
  if (comparisonHtml && reportRoot) {
    reportRoot.classList.remove("hidden");
    reportRoot.style.opacity = "1";
    var div = document.createElement("div");
    div.innerHTML = comparisonHtml;
    var exportSection = reportRoot.querySelector(".stagger-section.fade-in-delay-7");
    if (exportSection) {
      exportSection.parentNode.insertBefore(div.firstElementChild, exportSection);
    } else {
      reportRoot.appendChild(div.firstElementChild);
    }
  }
};

window.startBatchAudit = async function() {
  var input = document.getElementById("sitemap-url");
  var url = (input.value || "").trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  var progress = document.getElementById("batch-progress");
  var bar = document.getElementById("batch-bar");
  var status = document.getElementById("batch-status");
  var results = document.getElementById("batch-results");
  progress.classList.remove("hidden");
  results.innerHTML = t("Fetching sitemap...", "正在获取 sitemap...");
  try {
    var resp = await fetch(url);
    var text = await resp.text();
    var urls = extractUrlsFromSitemap(text);
    if (urls.length === 0) { results.innerHTML = t("No URLs found in sitemap.", "sitemap 中未找到 URL。"); return; }
    if (urls.length > 20) { results.innerHTML = t("Found " + urls.length + " URLs. Auditing first 20.", "找到 " + urls.length + " 个 URL，将审计前 20 个。"); urls = urls.slice(0, 20); }
    results.innerHTML = "";
    var completed = 0;
    for (var i = 0; i < urls.length; i++) {
      status.textContent = t("Scanning ", "正在扫描 ") + (i + 1) + "/" + urls.length + ": " + urls[i];
      bar.style.width = ((i / urls.length) * 100) + "%";
      try {
        var r = await auditUrl(urls[i]);
        completed++;
        var lc = r.level === "Excellent" ? "text-geo-500" : r.level === "Good" ? "text-brand-500" : r.level === "Basic" ? "text-warn-500" : "text-danger-500";
        results.innerHTML += '<div class="flex justify-between py-1 ' + ((i % 2 === 0) ? "bg-white/5" : "") + ' px-2 rounded"><span class="truncate mr-2 text-gray-300">' + urls[i] + '</span><span class="font-mono text-xs font-bold ' + lc + '">' + r.score + '</span></div>';
      } catch (e) {
        results.innerHTML += '<div class="flex justify-between py-1 px-2 rounded text-danger-500"><span class="truncate mr-2">' + urls[i] + '</span><span class="text-xs">' + t("Error", "错误") + '</span></div>';
      }
    }
    bar.style.width = "100%";
    status.textContent = t("Completed: ", "已完成：") + completed + "/" + urls.length + t(" URLs", " 个 URL");
  } catch (e) {
    results.innerHTML = t("Error: ", "错误：") + e.message;
  }
};

function extractUrlsFromSitemap(xml) {
  var urls = [];
  var regex = /<loc[^>]*>([^<]+)<\/loc>/gi;
  var match;
  while ((match = regex.exec(xml)) !== null) urls.push(match[1].trim());
  return urls;
}

// Inline error shown under the audit input. Created on demand so it works on
// every page that owns a #url-input without touching each .astro file.
function geoShowUrlError(message) {
  var input = document.getElementById("url-input");
  if (!input) return;
  var box = document.getElementById("url-error");
  if (!box) {
    box = document.createElement("p");
    box.id = "url-error";
    box.setAttribute("role", "alert");
    box.className = "text-danger-500 text-sm mt-2";
    var anchor = input.closest(".flex") || input.parentElement;
    if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(box, anchor.nextSibling);
  }
  box.textContent = message;
  input.setAttribute("aria-invalid", "true");
}

function geoClearUrlError() {
  var box = document.getElementById("url-error");
  if (box && box.parentElement) box.parentElement.removeChild(box);
  var input = document.getElementById("url-input");
  if (input) input.removeAttribute("aria-invalid");
}

window.startAudit = async function (entryPoint) {
  var input = document.getElementById("url-input");
  var btn = document.getElementById("audit-btn");
  // Reject before the loading state takes over. Once it does, the hero (and the
  // input with it) is hidden, so a typo used to mean 45s+ of waiting with no way
  // back to fix it. See src/lib/auditUrl.js.
  var parsedUrl = normalizeAuditUrl(input.value);
  if (!parsedUrl) {
    geoShowUrlError(t("Enter a website address like example.com", "请输入网址，例如 example.com"));
    input.focus();
    return;
  }
  geoClearUrlError();
  var url = parsedUrl.url;
  var loadEl = document.getElementById("loading-section");
  var reportEl = document.getElementById("report-section");
  if (!loadEl || !reportEl) {
    // Pages without the audit containers (e.g. /tools/*) bounce to the homepage
    // audit flow, which owns the loading + report UI. entry_point is preserved via &src=.
    var base = /^\/zh(\/|$)/.test(window.location.pathname) ? '/zh/' : '/';
    // Carry the originating tool's slug along. A headed-browser run measured
    // the bounce itself at 329ms, so the jump is not what loses people — what
    // loses them is that the landing page carries no trace of where the audit
    // came from (verified: anySrcIndicatorInReport = false). The homepage uses
    // this to label the run.
    var slug = window.location.pathname.replace(/\/+$/, '').split('/').pop() || '';
    window.location.href = base + '?audit=' + encodeURIComponent(url) + '&src=tool_page&tool=' + encodeURIComponent(slug);
    return;
  }
  // Keep (or restore) the pristine loading markup so "Try Again" can re-run in place.
  if (loadingHtml === null) loadingHtml = loadEl.innerHTML;
  else loadEl.innerHTML = loadingHtml;
  btn.disabled = true;
  btn.textContent = t("Scanning\u2026", "扫描中\u2026");
  geoHide(document.getElementById("hero-section"));
  reportEl.classList.add("hidden");
  loadEl.classList.remove("hidden");
  loadEl.style.opacity = "0";
  loadEl.style.transition = "none";
  void loadEl.offsetHeight; // force reflow
  loadEl.style.transition = "opacity 0.3s ease";
  loadEl.style.opacity = "1";
  document.getElementById("scanning-url").textContent = url;
  var stepIdx = 0;
  var steps = document.querySelectorAll(".scan-step");
  steps.forEach(function(s) { s.className = "scan-step"; });
  if (steps.length > 0) steps[0].classList.add("active");
  if (scanTimer) clearInterval(scanTimer);
  scanTimer = setInterval(function() {
    if (stepIdx < steps.length) {
      steps[stepIdx].classList.remove("active");
      steps[stepIdx].classList.add("done");
      stepIdx++;
      if (stepIdx < steps.length) steps[stepIdx].classList.add("active");
    }
  }, 350);
  try {
    var targetUrl = url;
    if (!/^https?:\/\//i.test(targetUrl)) targetUrl = "https://" + targetUrl;
    var t0 = performance.now();
    if (typeof window.geoTrack === 'function') window.geoTrack('audit_started', { url_domain: geoUrlDomain(targetUrl), source_type: getGeoSource(), entry_point: entryPoint || 'home' });
    var result = await auditUrl(targetUrl);
    addToHistory(result);
    localStorage.setItem("geoscope_last_result", JSON.stringify(result));
    if (typeof window.geoTrack === 'function') window.geoTrack('audit_completed', { url_domain: geoUrlDomain(targetUrl), score: result.score, level: result.level, score_bucket: scoreBucket(result.score), duration_ms: Math.round(performance.now() - t0), source_type: getGeoSource() });
    clearInterval(scanTimer);
    var reportEl = document.getElementById("report-section");
    var loadEl = document.getElementById("loading-section");
    // Hide loading section
    loadEl.style.transition = "opacity 0.2s ease";
    loadEl.style.opacity = "0";
    setTimeout(function() {
      loadEl.classList.add("hidden");
      // Render report content BEFORE showing the container
      renderReport(result);
      // Now show the report section
      reportEl.classList.remove("hidden");
      reportEl.style.opacity = "0";
      reportEl.style.transition = "none";
      void reportEl.offsetHeight; // force reflow
      reportEl.style.transition = "opacity 0.3s ease";
      reportEl.style.opacity = "1";
      renderHistory();
      maybeShowSaveCloud(result);
    }, 200);
    var history = getHistory();
    var compareLink = document.getElementById("compare-link");
    if (history.length >= 2 && compareLink) {
      compareLink.style.display = "inline";
    }
  } catch (err) {
    clearInterval(scanTimer);
    // targetUrl, not url: url is the raw #url-input value and may lack the
    // https:// prefix that boot.js:195 adds, so new URL(url) throws and
    // geoUrlDomain() silently returns '' — the one audit event whose domain we
    // most need (the failure) was the only one reporting none.
    if (typeof window.geoTrack === 'function') window.geoTrack('audit_failed', { url_domain: geoUrlDomain(targetUrl), error_code: geoErrorCode(err), source_type: getGeoSource() });
    var extTipHtml = '<div class="mt-6 pt-5 border-t border-gray-700/60 text-left bg-brand-500/5 rounded-xl p-4 border border-brand-500/20">' +
      '<div class="flex items-start gap-3">' +
        '<span class="text-xl">🛡️</span>' +
        '<div class="flex-1">' +
          '<div class="font-semibold text-white text-sm mb-1">' +
            t("Hit a WAF / CORS block or auditing Localhost?", "遇到 WAF / CORS 拦截或正在调试 Localhost？") +
          '</div>' +
          '<p class="text-xs text-gray-300 leading-relaxed mb-3">' +
            t("Install the official GeoScore Chrome Extension to audit directly inside your current tab. It bypasses Cloudflare/anti-bot blocks, inspects live rendered DOM, and works on localhost and password-protected pages.",
              "建议安装使用 GeoScore Chrome 官方插件，直接在当前标签页内完成审计。可绕过 Cloudflare 与 WAF 防火墙限制，支持本地 Localhost、登录态页面与真实渲染 DOM。") +
          '</p>' +
          '<a href="https://chromewebstore.google.com/detail/geoscore-free-geo-aeo-llm/cboppgehhkhaamcgfcikhekkdaelichn" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-geo-600 to-brand-600 hover:from-geo-500 hover:to-brand-500 transition">' +
            t("Get GeoScore Chrome Extension →", "安装 GeoScore 官方插件 →") +
          '</a>' +
        '</div>' +
      '</div>' +
    '</div>';
    document.getElementById("loading-section").innerHTML = '<div class="card p-8 text-center" role="alert"><div class="text-danger-500 text-lg font-semibold mb-2">' + t("Audit Failed", "审计失败") + '</div><p class="text-gray-400 text-sm mb-4">' + err.message + '</p><button id="audit-retry" class="px-4 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/20 transition">' + t("Try Again", "重试") + '</button>' + extTipHtml + '</div>';
    var retryBtn = document.getElementById("audit-retry");
    if (retryBtn) retryBtn.addEventListener("click", function() { window.startAudit(entryPoint); });
  }
  btn.disabled = false;
  btn.textContent = t("Start Audit", "开始审计");
};

// Smooth show/hide helpers (opacity-based, not display: none)
function geoShow(el) {
  if (!el) return;
  el.classList.remove("hidden");
  el.style.opacity = "0";
  el.style.transition = "none";
  // Force reflow to ensure the opacity:0 takes effect before transition
  void el.offsetHeight;
  el.style.transition = "opacity 0.3s ease";
  el.style.opacity = "1";
}
function geoHide(el) {
  if (!el) return;
  el.style.transition = "opacity 0.2s ease";
  el.style.opacity = "0";
  setTimeout(function() { el.classList.add("hidden"); }, 200);
}

var resultViewedTimer = null;
// Monotonic token identifying the newest report. A report that has been
// superseded (the visitor started another audit) must never report, even if its
// own timer or IntersectionObserver fires late — otherwise one visit reports
// result_viewed twice, the stale event carrying the previous report's score.
var resultViewedRun = 0;
// Fire result_viewed once the score header is actually seen (not just rendered),
// to avoid systematically inflating the denominator on long reports.
// gtag() only exists after the visitor opts in (Layout.astro + consent.js), so a
// report rendered before consent must NOT consume the one-shot latch — otherwise
// the event is dropped for good, which is exactly how result_viewed ended up
// near-zero in GA4 while audit_completed kept arriving. Retry on a bounded
// budget instead; once it is spent we disconnect and clear, so neither the
// observer nor a timer is leaked.
function setupResultViewed(root, r) {
  var header = root.querySelector('.stagger-section');
  if (!header) return;
  var RETRY_MS = 1000;
  var MAX_ATTEMPTS = 30;               // ~30s window for a late consent click
  var run = ++resultViewedRun;         // supersedes any previous report
  var fired = false;
  var attempts = 0;
  var observer = null;
  var myTimer = null;
  function canTrack() {
    // Mirrors exactly what geoTrack() checks internally, so "not ready" here
    // means geoTrack() would have been a silent no-op anyway.
    return typeof window.geoTrack === 'function' && typeof window.gtag === 'function';
  }
  function stop() {
    if (observer) { observer.disconnect(); observer = null; }
    if (myTimer !== null) {
      clearTimeout(myTimer);
      // Only release the shared slot if it is still ours; a newer audit owns it otherwise.
      if (resultViewedTimer === myTimer) resultViewedTimer = null;
      myTimer = null;
    }
  }
  function arm(delay) {
    if (myTimer !== null) clearTimeout(myTimer);
    myTimer = setTimeout(fire, delay);
    // Keep the shared slot pointing at the live timer of the newest report, so
    // the next setupResultViewed() cancels this chain instead of a dead id.
    resultViewedTimer = myTimer;
  }
  function fire() {
    if (fired) return;
    if (run !== resultViewedRun) { stop(); return; }   // superseded: never report
    if (myTimer !== null) {
      // The timer that brought us here (if any) is spent; drop it from the slot
      // before deciding, so a retry below re-arms with a live id.
      if (resultViewedTimer === myTimer) resultViewedTimer = null;
      clearTimeout(myTimer);
      myTimer = null;
    }
    if (!canTrack()) {
      // Consent has not arrived yet. Leave `fired` false so a later attempt can
      // still send; no third-party request happens in the meantime.
      attempts++;
      if (attempts >= MAX_ATTEMPTS) { stop(); return; }
      arm(RETRY_MS);
      return;
    }
    fired = true;
    if (observer) { observer.disconnect(); observer = null; }
    window.geoTrack('result_viewed', {
      score: r.score,
      score_bucket: scoreBucket(r.score),
      level: r.level,
      source_type: getGeoSource()
    });
  }
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(function(entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting && entries[i].intersectionRatio >= 0.5) { fire(); break; }
      }
    }, { threshold: 0.5 });
    observer.observe(header);
  }
  // 3s fallback to prevent coverage collapse if IO never fires. A retry re-arms
  // the same timer until the event lands or the budget runs out.
  if (resultViewedTimer !== null) clearTimeout(resultViewedTimer);
  arm(3000);
}

// Queried at call time so a mid-session preference change is honoured.
function prefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function renderSpaDomNotice(r) {
  try {
    var cq = r && r.dimensions && r.dimensions.contentQuality;
    if (!cq || !Array.isArray(cq.checks)) return '';
    var wcCheck = cq.checks.find(function(c) { return c && c.id === 'wordcount'; });
    if (!wcCheck || wcCheck.passed) return '';
    var match = /\b(\d+)\s+words\b/i.exec(wcCheck.label || '');
    var wordCount = match ? parseInt(match[1], 10) : -1;
    if (wordCount >= 100 && wordCount !== -1) return '';

    var wordsDisplay = wordCount >= 0 ? wordCount : 0;
    var zh = (document.documentElement.lang || 'en').toLowerCase().indexOf('zh') === 0;
    return '<div class="card p-5 mb-8 border-brand-500/40 bg-brand-500/5 stagger-section">' +
      '<div class="flex items-start gap-3 text-left">' +
        '<span class="text-xl">💡</span>' +
        '<div class="flex-1">' +
          '<h3 class="text-sm font-semibold text-white mb-1">' +
            (zh ? '疑似客户端 JS 渲染单页应用（SPA）— 字数极低（仅 ' + wordsDisplay + ' 词）' : 'Possible Client-Rendered App (SPA) — Low Word Count (' + wordsDisplay + ' words)') +
          '</h3>' +
          '<p class="text-xs text-gray-300 leading-relaxed mb-3">' +
            (zh ? '服务端返回的原始静态 HTML 中有效正文过少。大多数 AI 搜索引擎爬虫（如 GPTBot、ClaudeBot）仅抓取初始 HTML，不执行客户端复杂脚本。建议使用 <strong class="text-brand-400">GeoScore Chrome 官方插件</strong> 对比 SSR 初始 HTML 与浏览器渲染后真实 DOM，排查可见性盲区。' : 'The raw server HTML contains very little readable text. Major AI crawlers (GPTBot, ClaudeBot, PerplexityBot) often index raw HTML without executing JavaScript. Use the <strong class="text-brand-400">GeoScore Chrome Extension</strong> to compare raw SSR HTML with the live browser-rendered DOM.') +
          '</p>' +
          '<a href="https://chromewebstore.google.com/detail/geoscore-free-geo-aeo-llm/cboppgehhkhaamcgfcikhekkdaelichn" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs text-geo-400 hover:text-geo-300 font-semibold underline underline-offset-2">' +
            (zh ? '使用 Chrome 官方插件对比 DOM →' : 'Compare DOM with Chrome Extension →') +
          '</a>' +
        '</div>' +
      '</div>' +
    '</div>';
  } catch (e) {
    return '';
  }
}

function renderReport(r) {
  if (radarChartInstance) { radarChartInstance.destroy(); radarChartInstance = null; }
  if (trendChartInstance) { trendChartInstance.destroy(); trendChartInstance = null; }
  var root = document.getElementById("report-section");
  var parts = [
    renderScoreHeader(r),
    renderSpaDomNotice(r),
    renderRadarContainer(),
    renderDimensionBreakdown(r.dimensions),
    renderNegativeSignals(r.negativeSignals),
    // 2026-10-23: the fix list used to render 9th, after the upgrade ask (5th).
    // The page asked for money before it said what to do — for a 94-score site
    // the sequence was "you're fine -> but you can't prove it -> buy". Show the
    // actionable list first, then ask.
    renderFixesPanel(r.recommendations),
    renderFixFilesPanel(r),
    renderUpgradeCta(r, 'primary', !!(r && r.raw)),
    renderSeoSupplement(r.seoSupplement),
    renderUpgradeCta(r, 'lead'),
    renderExportButtons(),
    renderShareButtons(r),
    '<div id="save-cloud-root"></div>'
  ];
  root.innerHTML = "<div>" + parts.join("") + "</div>";

  // Funnel step that was missing (2026-10-23 rebuild): the upgrade CTA is part
  // of this render, so its impression is recorded here — clicks alone could
  // not show the view->click drop-off. Deliberately NOT inside the
  // result_viewed consent-retry closure: that path is call-count tested, and
  // this event follows the audit_started pattern (geoTrack no-ops pre-consent).
  if (typeof window.geoTrack === 'function') {
    window.geoTrack('result_cta_impression', {
      score: r.score,
      score_bucket: scoreBucket(r.score),
      // Must name the CTA that is actually rendered. A low scorer's primary ask
      // became result_fixpack on 2026-11-01; while this still said
      // result_monitor the funnel reported impressions for a button that was no
      // longer primary, so result_fixpack showed clicks with zero impressions
      // and the CTA reversal looked like a failure it never got measured for.
      cta_id: scoreBucket(r.score) === 'low' ? 'result_fixpack' : 'result_visibility',
      source_type: getGeoSource()
    });
  }

  // Animate report sections with Web Animations API (reliable for dynamically inserted content)
  var animEls = root.querySelectorAll(".stagger-section");
  if (prefersReducedMotion()) {
    // Skip the entrance animation outright: running it at 0 duration would still
    // flash, and leaving opacity at 0 would hide the whole report.
    animEls.forEach(function(el) { el.style.opacity = "1"; });
  } else {
    animEls.forEach(function(el, i) {
      var delay = Math.min(i, 7) * 80;
      el.style.opacity = "0";
      el.animate([
        { opacity: 0, transform: "translateY(10px)" },
        { opacity: 1, transform: "translateY(0)" }
      ], {
        duration: 500,
        delay: delay,
        fill: "both",
        easing: "cubic-bezier(0.16, 1, 0.3, 1)"
      });
    });
  }

  initRadarChart(r.dimensions).then(function(chart) { radarChartInstance = chart; });
  var urlHistory = getUrlHistory(r.url);
  if (urlHistory.length >= 2) {
    var trendHtml = renderTrendContainer();
    var exportSection = root.querySelector("[class*='fade-in-delay-7']");
    if (exportSection) {
      var trendDiv = document.createElement("div");
      trendDiv.innerHTML = trendHtml;
      exportSection.parentNode.insertBefore(trendDiv.firstElementChild, exportSection);
      var trendEl = root.querySelector("#trend-section");
      if (trendEl) {
        trendEl.style.display = "block";
        if (prefersReducedMotion()) {
          trendEl.style.opacity = "1";
        } else {
          trendEl.style.opacity = "0";
          trendEl.animate([
            { opacity: 0, transform: "translateY(10px)" },
            { opacity: 1, transform: "translateY(0)" }
          ], {
            duration: 500,
            delay: 320,
            fill: "both",
            easing: "cubic-bezier(0.16, 1, 0.3, 1)"
          });
        }
      }
      initTrendChart(urlHistory).then(function(chart) { trendChartInstance = chart; });
    }
  }
  setupResultViewed(root, r);
}

function renderHistory() {
  var root = document.getElementById("history-root");
  if (!root) return;
  root.innerHTML = renderHistoryList(getHistory());
  // Use a single delegated listener — replace node to avoid stacking listeners
  var newRoot = root.cloneNode(false);
  newRoot.innerHTML = root.innerHTML;
  root.parentNode.replaceChild(newRoot, root);
  newRoot.addEventListener("click", function(e) {
    var item = e.target.closest("[data-url]");
    if (item) {
      var url = item.getAttribute("data-url");
      document.getElementById("url-input").value = url;
      window.startAudit('history');
    }
  });
}

document.addEventListener("DOMContentLoaded", function() { renderHistory(); });

// --- Export functionality ---
window.doExport = function(format) {
  if (typeof window.geoTrack === 'function') window.geoTrack('tool_complete', { tool_name: 'report_export', format: format, source_type: getGeoSource() });
  var raw = localStorage.getItem("geoscope_last_result");
  if (!raw) { showToast(t("No audit result to export. Run an audit first.", "没有可导出的审计结果，请先运行一次审计。"), 'info'); return; }
  var r;
  try { r = JSON.parse(raw); } catch(e) { showToast(t("Failed to parse stored result.", "解析已保存的结果失败。"), 'error'); return; }
  var content, mime, ext;
  if (format === "md") {
    content = exportMarkdown(r); mime = "text/markdown"; ext = "md";
  } else if (format === "json") {
    content = exportJson(r); mime = "application/json"; ext = "json";
  } else if (format === "csv") {
    content = exportCsv(r); mime = "text/csv"; ext = "csv";
  } else if (format === "html") {
    content = exportHtml(r); mime = "text/html"; ext = "html";
  } else return;
  var blob = new Blob([content], { type: mime });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "geo-audit-" + (r.url || "result").replace(/^https?:\/\//, "").replace(/[^a-z0-9]/gi, "-") + "." + ext;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
};

// --- Fix file download & preview ---
window.downloadFixFile = function(fileKey) {
  var raw = localStorage.getItem("geoscope_last_result");
  if (!raw) { showToast(t("No audit result found.", "未找到审计结果。"), 'info'); return; }
  var r;
  try { r = JSON.parse(raw); } catch(e) { showToast(t("Failed to parse stored result.", "解析已保存的结果失败。"), 'error'); return; }
  var files = generateFixFiles(r);
  var f = files[fileKey];
  if (!f) return;
  var blob = new Blob([f.content], { type: f.mime });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = f.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  if (typeof window.geoTrack === 'function') window.geoTrack('tool_complete', { tool_name: 'fix_file_download', file: fileKey, source_type: getGeoSource() });
};

window.previewFixFile = function(fileKey) {
  var raw = localStorage.getItem("geoscope_last_result");
  if (!raw) { showToast(t("No audit result found.", "未找到审计结果。"), 'info'); return; }
  var r;
  try { r = JSON.parse(raw); } catch(e) { showToast(t("Failed to parse stored result.", "解析已保存的结果失败。"), 'error'); return; }
  var files = generateFixFiles(r);
  var f = files[fileKey];
  if (!f) return;
  var previewEl = document.getElementById('fix-preview');
  var contentEl = document.getElementById('preview-content');
  var titleEl = document.getElementById('preview-title');
  if (previewEl && contentEl && titleEl) {
    titleEl.textContent = f.filename;
    contentEl.textContent = f.content;
    previewEl.classList.remove('hidden');
  }
};

// --- Copy share link ---
window.copyShareLink = function(auditUrl) {
  var link = 'https://geoscore.help/?audit=' + encodeURIComponent(auditUrl);
  navigator.clipboard.writeText(link).then(function() {
    var label = document.getElementById('copy-label');
    if (label) { label.textContent = t('Copied!', '已复制！'); setTimeout(function() { label.textContent = t('Copy Link', '复制链接'); }, 2000); }
  }).catch(function() {});
};

// --- Result-page CTA handlers (delegated: report-section innerHTML is rebuilt per audit) ---
function handleReportCtaClick(e) {
  var cta = e.target.closest('[data-cta-id]');
  if (!cta) return;
  var ctaId = cta.getAttribute('data-cta-id');
  var action = cta.getAttribute('data-cta-action');
  var placement = cta.getAttribute('data-cta-placement');
  var r = null;
  try { r = JSON.parse(localStorage.getItem('geoscope_last_result') || 'null'); } catch (err) { r = null; }
  var params = { cta_id: ctaId, source_type: getGeoSource(), transport_type: 'beacon' };
  if (placement) params.cta_placement = placement;
  if (r && typeof r.score === 'number') { params.score = r.score; params.score_bucket = scoreBucket(r.score); }
  if (typeof window.geoTrack === 'function') window.geoTrack('upgrade_cta_clicked', params);
  if (action === 'lead-toggle') {
    e.preventDefault();
    var form = document.getElementById('lead-entry-form');
    if (form) form.classList.toggle('hidden');
  } else if (action === 'lead-submit') {
    e.preventDefault();
    submitLead(ctaId, r);
  }
  // primary CTA has no data-cta-action → default anchor navigation proceeds
}

function setLeadStatus(el, msg, isError) {
  if (!el) return;
  el.textContent = msg;
  el.className = 'text-xs mt-3 ' + (isError ? 'text-danger-500' : 'text-geo-500');
}

async function submitLead(ctaId, r) {
  var emailEl = document.getElementById('lead-email');
  var consentEl = document.getElementById('lead-consent');
  var statusEl = document.getElementById('lead-status');
  var email = (emailEl && emailEl.value ? emailEl.value : '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setLeadStatus(statusEl, t('Enter a valid email.', '请输入有效的邮箱。'), true); return; }
  if (!consentEl || !consentEl.checked) { setLeadStatus(statusEl, t('Please check the consent box.', '请勾选同意。'), true); return; }
  if (!window.geoscoreAuth || typeof window.geoscoreAuth.api !== 'function') { setLeadStatus(statusEl, t('Temporarily unavailable, please retry.', '暂时无法提交，请稍后重试。'), true); return; }
  var payload = {
    email: email,
    consent: true,
    cta_id: ctaId,
    host: r ? geoUrlDomain(r.url) : '',
    url: r ? r.url : '',
    score: r && typeof r.score === 'number' ? r.score : null,
    score_bucket: r && typeof r.score === 'number' ? scoreBucket(r.score) : '',
    source_type: getGeoSource()
  };
  setLeadStatus(statusEl, t('Sending\u2026', '发送中\u2026'), false);
  try {
    var res = await window.geoscoreAuth.api('/api/leads', { method: 'POST', body: payload });
    if (res && res.ok) {
      setLeadStatus(statusEl, t('Received. anan will contact you at the email you left about this check.', '已收到。anan 会用你留下的邮箱就本次检测联系你。'), false);
      if (typeof window.geoTrack === 'function') window.geoTrack('lead_submitted', { cta_id: ctaId, score_bucket: payload.score_bucket, source_type: payload.source_type });
    } else {
      setLeadStatus(statusEl, t('Could not submit, please retry.', '提交失败，请重试。'), true);
    }
  } catch (err) {
    setLeadStatus(statusEl, t('Could not submit, please retry.', '提交失败，请重试。'), true);
  }
}

// --- Attribution for audits that were bounced off a tool page ---------------
// The tool pages have no #loading-section / #report-section, so a run started
// there executes here. Without this label the visitor lands on a page with a
// different h1, Home highlighted in the nav and a generic scan panel, and the
// only sensible reading in the first few seconds is "I clicked the wrong
// thing". The slug is validated against the known tool pages and rendered with
// textContent, so a hand-crafted ?tool= cannot inject markup.
var TOOL_PAGE_NAMES = {
  'llms-txt-checker': 'llms.txt Checker',
  'ai-readiness-score': 'AI Readiness Score',
  'robots-txt-ai-checker': 'robots.txt AI Checker',
  'shopify': 'GEO for Shopify',
  'wordpress': 'GEO for WordPress',
  'nextjs': 'GEO for Next.js'
};

function showAuditOrigin(slug) {
  var host = document.getElementById('audit-origin');
  if (!host || !slug) return;
  if (!Object.prototype.hasOwnProperty.call(TOOL_PAGE_NAMES, slug)) return;
  var name = TOOL_PAGE_NAMES[slug];
  var box = document.createElement('div');
  box.className = 'card p-3 text-sm text-gray-400 text-center';
  box.appendChild(document.createTextNode(t('Audit started from ', '本次审计发起自 ')));
  var strong = document.createElement('strong');
  strong.className = 'text-white';
  strong.textContent = name;
  box.appendChild(strong);
  // 清空再挂：这个函数是往容器里 append 的，重复调用会叠出第二条标识。
  // 目前每次加载只调用一次，但让它幂等不花钱。
  host.textContent = '';
  host.appendChild(box);
  host.classList.remove('hidden');
}

// --- Bootstrap: attach click listeners (replaces onclick) ---
document.addEventListener("DOMContentLoaded", function() {
  var ab = document.getElementById("audit-btn");
  // boot.js is shared by the two homepages and all six tool pages, so a
  // hardcoded entry point here reported every tool-page run as "home" and the
  // M2 "tool_page share" metric could never move. Derive it from the path
  // instead. /tools/* and /zh/tools/* are the only non-home paths that render
  // #audit-btn (there is no /tools/ index page), and the two homepages are
  // exactly "/" and "/zh/" — so this stays correct if pages are added later.
  if (ab) ab.addEventListener("click", function() {
    var here = window.location.pathname;
    window.startAudit(/\/(tools|geo-for)\/[^/]+\/?$/.test(here) ? 'tool_page' : 'home');
  });
  var bl = document.getElementById("batch-link");
  if (bl) bl.addEventListener("click", function() { window.showBatchInput(); });
  var bb = document.getElementById("batch-btn");
  if (bb) bb.addEventListener("click", function() { window.startBatchAudit(); });
  var cb = document.getElementById("compare-btn");
  if (cb) cb.addEventListener("click", function() { window.runComparison(); });
  var heroModeTablist = document.getElementById("hero-mode-tablist");
  if (heroModeTablist && heroModeTablist.parentElement) {
    var heroModeContainer = heroModeTablist.parentElement;
    heroModeTablist.addEventListener("click", function(e) {
      var tab = e.target.closest('[data-mode-tab]');
      if (tab) selectHeroModeTab(tab.getAttribute('data-mode-tab'), { focusInput: e.detail > 0 });
    });
    heroModeTablist.addEventListener("keydown", function(e) {
      handleTablistKeydown(e, '[data-mode-tab]', function(nextTab) {
        selectHeroModeTab(nextTab.getAttribute('data-mode-tab'), { focusTab: true, focusInput: false });
      });
    });
    heroModeContainer.addEventListener("beforematch", function(e) {
      var panel = e.target.closest('[data-mode-panel]');
      if (panel) selectHeroModeTab(panel.getAttribute('data-mode-panel'), { focusTab: false, focusInput: false });
    });
  }
  var reportCtaRoot = document.getElementById("report-section");
  if (reportCtaRoot) {
    reportCtaRoot.addEventListener("click", function(e) {
      var badgeBtn = e.target.closest('[data-badge-copy]');
      if (badgeBtn) {
        var format = badgeBtn.getAttribute('data-badge-copy');
        if (format === 'markdown' || format === 'html') {
          var codeEl = reportCtaRoot.querySelector('[data-badge-snippet="' + format + '"]');
          if (codeEl && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(codeEl.textContent || '').then(function() {
              var orig = badgeBtn.getAttribute('data-orig-label') || badgeBtn.textContent;
              badgeBtn.setAttribute('data-orig-label', orig);
              badgeBtn.textContent = t('Copied!', '已复制！');
              setTimeout(function() { badgeBtn.textContent = orig; }, 2000);
            }).catch(function() {});
          }
          if (typeof window.geoTrack === 'function') {
            window.geoTrack('tool_complete', { tool_name: 'badge_copy', format: format });
          }
        }
        return;
      }
      var stackTab = e.target.closest('[data-stack-tab]');
      if (stackTab) {
        selectStackTab(stackTab.getAttribute('data-stack-tab'));
        return;
      }
      handleReportCtaClick(e);
    });
    reportCtaRoot.addEventListener("keydown", function(e) {
      handleTablistKeydown(e, '[data-stack-tab]', function(nextTab) {
        selectStackTab(nextTab.getAttribute('data-stack-tab'), { focusTab: true });
      });
    });
    reportCtaRoot.addEventListener("beforematch", function(e) {
      var panel = e.target.closest('[data-stack-panel]');
      if (panel) selectStackTab(panel.getAttribute('data-stack-panel'), { focusTab: false });
    });
  }

  // --- Pro monitoring panel ---
  initProMonitor();

  // --- URL parameter: auto-start audit from ?audit=url ---
  var params = new URLSearchParams(window.location.search);
  var actionParam = params.get('action');
  // Privacy: ?audit= / ?url= leave the audited site sitting in the address bar,
  // where analytics and ad scripts can read it. Everything below reads `params`,
  // which is already parsed, so the visible URL can be cleaned immediately.
  // A pasted share link still works; it just does not linger in the address bar
  // or in browser history.
  if (window.history && window.history.replaceState &&
      (params.has('audit') || params.has('url') || params.has('action'))) {
    try {
      var leftover = new URLSearchParams(window.location.search);
      leftover.delete('audit');
      leftover.delete('url');
      leftover.delete('src');
      leftover.delete('tool');
      leftover.delete('action');
      var leftoverQs = leftover.toString();
      window.history.replaceState(null, '',
        window.location.pathname + (leftoverQs ? '?' + leftoverQs : '') + (window.location.hash || ''));
    } catch (e) { /* never block an audit on a history failure */ }
  }
  var auditParam = params.get('audit');
  if (auditParam) {
    var cleanUrl = decodeURIComponent(auditParam);
    if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = 'https://' + cleanUrl;
    var urlInput = document.getElementById('url-input');
    if (urlInput) urlInput.value = cleanUrl.replace(/^https?:\/\//, '');
    if (params.get('src') === 'tool_page') showAuditOrigin(params.get('tool'));
    setTimeout(function() { window.startAudit(params.get('src') || 'share_link'); }, 300);
  }

  // --- URL parameter: prefill from ?url=... (D-004 deep link) ---
  // ?audit= is the "run it now" link (it bounces tool pages to the homepage
  // audit flow). ?url= is the "look at this before you run it" link: the input
  // is prefilled but nothing auto-starts, so the user keeps the choice. Absent
  // or unusable values leave the page exactly as it is today.
  var urlParam = params.get('url');
  if (urlParam !== null) {
    var prefill = sanitizeDeepLinkUrl(urlParam);
    var deepInput = document.getElementById('url-input');
    if (deepInput) {
      if (prefill) {
        // Assign through .value, never innerHTML: the parameter is untrusted
        // and must not become markup.
        deepInput.value = prefill;
        deepInput.setAttribute('data-deeplink', 'filled');

        if (actionParam === 'full_scan') {
          if (document.getElementById('hero-mode-tablist')) {
            selectHeroModeTab('batch', { focusInput: false });
          }
          var batchSec = document.getElementById('batch-section');
          if (batchSec) {
            batchSec.classList.remove('hidden');
          }
          var sitemapInput = document.getElementById('sitemap-url');
          if (sitemapInput) {
            try {
              var originUrl = new URL(/^https?:\/\//i.test(prefill) ? prefill : 'https://' + prefill);
              sitemapInput.value = originUrl.origin + '/sitemap.xml';
            } catch (e) {
              sitemapInput.value = 'https://' + prefill + '/sitemap.xml';
            }
          }
          var tipMsg = t(
            'Click Start Batch Scan to run a full-site audit, or upgrade to Pro for weekly automated monitoring.',
            '点击「开始批量扫描」进行全站扫描，或升级 Pro 开启每周监控。'
          );
          showToast(tipMsg, 'info');
          if (batchSec && !document.getElementById('batch-fullscan-hint')) {
            var hintDiv = document.createElement('div');
            hintDiv.id = 'batch-fullscan-hint';
            hintDiv.className = 'mb-3 p-3 rounded-lg bg-brand-500/10 border border-brand-500/30 text-xs text-brand-300 font-medium flex items-center justify-between gap-2';
            hintDiv.textContent = tipMsg;
            var batchBtn = document.getElementById('batch-btn');
            var batchRow = batchBtn ? batchBtn.parentNode : null;
            if (batchBtn && batchBtn.parentNode === batchSec) {
              batchSec.insertBefore(hintDiv, batchBtn);
            } else if (batchRow && batchRow.parentNode === batchSec) {
              batchSec.insertBefore(hintDiv, batchRow);
            } else {
              batchSec.prepend(hintDiv);
            }
          }
        }
      } else {
        // Unusable value: stay on an empty input and say so without blocking.
        // showToast, not alert — M2 cleared alert() site-wide.
        showToast(t('That link had an invalid website URL. Enter one to continue.', '该链接的网址无效，请手动输入后继续。'), 'info');
        deepInput.setAttribute('data-deeplink', 'invalid');
      }
    }
  }
});

// --- D-004 deep link: validate ?url= before it reaches the input ---
// Returns the bare host+path to prefill, or null when the value cannot be used.
// Deliberately never throws: URL() rejects things the user may plausibly type
// (spaces, bare words), and a bad ?url= must degrade to "empty input", not a
// broken page. Mirrors what lib/scanner.js normalizeUrl accepts, minus the throw.
function sanitizeDeepLinkUrl(raw) {
  if (typeof raw !== 'string') return null;
  var v = raw.trim();
  if (!v) return null;
  if (v.length > 255) return null;               // longer than any real host+path
  if (/\s/.test(v)) return null;                 // spaces are never valid here
  if (/^javascript:/i.test(v) || /^data:/i.test(v) || /^vbscript:/i.test(v)) return null;
  var withProto = /^https?:\/\//i.test(v) ? v : 'https://' + v;
  var u;
  try {
    u = new URL(withProto);
  } catch (e) {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  if (!u.hostname || u.hostname.indexOf('.') === -1) return null;  // needs a dot
  if (!/^[a-z0-9.-]+$/i.test(u.hostname)) return null;
  return u.host + u.pathname.replace(/\/$/, '') + (u.search || '');
}

// --- Pro monitoring panel (pages with #pro-monitor-root) ---
function initProMonitor() {
  var monitorRoot = document.getElementById('pro-monitor-root');
  if (!monitorRoot) return;
  var auth = window.geoscoreAuth;
  if (!auth || !auth.onAuthChange) return;
  auth.onAuthChange(function(user) {
    var teaser = document.getElementById('pro-upgrade-teaser');
    var panel = document.getElementById('pro-monitor-panel');
    if (user && user.plan === 'pro') {
      monitorRoot.classList.remove('hidden');
      if (teaser) teaser.classList.add('hidden');
      if (panel) {
        panel.classList.remove('hidden');
        if (!panel.getAttribute('data-initialized')) {
          panel.setAttribute('data-initialized', '1');
          initSitesPanel(auth);
        }
      }
    } else if (user) {
      monitorRoot.classList.remove('hidden');
      if (teaser) teaser.classList.remove('hidden');
      if (panel) panel.classList.add('hidden');
    } else {
      monitorRoot.classList.add('hidden');
    }
  });
}

// --- Save the finished audit to the cloud (Pro only) ---
function maybeShowSaveCloud(result) {
  var root = document.getElementById('save-cloud-root');
  var auth = window.geoscoreAuth;
  if (!root || !auth || !auth.getCurrentUser || !auth.api) return;
  var user = auth.getCurrentUser();
  if (!user || user.plan !== 'pro') return;
  var zh = (document.documentElement.lang || 'en').toLowerCase().indexOf('zh') === 0;
  root.innerHTML = '<div class="card p-4 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">' +
    '<div><div class="text-sm font-semibold mb-1">' + (zh ? '保存到云端' : 'Save to cloud') + '</div>' +
    '<p class="text-xs text-gray-500">' + (zh ? '将此审计保存到你的 30 天云端历史，并可用于 PDF 导出。' : 'Store this audit in your 30-day cloud history and export it as PDF.') + '</p></div>' +
    '<button id="save-cloud-btn" class="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-geo-600 to-brand-600 hover:from-geo-500 hover:to-brand-500 transition whitespace-nowrap">' + (zh ? '保存' : 'Save') + '</button></div>';
  document.getElementById('save-cloud-btn').addEventListener('click', function() {
    saveAuditToCloud(auth, result, this);
  });
}

// Flush any queued clicks made before boot.js loaded
if (window.__geoFlush) window.__geoFlush();

