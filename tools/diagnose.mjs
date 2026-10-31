/**
 * One URL in, one paste-ready diagnosis paragraph out.
 *
 * WHY THIS EXISTS
 * The $49 gig promises "message me your store URL and get a free diagnosis".
 * That promise is the whole acquisition loop, and it only survives if writing
 * the diagnosis takes about a minute. If it takes twenty, nobody keeps it up for
 * two weeks — so the reply is generated here instead of being written by hand.
 *
 * WHAT IT DOES NOT DO
 * It does not invent anything. If the evidence line is unknown, the paragraph
 * carries the URL and the defect and says nothing it cannot back. If the page
 * cannot be fetched at all, it refuses to produce a paragraph rather than
 * guessing at what is wrong. And it never claims a citation, a ranking, or an
 * improvement — those are the claims that turn a $49 delivery into a dispute.
 *
 * Ranking is imported from tools/build-targets.mjs on purpose: the sales
 * priority there (a blocked crawler outranks a heavier but duller defect) is the
 * same judgement this paragraph needs, and two copies would drift.
 *
 * Usage:
 *   node tools/diagnose.mjs <url> [--zh] [--json]
 */
import { auditUrl } from '../src/lib/node-scanner.js';
import {
  pickTopDefect,
  buildEvidence,
  normalizeHost,
} from './build-targets.mjs';

const ZH = process.argv.includes('--zh');
const AS_JSON = process.argv.includes('--json');
const target = process.argv.slice(2).find((a) => !a.startsWith('--'));

/**
 * Top N defects, using the exact ranking from build-targets.
 *
 * pickTopDefect returns one. To get the next, mask the winner as passed and ask
 * again — that reuses the tier/weight/dimension ordering instead of restating
 * it here.
 *
 * At most one defect per dimension: two crawlers blocked by the same robots.txt
 * is one finding, and printing it twice reads like a mail-merge that fired
 * twice. The sibling count is added to the sentence instead.
 */
export function pickDefects(dimensions, count) {
  const dims = dimensions || {};
  const found = [];
  const masked = {};
  for (const [key, dim] of Object.entries(dims)) {
    masked[key] = { ...dim, checks: Array.isArray(dim && dim.checks) ? dim.checks.slice() : [] };
  }
  // Budget on real work, not on `count * 4`: a site whose robots.txt blocks all
  // twenty crawlers would otherwise burn the whole budget inside one dimension
  // and never reach the llms.txt and schema gaps behind it.
  let budget = 0;
  for (const dim of Object.values(masked)) {
    budget += dim.checks.filter((c) => c && !c.passed).length;
  }
  const seen = new Set();
  for (let i = 0; i < budget && found.length < count; i++) {
    const top = pickTopDefect(masked);
    if (!top) break;
    const dim = masked[top.dimension];
    if (!dim) break;
    const idx = dim.checks.findIndex((c) => c && c.id === top.id);
    if (idx < 0) break;
    dim.checks[idx] = { ...dim.checks[idx], passed: true };
    if (seen.has(top.dimension)) continue;
    seen.add(top.dimension);
    found.push(top);
  }
  return found;
}

/**
 * The dimensions the $49 pack actually changes.
 *
 * The pack ships three artefacts — Product JSON-LD, a robots.txt rule, an
 * llms.txt — so only gaps those three can close are sellable. Naming a defect
 * we cannot fix turns a $49 order into a dispute, and it wastes the one message
 * a stranger will read.
 *
 * discoveryEndpoints is deliberately absent: `.well-known/ai.txt`,
 * `/ai/summary.json` and `/ai/faq.json` are the most common gap in our 324-site
 * study, but they are not in the pack, so the paragraph must not mention them.
 */
const SELLABLE = new Set(['aiCrawlability', 'aiGuidance', 'structuredData']);

