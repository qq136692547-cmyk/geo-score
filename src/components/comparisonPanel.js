var IS_ZH = (document.documentElement.lang || 'en').toLowerCase().indexOf('zh') === 0;
function t(en, zh) { return IS_ZH ? zh : en; }

var DIM_LABELS_ZH = { aiCrawlability: "AI 可爬取性", aiGuidance: "AI 引导", structuredData: "结构化数据", metaSocial: "Meta 与社交", contentQuality: "内容质量", eeat: "E-E-A-T", brandEntity: "品牌与实体", citationReadiness: "引用就绪度", discoveryEndpoints: "发现端点", agentFriendliness: "Agent 友好度", freshness: "内容新鲜度" };
var DIM_LABELS = { aiCrawlability: "AI Crawlability", aiGuidance: "AI Guidance", structuredData: "Structured Data", metaSocial: "Meta & Social", contentQuality: "Content Quality", eeat: "E-E-A-T", brandEntity: "Brand & Entity", citationReadiness: "Citation Readiness", discoveryEndpoints: "Discovery", agentFriendliness: "Agent Friendly", freshness: "Freshness" };

export function renderComparisonPanel(selected) {
  if (!selected || selected.length < 2) return "";
  var dimKeys = Object.keys(DIM_LABELS);
  return '<div class="stagger-section fade-in-delay-5 card p-6 mb-8">' +
    '<h2 class="text-lg font-bold mb-4">' + t('Multi-Site Comparison', '多站点对比') + '</h2>' +
    '<div class="overflow-x-auto"><table class="w-full text-sm">' +
    '<thead><tr class="border-b border-gray-700"><th class="pb-2 pr-3 text-left text-gray-400 font-medium">' + t('Dimension', '维度') + '</th>' +
    selected.map(function(s) {
      return '<th class="pb-2 pr-3 text-left font-mono text-xs ' + lc(s.level) + '">' + s.url + '<br/><span class="text-sm font-bold">' + s.score + '</span></th>';
    }).join("") +
    '</tr></thead><tbody>' +
    dimKeys.map(function(k) {
      return '<tr class="border-b border-gray-700/50">' +
        '<td class="py-2 pr-3 text-gray-300 text-xs">' + (IS_ZH ? (DIM_LABELS_ZH[k] || k) : DIM_LABELS[k]) + '</td>' +
        selected.map(function(s) {
          var pct = s.dimensions && s.dimensions[k] != null ? s.dimensions[k] : 0;
          var bc = pct >= 80 ? "bg-geo-500" : pct >= 60 ? "bg-brand-500" : pct >= 40 ? "bg-warn-500" : "bg-danger-500";
          return '<td class="py-2 pr-3"><div class="flex items-center gap-2"><div class="w-16 h-1.5 rounded-full bg-gray-700/50 overflow-hidden"><div class="h-full rounded-full ' + bc + '" style="width:' + pct + '%"></div></div><span class="text-xs font-mono text-gray-400">' + pct + '%</span></div></td>';
        }).join("") +
        '</tr>';
    }).join("") +
    '</tbody></table></div></div>';
}

function lc(l) {
  return l === "Excellent" ? "text-geo-500" : l === "Good" ? "text-brand-500" : l === "Basic" ? "text-warn-500" : "text-danger-500";
}
