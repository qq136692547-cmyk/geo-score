var IS_ZH = (document.documentElement.lang || 'en').toLowerCase().indexOf('zh') === 0;
function t(en, zh) { return IS_ZH ? zh : en; }

export function renderFixesPanel(recommendations) {
  var html = '<div class="stagger-section fade-in-delay-6 card p-6 mb-8">' +
    '<h2 class="text-lg font-bold mb-5">' + t('Prioritized Fixes', '优先修复建议') + '</h2>';
  if (recommendations && recommendations.length > 0) {
    html += '<div class="space-y-3">' +
      recommendations.slice(0, 15).map(function(rec, i) {
        var priCls = rec.priority === "high" ? "border-l-danger-500" : (rec.priority === "medium" ? "border-l-warn-500" : "border-l-gray-500");
        var priLabel = rec.priority === "high" ? t("high", "高") : (rec.priority === "medium" ? t("medium", "中") : t("low", "低"));
        return '<div class="flex items-start gap-3 text-sm p-4 rounded-xl bg-white/5 border-l-2 ' + priCls + '">' +
          '<span class="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-gray-500/20 text-gray-400">' + (i + 1) + '</span>' +
          '<div class="flex-1"><div class="text-gray-200 font-medium">' + rec.issue + '</div><div class="text-gray-500 mt-0.5">' + rec.fix + '</div><div class="text-xs text-gray-600 mt-1">' + rec.dimension + ' &middot; ' + priLabel + '</div></div></div>';
      }).join("") +
      '</div>';
  } else { html += '<p class="text-gray-400">' + t('No issues found!', '未发现问题！') + '</p>'; }
  html += '</div>';
  return html;
}
