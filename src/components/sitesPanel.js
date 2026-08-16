/**
 * GeoScore Pro monitoring panel
 * Renders monitored sites into #pro-sites-list and wires the add form
 * (#pro-add-form). Delegates delete / history actions. Requires the
 * window.geoscoreAuth.api() wrapper (see auth.js).
 */
import { openSiteHistory } from './auditHistory.js';

var IS_ZH = (document.documentElement.lang || 'en').toLowerCase().indexOf('zh') === 0;
function t(en, zh) { return IS_ZH ? zh : en; }

var MAX_SITES = 5;

function scoreClass(score) {
  if (score >= 80) return 'text-geo-500';
  if (score >= 60) return 'text-brand-500';
  if (score >= 40) return 'text-warn-500';
  return 'text-danger-500';
}

function fmtDate(sec) {
  if (!sec) return t('Never', '从未');
  var d = new Date(sec * 1000);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

export function initSitesPanel(auth) {
  var form = document.getElementById('pro-add-form');
  var input = document.getElementById('pro-site-input');
  var list = document.getElementById('pro-sites-list');
  var count = document.getElementById('pro-monitor-count');
  if (!form || !list) return;

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var raw = (input.value || '').trim();
    if (!raw) return;
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      var res = await auth.api('/api/sites', { method: 'POST', body: { url: raw } });
      if (res.ok) {
        input.value = '';
        await refreshSites(auth, list, count);
      } else {
        alert((res.data && res.data.error) ? res.data.error : t('Failed to add domain.', '添加域名失败。'));
      }
    } catch (err) {
      alert(t('Network error while adding the domain.', '添加域名时网络错误。'));
    }
    btn.disabled = false;
  });

  list.addEventListener('click', function(e) {
    var del = e.target.closest('[data-delete]');
    if (del) {
      var id = del.getAttribute('data-delete');
      del.disabled = true;
      auth.api('/api/sites?id=' + encodeURIComponent(id), { method: 'DELETE' })
        .then(function() { return refreshSites(auth, list, count); })
        .catch(function() { del.disabled = false; alert(t('Failed to delete the domain.', '删除域名失败。')); });
      return;
    }
    var hist = e.target.closest('[data-history]');
    if (hist) {
      openSiteHistory(auth, hist.getAttribute('data-history'), hist.getAttribute('data-host'));
    }
  });

  refreshSites(auth, list, count);
}

async function refreshSites(auth, list, count) {
  list.innerHTML = '<div class="text-gray-500 text-xs py-2">' + t('Loading...', '加载中...') + '</div>';
  var res;
  try {
    res = await auth.api('/api/sites');
  } catch (e) {
    list.innerHTML = '<div class="text-danger-500 text-xs py-2">' + t('Failed to load monitored domains.', '监控域名加载失败。') + '</div>';
    return;
  }
  if (!res.ok) { list.innerHTML = ''; return; }
  var sites = (res.data && res.data.sites) || [];
  if (count) count.textContent = sites.length + '/' + MAX_SITES + ' ' + t('domains', '个域名');
  if (sites.length === 0) {
    list.innerHTML = '<div class="text-gray-500 text-xs py-2">' + t('No monitored domains yet. Add your first domain above.', '还没有监控域名，请在上面添加第一个域名。') + '</div>';
    return;
  }
  list.innerHTML = sites.map(function(s) {
    var scoreCell = s.last_score != null
      ? '<span class="font-bold ' + scoreClass(s.last_score) + '">' + s.last_score + '</span>'
      : '<span class="text-gray-600">&mdash;</span>';
    var statusCell = s.consecutive_failures >= 3
      ? '<span class="text-danger-500 text-xs">' + t('failed', '失败') + '</span>'
      : '<span class="text-xs text-gray-600">' + fmtDate(s.last_audit_at) + '</span>';
    return '<div class="flex items-center gap-3 py-2 px-3 card-hover rounded-lg">' +
      '<span class="flex-1 text-gray-300 text-sm truncate">' + escapeHtml(s.host) + '</span>' +
      scoreCell +
      statusCell +
      '<button class="text-xs text-brand-400 hover:text-brand-300 transition" data-history="' + s.id + '" data-host="' + escapeHtml(s.host) + '">' + t('History', '历史') + '</button>' +
      '<button class="text-xs text-danger-400 hover:text-danger-300 transition" data-delete="' + s.id + '">' + t('Remove', '移除') + '</button>' +
      '</div>';
  }).join('');
}
