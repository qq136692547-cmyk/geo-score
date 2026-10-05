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

window.showBatchInput = function() {
  var el = document.getElementById("batch-section");
  if (el) el.classList.toggle("hidden");
};

window.showComparison = function() {
  var el = document.getElementById("compare-section");
  if (el) {
    el.style.display = el.style.display === "none" ? "block" : "none";
    if (el.style.display !== "none") populateCompareList();
  }
};

function populateCompareList() {
  var root = document.getElementById("compare-list");
  var history = getHistory();
  if (history.length < 2) { root.innerHTML = t("Audit at least 2 sites first.", "请先审计至少 2 个站点。"); return; }
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
  document.getElementById("compare-section").style.display = "none";
  var reportRoot = document.getElementById("report-section");
  var comparisonHtml = renderComparisonPanel(selected);
  if (comparisonHtml) {
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

window.startAudit = async function (entryPoint) {
  var input = document.getElementById("url-input");
  var btn = document.getElementById("audit-btn");
  var url = (input.value || "").trim();
  if (!url) { input.focus(); return; }
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
    if (history.length >= 2) {
      document.getElementById("compare-link").style.display = "inline";
    }
  } catch (err) {
    clearInterval(scanTimer);
    // targetUrl, not url: url is the raw #url-input value and may lack the
    // https:// prefix that boot.js:195 adds, so new URL(url) throws and
    // geoUrlDomain() silently returns '' — the one audit event whose domain we
    // most need (the failure) was the only one reporting none.
    if (typeof window.geoTrack === 'function') window.geoTrack('audit_failed', { url_domain: geoUrlDomain(targetUrl), error_code: geoErrorCode(err), source_type: getGeoSource() });
    document.getElementById("loading-section").innerHTML = '<div class="card p-8 text-center" role="alert"><div class="text-danger-500 text-lg font-semibold mb-2">' + t("Audit Failed", "审计失败") + '</div><p class="text-gray-400 text-sm">' + err.message + '</p><button id="audit-retry" class="mt-4 px-4 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/20 transition">' + t("Try Again", "重试") + '</button></div>';
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

function renderReport(r) {
  if (radarChartInstance) { radarChartInstance.destroy(); radarChartInstance = null; }
  if (trendChartInstance) { trendChartInstance.destroy(); trendChartInstance = null; }
  var root = document.getElementById("report-section");
  var parts = [
    renderScoreHeader(r),
    renderRadarContainer(),
    renderDimensionBreakdown(r.dimensions),
    renderNegativeSignals(r.negativeSignals),
    renderUpgradeCta(r, 'primary'),
    renderSeoSupplement(r.seoSupplement),
    renderFixFilesPanel(r),
    renderUpgradeCta(r, 'lead'),
    renderFixesPanel(r.recommendations),
    renderExportButtons(),
    renderShareButtons(r),
    '<div id="save-cloud-root"></div>'
  ];
  root.innerHTML = "<div>" + parts.join("") + "</div>";

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
  var r = null;
  try { r = JSON.parse(localStorage.getItem('geoscope_last_result') || 'null'); } catch (err) { r = null; }
  var params = { cta_id: ctaId, source_type: getGeoSource() };
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
  'robots-txt-ai-checker': 'robots.txt AI Checker'
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
    window.startAudit(/\/tools\/[^/]+\/?$/.test(here) ? 'tool_page' : 'home');
  });
  var bl = document.getElementById("batch-link");
  if (bl) bl.addEventListener("click", function() { window.showBatchInput(); });
  var bb = document.getElementById("batch-btn");
  if (bb) bb.addEventListener("click", function() { window.startBatchAudit(); });
  var cb = document.getElementById("compare-btn");
  if (cb) cb.addEventListener("click", function() { window.runComparison(); });
  var reportCtaRoot = document.getElementById("report-section");
  if (reportCtaRoot) reportCtaRoot.addEventListener("click", handleReportCtaClick);

  // --- Pro monitoring panel ---
  initProMonitor();

  // --- URL parameter: auto-start audit from ?audit=url ---
  var params = new URLSearchParams(window.location.search);
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

