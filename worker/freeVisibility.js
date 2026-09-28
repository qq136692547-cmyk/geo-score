/**
 * Free-tier AI visibility entry point.
 *
 * Implements the PRD §12.5 decision order for non-Pro users, plus the §12.6
 * payload boundary (a free check never creates a monitored site) and the §12.7
 * prechecks. Only the Worker is authoritative - the front end may grey out the
 * button, but it is never a security boundary.
 *
 * Steps 1-2 of the order (requireAuth / resolvePlan) stay in pro.js, because the
 * resolved plan is what decides whether this path is taken at all.
 *
 * Implemented here:
 *   3    google-only identity + disposable-mailbox blacklist
 *   3b   public http(s) URL only (§12.6) - runs before any state change, so an
 *        invalid URL can never burn the user's single free check
 *   3c   global LLM budget precheck (§12.7)
 *   4    IP 24h / host 72h cooldown
 *   5-7  UTC month rollover, read free_vis_used, optimistic-lock claim
 *   9-11 fetch the page, run one engine (FREE_ENGINES), store with site_id NULL
 * Step 8's atomic call counting sits in visibility.js next to the call it counts.
 *
 * DEVIATION from the literal §12.5 order: the spec lists the budget precheck as
 * step 8, after the step-7 claim. Claiming first would let a global cost cap
 * silently eat a user's one monthly free check and then answer 429. The precheck
 * therefore runs before the claim. The guardrail itself is unchanged - when the
 * budget is exhausted, no fetch and no LLM call happen either way.
 */

import {
  FREE_ENGINES,
  FREE_IP_COOLDOWN_SEC,
  FREE_HOST_COOLDOWN_SEC,
  inspectPublicUrl,
  evaluateFreeEligibility,
  consumeFreeCheck,
  currentPeriodEndUtc,
} from './visibilityQuota.js';
import {
  cooldownStatus,
  recordCooldown,
  readLlmCalls,
  llmMonthlyCallBudget,
  evaluateLlmBudget,
} from './guardrails.js';
import { runVisibilityCheck } from './visibility.js';

function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

/**
 * Client IP for the abuse cooldown. CF-Connecting-IP is set by Cloudflare on
 * every request to a Worker; X-Forwarded-For is only a fallback for local runs.
 * A missing IP is logged and skipped rather than rejected: the per-account
 * quota, the host cooldown and the global budget still bound the damage, while
 * a 400 here would take the feature down for every user at once.
 */
export function extractClientIp(request) {
  const headers = request && request.headers;
  if (!headers) return '';
  const direct = headers.get('CF-Connecting-IP');
  if (direct) return String(direct).trim().toLowerCase();
  const forwarded = headers.get('X-Forwarded-For');
  if (forwarded) return String(forwarded).split(',')[0].trim().toLowerCase();
  return '';
}

/**
 * §12.6: the free path takes a caller-supplied address. Build a URL from
 * `url`/`host`, then let inspectPublicUrl reject everything that is not a public
 * http(s) endpoint.
 */
function resolveTargetUrl(body) {
  const raw = String((body && (body.url || body.host)) || '').trim();
  if (!raw) return { ok: false, reason: 'missing url' };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)) {
    return { ok: false, reason: 'only http/https allowed' };
  }
  const normalized = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
  return inspectPublicUrl(normalized);
}

/**
 * POST /api/visibility/check for a non-Pro caller. Returns a Response so the
 * whole decision order is reachable from a single unit test.
 */
export async function runFreeVisibilityCheck(env, request, user, body, corsHeaders) {
  if (!env.TOKENRHYTHM_API_KEY) {
    return json({ error: 'AI visibility check unavailable' }, 503, corsHeaders);
  }

  // Step 3 - cheap identity checks first, no state touched yet.
  const eligibility = evaluateFreeEligibility(user, env);
  if (!eligibility.eligible) {
    const status = eligibility.reason === 'not_authenticated' ? 401 : 403;
    return json({
      error: status === 401 ? 'Unauthorized' : 'Free check requires a Google sign-in',
      code: eligibility.reason,
    }, status, corsHeaders);
  }

  // Step 3b - §12.6 public-URL guard, before the claim below.
  const target = resolveTargetUrl(body);
  if (!target.ok) {
    return json({ error: 'URL not allowed', code: 'url_not_allowed', reason: target.reason }, 400, corsHeaders);
  }

  const now = Math.floor(Date.now() / 1000);
  const periodEnd = currentPeriodEndUtc(now);

  // Step 3c - §12.7 budget precheck, ahead of the quota claim (see file header).
  const budget = evaluateLlmBudget(await readLlmCalls(env, now), llmMonthlyCallBudget(env), false);
  if (budget.level === 'warn') console.log('llm budget warning: ' + JSON.stringify(budget));
  if (!budget.ok) {
    return json({
      error: 'AI visibility check is temporarily unavailable',
      code: budget.code,
      budget,
      retry_after: periodEnd - now,
    }, 429, corsHeaders);
  }

  // Step 4 - abuse cooldowns.
  const ip = extractClientIp(request);
  if (!ip) console.log('free visibility: no client IP header, ip cooldown skipped');
  if (ip) {
    const ipCooldown = await cooldownStatus(env, 'ip', ip, FREE_IP_COOLDOWN_SEC, now);
    if (!ipCooldown.ok) {
      return json({
        error: 'Free check already used from this network',
        code: 'ip_cooldown',
        retry_after: ipCooldown.retry_after,
      }, 429, corsHeaders);
    }
  }
  const hostCooldown = await cooldownStatus(env, 'host', target.host, FREE_HOST_COOLDOWN_SEC, now);
  if (!hostCooldown.ok) {
    return json({
      error: 'Free check already used for this domain',
      code: 'host_cooldown',
      retry_after: hostCooldown.retry_after,
    }, 429, corsHeaders);
  }

  // Steps 5-7 - period rollover + optimistic-lock claim.
  const claimed = await consumeFreeCheck(env, user, now);
  if (!claimed.ok) {
    return json({
      error: claimed.reason === 'concurrent_request'
        ? 'Another check is already in progress'
        : 'Free check already used this month',
      code: claimed.reason,
      remaining: 0,
      retry_after: claimed.reason === 'quota_exhausted' ? periodEnd - now : undefined,
    }, 429, corsHeaders);
  }

  // Record the windows only after the claim succeeded, so a rejected request
  // never spends a cooldown. Best-effort: the quota is already consumed, so a
  // failed write cannot be turned into extra checks by the same account.
  try {
    if (ip) await recordCooldown(env, 'ip', ip, now);
    await recordCooldown(env, 'host', target.host, now);
  } catch (err) {
    console.log('free visibility: cooldown write failed: ' + String(err && err.message ? err.message : err));
  }

  // Steps 9-11 - fetch, one engine, store. §12.6: site_id stays NULL so a free
  // check never consumes one of the Pro monitored-domain slots.
  const site = { id: null, user_id: user.id, email: user.email, host: target.host, url: target.url };
  let result;
  try {
    result = await runVisibilityCheck(env, site, { engines: FREE_ENGINES });
  } catch (err) {
    return json(
      { error: String(err && err.message ? err.message : err).slice(0, 300), plan: 'free', remaining: 0 },
      500,
      corsHeaders
    );
  }

  return json({
    ...result,
    plan: 'free',
    engines_run: FREE_ENGINES,
    remaining: 0,
    period_end: periodEnd,
  }, 200, corsHeaders);
}
