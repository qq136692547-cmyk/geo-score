import { generateFixFiles } from '../lib/fixGenerator.js';

export function renderFixFilesPanel(result) {
  if (!result || !result.raw) return '';

  var files = generateFixFiles(result);
  var keys = Object.keys(files);

  var html = '<div class="stagger-section fade-in-delay-6 card p-6 mb-8">' +
    '<h2 class="text-lg font-bold mb-2">Auto-Generated Fix Files</h2>' +
    '<p class="text-sm text-gray-500 mb-5">Download these files and upload them to your website root to instantly improve your GEO score.</p>' +
    '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';

  keys.forEach(function(key) {
    var f = files[key];
    var icon = key === 'llmsTxt' ? '📄' : key === 'robotsTxt' ? '🤖' : '🔧';
    var label = key === 'llmsTxt' ? 'llms.txt' : key === 'robotsTxt' ? 'robots.txt' : 'JSON-LD Schema';
    var desc = key === 'llmsTxt'
      ? 'AI guidance file — helps ChatGPT, Claude & Perplexity understand your site'
      : key === 'robotsTxt'
      ? 'Crawler rules — explicitly allows all major AI bots to crawl your site'
      : 'Structured data — helps AI engines parse your site information';

    html += '<div class="bg-white/5 rounded-xl p-4 border border-gray-700/50">' +
      '<div class="text-2xl mb-2">' + icon + '</div>' +
      '<h3 class="font-semibold text-white text-sm mb-1">' + label + '</h3>' +
      '<p class="text-xs text-gray-500 mb-3">' + desc + '</p>' +
      '<div class="flex gap-2">' +
        '<button onclick="window.downloadFixFile(\'' + key + '\')" class="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-geo-600 to-brand-600 hover:from-geo-500 hover:to-brand-500 transition">Download</button>' +
        '<button onclick="window.previewFixFile(\'' + key + '\')" class="px-3 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 transition">Preview</button>' +
      '</div>' +
      '<p class="text-xs text-gray-600 mt-2 font-mono">' + f.path + '</p>' +
    '</div>';
  });

  html += '</div>' +
    '<div id="fix-preview" class="mt-4 hidden">' +
      '<div class="flex items-center justify-between mb-2">' +
        '<h3 class="text-sm font-semibold text-gray-300" id="preview-title">Preview</h3>' +
        '<button onclick="document.getElementById(\'fix-preview\').classList.add(\'hidden\')" class="text-xs text-gray-500 hover:text-white">✕ Close</button>' +
      '</div>' +
      '<pre id="preview-content" class="bg-gray-900/70 rounded-xl p-4 text-sm text-gray-300 overflow-x-auto max-h-96 font-mono whitespace-pre-wrap"></pre>' +
    '</div>' +
    '<div class="mt-4 p-3 rounded-lg bg-geo-500/5 border border-geo-500/20 text-xs text-gray-400">' +
      '<strong class="text-geo-400">💡 Tip:</strong> Upload these files to your web server, then re-run the audit to see your improved score. ' +
      'The <code>llms.txt</code> and <code>robots.txt</code> files should go in your website root directory. ' +
      'The JSON-LD snippet should be added inside your HTML <code>&lt;head&gt;</code> tags.' +
    '</div>' +
  '</div>';

  return html;
}
