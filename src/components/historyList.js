const LEVEL_CLR = { Excellent: "text-geo-500", Good: "text-brand-500", Basic: "text-warn-500", Critical: "text-danger-500" };

export function renderHistoryList(history) {
  if (!history || history.length === 0) return "";
  return '<div class="card p-4 text-sm"><div class="text-gray-400 mb-2 text-xs uppercase tracking-wider font-semibold">Recent Audits</div>' +
    history.slice(0, 5).map(function(e) {
      var levelCls = LEVEL_CLR[e.level] || "text-gray-400";
      var safeUrl = e.url.replace(/"/g, "&quot;");
      return '<div class="flex justify-between items-center py-2 px-3 card-hover rounded-lg cursor-pointer" data-url="' + safeUrl + '"><span class="text-gray-300 text-sm truncate mr-2">' + safeUrl + '</span><span class="font-bold text-sm ' + levelCls + '">' + e.score + '</span></div>';
    }).join("") +
    '</div>';
}