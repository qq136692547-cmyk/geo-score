import { describe, it, expect } from 'vitest';
import { handleProRoutes, base64Url, hmacSha256 } from '../../worker/pro.js';
import { createMockDb } from './mock-db.js';
import {
  currentMonthUtc,
  llmMonthlyCallBudget,
  LLM_MONTHLY_CALL_BUDGET_DEFAULT,
  readLlmCalls,
  incrLlmCalls,
  evaluateLlmBudget,
  hashCooldownValue,
  cooldownStatus,
  recordCooldown,
} from '../../worker/guardrails.js';

const JWT_SECRET = 'test-secret';
const NOW = Math.floor(Date.now() / 1000);
const FUTURE = NOW + 7 * 86400;

async function makeToken(uid) {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ uid, exp: FUTURE }));
  const signature = await hmacSha256(header + '.' + payload, JWT_SECRET);
  return header + '.' + payload + '.' + signature;
}

describe('evaluateLlmBudget tiers', () => {
  // limit 1000 makes the 80/100/150% boundaries exact integers.
  it('stays ok below 80%', () => {
    const b = evaluateLlmBudget(799, 1000, false);
    expect(b.level).toBe('ok');
    expect(b.ok).toBe(true);
    expect(b.code).toBe(null);
  });

  it('warns at exactly 80% and keeps serving free callers', () => {
    const b = evaluateLlmBudget(800, 1000, false);
    expect(b.level).toBe('warn');
    expect(b.ok).toBe(true);
    expect(b.code).toBe('llm_budget_warn');
  });

  it('blocks free callers at exactly 100% but still serves Pro', () => {
    expect(evaluateLlmBudget(1000, 1000, false)).toMatchObject({ level: 'block_free', ok: false, code: 'llm_budget_block_free' });
    expect(evaluateLlmBudget(1000, 1000, true)).toMatchObject({ level: 'block_free', ok: true });
  });

  it('keeps blocking free callers between 100% and 150%', () => {
    expect(evaluateLlmBudget(1499, 1000, false)).toMatchObject({ level: 'block_free', ok: false });
    expect(evaluateLlmBudget(1499, 1000, true)).toMatchObject({ level: 'block_free', ok: true });
  });

  it('blocks everyone at exactly 150%', () => {
    expect(evaluateLlmBudget(1500, 1000, false)).toMatchObject({ level: 'block_all', ok: false, code: 'llm_budget_block_all' });
    expect(evaluateLlmBudget(1500, 1000, true)).toMatchObject({ level: 'block_all', ok: false });
  });

  it('treats zero calls as ok and reports the ratio', () => {
    expect(evaluateLlmBudget(0, 1000, false)).toMatchObject({ ok: true, ratio: 0, calls: 0, limit: 1000 });
  });

  it('falls back to the default limit when the configured value is unusable', () => {
    const b = evaluateLlmBudget(1, 0, false);
    expect(b.limit).toBe(LLM_MONTHLY_CALL_BUDGET_DEFAULT);
  });
});

describe('llmMonthlyCallBudget', () => {
  it('honours an explicit env override', () => {
    expect(llmMonthlyCallBudget({ LLM_MONTHLY_CALL_BUDGET: '250' })).toBe(250);
  });

  it('ignores non-positive and non-numeric overrides', () => {
    expect(llmMonthlyCallBudget({ LLM_MONTHLY_CALL_BUDGET: '0' })).toBe(LLM_MONTHLY_CALL_BUDGET_DEFAULT);
    expect(llmMonthlyCallBudget({ LLM_MONTHLY_CALL_BUDGET: 'abc' })).toBe(LLM_MONTHLY_CALL_BUDGET_DEFAULT);
    expect(llmMonthlyCallBudget({})).toBe(LLM_MONTHLY_CALL_BUDGET_DEFAULT);
  });
});

describe('currentMonthUtc', () => {
  it('formats as UTC YYYY-MM and rolls over on the UTC month boundary', () => {
    expect(currentMonthUtc(Date.UTC(2026, 8, 28, 12, 0, 0) / 1000)).toBe('2026-09');
    expect(currentMonthUtc(Date.UTC(2026, 11, 31, 23, 59, 59) / 1000)).toBe('2026-12');
    expect(currentMonthUtc(Date.UTC(2027, 0, 1, 0, 0, 0) / 1000)).toBe('2027-01');
  });
});

describe('llm_counters', () => {
  it('accumulates every increment instead of recording one per batch', async () => {
    const db = createMockDb({ llm_counters: [] });
    const env = { DB: db };
    for (let i = 0; i < 4; i++) await incrLlmCalls(env, NOW, 1);
    expect(await readLlmCalls(env, NOW)).toBe(4);
    expect(db._tables.llm_counters).toHaveLength(1);
  });

  it('adds the requested delta', async () => {
    const db = createMockDb({ llm_counters: [] });
    const env = { DB: db };
    await incrLlmCalls(env, NOW, 5);
    expect(await readLlmCalls(env, NOW)).toBe(5);
  });

  it('reports 0 for a month with no counter row', async () => {
    const db = createMockDb({ llm_counters: [{ month: currentMonthUtc(NOW), calls: 7, updated_at: NOW }] });
    expect(await readLlmCalls({ DB: db }, Date.UTC(2027, 0, 15, 0, 0, 0) / 1000)).toBe(0);
  });

  it('keeps months independent', async () => {
    const db = createMockDb({ llm_counters: [] });
    const env = { DB: db };
    const sept = Date.UTC(2026, 8, 28, 12, 0, 0) / 1000;
    const oct = Date.UTC(2026, 9, 2, 12, 0, 0) / 1000;
    await incrLlmCalls(env, sept, 3);
    await incrLlmCalls(env, oct, 1);
    expect(await readLlmCalls(env, sept)).toBe(3);
    expect(await readLlmCalls(env, oct)).toBe(1);
  });
});