/**
 * Mask every dimension the paragraph is not allowed to talk about, so the
 * existing ranking can be reused instead of restated.
 *
 * Two things get masked:
 *   1. dimensions outside SELLABLE — we cannot fix them;
 *   2. structuredData unless `props` is what failed. The pack delivers Product
 *      JSON-LD; when only `article`/`faq`/`howto` fail the real gap is blog
 *      markup, and offering a Product file for it would be selling the wrong
 *      thing.
 *
 * The test is "does any check in here fail", NOT "did this dimension lose
 * points". Those differ: blocking a single weight-1 crawler leaves
 * aiCrawlability at 12/12 after rounding, so a score-based test reported no
 * defect while robots.txt was literally blocking PetalBot at the root — and the
 * refusal letter then told the merchant we found nothing wrong with their
 * crawler rules, which they could disprove by opening the file. A failing check
 * in a sellable dimension is a real, fixable gap whether or not the rounding
 * shows it.
 */
export function maskUnsellable(dimensions) {
  const dims = dimensions || {};
  const out = {};
  for (const [key, dim] of Object.entries(dims)) {
    const checks = Array.isArray(dim && dim.checks) ? dim.checks : [];
    const anyFailing = checks.some((c) => c && !c.passed);
    const propsFailing = key === 'structuredData'
      && checks.some((c) => c && c.id === 'props' && !c.passed);
    const usable = SELLABLE.has(key) && anyFailing && (key !== 'structuredData' || propsFailing);
    if (usable && key === 'structuredData') {
      // `props` is the gap the pack closes. If `org` or `article` also fail they
      // outrank it, and we would end up offering a Product file for a blog
      // problem — so only `props` is left standing here.
      out[key] = {
        ...dim,
        checks: checks.map((c) => (c && c.id === 'props' ? { ...c } : { ...c, passed: true })),
      };
      continue;
    }
    out[key] = usable
      ? { ...dim, checks: checks.slice() }
      : { ...dim, checks: checks.map((c) => ({ ...c, passed: true })) };
  }
  return out;
}

/** Crawler ids that read as a product name in a sentence. */
function crawlerName(id) {
  const MAP = {
    gptbot: 'GPTBot',
    'oai-searchbot': 'OAI-SearchBot',
    'chatgpt-user': 'ChatGPT-User',
    claudebot: 'ClaudeBot',
    'anthropic-ai': 'anthropic-ai',
    perplexity: 'PerplexityBot',
    'perplexity-user': 'Perplexity-User',
    'google-extended': 'Google-Extended',
    ccbot: 'CCBot',
    bytespider: 'Bytespider',
    'applebot-extended': 'Applebot-Extended',
    'meta-externalagent': 'meta-externalagent',
    // Ids that actually appear in the crawler checks; a missing entry prints a
    // bare lowercase id mid-sentence ("blocks petalbot from the site root").
    amazonbot: 'Amazonbot',
    'claude-searchbot': 'Claude-SearchBot',
    'cohere-ai': 'cohere-ai',
    duckassistbot: 'DuckAssistBot',
    petalbot: 'PetalBot',
    'diffbot': 'Diffbot',
    'ai2bot': 'AI2Bot',
    'xi-bot': 'xAI-Bot',
    'youbot': 'YouBot',
    timpibot: 'Timpibot',
    omgilibot: 'omgilibot',
    imagesift: 'ImagesiftBot',
  };
  return MAP[id] || id;
}

/**
 * Check id → the thing that is actually missing, in words we can stand behind.
 *
 * Every label in the scorer is phrased as the *desired state* — "Organization
 * schema present", "About page link found", "Has H1 + blockquote structure".
 * A failing check means the opposite of its label, so quoting the label would
 * tell the merchant their site is fine in the same sentence that calls it
 * broken. The gap is therefore named here, from the id, never copied from the
 * label.
 */
const CHECK_GAP = {
  org: { zh: 'Organization schema', en: 'Organization schema' },
  article: { zh: '文章页的 Article schema', en: 'Article schema on blog posts' },
  faq: { zh: 'FAQPage schema', en: 'FAQPage schema' },
  howto: { zh: 'HowTo schema', en: 'HowTo schema' },
  exists: { zh: 'llms.txt 本身', en: 'file presence' },
  structure: { zh: 'H1 与 blockquote 结构', en: 'H1 and blockquote structure' },
  areas: { zh: '分区章节', en: 'area sections' },
  links: { zh: '描述性链接', en: 'descriptive links' },
};

function gapWords(id) {
  return CHECK_GAP[id] || { zh: '结构', en: 'its structure' };
}

