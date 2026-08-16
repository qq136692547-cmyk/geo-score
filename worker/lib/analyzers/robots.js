/**
 * AI crawler checks — 20 bots across 3 tiers.
 * Tier 1 (critical, weight 3): the 6 bots that matter most for ChatGPT/Claude/Perplexity/Gemini.
 * Tier 2 (important, weight 2): additional crawlers from major AI platforms.
 * Tier 3 (emerging, weight 1): smaller or newer AI search crawlers.
 */

/** Helper: create a check function for a given User-agent string. */
function makeCheck(ua) {
  return (txt) => {
    if (!txt) return false;
    const re = new RegExp('User-agent:\\s*' + ua.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const m = re.exec(txt);
    if (!m) return false;
    // Look at the block after this User-agent line until the next User-agent
    const after = txt.slice(m.index + m[0].length);
    const nextUA = after.search(/\nUser-agent:/i);
    const block = nextUA >= 0 ? after.slice(0, nextUA) : after;
    return /Allow:\s*\//i.test(block);
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
  const checks = CHECKS.map((c) => ({
    id: c.id,
    label: c.label,
    passed: robotsTxt ? c.check(robotsTxt) : false,
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
