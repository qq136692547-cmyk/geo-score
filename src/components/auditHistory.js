/**
 * GeoScore Pro cloud audit history
 * - openSiteHistory(auth, siteId, host): fetch and render cloud audits for a
 *   monitored site (score trend + rows with status and PDF download)
 * - downloadAuditPdf(auth, auditId): fetch the PDF via Bearer auth and download
 * - saveAuditToCloud(auth, result, btn): save the current audit to the cloud
 */
var IS_ZH = (document.documentElement.lang || 'en').toLowerCase().indexOf('zh') === 0;
function t(en, zh) { return IS_ZH ? zh : en; }

function scoreClass(score) {
  if (score >= 80) return 'text-geo-500';
  if (score >= 60) return 'text-brand-500';
  if (score >= 40) return 'text-warn-500';
  return 'text-danger-500';
}

function fmtDate(sec) {
  var d = new Date(sec * 1000);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

export async function openSiteHistory(auth, siteId, host) {
  var root = document.getElementById('pro-audit-history');
  if (!root) return;
  root.classList.remove('hidden');
  root.innerHTML = '<div class="card p-5 text-gray-500 text-sm">' + t('Loading history...', '正在加载历史...') + '</div>';
  var res;
  try {
    res = await auth.api('/api/audits?site_id=' + encodeURIComponent(siteId) + '&limit=30');
  } catch (e) {
    root.innerHTML = '<div class="card p-5 text-danger-500 text-sm">' + t('Failed to load history.', '历史记录加载失败。') + '</div>';
    return;
  }
  if (!res.ok) {
    root.innerHTML = '<div class="card p-5 text-danger-500 text-sm">' + t('Failed to load history.', '历史记录加载失败。') + '</div>';
    return;
  }
  var audits = (res.data && res.data.audits) || [];
  var okAudits = audits.filter(function(a) { return a.status === 'ok'; });

  var parts = [];
  parts.push('<div class="card p-5">');
  parts.push('<div class="flex items-center justify-between mb-1">');
  parts.push('<h3 class="font-bold text-sm">' + t('Cloud history', '云端历史') + ' &mdash; ' + escapeHtml(host || '') + '</h3>');
  parts.push('<button id="audit-history-close" class="text-gray-500 hover:text-white text-xl transition">&times;</button>');
  parts.push('</div>');
  parts.push('<p class="text-xs text-gray-500 mb-4">' + t('Weekly automated audits, kept for 30 days.', '每周自动审计，保留 30 天。') + '</p>');
  if (audits.length === 0) {
    parts.push('<p class="text-sm text-gray-500 py-2">' + t('No audits yet. The first scheduled audit runs on Monday.', '暂无审计记录。首次定时审计将在周一运行。') + '</p>');
  } else {
    if (okAudits.length >= 2) {
      parts.push('<div class="mb-4"><canvas id="cloud-trend-canvas"></canvas></div>');
    }
    parts.push('<div class="space-y-2">' + audits.map(function(a) {
      var statusCell = a.status === 'ok'
        ? '<span class="font-bold ' + scoreClass(a.score) + '">' + a.score + '</span>'
        : '<span class="text-danger-500 text-xs">' + t('failed', '失败') + '</span>';
      var pdfBtn = a.status === 'ok'
        ? '<button class="text-xs text-brand-400 hover:text-brand-300 transition" data-pdf="' + a.id + '">' + t('PDF', 'PDF') + '</button>'
        : '';
      return '<div class="flex items-center gap-3 py-2 px-3 card-hover rounded-lg">' +
        '<span class="text-xs text-gray-500 w-24">' + fmtDate(a.created_at) + '</span>' +
        '<span class="flex-1 text-gray-300 text-sm truncate">' + escapeHtml(a.host || a.url || '') + '</span>' +
        statusCell + pdfBtn +
        '</div>';
    }).join('') + '</div>');
  }
  parts.push('</div>');
  root.innerHTML = parts.join('');

  var closeBtn = document.getElementById('audit-history-close');
  if (closeBtn) closeBtn.addEventListener('click', function() { root.classList.add('hidden'); });
  root.querySelectorAll('[data-pdf]').forEach(function(btn) {
    btn.addEventListener('click', function() { downloadAuditPdf(auth, btn.getAttribute('data-pdf')); });
  });
  if (okAudits.length >= 2) {
    initCloudTrend(okAudits);
  }
}

async function initCloudTrend(audits) {
  var canvas = document.getElementById('cloud-trend-canvas');
  if (!canvas) return;
  var mod = await import('chart.js');
  var Chart = mod.Chart;
  Chart.register(...mod.registerables);
  var reversed = audits.slice().reverse();
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: reversed.map(function(a) { return fmtDate(a.created_at); }),
      datasets: [{
        label: 'Score',
        data: reversed.map(function(a) { return a.score; }),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.1)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: reversed.map(function(a) {
          return a.score >= 80 ? '#22c55e' : a.score >= 60 ? '#3b82f6' : a.score >= 40 ? '#eab308' : '#ef4444';
        }),
        pointRadius: 4,
        pointBorderColor: '#1e293b',
        pointBorderWidth: 1.5,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(148,163,184,0.08)' } },
        y: { min: 0, max: 100, ticks: { color: '#64748b', font: { size: 10 }, stepSize: 20 }, grid: { color: 'rgba(148,163,184,0.08)' } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.95)',
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(148,163,184,0.15)',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: { label: function(ctx) { return 'Score: ' + ctx.parsed.y + '/100'; } }
        }
      }
    }
  });
}

export async function downloadAuditPdf(auth, auditId) {
  var resp;
  try {
    resp = await auth.api('/api/audits/' + encodeURIComponent(auditId) + '/pdf', { raw: true });
  } catch (e) {
    alert(t('Network error while exporting PDF.', '导出 PDF 时网络错误。'));
    return;
  }
  if (!resp.ok) {
    alert(t('Failed to export PDF.', 'PDF 导出失败。'));
    return;
  }
  var blob = await resp.blob();
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'geo-audit-' + auditId + '.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export async function saveAuditToCloud(auth, result, btn) {
  if (!result || !result.url || !btn) return;
  btn.disabled = true;
  var original = btn.textContent;
  btn.textContent = t('Saving...', '保存中...');
  try {
    var res = await auth.api('/api/audits', { method: 'POST', body: { url: result.url, result: result } });
    btn.textContent = res.ok ? t('Saved to cloud \u2713', '已保存到云端 \u2713') : ((res.data && res.data.error) || t('Save failed', '保存失败'));
  } catch (e) {
    btn.textContent = t('Network error', '网络错误');
  }
  setTimeout(function() { btn.textContent = original; btn.disabled = false; }, 2500);
}