/**
 * Turn one defect into a sentence a merchant can act on.
 * `siblings` is how many other checks in the same dimension failed.
 */
function defectSentence(defect, evidence, zh, index, siblings = 0) {
  const ordinal = index === 0 ? (zh ? '最该先修的是：' : 'The first thing to fix:')
    : (zh ? '第二处是：' : 'Second:');

  if (defect.dimension === 'aiCrawlability') {
    const name = crawlerName(defect.id);
    const head = zh
      ? `${ordinal}robots.txt 把 ${name} 挡在根路径外，等于全站不让它进`
      : `${ordinal} your robots.txt blocks ${name} from the site root, which keeps that crawler off everything`;
    const more = siblings > 0
      ? (zh
        ? `（另外还有 ${siblings} 个 AI 爬虫被同样挡住）`
        : (siblings === 1
          ? ' (and one other AI crawler is blocked the same way)'
          : ` (and ${siblings} other AI crawlers are blocked the same way)`))
      : '';
    const quote = evidence.evidenceLine && evidence.evidenceLine !== 'unknown'
      ? (zh ? `（原文：${evidence.evidenceLine}）` : ` (the rule reads: ${evidence.evidenceLine})`)
      : '';
    return `${head}${more} — ${evidence.evidenceUrl}${quote}`;
  }

  if (defect.dimension === 'aiGuidance') {
    // We know only that nothing came back — not that it was a 404. See
    // llmsEvidenceLine: the fetcher collapses 403, 429, 5xx, timeouts and an
    // empty 200 into the same null.
    const missing = evidence.evidenceLine === 'GET /llms.txt -> nothing returned';
    if (missing) {
      return zh
        ? `${ordinal}我们在 /llms.txt 上什么也没读到，AI 代理进来时没有任何文件说明这是什么 — ${evidence.evidenceUrl}`
        : `${ordinal} nothing came back from /llms.txt, so an agent arriving has nothing describing the site — ${evidence.evidenceUrl}`;
    }
    // The length label reads "Under 200 lines (403)" — a pass-state statement
    // carrying the number that failed. Use the number, not the claim.
    if (defect.id === 'length') {
      const label = String(defect.label);
      const lines = label.match(/Under 200 lines \((\d+)\)/) ? label.match(/Under 200 lines \((\d+)\)/)[1] : '';
      if (lines) {
        return zh
          ? `${ordinal}llms.txt 有 ${lines} 行，超过我们采用的 200 行上限 — ${evidence.evidenceUrl}`
          : `${ordinal} the llms.txt runs to ${lines} lines, past the 200-line limit we check against — ${evidence.evidenceUrl}`;
      }
    }
    // "but its area sections does not pass" — a plural gap word breaks the
    // verb agreement, so the check is named instead of the subject.
    const gap = gapWords(defect.id);
    return zh
      ? `${ordinal}llms.txt 在，但「${gap.zh}」这一项没过 — ${evidence.evidenceUrl}`
      : `${ordinal} the llms.txt is there, but it fails the ${gap.en} check — ${evidence.evidenceUrl}`;
  }

  if (defect.dimension === 'structuredData') {
    // `props` is the only structured-data check the pack fixes, and the only
    // one whose label carries a number worth quoting.
    if (defect.id === 'props') {
      const n = (String(defect.label).match(/Avg (\d+) properties/) || [])[1];
      // Zero properties means there is no JSON-LD to complete, so "too thin"
      // would imply a schema block that does not exist.
      if (n === '0') {
        return zh
          ? `${ordinal}页面上没有可读的 JSON-LD 结构化数据，购物端读不到价格、库存和标识符 — ${evidence.evidenceUrl}`
          : `${ordinal} there is no readable JSON-LD on the page at all, so a shopping surface cannot read price, stock or identifiers — ${evidence.evidenceUrl}`;
      }
      if (n) {
        return zh
          ? `${ordinal}结构化数据太薄，每个 schema 平均只有 ${n} 项属性，购物端要 5 项以上才读得全价格、库存和标识符 — ${evidence.evidenceUrl}`
          : `${ordinal} the structured data is too thin — ${n} properties per schema on average, where a shopping surface needs five or more to read price, stock and identifiers — ${evidence.evidenceUrl}`;
      }
    }
    const gap = gapWords(defect.id);
    return zh
      ? `${ordinal}结构化数据不足，缺 ${gap.zh} — ${evidence.evidenceUrl}`
      : `${ordinal} the structured data falls short — missing: ${gap.en} — ${evidence.evidenceUrl}`;
  }

  return zh
    ? `${ordinal}${defect.dimension} 没达标 — ${evidence.evidenceUrl}`
    : `${ordinal} ${defect.dimension} is below the bar — ${evidence.evidenceUrl}`;
}

