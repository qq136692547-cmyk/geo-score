/**
 * GeoScore Pro AI visibility panel
 * - openVisibility(auth, site): renders per-engine "AI recommendation
 *   simulation" results for a monitored site into #pro-ai-visibility.
 * - "Run AI check" triggers POST /api/visibility/check (Pro only).
 * Requires window.geoscoreAuth.api() (see auth.js).
 */
var IS_ZH = (document.documentElement.lang || 'en').toLowerCase().indexOf('zh') === 0;
function t(en, zh) { return IS_ZH ? zh : en; }

var ENGINES = [
  { id: 'chatgpt', label: 'ChatGPT', initial: 'C', tile: 'bg-gradient-to-br from-sky-500 to-blue-600' },
  { id: 'perplexity', label: 'Perplexity', initial: 'P', tile: 'bg-gradient-to-br from-teal-400 to-cyan-600' },
  { id: 'claude', label: 'Claude', initial: 'C', tile: 'bg-gradient-to-br from-orange-400 to-amber-600' },
  { id: 'gemini', label: 'Gemini', initial: 'G', tile: 'bg-gradient-to-br from-indigo-400 to-violet-600' },
];

function engineMeta(id) {
  for (var i = 0; i < ENGINES.length; i++) if (ENGINES[i].id === id) return ENGINES[i];
  return { id: id, label: id, initial: (id || '?')[0].toUpperCase(), tile: 'bg-gradient-to-br from-gray-500 to-gray-700' };
}

