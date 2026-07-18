import ICONS from '../lib/icons.js';

const BG_CLR = { Excellent: "bg-geo-500", Good: "bg-brand-500", Basic: "bg-warn-500", Critical: "bg-danger-500" };

export function renderScoreHeader(r) {
  return '<div class="stagger-section fade-in-delay-1 flex flex-col lg:flex-row items-center gap-8 mb-10 p-8 card">' +
    '<div class="relative flex-shrink-0">' +
      '<svg class="w-28 h-28 -rotate-90" viewBox="0 0 120 120">' +
        '<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(148,163,184,0.1)" stroke-width="8"/>' +
        '<circle cx="60" cy="60" r="52" fill="none" stroke="url(#scoreGrad)" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + (r.score * 3.27) + ' 326.7" class="score-ring"/>' +
        '<defs><linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#22c55e"/><stop offset="100%" stop-color="#3b82f6"/></linearGradient></defs>' +
      '</svg>' +
      '<div class="absolute inset-0 flex items-center justify-center"><span class="text-4xl font-extrabold gradient-text">' + r.score + '</span></div>' +
    '</div>' +
    '<div class="flex-1 text-center lg:text-left">' +
      '<h1 class="text-2xl font-bold mb-1">GEO Audit Report</h1>' +
      '<a href="' + r.url + '" target="_blank" class="text-brand-500 hover:underline text-sm font-mono break-all">' + r.url + '</a>' +
      '<div class="mt-3 flex flex-wrap gap-2 justify-center lg:justify-start">' +
        '<span class="px-3 py-1 rounded-full text-xs font-bold text-white ' + BG_CLR[r.level] + '">' + r.level + '</span>' +
        '<span class="px-3 py-1 rounded-full text-xs bg-white/5 text-gray-400">' + r.timestamp + '</span>' +
      '</div>' +
      '<p class="mt-3 text-sm text-gray-400">' + r.summary + '</p>' +
    '</div>' +
  '</div>';
}
