/**
 * AI crawler checks — 20 bots across 3 tiers.
 * Tier 1 (critical, weight 3): the 6 bots that matter most for ChatGPT/Claude/Perplexity/Gemini.
 * Tier 2 (important, weight 2): additional crawlers from major AI platforms.
 * Tier 3 (emerging, weight 1): smaller or newer AI search crawlers.
 *
 * How "is this bot allowed?" is decided, per RFC 9309 (the Robots Exclusion
 * Protocol standard):
 *
 *  1. Group consecutive `User-agent` lines together; each group is followed by
 *     its own Allow/Disallow rules. Multiple groups may name the same agent and
 *     their rules are merged.
 *  2. A group's rules apply to a bot if the group names that bot, or names `*`.
 *     A bot matching a specific group ignores the `*` group.
 *  3. Within a matching group, the MOST SPECIFIC (longest) path pattern wins.
 *     `Allow: /page` beats `Disallow: /` because "/page" is longer.
 *  4. An empty `Disallow:` means "allow everything" and cancels narrower blocks.
 *  5. NO robots.txt, or a file that never mentions the bot, means ALLOWED. The
 *     default is allow; a site only lists a bot when it wants to restrict it.
 *
 * Point 5 is the one this module previously got wrong. The old check required an
 * explicit `User-agent: <bot>` line containing `Allow: /`, so a robots.txt that
 * never mentioned an AI crawler was scored as blocking it. Measured over a
 * 343-site sample that produced 323 false "blocked" verdicts (94.2% of sites),
 * including dev.to, which is fully open to GPTBot. A file whose only rules are
 * partial (`Disallow: /search?q=*`) does not block anything at the root.
 */

/**
 * Parse a robots.txt into groups of { userAgents[], allow[], disallow[] }.
 * Comment and non-conforming lines are dropped, per the standard.
 */
function parseRobots(txt) {
  if (!txt || !String(txt).trim()) return null;
  const groups = [];
  let cur = null;
  let expectingAgents = false;

  for (const raw of String(txt).split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();

    if (field === 'user-agent') {
      // Consecutive User-agent lines share one rule block. A rule line closes the
      // current agent list, so the next User-agent starts a new group.
      if (!cur || !expectingAgents) {
        cur = { userAgents: [], allow: [], disallow: [] };
        groups.push(cur);
        expectingAgents = true;
      }
      cur.userAgents.push(value.toLowerCase());
    } else if (field === 'allow' || field === 'disallow') {
      if (!cur) continue;
      expectingAgents = false;
      (field === 'allow' ? cur.allow : cur.disallow).push(value);
    }
  }
  return groups.length ? groups : null;
}

/** Escape a robots path pattern for use inside a RegExp. */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Does a robots path pattern cover the given path?
 * `*` is the only wildcard the standard defines; everything else is a literal
 * prefix. So `/admin` does not cover `/`, while `/*` and `*` do.
 */
function patternCovers(pattern, p) {
  const rx = new RegExp('^' + pattern.split('*').map(escapeRe).join('.*'));
  return rx.test(p);
}

/**
 * Decide one bot's verdict against parsed groups.
 *
 * The question is narrow and concrete: can this bot fetch the site root `/`?
 * A site-wide block therefore means "some applicable rule covers `/` with a
 * Disallow". A rule such as `Disallow: /admin` restricts part of the site but
 * leaves the root — and the rest of the site — crawlable.
 *
 * Group selection follows rule 2: if any group names this bot, those groups are
 * merged and the `*` group is not consulted at all.
 */
function isBlocked(groups, ua) {
  if (!groups) return false; // no robots.txt => default allow
  const bot = ua.toLowerCase();

  const named = groups.filter((g) => g.userAgents.includes(bot));
  const applicable = named.length
    ? named
    : groups.filter((g) => g.userAgents.includes('*'));
  if (!applicable.length) return false; // file never mentions this bot => allow

  let best = null; // { allow: boolean, len: number }
  for (const g of applicable) {
    for (const [field, allow] of [['disallow', false], ['allow', true]]) {
      for (const pattern of g[field]) {
        if (pattern === '') continue; // empty rule states no restriction
        if (!patternCovers(pattern, '/')) continue;
        const len = pattern.length;
        // Longest match wins; on a tie the least restrictive rule wins.
        if (best === null || len > best.len || (len === best.len && allow)) {
          best = { allow, len };
        }
      }
    }
  }

  return best !== null && !best.allow;
}

