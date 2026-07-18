import ICONS from '../lib/icons.js';

export function renderSeoSupplement(s) {
  if (!s) return "";
  var checks = [
    { label: "HTTPS", ok: s.https },
    { label: "Title Tag", ok: s.hasTitle },
    { label: "Meta Description", ok: s.hasMetaDesc },
    { label: "Responsive Viewport", ok: s.responsive }
  ];
  return '<div class="stagger-section fade-in-delay-5 card p-6 mb-8">' +
    '<h2 class="text-lg font-bold mb-4">SEO Supplement <span class="text-sm text-gray-500 font-normal">(informational)</span></h2>' +
    '<div class="grid grid-cols-2 md:grid-cols-4 gap-3">' +
    checks.map(function(c) {
      var icon = c.ok ? ICONS.check : ICONS.cross;
      var cls = c.ok ? 'text-geo-500' : 'text-gray-500';
      return '<div class="card-hover p-4 rounded-xl text-center"><div class="text-xl mb-1 ' + cls + '">' + icon + '</div><div class="text-xs text-gray-400">' + c.label + '</div></div>';
    }).join("") +
    '</div></div>';
}
