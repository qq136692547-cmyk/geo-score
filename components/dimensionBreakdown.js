import ICONS from '../lib/icons.js';

const LABELS = { aiCrawlability: "AI Crawlability", aiGuidance: "AI Guidance", structuredData: "Structured Data", metaSocial: "Meta & Social", contentQuality: "Content Quality", eeat: "E-E-A-T", brandEntity: "Brand & Entity", citationReadiness: "Citation Readiness", discoveryEndpoints: "Discovery", agentFriendliness: "Agent Friendly", freshness: "Freshness" };

export function renderDimensionBreakdown(dimensions) {
  const dimKeys = Object.keys(dimensions);
  return '<div class="stagger-section fade-in-delay-3 card p-6 mb-8">' +
    '<h2 class="text-lg font-bold mb-5">Dimension Breakdown</h2>' +
    '<div class="space-y-4">' +
    dimKeys.map(function(k) {
      var d = dimensions[k];
      var label = LABELS[k] || k;
      var pct = d.percentage || 0;
      var barColor = pct >= 80 ? 'bg-geo-500' : pct >= 60 ? 'bg-brand-500' : pct >= 40 ? 'bg-warn-500' : 'bg-danger-500';
      var checkCount = (d.passed || 0) + "/" + (d.total || d.checks || 0);
      var items = (d.items || []).map(function(item) {
        var icon = item.pass ? ICONS.check : (item.warn ? ICONS.warning : ICONS.cross);
        var iconCls = item.pass ? 'text-geo-500' : (item.warn ? 'text-warn-500' : 'text-danger-500');
        return '<div class="flex items-start gap-2 py-1.5 text-sm"><span class="flex-shrink-0 mt-0.5 ' + iconCls + '">' + icon + '</span><span class="text-gray-300">' + item.label + '</span></div>';
      }).join("");
      return '<div class="card-hover p-4 rounded-xl">' +
        '<div class="flex justify-between items-center mb-2"><span class="text-sm font-medium text-gray-200">' + label + '</span><span class="text-xs font-mono text-gray-500">' + pct + '% &middot; ' + checkCount + '</span></div>' +
        '<div class="w-full h-1.5 rounded-full bg-gray-700/50 overflow-hidden"><div class="h-full rounded-full ' + barColor + '" style="width:' + pct + '%"></div></div>' +
        (items ? '<div class="mt-3 pl-1">' + items + '</div>' : '') +
      '</div>';
    }).join("") +
    '</div></div>';
}