function fmtDateTime(sec) {
  if (!sec) return t('Never', '从未');
  var d = new Date(sec * 1000);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function sentimentLabel(s) {
  if (s === 'positive') return t('Positive', '正面');
  if (s === 'negative') return t('Negative', '负面');
  return t('Neutral', '中性');
}

function sentimentClass(s) {
  if (s === 'positive') return 'text-geo-500';
  if (s === 'negative') return 'text-danger-500';
  return 'text-gray-400';
}

function badge(ok, textYes, textNo) {
  if (ok === true) {
    return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-geo-500/10 text-geo-500">' + textYes + '</span>';
  }
  return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-white/5 text-gray-500">' + textNo + '</span>';
}

function renderEngineCard(r) {
  var meta = engineMeta(r.engine);
  var body;
  if (r.error) {
    body = '<p class="text-xs text-danger-500 mt-2">' + escapeHtml(r.error) + '</p>';
  } else {
    body = '<div class="flex flex-wrap items-center gap-2 mt-2">' +
      badge(r.mentioned, t('Mentioned', '会被提及'), t('Not mentioned', '未提及')) +
      badge(r.cited, t('Cited', '会被引用'), t('Not cited', '未引用')) +
      '<span class="text-xs ' + sentimentClass(r.sentiment) + '">' + sentimentLabel(r.sentiment) + '</span>' +
      '</div>' +
      (r.snippet ? '<p class="text-xs text-gray-400 mt-2 leading-relaxed line-clamp-3">"' + escapeHtml(r.snippet) + '"</p>' : '');
  }
  return '<div class="card p-4">' +
    '<div class="flex items-center gap-2">' +
    '<span class="w-7 h-7 flex items-center justify-center rounded-md text-white text-xs font-bold ' + meta.tile + '">' + meta.initial + '</span>' +
    '<span class="text-sm font-semibold text-gray-200">' + escapeHtml(meta.label) + '</span>' +
    '</div>' + body +
    '</div>';
}

function renderSummary(result) {
  if (!result || !result.engines || result.engines.length === 0) {
    return '<div class="text-sm text-gray-500 py-6 text-center">' +
      t('No AI visibility data yet. Click "Run AI check" to simulate whether AI engines would mention or cite this site.', '还没有 AI 可见性数据。点击“运行 AI 检查”，模拟 AI 引擎是否会提及或引用该网站。') +
      '</div>';
  }
  var mentioned = result.engines.filter(function(e) { return e.mentioned && !e.error; }).length;
  var cited = result.engines.filter(function(e) { return e.cited && !e.error; }).length;
  var checked = result.engines.filter(function(e) { return !e.error; }).length;
  var parts = [];
  parts.push('<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">');
  parts.push('<span class="text-gray-400">' + t('AI engines checked', '已检查引擎') + ': <span class="text-gray-200 font-semibold">' + checked + '/4</span></span>');
  parts.push('<span class="text-gray-400">' + t('Mentioned by', '会被提及') + ': <span class="text-geo-500 font-bold">' + mentioned + '/4</span></span>');
  parts.push('<span class="text-gray-400">' + t('Cited by', '会被引用') + ': <span class="text-geo-500 font-bold">' + cited + '/4</span></span>');
  if (result.checked_at) parts.push('<span class="text-gray-600 text-xs">' + fmtDateTime(result.checked_at) + '</span>');
  parts.push('</div>');
  return parts.join('');
}

export function openVisibility(auth, site) {
  var root = document.getElementById('pro-ai-visibility');
  if (!root || !auth || !auth.api) return;
  root.classList.remove('hidden');
  root.innerHTML = renderFrame(site, null);
  wireRun(root, auth, site);
  loadLatest(root, auth, site);
}

function renderFrame(site, data) {
  var parts = [];
  parts.push('<div class="card p-5">');
  parts.push('<div class="flex items-start justify-between gap-3 mb-1">');
  parts.push('<div>');
  parts.push('<h3 class="font-bold text-sm">' + t('AI Visibility', 'AI 可见性') + ' <span class="text-gray-500 font-normal">&middot;</span> ' + escapeHtml(site.host || '') + '</h3>');
  parts.push('<p class="text-xs text-gray-500 mt-1">' + t('AI recommendation simulation based on your public content. It estimates whether AI engines would mention or cite your site - not real engine traffic.', 'AI 推荐模拟：基于网站公开内容估算 AI 引擎是否会提及或引用你的网站，不代表真实引擎流量。') + '</p>');
  parts.push('</div>');
  parts.push('<button id="vis-close" class="text-gray-500 hover:text-white text-xl transition">&times;</button>');
  parts.push('</div>');
  parts.push('<div class="flex items-center justify-between gap-3 my-3">');
  parts.push('<div id="vis-summary">' + renderSummary(data) + '</div>');
  parts.push('<button id="vis-run" class="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-geo-600 to-brand-600 hover:from-geo-500 hover:to-brand-500 transition whitespace-nowrap shrink-0">' + t('Run AI Check', '运行 AI 检查') + '</button>');
  parts.push('</div>');
  parts.push('<div id="vis-engines" class="grid grid-cols-1 sm:grid-cols-2 gap-3">');
  if (data && data.engines && data.engines.length > 0) {
    parts.push(data.engines.map(renderEngineCard).join(''));
  } else {
    parts.push('<div class="sm:col-span-2 text-sm text-gray-500 py-4 text-center">' + t('Click "Run AI Check" to get started.', '点击“运行 AI 检查”开始。') + '</div>');
  }
  parts.push('</div>');
  parts.push('</div>');
  return parts.join('');
}

function wireRun(root, auth, site) {
  var closeBtn = document.getElementById('vis-close');
  if (closeBtn) closeBtn.addEventListener('click', function() { root.classList.add('hidden'); });
  var runBtn = document.getElementById('vis-run');
  if (!runBtn) return;
  runBtn.addEventListener('click', async function() {
    runBtn.disabled = true;
    runBtn.textContent = t('Simulating…', '正在模拟…');
    var summaryEl = document.getElementById('vis-summary');
    if (summaryEl) summaryEl.innerHTML = '<span class="text-gray-400 text-sm">' + t('Asking ChatGPT, Perplexity, Claude and Gemini…', '正在询问 ChatGPT、Perplexity、Claude 和 Gemini…') + '</span>';
    try {
      var res = await auth.api('/api/visibility/check', { method: 'POST', body: { host: site.host, url: site.url } });
      if (res.ok) {
        root.innerHTML = renderFrame(site, res.data);
        wireRun(root, auth, site);
      } else {
        alert((res.data && res.data.error) ? res.data.error : t('AI check failed.', 'AI 检查失败。'));
      }
    } catch (err) {
      alert(t('Network error while running the AI check.', '运行 AI 检查时网络错误。'));
    }
    runBtn.disabled = false;
    runBtn.textContent = t('Run AI Check', '运行 AI 检查');
  });
}

async function loadLatest(root, auth, site) {
  try {
    var res = await auth.api('/api/visibility?host=' + encodeURIComponent(site.host));
    if (res.ok && res.data && res.data.engines && res.data.engines.length > 0) {
      root.innerHTML = renderFrame(site, res.data);
      wireRun(root, auth, site);
    }
  } catch (e) {
    // Keep the default empty-state frame; network issues are non-fatal here.
  }
}