/** Which files the pack would touch, given what actually failed. */
function fixSummary(defects, zh) {
  const dims = new Set(defects.map((d) => d.dimension));
  const parts = [];
  if (dims.has('structuredData')) parts.push(zh ? '补全 schema 属性（店铺即 Product JSON-LD，含变体报价与标识符）' : 'complete the schema properties — on a store that means Product JSON-LD with variant offers and identifiers');
  if (dims.has('aiCrawlability')) parts.push(zh ? '合并一段 robots.txt 规则，不动现有内容' : 'merge a robots.txt snippet without touching your existing rules');
  if (dims.has('aiGuidance')) parts.push(zh ? '重写一份人工整理的 llms.txt' : 'rewrite a hand-curated llms.txt');
  if (!parts.length) return '';
  return zh
    ? `修的话我们会${parts.join('、')}。`
    : `To fix these we would ${parts.join(', and ')}.`;
}

/**
 * Long hosts are written as paths, not URLs.
 *
 * The greeting already names the site, and a 60-character domain repeated in
 * two evidence links costs ~150 characters — enough to blow the budget on its
 * own. `/robots.txt` is unambiguous once the domain has been stated, and it
 * keeps the guarantee absolute instead of scaling the limit until it means
 * nothing.
 */
const DISPLAY_HOST_MAX = 24;

function displayUrl(url, host) {
  const base = 'https://' + host;
  if (host.length <= DISPLAY_HOST_MAX || !String(url).startsWith(base)) return url;
  return String(url).slice(base.length) || '/';
}

function wordCount(s) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * The paragraph itself. Pure: takes an audit result, returns text.
 * `null` result means the page could not be fetched, and the caller is expected
 * to print the refusal line instead — this function returns '' in that case.
 */
export function buildDiagnosis(result, opts = {}) {
  if (!result || typeof result.score !== 'number') return '';
  const zh = !!opts.zh;
  const host = opts.host || normalizeHost(result.url || '');

  const defects = pickDefects(maskUnsellable(result.dimensions), 2);
  const evidence = defects.map((d) => buildEvidence(host, d, result.raw));

  if (!defects.length) {
    // Wording is a claim about our search, not about the site: "I could not
    // find" stays true even when a dimension is missing from the result
    // entirely, whereas "the structured data is intact" would not.
    return zh
      ? `你好——回复前我跑了 ${host} 的审计，${result.score}/100。这个修复包只管三件事：Product 结构化数据、robots.txt 里的爬虫规则、llms.txt。这三项我都没查出问题，所以这 49 美元我不该收——钱花在别处更值。想看 AI 侧的完整情况，审计本身是免费的：https://geoscore.help/`
      : `Hi — I ran ${host} through our audit before replying; it scores ${result.score}/100. This pack only covers three things: Product structured data, the crawler rules in robots.txt, and llms.txt. I could not find a defect in any of the three, so I should not take your $49 — your money is better spent elsewhere. If you want the fuller picture, the audit itself is free: https://geoscore.help/`;
  }

  // Ask for a product URL only when the gap is product data. On a publisher or
  // a SaaS site that question makes no sense and reads as a template.
  const productGap = defects.some((d) => d.dimension === 'structuredData');

  const blocks = [];
  blocks.push({
    optional: false,
    text: zh
      ? `你好——回复前我跑了 ${host} 的审计，下面都是针对你这个站，不是模板。`
      : `Hi — I ran ${host} through our audit before replying, so this is specific to your page, not a template.`,
  });
  blocks.push({
    optional: false,
    text: zh
      ? `得分 ${result.score}/100${result.level ? `（${result.level}）` : ''}。`
      : `It scores ${result.score}/100${result.level ? ` (${result.level})` : ''}.`,
  });
  blocks.push({
    optional: false,
    text: defects.map((d, i) => {
      const dim = (result.dimensions || {})[d.dimension];
      const siblings = d.dimension === 'aiCrawlability' && dim && Array.isArray(dim.checks)
        ? dim.checks.filter((c) => c && !c.passed && c.id !== d.id).length
        : 0;
      const ev = { ...evidence[i], evidenceUrl: displayUrl(evidence[i].evidenceUrl, host) };
      return defectSentence(d, ev, zh, i, siblings);
    }).join('\n'),
  });
  const fix = fixSummary(defects, zh);
  if (fix) blocks.push({ optional: true, text: fix });
  blocks.push({
    optional: false,
    text: zh
      ? '说清楚一点：没有人能承诺这让 AI 引用你或排名上升，我也不承诺。我能承诺的是文件正确、且对着你的线上页面校验过。'
      : 'One thing I want to be straight about: nobody can promise this gets you cited or ranked by an AI engine, and I will not pretend otherwise. What I can promise is the files being correct and checked against your live page.',
  });
  blocks.push({
    optional: true,
    text: zh
      ? (productGap
        ? '想先做哪款商品，把链接发我，我告诉你还缺哪几项。'
        : '想先从哪个页面开始，把链接发我，我告诉你还缺几项。')
      : (productGap
        ? 'If you want, send me the product URL you would like done first and I will tell you exactly what is missing from it.'
        : 'If you want, send me the page you would like done first and I will tell you exactly what is missing from it.'),
  });

  return fitToBudget(blocks, zh);
}

