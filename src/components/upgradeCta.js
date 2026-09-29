var IS_ZH = (document.documentElement.lang || 'en').toLowerCase().indexOf('zh') === 0;
function t(en, zh) { return IS_ZH ? zh : en; }

function bucket(score) {
  if (score < 60) return 'low';
  if (score < 68) return 'mid';
  return 'high';
}

function priorityFixCount(r) {
  if (!r || !r.recommendations || !r.recommendations.length) return 0;
  return r.recommendations.filter(function(x) { return x.priority === 'high'; }).length;
}

var BTN_CLS = 'inline-block px-4 py-2.5 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-geo-600 to-brand-600 hover:from-geo-500 hover:to-brand-500 transition cursor-pointer';

function ctaShell(title, bodyHtml, btnHtml) {
  return '<div class="stagger-section card p-6 mb-8 border-brand-500/20">' +
    '<h3 class="text-base font-bold mb-2">' + title + '</h3>' +
    '<div class="text-sm text-gray-400">' + bodyHtml + '</div>' +
    btnHtml +
    '</div>';
}

function renderPrimary(r) {
  var b = bucket(r.score);
  var pricingHref = IS_ZH ? '/zh/pricing/' : '/pricing/';

  if (b === 'low') {
    var n = priorityFixCount(r);
    var title = n > 0
      ? t('Your site has ' + n + ' priority fixes this run', '你的站这次有 ' + n + ' 项优先修复项')
      : t('There are still items worth verifying', '仍有需要验证的项');
    var body = t(
      'Whether the fixes actually took effect still needs a re-check. Want me to run it weekly and alert you when the score changes?',
      '改完后是否生效仍需要复查。要我每周替你跑一次，分数变了就通知你吗？'
    );
    var compare = '<div class="mt-4 grid grid-cols-2 gap-3 text-sm">' +
        '<div class="rounded-lg bg-white/5 p-3"><div class="text-xs text-gray-500 mb-1">' + t('This run', '本次') + '</div><div class="font-mono font-bold text-gray-200">' + r.score + ' · ' + (r.timestamp || '') + '</div></div>' +
        '<div class="rounded-lg bg-white/5 p-3"><div class="text-xs text-gray-500 mb-1">' + t('Next', '下次') + '</div><div class="text-gray-400">' + t('To be re-checked', '待复查') + '</div></div>' +
      '</div>' +
      '<p class="mt-2 text-xs text-gray-500">' + t('One check gives you a baseline; continuous monitoring tells you when that baseline changes.', '一次检测给你基线；持续监测告诉你基线何时变化。') + '</p>';
    var btn = '<a href="' + pricingHref + '" data-cta-id="result_monitor" data-cta-placement="primary" class="mt-4 ' + BTN_CLS + '">' + t('Track this site continuously', '持续跟踪这个站') + '</a>';
    return ctaShell(title, body + compare, btn);
  }

  if (b === 'mid') {
    var title2 = t(r.score + ' sits in the "workable basics, no clear edge" range', r.score + ' 分处在“基础能用、差异未拉开”的区间');
    var body2 = t(
      'When competing with peers, what matters more is whether an AI answer would actually mention your site. Pro includes a content-based AI visibility simulation.',
      '和同行竞争时，更值得验证的是 AI 回答会不会提到你的站。Pro 提供基于网页内容的 AI 可见性模拟。'
    );
    var btn2 = '<a href="' + pricingHref + '" data-cta-id="result_visibility" data-cta-placement="primary" class="mt-4 ' + BTN_CLS + '">' + t('See what Pro includes', '查看 Pro 包含什么') + '</a>';
    return ctaShell(title2, body2, btn2);
  }

  var title3 = t(r.score + ' means the basics have no obvious problems', r.score + ' 分说明基础没有明显问题');
  var body3 = t(
    'The score alone cannot prove an AI answer will mention your site. Pro includes a content-based AI visibility simulation.',
    '分数本身不能证明 AI 会在回答里提到你的站。Pro 提供基于网页内容的 AI 可见性模拟。'
  );
  var btn3 = '<a href="' + pricingHref + '" data-cta-id="result_visibility" data-cta-placement="primary" class="mt-4 ' + BTN_CLS + '">' + t('See what Pro includes', '查看 Pro 包含什么') + '</a>';
  return ctaShell(title3, body3, btn3);
}

function renderLead(r) {
  return '<div class="stagger-section card p-6 mb-8">' +
    '<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">' +
      '<div class="text-sm font-semibold">' + t('Got the files, but not sure how to put them on your site?', '文件拿到了，但不确定怎么放到网站上？') + '</div>' +
      '<button type="button" data-cta-id="result_lead" data-cta-action="lead-toggle" class="' + BTN_CLS + ' whitespace-nowrap">' + t('Help me fix it', '我来帮你修') + '</button>' +
    '</div>' +
    '<div id="lead-entry-form" class="hidden mt-5 pt-5 border-t border-gray-700/50">' +
      '<p class="text-sm text-gray-400 mb-3">' + t('Leave your email — anan will look at this run and tell you the first 3 things to fix.', '留下邮箱，anan 会看你的这次结果，告诉你先改哪 3 项。') + '</p>' +
      '<label class="block text-xs text-gray-500 mb-1" for="lead-email">' + t('Email', '邮箱') + '</label>' +
      '<input id="lead-email" type="email" autocomplete="email" placeholder="you@example.com" class="w-full px-3 py-2 mb-3 rounded-lg bg-white/5 border border-gray-700 text-sm text-gray-200 focus:border-brand-500 outline-none" />' +
      '<label class="flex items-start gap-2 mb-3 text-xs text-gray-400 cursor-pointer">' +
        '<input id="lead-consent" type="checkbox" class="mt-0.5" />' +
        '<span>' + t('I agree that GeoScore may contact me at this email about this check.', '我同意 GeoScore 使用此邮箱就本次检测结果联系我。') + '</span>' +
      '</label>' +
      '<p class="text-xs text-gray-500 mb-3">' + t('We ask for your email only to reply about this check; no ads, no third parties. Operator: anan · qq136692547@gmail.com', '需要邮箱是为了回复这次检测；不发广告，不提供给第三方。运营者：anan · qq136692547@gmail.com') + '</p>' +
      '<button type="button" data-cta-id="result_lead" data-cta-action="lead-submit" class="' + BTN_CLS + '">' + t('Send', '发送') + '</button>' +
      '<p id="lead-status" class="text-xs mt-3" role="status" aria-live="polite"></p>' +
    '</div>' +
    '</div>';
}

export function renderUpgradeCta(r, placement) {
  if (!r || typeof r.score !== 'number') return '';
  if (placement === 'primary') return renderPrimary(r);
  if (placement === 'lead') return renderLead(r);
  return '';
}
