/**
 * Cost and abuse guardrails for LLM-backed AI visibility checks.
 * Implements PRD §12.5 (decision order steps 4 and 8) and §12.7 (cost guardrails).
 *
 * ============================================================================
 * THE BUDGET NUMBER BELOW IS AN ASSUMPTION, NOT A VENDOR QUOTE.
 * ============================================================================
 * PRD §12.7 and checklist line 445 require the real TOKENRHYTHM input/output
 * prices to be confirmed against the account's own GET /v1/models before any
 * dollar figure is treated as authoritative. Until that is done, this default
 * only exists so the circuit breaker has a shape. Override it at runtime with
 * the LLM_MONTHLY_CALL_BUDGET var/secret instead of editing this file.
 *
 * Derivation of the current placeholder (from secondary sources, UNVERIFIED):
 *   model deepseek-v4-flash-0731, list CNY 1 / 2 per 1M tokens (input/output)
 *   1 engine call = ~1050 input tok + <=500 output tok
 *                 = 1050e-6 * 1 + 500e-6 * 2 = CNY 0.00205 per call
 *   USD 5/month ~ CNY 36 -> ~17,500 calls; 12000 keeps ~30% headroom.
 * If the verified price differs, recompute and change only the env var.
 */

export const LLM_MONTHLY_CALL_BUDGET_DEFAULT = 12000;

const WARN_RATIO = 0.8;        // >= 80%  -> log a warning, keep serving
const BLOCK_FREE_RATIO = 1.0;  // >= 100% -> refuse non-Pro callers
const BLOCK_ALL_RATIO = 1.5;   // >= 150% -> refuse every caller

/** UTC 'YYYY-MM', the budget accounting period. */
export function currentMonthUtc(now) {
  const d = new Date(now * 1000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}

export function llmMonthlyCallBudget(env) {
  const raw = Number(env && env.LLM_MONTHLY_CALL_BUDGET);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : LLM_MONTHLY_CALL_BUDGET_DEFAULT;
}

export async function readLlmCalls(env, now) {
  const row = await env.DB.prepare('SELECT calls FROM llm_counters WHERE month=?')
    .bind(currentMonthUtc(now))
    .first();
  return row && Number.isFinite(row.calls) ? row.calls : 0;
}

/**
 * Atomically add n to the current month's call counter.
 *
 * D1 has no transactions across statements, so the increment must be a single
 * UPSERT with `calls = calls + ?`. A read-then-write would lose counts under
 * concurrency and let a burst slip past the circuit breaker.
 */
export async function incrLlmCalls(env, now, n) {
  const delta = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  const month = currentMonthUtc(now);
  await env.DB.prepare(
    'INSERT INTO llm_counters (month, calls, updated_at) VALUES (?, ?, ?) ON CONFLICT(month) DO UPDATE SET calls = calls + ?, updated_at = ?'
  ).bind(month, delta, now, delta, now).run();
  return delta;
}

/**
 * Pure tier evaluation, no DB access so every boundary is unit-testable.
 * level: 'ok' | 'warn' | 'block_free' | 'block_all'
 */
export function evaluateLlmBudget(calls, limit, isPro) {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : LLM_MONTHLY_CALL_BUDGET_DEFAULT;
  const safeCalls = Number.isFinite(calls) && calls > 0 ? calls : 0;
  const ratio = safeCalls / safeLimit;
  let level = 'ok';
  if (ratio >= BLOCK_ALL_RATIO) level = 'block_all';
  else if (ratio >= BLOCK_FREE_RATIO) level = 'block_free';
  else if (ratio >= WARN_RATIO) level = 'warn';
  const blocked = level === 'block_all' || (level === 'block_free' && !isPro);
  return {
    ok: !blocked,
    level,
    code: level === 'ok' ? null : 'llm_budget_' + level,
    calls: safeCalls,
    limit: safeLimit,
    ratio: Math.round(ratio * 10000) / 10000,
  };
}

/**
 * Salted hash for cooldown keys so raw IPs are never persisted (PRD §12.4).
 * There is deliberately no public fallback salt: an unhashed or guessable key
 * would make the table a plain IP log again.
 */
export async function hashCooldownValue(env, value) {
  const salt = (env && env.COOLDOWN_SALT) || (env && env.JWT_SECRET);
  if (!salt) throw new Error('cooldown salt unavailable');
  const data = new TextEncoder().encode(salt + '|' + String(value));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function cooldownKey(env, scope, value) {
  return scope === 'ip' ? await hashCooldownValue(env, value) : String(value);
}

/**
 * PRD §12.5 step 4. scope 'ip' is hashed before lookup; scope 'host' is stored
 * as the normalized host. Returns { ok, retry_after } in seconds.
 */
export async function cooldownStatus(env, scope, value, windowSeconds, now) {
  const row = await env.DB.prepare('SELECT last_at FROM visibility_cooldowns WHERE scope=? AND value=?')
    .bind(scope, await cooldownKey(env, scope, value))
    .first();
  if (!row || !Number.isFinite(row.last_at)) return { ok: true, retry_after: 0 };
  const elapsed = now - row.last_at;
  if (elapsed >= windowSeconds) return { ok: true, retry_after: 0 };
  return { ok: false, retry_after: Math.max(1, windowSeconds - elapsed) };
}

export async function recordCooldown(env, scope, value, now) {
  await env.DB.prepare(
    'INSERT INTO visibility_cooldowns (scope, value, last_at) VALUES (?, ?, ?) ON CONFLICT(scope, value) DO UPDATE SET last_at = ?'
  ).bind(scope, await cooldownKey(env, scope, value), now, now).run();
}
