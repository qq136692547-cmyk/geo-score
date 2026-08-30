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
import { saveAuditToCloud } from '../components/auditHistory.js';

var radarChartInstance = null;
var trendChartInstance = null;
var scanTimer = null;

var IS_ZH = (document.documentElement.lang || 'en').toLowerCase().indexOf('zh') === 0;
function t(en, zh) { return IS_ZH ? zh : en; }

function getGeoSource() {
  try {
    var params = new URLSearchParams(location.search);
    var source = (params.get('utm_source') || '').toLowerCase();
    var medium = (params.get('utm_medium') || '').toLowerCase();
    if (source === 'ttcalc' && medium === 'site') return 'cross_site';
    if (source) return 'external';
    var ref = document.referrer;
    if (!ref) return 'direct';
    var refHost = new URL(ref).hostname.toLowerCase();
    if (/(^|\.)(google|bing|baidu|duckduckgo|yandex|ecosia|startpage|brave)\.[a-z.]+$/.test(refHost)) return 'search';
    return 'external';
  } catch (e) { return 'other'; }
}

function geoUrlDomain(value) {
  try { return new URL(value).hostname; } catch (e) { return ''; }
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
  if (history.length < 2) { root.innerHTML = "Audit at least 2 sites first."; return; }
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
  results.innerHTML = "Fetching sitemap...";
  try {
    var resp = await fetch(url);
    var text = await resp.text();
    var urls = extractUrlsFromSitemap(text);
    if (urls.length === 0) { results.innerHTML = "No URLs found in sitemap."; return; }
    if (urls.length > 20) { results.innerHTML = "Found " + urls.length + " URLs. Auditing first 20."; urls = urls.slice(0, 20); }
    results.innerHTML = "";
    var completed = 0;
    for (var i = 0; i < urls.length; i++) {
      status.textContent = "Scanning " + (i + 1) + "/" + urls.length + ": " + urls[i];
      bar.style.width = ((i / urls.length) * 100) + "%";
      try {
        var r = await auditUrl(urls[i]);
        completed++;
        var lc = r.level === "Excellent" ? "text-geo-500" : r.level === "Good" ? "text-brand-500" : r.level === "Basic" ? "text-warn-500" : "text-danger-500";
        results.innerHTML += '<div class="flex justify-between py-1 ' + ((i % 2 === 0) ? "bg-white/5" : "") + ' px-2 rounded"><span class="truncate mr-2 text-gray-300">' + urls[i] + '</span><span class="font-mono text-xs font-bold ' + lc + '">' + r.score + '</span></div>';
      } catch (e) {
        results.innerHTML += '<div class="flex justify-between py-1 px-2 rounded text-danger-500"><span class="truncate mr-2">' + urls[i] + '</span><span class="text-xs">Error</span></div>';
      }
    }
    bar.style.width = "100%";
    status.textContent = "Completed: " + completed + "/" + urls.length + " URLs";
  } catch (e) {
    results.innerHTML = "Error: " + e.message;
  }
};

function extractUrlsFromSitemap(xml) {
  var urls = [];
  var regex = /<loc[^>]*>([^<]+)<\/loc>/gi;
  var match;
  while ((match = regex.exec(xml)) !== null) urls.push(match[1].trim());
  return urls;
}

