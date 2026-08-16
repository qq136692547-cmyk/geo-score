import { generateFixFiles } from '../lib/fixGenerator.js';

var IS_ZH = (document.documentElement.lang || 'en').toLowerCase().indexOf('zh') === 0;
function t(en, zh) { return IS_ZH ? zh : en; }

export function renderFixFilesPanel(result) {
  if (!result || !result.raw) return '';

  var files = generateFixFiles(result);
  var keys = Object.keys(files);

  var html = '<div class="stagger-section fade-in-delay-6 card p-6 mb-8">' +
    '<h2 class="text-lg font-bold mb-2">' + t('Auto-Generated Fix Files', '自动生成修复文件') + '</h2>' +
    '<p class="text-sm text-gray-500 mb-5">' + t('Download these files and upload them to your website root to instantly improve your GEO score.', '下载这些文件并上传到网站根目录，即可立即提升你的 GEO 分数。') + '</p>' +
    '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';

  keys.forEach(function(key) {
    var f = files[key];
    var icon = key === 'llmsTxt' ? '📄' : key === 'robotsTxt' ? '🤖' : '🔧';
    var label = key === 'llmsTxt' ? 'llms.txt' : key === 'robotsTxt' ? 'robots.txt' : t('JSON-LD Schema', 'JSON-LD 结构化数据');
    var desc = key === 'llmsTxt'
      ? t('AI guidance file — helps ChatGPT, Claude & Perplexity understand your site', 'AI 引导文件——帮助 ChatGPT、Claude 和 Perplexity 理解你的网站')
      : key === 'robotsTxt'
      ? t('Crawler rules — explicitly allows all major AI bots to crawl your site', '爬虫规则——显式允许所有主流 AI 爬虫抓取你的网站')
      : t('Structured data — helps AI engines parse your site information', '结构化数据——帮助 AI 引擎解析你的网站信息');

    html += '<div class="bg-white/5 rounded-xl p-4 border border-gray-700/50">' +
      '<div class="text-2xl mb-2">' + icon + '</div>' +
      '<h3 class="font-semibold text-white text-sm mb-1">' + label + '</h3>' +
      '<p class="text-xs text-gray-500 mb-3">' + desc + '</p>' +
      '<div class="flex gap-2">' +
        '<button onclick="window.downloadFixFile(\'' + key + '\')" class="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-geo-600 to-brand-600 hover:from-geo-500 hover:to-brand-500 transition">' + t('Download', '下载') + '</button>' +
        '<button onclick="window.previewFixFile(\'' + key + '\')" class="px-3 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 transition">' + t('Preview', '预览') + '</button>' +
      '</div>' +
      '<p class="text-xs text-gray-600 mt-2 font-mono">' + f.path + '</p>' +
    '</div>';
  });

  html += '</div>' +
    '<div id="fix-preview" class="mt-4 hidden">' +
      '<div class="flex items-center justify-between mb-2">' +
        '<h3 class="text-sm font-semibold text-gray-300" id="preview-title">' + t('Preview', '预览') + '</h3>' +
        '<button onclick="document.getElementById(\'fix-preview\').classList.add(\'hidden\')" class="text-xs text-gray-500 hover:text-white">' + t('✕ Close', '✕ 关闭') + '</button>' +
      '</div>' +
      '<pre id="preview-content" class="bg-gray-900/70 rounded-xl p-4 text-sm text-gray-300 overflow-x-auto max-h-96 font-mono whitespace-pre-wrap"></pre>' +
    '</div>' +
    '<div class="mt-4 p-3 rounded-lg bg-geo-500/5 border border-geo-500/20 text-xs text-gray-400">' +
      '<strong class="text-geo-400">💡 ' + t('Tip:', '提示：') + '</strong> ' + t('Upload these files to your web server, then re-run the audit to see your improved score. ', '把这些文件上传到你的服务器后重新运行审计，即可看到分数提升。 ') +
      t('The <code>llms.txt</code> and <code>robots.txt</code> files should go in your website root directory. ', '<code>llms.txt</code> 和 <code>robots.txt</code> 应放在网站根目录。 ') +
      t('The JSON-LD snippet should be added inside your HTML <code>&lt;head&gt;</code> tags.', 'JSON-LD 代码片段应添加到 HTML 的 <code>&lt;head&gt;</code> 标签内。') +
    '</div>' +
  '</div>';

  return html;
}
