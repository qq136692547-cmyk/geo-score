import ICONS from '../lib/icons.js';

export function renderNegativeSignals(signals) {
  if (!signals || !signals.checks || signals.checks.length === 0) return "";
  var found = signals.checks.filter(function(s) { return !s.passed; }).length;
  return '<div class="stagger-section fade-in-delay-4 card p-6 mb-8 border-danger-500/20">' +
    '<h2 class="text-lg font-bold mb-4 text-danger-500">' + ICONS.alert + ' Negative Signals (' + found + ' found)</h2>' +
    '<div class="space-y-2">' +
    signals.checks.map(function(s) {
      var icon = s.passed ? ICONS.check : ICONS.cross;
      var cls = s.passed ? 'text-geo-500' : 'text-danger-500';
      return '<div class="flex items-start gap-2 text-sm"><span class="flex-shrink-0 mt-0.5 ' + cls + '">' + icon + '</span><span class="text-gray-300">' + s.label + '</span></div>';
    }).join("") +
    '</div></div>';
}