describe('visibility_cooldowns', () => {
  const envWith = () => ({ DB: createMockDb({ visibility_cooldowns: [] }), JWT_SECRET });

  it('allows a host with no record', async () => {
    expect(await cooldownStatus(envWith(), 'host', 'example.com', 72 * 3600, NOW)).toEqual({ ok: true, retry_after: 0 });
  });

  it('blocks a host inside its window and reports the remaining seconds', async () => {
    const env = envWith();
    await recordCooldown(env, 'host', 'example.com', NOW);
    const twoHoursIn = NOW + 2 * 3600;
    expect(await cooldownStatus(env, 'host', 'example.com', 72 * 3600, twoHoursIn)).toEqual({ ok: false, retry_after: 72 * 3600 - 2 * 3600 });
  });

  it('allows a host again once the window has elapsed', async () => {
    const env = envWith();
    await recordCooldown(env, 'host', 'example.com', NOW);
    expect((await cooldownStatus(env, 'host', 'example.com', 72 * 3600, NOW + 72 * 3600)).ok).toBe(true);
  });

  it('scopes ip and host records independently', async () => {
    const env = envWith();
    await recordCooldown(env, 'host', 'example.com', NOW);
    expect((await cooldownStatus(env, 'ip', '203.0.113.9', 24 * 3600, NOW)).ok).toBe(true);
  });

  it('never stores a raw IP address', async () => {
    const db = createMockDb({ visibility_cooldowns: [] });
    const env = { DB: db, JWT_SECRET };
    await recordCooldown(env, 'ip', '203.0.113.9', NOW);
    const stored = db._tables.visibility_cooldowns[0].value;
    expect(stored).not.toBe('203.0.113.9');
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashes deterministically per salt and differs across salts', async () => {
    const a = await hashCooldownValue({ JWT_SECRET: 's1' }, '203.0.113.9');
    const b = await hashCooldownValue({ JWT_SECRET: 's1' }, '203.0.113.9');
    const c = await hashCooldownValue({ JWT_SECRET: 's2' }, '203.0.113.9');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('prefers an explicit COOLDOWN_SALT over JWT_SECRET', async () => {
    const a = await hashCooldownValue({ JWT_SECRET: 'jwt', COOLDOWN_SALT: 'salt' }, '203.0.113.9');
    const b = await hashCooldownValue({ JWT_SECRET: 'jwt' }, '203.0.113.9');
    expect(a).not.toBe(b);
  });

  it('refuses to hash without any salt', async () => {
    await expect(hashCooldownValue({}, '203.0.113.9')).rejects.toThrow('cooldown salt unavailable');
  });
});

describe('POST /api/visibility/check budget gate', () => {
  async function callVisibility(env, userPlan, uid) {
    const headers = { Authorization: 'Bearer ' + (await makeToken(uid)) };
    headers['Content-Type'] = 'application/json';
    const url = new URL('https://worker.test/api/visibility/check');
    return handleProRoutes(
      new Request(url, { method: 'POST', headers, body: JSON.stringify({ host: 'example.com' }) }),
      env, {}, url, url.pathname
    );
  }

  function envWith(calls, limit, userPlan = 'pro') {
    return {
      DB: createMockDb({
        users: [{ id: 'u_1', email: 'pro@example.com', name: 'Pro User', plan: userPlan }],
        subscriptions: [{ email: 'pro@example.com', plan: 'pro', status: 'active', current_period_end: FUTURE }],
        llm_counters: [{ month: currentMonthUtc(NOW), calls, updated_at: NOW }],
      }),
      JWT_SECRET,
      TOKENRHYTHM_API_KEY: 'test-key',
      LLM_MONTHLY_CALL_BUDGET: String(limit),
    };
  }

  it('rejects with 429 once the global budget hits 150%', async () => {
    const env = envWith(6, 4);
    const resp = await callVisibility(env, 'pro', 'u_1');
    expect(resp.status).toBe(429);
    const data = await resp.json();
    expect(data.code).toBe('llm_budget_block_all');
    expect(data.budget).toMatchObject({ calls: 6, limit: 4, ratio: 1.5 });
  });

  it('lets a Pro caller through at 100% instead of blocking it', async () => {
    const env = envWith(4, 4);
    const resp = await callVisibility(env, 'pro', 'u_1');
    // Passed the budget gate; fails later on the unseeded site lookup.
    expect(resp.status).toBe(404);
    expect((await resp.json()).error).toBe('Domain not monitored');
  });

  it('lets a caller through while only warning', async () => {
    const env = envWith(4, 5);
    const resp = await callVisibility(env, 'pro', 'u_1');
    expect(resp.status).toBe(404);
  });

  it('returns 503 for a missing AI key, which is checked ahead of the budget gate', async () => {
    const env = envWith(6, 4);
    delete env.TOKENRHYTHM_API_KEY;
    const resp = await callVisibility(env, 'pro', 'u_1');
    expect(resp.status).toBe(503);
  });
});