window.startAudit = async function () {
  var input = document.getElementById("url-input");
  var btn = document.getElementById("audit-btn");
  var url = (input.value || "").trim();
  if (!url) { input.focus(); return; }
  btn.disabled = true;
  btn.textContent = "Scanning\u2026";
  geoHide(document.getElementById("hero-section"));
  var loadEl = document.getElementById("loading-section");
  document.getElementById("report-section").classList.add("hidden");
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
    if (typeof window.geoTrack === 'function') window.geoTrack('audit_started', { url_domain: geoUrlDomain(targetUrl), source_type: getGeoSource() });
    var result = await auditUrl(targetUrl);
    addToHistory(result);
    localStorage.setItem("geoscope_last_result", JSON.stringify(result));
    if (typeof window.geoTrack === 'function') window.geoTrack('audit_completed', { url_domain: geoUrlDomain(targetUrl), score: result.score, level: result.level, source_type: getGeoSource() });
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
    if (typeof window.geoTrack === 'function') window.geoTrack('audit_failed', { url_domain: geoUrlDomain(url), error_code: geoErrorCode(err), source_type: getGeoSource() });
    document.getElementById("loading-section").innerHTML = '<div class="card p-8 text-center"><div class="text-danger-500 text-lg font-semibold mb-2">Audit Failed</div><p class="text-gray-400 text-sm">' + err.message + '</p><button onclick="location.reload()" class="mt-4 px-4 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/20 transition">Try Again</button></div>';
  }
  btn.disabled = false;
  btn.textContent = "Start Audit";
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
}function renderReport(r) {
  if (radarChartInstance) { radarChartInstance.destroy(); radarChartInstance = null; }
  if (trendChartInstance) { trendChartInstance.destroy(); trendChartInstance = null; }
  var root = document.getElementById("report-section");
  var parts = [
    renderScoreHeader(r),
    renderRadarContainer(),
    renderDimensionBreakdown(r.dimensions),
    renderNegativeSignals(r.negativeSignals),
    renderSeoSupplement(r.seoSupplement),
    renderFixFilesPanel(r),
    renderFixesPanel(r.recommendations),
    renderExportButtons(),
    renderShareButtons(r),
    '<div id="save-cloud-root"></div>'
  ];
  root.innerHTML = "<div>" + parts.join("") + "</div>";

  // Animate report sections with Web Animations API (reliable for dynamically inserted content)
  var animEls = root.querySelectorAll(".stagger-section");
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
      initTrendChart(urlHistory).then(function(chart) { trendChartInstance = chart; });
    }
  }
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
      window.startAudit();
    }
  });
}

document.addEventListener("DOMContentLoaded", function() { renderHistory(); });

// --- Export functionality ---
window.doExport = function(format) {
  if (typeof window.geoTrack === 'function') window.geoTrack('tool_complete', { tool_name: 'report_export', format: format, source_type: getGeoSource() });
  var raw = localStorage.getItem("geoscope_last_result");
  if (!raw) { alert(t("No audit result to export. Run an audit first.", "没有可导出的审计结果，请先运行一次审计。")); return; }
  var r;
  try { r = JSON.parse(raw); } catch(e) { alert(t("Failed to parse stored result.", "解析已保存的结果失败。")); return; }
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
  if (!raw) { alert(t("No audit result found.", "未找到审计结果。")); return; }
  var r;
  try { r = JSON.parse(raw); } catch(e) { alert(t("Failed to parse stored result.", "解析已保存的结果失败。")); return; }
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
  if (!raw) { alert(t("No audit result found.", "未找到审计结果。")); return; }
  var r;
  try { r = JSON.parse(raw); } catch(e) { alert(t("Failed to parse stored result.", "解析已保存的结果失败。")); return; }
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
    if (label) { label.textContent = 'Copied!'; setTimeout(function() { label.textContent = 'Copy Link'; }, 2000); }
  }).catch(function() {});
};

// --- Bootstrap: attach click listeners (replaces onclick) ---
document.addEventListener("DOMContentLoaded", function() {
  var ab = document.getElementById("audit-btn");
  if (ab) ab.addEventListener("click", function() { window.startAudit(); });
  var bl = document.getElementById("batch-link");
  if (bl) bl.addEventListener("click", function() { window.showBatchInput(); });
  var bb = document.getElementById("batch-btn");
  if (bb) bb.addEventListener("click", function() { window.startBatchAudit(); });
  var cb = document.getElementById("compare-btn");
  if (cb) cb.addEventListener("click", function() { window.runComparison(); });

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
    setTimeout(function() { window.startAudit(); }, 300);
  }
});

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

