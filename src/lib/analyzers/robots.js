const CHECKS = [
  { id: 'oai-searchbot', label: 'OAI-SearchBot allowed', weight: 3, check: (txt) => /User-agent:\s*OAI-SearchBot/i.test(txt) && /Allow:\s*\//i.test(txt.split(/User-agent:\s*OAI-SearchBot/i)[1].split(/\nUser-agent:/i)[0]) },
  { id: 'perplexity', label: 'PerplexityBot allowed', weight: 3, check: (txt) => /User-agent:\s*PerplexityBot/i.test(txt) && /Allow:\s*\//i.test(txt.split(/User-agent:\s*PerplexityBot/i)[1].split(/\nUser-agent:/i)[0]) },
  { id: 'claudebot', label: 'ClaudeBot allowed', weight: 3, check: (txt) => /User-agent:\s*ClaudeBot/i.test(txt) && /Allow:\s*\//i.test(txt.split(/User-agent:\s*ClaudeBot/i)[1].split(/\nUser-agent:/i)[0]) },
  { id: 'google-extended', label: 'Google-Extended allowed', weight: 3, check: (txt) => /User-agent:\s*Google-Extended/i.test(txt) && /Allow:\s*\//i.test(txt.split(/User-agent:\s*Google-Extended/i)[1].split(/\nUser-agent:/i)[0]) },
  { id: 'gptbot', label: 'GPTBot disallowed', weight: 3, check: (txt) => /User-agent:\s*GPTBot/i.test(txt) && (/Disallow:\s*\//i.test(txt.split(/User-agent:\s*GPTBot/i)[1].split(/\nUser-agent:/i)[0]) || !/Allow:/i.test(txt.split(/User-agent:\s*GPTBot/i)[1].split(/\nUser-agent:/i)[0])) },
  { id: 'anthropic-ai', label: 'anthropic-ai disallowed', weight: 3, check: (txt) => /User-agent:\s*anthropic-ai/i.test(txt) && (/Disallow:\s*\//i.test(txt.split(/User-agent:\s*anthropic-ai/i)[1].split(/\nUser-agent:/i)[0]) || !/Allow:/i.test(txt.split(/User-agent:\s*anthropic-ai/i)[1].split(/\nUser-agent:/i)[0])) },
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
  const score = Math.round((passed / total) * 12);
  return { score, maxScore: 12, checks, passed, total };
}

export { analyzeRobots, CHECKS as ROBOTS_CHECKS };
