import { generateFixFiles } from '../lib/fixGenerator.js';

var IS_ZH = (document.documentElement.lang || 'en').toLowerCase().indexOf('zh') === 0;
function t(en, zh) { return IS_ZH ? zh : en; }

export function renderFixFilesPanel(result) {
  if (!result || !result.raw) return '';

  var files = generateFixFiles(result);
  var keys = Object.keys(files);

  var html = '<div class="stagger-section fade-in-delay-6 card p-6 mb-8">' +
    '<h2 class="text-lg font-bold mb-2">' + t('Auto-Generated Fix Files', '自动生成修复文件') + '</h2>' +
    '<p class="text-sm text-gray-500 mb-5">' + t('Download these files and upload them to your website root. They change what AI crawlers can read — a re-audit shows you what actually moved.', '下载这些文件并上传到网站根目录。它们改变的是 AI 爬虫能读到什么——重新审计一次，看实际变了哪些。') + '</p>' +
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
      '<p class="text-xs text-gray-400 mt-2 font-mono">' + f.path + '</p>' +
    '</div>';
  });

  var fixpackHref = IS_ZH ? '/zh/fixpack/' : '/fixpack/';
  var stacks = [
    {
      id: 'static',
      label: 'Static HTML',
      body: t(
        '<p>Upload <code>llms.txt</code> and <code>robots.txt</code> to your website root directory (e.g. <code>https://yoursite.com/llms.txt</code>), paste the JSON-LD snippet inside your HTML <code>&lt;head&gt;</code>, then re-run the audit to see what changed.</p>',
        '<p>将 <code>llms.txt</code> 和 <code>robots.txt</code> 上传到网站根目录（例如 <code>https://yoursite.com/llms.txt</code>），把 JSON-LD 代码片段插入 HTML 的 <code>&lt;head&gt;</code> 标签内，然后重新运行审计验证变化。</p>'
      )
    },
    {
      id: 'nextjs',
      label: 'Next.js',
      body: t(
        '<p>Place <code>llms.txt</code> and <code>robots.txt</code> inside <code>public/</code> (or configure <code>app/robots.ts</code> in App Router), and inject <code>&lt;script type="application/ld+json"&gt;</code> inside <code>app/layout.tsx</code>.</p>',
        '<p>将 <code>llms.txt</code> 和 <code>robots.txt</code> 放到 <code>public/</code> 目录（或在 App Router 中配置 <code>app/robots.ts</code>），并在 <code>app/layout.tsx</code> 中注入 <code>&lt;script type="application/ld+json"&gt;</code>。</p>'
      )
    },
    {
      id: 'wordpress',
      label: 'WordPress',
      body: t(
        '<p>Upload <code>llms.txt</code> via FTP or your host\'s File Manager to the WordPress root directory (same level as <code>wp-config.php</code>), configure <code>robots.txt</code> in Yoast SEO or Rank Math, and insert JSON-LD via WPCode.</p>' +
        '<div class="mt-3 pt-3 border-t border-gray-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">' +
          '<span class="text-xs text-gray-300">Rather not touch live server files? Get custom fix files built for your site within 48 hours.</span>' +
          '<a href="' + fixpackHref + '" data-cta-id="fixfiles_stack_fixpack" data-cta-placement="stack_guide_wordpress" class="text-xs font-semibold text-brand-400 hover:underline whitespace-nowrap">Get $49 Fix Pack →</a>' +
        '</div>',
        '<p>通过 FTP 或主机文件管理器将 <code>llms.txt</code> 上传至 WordPress 根目录（与 <code>wp-config.php</code> 同级），在 Yoast SEO 或 Rank Math 中配置 <code>robots.txt</code>，并使用 WPCode 插入 JSON-LD。</p>' +
        '<div class="mt-3 pt-3 border-t border-gray-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">' +
          '<span class="text-xs text-gray-300">不想在正在运营的站点上手动改服务器文件？48 小时内为你人工定制全套修复文件。</span>' +
          '<a href="' + fixpackHref + '" data-cta-id="fixfiles_stack_fixpack" data-cta-placement="stack_guide_wordpress" class="text-xs font-semibold text-brand-400 hover:underline whitespace-nowrap">获取 $49 Fix Pack →</a>' +
        '</div>'
      )
    },
    {
      id: 'shopify',
      label: 'Shopify',
      body: t(
        '<p>Shopify does not allow uploading files directly to the root directory — upload <code>llms.txt</code> under <strong>Content &gt; Files</strong> and add a URL redirect from <code>/llms.txt</code> to that file, edit <code>templates/robots.txt.liquid</code> to allow AI crawlers, and add Product JSON-LD to your product template (or guard it with <code>template contains \'product\'</code>).</p>' +
        '<div class="mt-3 p-3.5 rounded-lg bg-brand-500/10 border border-brand-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
          '<div class="text-xs text-gray-200 leading-relaxed"><strong class="text-white">Skip Liquid &amp; schema headaches:</strong> 48h custom fix files built from your live Shopify catalog + post-deploy re-audit.</div>' +
          '<a href="' + fixpackHref + '" data-cta-id="fixfiles_stack_fixpack" data-cta-placement="stack_guide_shopify" class="inline-block px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-geo-600 to-brand-600 hover:from-geo-500 hover:to-brand-500 transition whitespace-nowrap text-center">$49 Fix Pack (48h) →</a>' +
        '</div>',
        '<p>Shopify 不支持直接上传文件到根目录——在后台 <strong>内容 &gt; 文件（Content &gt; Files）</strong> 上传 <code>llms.txt</code> 并添加从 <code>/llms.txt</code> 指向该文件的 URL 重定向，编辑 <code>templates/robots.txt.liquid</code> 放行 AI 爬虫，并在商品模板（或 <code>template contains \'product\'</code> 判断内）添加 Product JSON-LD。</p>' +
        '<div class="mt-3 p-3.5 rounded-lg bg-brand-500/10 border border-brand-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
          '<div class="text-xs text-gray-200 leading-relaxed"><strong class="text-white">省去 Liquid 与 Schema 折腾：</strong>48 小时内按店铺真实商品目录人工定制全套修复文件，并附上线后复检报告。</div>' +
          '<a href="' + fixpackHref + '" data-cta-id="fixfiles_stack_fixpack" data-cta-placement="stack_guide_shopify" class="inline-block px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-geo-600 to-brand-600 hover:from-geo-500 hover:to-brand-500 transition whitespace-nowrap text-center">$49 Fix Pack (48h) →</a>' +
        '</div>'
      )
    }
  ];

  var guideHtml = '<div class="mt-6 pt-5 border-t border-gray-700/50 text-left">' +
    '<h3 class="text-sm font-semibold text-white mb-2">' + t('Deployment Guide by Stack', '按技术栈部署指引') + '</h3>' +
    '<div class="geo-tablist mb-3" role="tablist" focusgroup="tablist nomemory" aria-label="' + t('Deployment guide by stack', '按技术栈部署指引') + '">';

  stacks.forEach(function(s, idx) {
    var selected = idx === 0;
    guideHtml += '<button type="button" role="tab" class="geo-tab" id="stack-tab-' + s.id + '" data-stack-tab="' + s.id + '" aria-selected="' + (selected ? 'true' : 'false') + '" tabindex="' + (selected ? '0' : '-1') + '"' + (selected ? ' focusgroupstart' : '') + '>' + s.label + '</button>';
  });

  guideHtml += '</div>';

  stacks.forEach(function(s, idx) {
    var selected = idx === 0;
    guideHtml += '<div role="tabpanel" id="stack-panel-' + s.id + '" data-stack-panel="' + s.id + '" aria-labelledby="stack-tab-' + s.id + '"' + (selected ? ' tabindex="0"' : ' hidden="until-found"') + '>' +
      '<div class="p-4 rounded-xl bg-gray-900/60 border border-gray-700/50 text-xs text-gray-300 leading-relaxed space-y-2">' +
        s.body +
      '</div>' +
    '</div>';
  });

  guideHtml += '</div>';

  html += '</div>' +
    '<div id="fix-preview" class="mt-4 hidden">' +
      '<div class="flex items-center justify-between mb-2">' +
        '<h3 class="text-sm font-semibold text-gray-300" id="preview-title">' + t('Preview', '预览') + '</h3>' +
        '<button onclick="document.getElementById(\'fix-preview\').classList.add(\'hidden\')" class="text-xs text-gray-500 hover:text-white">' + t('✕ Close', '✕ 关闭') + '</button>' +
      '</div>' +
      '<pre id="preview-content" class="bg-gray-900/70 rounded-xl p-4 text-sm text-gray-300 overflow-x-auto max-h-96 font-mono whitespace-pre-wrap"></pre>' +
    '</div>' +
    guideHtml +
  '</div>';

  return html;
}
