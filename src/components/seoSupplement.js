import ICONS from '../lib/icons.js';

var IS_ZH = (document.documentElement.lang || 'en').toLowerCase().indexOf('zh') === 0;
function t(en, zh) { return IS_ZH ? zh : en; }

export function renderSeoSupplement(s) {
  if (!s) return "";
  var checks = [
    { label: t("HTTPS", "HTTPS"), ok: s.https },
    { label: t("Title Tag", "标题标签"), ok: s.hasTitle },
    { label: t("Meta Description", "Meta 描述"), ok: s.hasMetaDesc },
    { label: t("Responsive Viewport", "响应式视口"), ok: s.responsive }
  ];
  return '<div class="stagger-section fade-in-delay-5 card p-6 mb-8">' +
    '<h2 class="text-lg font-bold mb-4">' + t('SEO Supplement <span class="text-sm text-gray-500 font-normal">(informational)</span>', 'SEO 补充 <span class="text-sm text-gray-500 font-normal">（仅供参考）</span>') + '</h2>' +
    '<div class="grid grid-cols-2 md:grid-cols-4 gap-3">' +
    checks.map(function(c) {
      var icon = c.ok ? ICONS.check : ICONS.cross;
      var cls = c.ok ? 'text-geo-500' : 'text-gray-500';
      return '<div class="card-hover p-4 rounded-xl text-center"><div class="text-xl mb-1 ' + cls + '">' + icon + '</div><div class="text-xs text-gray-400">' + c.label + '</div></div>';
    }).join("") +
    '</div></div>';
}
