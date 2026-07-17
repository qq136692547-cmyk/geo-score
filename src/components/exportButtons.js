import ICONS from '../lib/icons.js';

export function renderExportButtons() {
  return '<div class="stagger-section fade-in-delay-7 flex flex-wrap gap-3 justify-center mb-12">' +
    '<button onclick="doExport('md')" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 transition">' + ICONS.markdown + ' Markdown</button>' +
    '<button onclick="doExport('html')" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 transition">' + ICONS.globe + ' HTML</button>' +
    '<button onclick="doExport('json')" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 transition">' + ICONS.json + ' JSON</button>' +
    '<button onclick="doExport('csv')" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 transition">' + ICONS.csv + ' CSV</button>' +
    '</div>';
}
