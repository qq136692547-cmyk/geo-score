// Verify the robots.txt parser used by the study, including that it catches the bug
// a naive regex would introduce. Without this, "82% of sites block AI crawlers"
// would just be a number produced by an unverified string match.
import { readFileSync } from 'node:fs';

// The function is not exported by run-audit.mjs (it is a script). Re-declare it here
// verbatim so the test actually covers the same logic, and assert the two copies match.
const src = readFileSync('D:/Codex/projects/geo-score/tools/run-audit.mjs', 'utf8');
const start = src.indexOf('function robotsVerdict');
const end = src.indexOf('\nasync function one');
const verbatim = src.slice(start, end);
const mod = await import('data:text/javascript;base64,' + Buffer.from(verbatim).toString('base64') + ';export {robotsVerdict};').catch(() => null);

let pass = 0, fail = 0;
const rows = [];
function rec(id, ok, note) { rows.push(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${note}`); ok ? pass++ : fail++; }

// If the dynamic import failed, fall back to evaluating the extracted source.
let robotsVerdict;
if (mod && mod.robotsVerdict) {
  robotsVerdict = mod.robotsVerdict;
} else {
  const fn = new Function(verbatim + '\nreturn robotsVerdict;')();
  robotsVerdict = fn;
}

// --- the case a naive regex gets WRONG ---
// "Disallow: /login" is a partial rule; the site is NOT blocked.
rec('partial-disallow-is-not-blocked',
  robotsVerdict('User-agent: *\nDisallow: /login\nDisallow: /admin').anyAiBlocked === 0,
  '"Disallow: /login" must not count as blocked');

// --- the case a naive regex gets WRONG in the other direction ---
// A comment mentioning Disallow: / must not count either.
rec('comment-is-ignored',
  robotsVerdict('User-agent: *\n# Disallow: /\nAllow: /').anyAiBlocked === 0,
  'commented-out Disallow must not count');

// --- genuine blanket block ---
rec('blanket-block-detected',
  robotsVerdict('User-agent: *\nDisallow: /').anyAiBlocked === 1,
  'User-agent:* + Disallow:/ is blocked');

// --- missing robots.txt counts as blocked (crawler cannot read any allow rule) ---
rec('missing-robots-counts-as-blocked',
  robotsVerdict('').anyAiBlocked === 1 && robotsVerdict(null).hasRobots === 0,
  'no robots.txt => AI crawlers have no explicit permission');

// --- per-crawler targeting ---
const targeted = robotsVerdict('User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /');
rec('crawler-specific-block',
  targeted.gptbotBlocked === 1 && targeted.anyAiBlocked === 1,
  'GPTBot specifically disallowed');

// --- two groups with the same UA are MERGED per RFC 9309 2.2.1, then the most
// specific (longest) match wins. "Disallow: /" (len 1) beats "Disallow:" (len 0),
// so the block stands. An earlier draft of this test expected "allow" here and was wrong.
rec('same-ua-groups-merge-longest-match-wins',
  robotsVerdict('User-agent: *\nDisallow: /\nUser-agent: *\nDisallow:').anyAiBlocked === 1,
  'merged groups: / is more specific than the empty rule, so blocked');

// --- a realistic permissive file ---
rec('permissive-file-not-blocked',
  robotsVerdict('User-agent: *\nAllow: /\n\nSitemap: https://x.com/sitemap.xml').anyAiBlocked === 0,
  'Allow:/ is not blocked');

// --- the file the real scanner saw for roadmap.sh (from the earlier probe) ---
const roadmap = `User-agent: *

# Utility/internal endpoints
Disallow: /og/

# Auth/account pages
Disallow: /login
Disallow: /signup
Disallow: /forgot-password`;
const r = robotsVerdict(roadmap);
rec('real-world-sample-parsed', r.anyAiBlocked === 0 && r.hasRobots === 1,
  'roadmap.sh robots.txt has only partial disallows => not blocked');

// --- mutation check: break the parser on purpose, the tests above must fail ---
// Guard: the mutation target must still exist, otherwise this check silently
// degrades into "no mutation happened" and reports a meaningless result.
const MUTATION_FROM = "if (d === '/' || d === '*') return true;";
rec('mutation-target-exists', verbatim.includes(MUTATION_FROM),
  'the line the mutation replaces is still present');
const broken = verbatim.replace(MUTATION_FROM, "return true; // mutated")
  + '\nreturn robotsVerdict;';
rec('mutation-was-applied', broken !== verbatim + '\nreturn robotsVerdict;',
  'the mutation actually changed the source');
let mutatedCaught = false;
try {
  const bad = new Function(broken)();
  // With the mutation, partial disallow is now treated as a full block.
  mutatedCaught = bad('User-agent: *\nDisallow: /login').anyAiBlocked === 1;
} catch (e) { mutatedCaught = true; }
rec('mutation-is-caught', mutatedCaught,
  'a broken parser flips the partial-disallow case, proving these assertions have teeth');

console.log(rows.join('\n'));
console.log(`\n==== PASS ${pass} / FAIL ${fail} ====`);