/** English is budgeted in words, Chinese in characters (it has no word breaks). */
export const BUDGET = { zh: 400, en: 200 };

function measure(text, zh) {
  return zh ? text.length : wordCount(text);
}

/**
 * Drop the optional paragraphs until the message fits.
 *
 * The budget is not decoration: a long Fiverr message does not get read, and a
 * guard that only logs the overage is theatre. Optional blocks are dropped
 * last-first, so the honesty sentence — the one thing that must never be
 * traded away — is never a candidate.
 */
function fitToBudget(blocks, zh) {
  const budget = zh ? BUDGET.zh : BUDGET.en;
  let kept = blocks.slice();
  for (let i = kept.length - 1; i >= 0 && measure(kept.map((b) => b.text).join('\n\n'), zh) > budget; i--) {
    if (kept[i].optional) kept = kept.filter((_, j) => j !== i);
  }
  return kept.map((b) => b.text).join('\n\n');
}

/** Printed instead of a paragraph when the page could not be fetched. */
export function unfetchableNotice(host, error, zh) {
  const why = String((error && error.message) || error || 'unknown').slice(0, 120);
  return zh
    ? `无法抓取 ${host}（${why}）。这种情况不生成诊断——没抓到页面就不该猜它哪里有问题，请人工看一眼。`
    : `Could not fetch ${host} (${why}). No diagnosis produced: without the page there is nothing honest to say about it. Take a manual look.`;
}

async function main() {
  if (!target) {
    console.error('Usage: node tools/diagnose.mjs <url> [--zh] [--json]');
    process.exit(2);
  }
  const host = normalizeHost(target);
  const url = /^https?:\/\//i.test(target) ? target : 'https://' + host;

  let result = null;
  let error = null;
  try {
    result = await auditUrl(url);
  } catch (e) {
    error = e;
  }

  if (!result) {
    const notice = unfetchableNotice(host, error, ZH);
    if (AS_JSON) console.log(JSON.stringify({ host, ok: false, error: String(error && error.message || error), text: notice }, null, 2));
    else console.log(notice);
    process.exit(1);
  }

  const text = buildDiagnosis(result, { host, zh: ZH });
  if (AS_JSON) {
    console.log(JSON.stringify({ host, ok: true, score: result.score, level: result.level, words: wordCount(text), text }, null, 2));
  } else {
    console.log(text);
  }
  console.error(`[diagnose] ${host} score=${result.score} words=${wordCount(text)}`);
}

if (process.argv[1] && /diagnose\.mjs$/.test(process.argv[1])) {
  main();
}