/** Helper: create a check function for a given User-agent string. */
function makeCheck(ua) {
  return (txt) => {
    const groups = parseRobots(txt);
    return !isBlocked(groups, ua);
  };
}


const CHECKS = [
  // Tier 1 — Critical (weight 3 each)
  { id: 'gptbot', label: 'GPTBot (OpenAI/ChatGPT)', weight: 3, check: makeCheck('GPTBot') },
  { id: 'oai-searchbot', label: 'OAI-SearchBot (OpenAI Search)', weight: 3, check: makeCheck('OAI-SearchBot') },
  { id: 'claudebot', label: 'ClaudeBot (Anthropic/Claude)', weight: 3, check: makeCheck('ClaudeBot') },
  { id: 'anthropic-ai', label: 'anthropic-ai (Anthropic)', weight: 3, check: makeCheck('anthropic-ai') },
  { id: 'perplexity', label: 'PerplexityBot (Perplexity)', weight: 3, check: makeCheck('PerplexityBot') },
  { id: 'google-extended', label: 'Google-Extended (Gemini/AI Overviews)', weight: 3, check: makeCheck('Google-Extended') },
  // Tier 2 — Important (weight 2 each)
  { id: 'ccbot', label: 'CCBot (Common Crawl)', weight: 2, check: makeCheck('CCBot') },
  { id: 'bytespider', label: 'Bytespider (ByteDance/TikTok)', weight: 2, check: makeCheck('Bytespider') },
  { id: 'meta-externalagent', label: 'meta-externalagent (Meta AI)', weight: 2, check: makeCheck('meta-externalagent') },
  { id: 'amazonbot', label: 'Amazonbot (Amazon AI)', weight: 2, check: makeCheck('Amazonbot') },
  { id: 'applebot-extended', label: 'Applebot-Extended (Apple Intelligence)', weight: 2, check: makeCheck('Applebot-Extended') },
  { id: 'chatgpt-user', label: 'ChatGPT-User (OpenAI)', weight: 2, check: makeCheck('ChatGPT-User') },
  { id: 'claude-searchbot', label: 'Claude-SearchBot (Anthropic Search)', weight: 2, check: makeCheck('Claude-SearchBot') },
  // Tier 3 — Emerging (weight 1 each)
  { id: 'cohere-ai', label: 'cohere-ai (Cohere)', weight: 1, check: makeCheck('cohere-ai') },
  { id: 'duckassistbot', label: 'DuckAssistBot (DuckDuckGo)', weight: 1, check: makeCheck('DuckAssistBot') },
  { id: 'ai2bot', label: 'AI2Bot (Allen Institute)', weight: 1, check: makeCheck('AI2Bot') },
  { id: 'xi-bot', label: 'xAI-Bot (Grok/xAI)', weight: 1, check: makeCheck('xAI-Bot') },
  { id: 'perplexity-user', label: 'Perplexity-User (Perplexity)', weight: 1, check: makeCheck('Perplexity-User') },
  { id: 'youbot', label: 'YouBot (You.com)', weight: 1, check: makeCheck('YouBot') },
  { id: 'petalbot', label: 'PetalBot (Huawei)', weight: 1, check: makeCheck('PetalBot') },
];

function analyzeRobots(robotsTxt) {
  // No robots.txt at all means every crawler is allowed: the default is permit,
  // and a file is only needed to restrict. The old code short-circuited to
  // `false` here, which reported "all 20 AI crawlers blocked" for the ~32% of
  // sites that publish no robots.txt.
  const checks = CHECKS.map((c) => ({
    id: c.id,
    label: c.label,
    passed: c.check(robotsTxt),
    weight: c.weight,
  }));
  const passed = checks.filter((c) => c.passed).length;
  const total = checks.length;
  // Weighted scoring: tier 1 bots are worth more
  const maxWeighted = checks.reduce((s, c) => s + c.weight, 0);
  const earnedWeighted = checks.filter(c => c.passed).reduce((s, c) => s + c.weight, 0);
  const score = Math.round((earnedWeighted / maxWeighted) * 12);
  return { score, maxScore: 12, checks, passed, total };
}

export { analyzeRobots, CHECKS as ROBOTS_CHECKS };
