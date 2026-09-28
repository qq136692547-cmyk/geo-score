import { describe, it, expect, afterEach, vi } from 'vitest';
import { handleProRoutes, base64Url, hmacSha256 } from '../../worker/pro.js';
import worker from '../../worker/payments.js';
import { createMockDb } from './mock-db.js';
import { recordCooldown, currentMonthUtc } from '../../worker/guardrails.js';
import { currentPeriodStartUtc } from '../../worker/visibilityQuota.js';

const JWT_SECRET = 'test-secret';
const COOLDOWN_SALT = 'salt';
const NOW = Math.floor(Date.now() / 1000);
const FUTURE = NOW + 7 * 86400;
const IP = '203.0.113.9';
const UID = 'u_free';

async function makeToken(uid) {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ uid, exp: FUTURE }));
  const signature = await hmacSha256(header + '.' + payload, JWT_SECRET);
  return header + '.' + payload + '.' + signature;
}

/**
 * A free-tier caller: google identity, no subscription, one check available.
 */
function freeEnv(over = {}) {
  const db = createMockDb({
    users: [{
      id: UID, email: 'free@gmail.com', name: 'Free User', avatar: null,
      provider: 'google', plan: 'free',
      free_vis_used: 0, free_vis_period_start: currentPeriodStartUtc(NOW),
      ...(over.user || {}),
    }],
    subscriptions: [],
    llm_counters: over.llm_counters || [],
    visibility_cooldowns: over.visibility_cooldowns || [],
    ai_visibility: [],
  });
  const env = {
    DB: db,
    JWT_SECRET,
    COOLDOWN_SALT,
    TOKENRHYTHM_API_KEY: 'test-key',
    LLM_MONTHLY_CALL_BUDGET: over.limit === undefined ? '100' : String(over.limit),
    ...(over.env || {}),
  };
  return { env, db };
}

async function callCheck(env, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (opts.token !== false) headers.Authorization = 'Bearer ' + (await makeToken(opts.uid || UID));
  if (opts.ip !== null) headers['CF-Connecting-IP'] = opts.ip === undefined ? IP : opts.ip;
  const url = new URL('https://worker.test/api/visibility/check');
  return handleProRoutes(
    new Request(url, { method: 'POST', headers, body: JSON.stringify(body) }),
    env, {}, url, url.pathname
  );
}

/** Homepage fetch + a single plausible LLM answer. */
function stubFetch() {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    calls.push(String(url));
    if (String(url).startsWith('https://tokenrhythm.studio/')) {
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          mentioned: true, cited: true, sentiment: 'positive',
          snippet: 'Example Corp is a leading AI visibility tool.', reasoning: 'directly relevant',
        }) } }],
      }), { status: 200 });
    }
    return new Response(
      '<html><head><title>Example Corp - AI Tools</title>'
      + '<meta name="description" content="Example Corp builds AI visibility tools for marketing teams.">'
      + '</head><body><h1>Welcome</h1></body></html>',
      { status: 200 }
    );
  }));
  return calls;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('free check: identity gate (PRD §12.5 step 3)', () => {
  it('rejects an anonymous caller before anything else (401)', async () => {
    const { env, db } = freeEnv();
    const resp = await callCheck(env, { url: 'https://example.com' }, { token: false });
    expect(resp.status).toBe(401);
    expect(db._tables.users[0].free_vis_used).toBe(0);
  });

  it('rejects a non-Google account (403 google_required)', async () => {
    const { env, db } = freeEnv({ user: { email: 'free@example.com', provider: 'email' } });
    const resp = await callCheck(env, { url: 'https://example.com' });
    expect(resp.status).toBe(403);
    expect((await resp.json()).code).toBe('google_required');
    expect(db._tables.users[0].free_vis_used).toBe(0);
  });

  it('rejects a disposable mailbox (403 disposable_email)', async () => {
    const { env } = freeEnv({ user: { email: 'throwaway@mailinator.com' } });
    const resp = await callCheck(env, { url: 'https://example.com' });
    expect(resp.status).toBe(403);
    expect((await resp.json()).code).toBe('disposable_email');
  });

  it('returns 503 when the AI key is not configured', async () => {
    const { env } = freeEnv();
    delete env.TOKENRHYTHM_API_KEY;
    const resp = await callCheck(env, { url: 'https://example.com' });
    expect(resp.status).toBe(503);
  });
});

describe('free check: public URL guard (PRD §12.6)', () => {
  const rejected = [
    ['loopback IPv4', 'http://127.0.0.1/'],
    ['private 10/8', 'http://10.0.0.5/'],
    ['link-local metadata endpoint', 'http://169.254.169.254/latest/meta-data/'],
    ['IPv4-mapped IPv6 loopback', 'http://[::ffff:127.0.0.1]/'],
    ['IPv6 unique local', 'http://[fd00::1]/'],
    ['localhost by name', 'http://localhost:8080/'],
    ['internal TLD', 'http://wiki.internal/'],
    ['non-http scheme', 'file:///etc/passwd'],
  ];

  for (const [label, url] of rejected) {
    it('refuses ' + label + ' (400) and does not spend the free check', async () => {
      const { env, db } = freeEnv();
      const resp = await callCheck(env, { url });
      expect(resp.status).toBe(400);
      expect((await resp.json()).code).toBe('url_not_allowed');
      expect(db._tables.users[0].free_vis_used).toBe(0);
      expect(db._tables.visibility_cooldowns).toHaveLength(0);
      expect(db._tables.ai_visibility).toHaveLength(0);
    });
  }

  it('rejects an empty target (400)', async () => {
    const { env } = freeEnv();
    const resp = await callCheck(env, {});
    expect(resp.status).toBe(400);
  });
});

describe('free check: abuse cooldowns (PRD §12.5 step 4)', () => {
  it('blocks a second attempt from the same network (429 ip_cooldown)', async () => {
    const { env, db } = freeEnv();
    await recordCooldown(env, 'ip', IP, NOW - 60);
    const resp = await callCheck(env, { url: 'https://example.com' });
    expect(resp.status).toBe(429);
    const data = await resp.json();
    expect(data.code).toBe('ip_cooldown');
    expect(data.retry_after).toBeGreaterThan(86000);
    expect(data.retry_after).toBeLessThanOrEqual(24 * 3600);
    // Step 4 runs before the claim, so nothing was spent.
    expect(db._tables.users[0].free_vis_used).toBe(0);
  });

  it('blocks a repeat attempt for the same domain from another network (429 host_cooldown)', async () => {
    const { env, db } = freeEnv();
    await recordCooldown(env, 'host', 'example.com', NOW - 60);
    const resp = await callCheck(env, { url: 'https://www.example.com/page' }, { ip: '198.51.100.7' });
    expect(resp.status).toBe(429);
    expect((await resp.json()).code).toBe('host_cooldown');
    expect(db._tables.users[0].free_vis_used).toBe(0);
  });

  it('lets a request through once the IP window has elapsed', async () => {
    stubFetch();
    const { env } = freeEnv();
    await recordCooldown(env, 'ip', IP, NOW - (24 * 3600 + 1));
    const resp = await callCheck(env, { url: 'https://example.com' });
    expect(resp.status).toBe(200);
  });

  it('skips the IP window when the platform sends no client IP', async () => {
    stubFetch();
    const { env } = freeEnv();
    const resp = await callCheck(env, { url: 'https://example.com' }, { ip: null });
    expect(resp.status).toBe(200);
  });
});

describe('free check: global budget precheck (PRD §12.7)', () => {
  it('rejects a free caller once the monthly budget is reached (429)', async () => {
    const { env, db } = freeEnv({ llm_counters: [{ month: currentMonthUtc(NOW), calls: 100, updated_at: NOW }], limit: 100 });
    const resp = await callCheck(env, { url: 'https://example.com' });
    expect(resp.status).toBe(429);
    const data = await resp.json();
    expect(data.code).toBe('llm_budget_block_free');
    expect(data.budget).toMatchObject({ calls: 100, limit: 100, ratio: 1 });
    // The precheck runs before the claim, so a cost cap never eats the free check.
    expect(db._tables.users[0].free_vis_used).toBe(0);
    expect(db._tables.visibility_cooldowns).toHaveLength(0);
  });

  it('still serves a free caller at the 80% warning line', async () => {
    stubFetch();
    const { env } = freeEnv({ llm_counters: [{ month: currentMonthUtc(NOW), calls: 80, updated_at: NOW }], limit: 100 });
    const resp = await callCheck(env, { url: 'https://example.com' });
    expect(resp.status).toBe(200);
  });
});

describe('free check: single-engine success path (PRD §12.5 steps 5-11)', () => {
  it('runs one engine, stores a NULL site_id and spends exactly one quota unit', async () => {
    const calls = stubFetch();
    const { env, db } = freeEnv();
    const resp = await callCheck(env, { url: 'https://www.example.com/pricing' });
    expect(resp.status).toBe(200);
    const data = await resp.json();

    expect(data.ok).toBe(true);
    expect(data.plan).toBe('free');
    expect(data.remaining).toBe(0);
    expect(data.engines_run).toEqual(['chatgpt']);
    expect(data.engines).toHaveLength(1);
    expect(data.engines[0]).toMatchObject({ engine: 'chatgpt', mentioned: true, cited: true });

    // One page fetch + exactly one LLM call, i.e. one billable engine.
    const llmCalls = calls.filter(u => u.startsWith('https://tokenrhythm.studio/'));
    expect(llmCalls).toHaveLength(1);

    expect(db._tables.users[0].free_vis_used).toBe(1);
    expect(db._tables.llm_counters).toHaveLength(1);
    expect(db._tables.llm_counters[0].calls).toBe(1);

    // §12.6: a free check must not create or attach to a monitored site.
    expect(db._tables.ai_visibility).toHaveLength(1);
    expect(db._tables.ai_visibility[0].site_id).toBe(null);
    expect(db._tables.ai_visibility[0].host).toBe('example.com');
    expect(db._tables.ai_visibility[0].user_id).toBe(UID);
    expect(db._tables.sites).toHaveLength(0);

    // Both cooldown windows are now armed.
    expect(db._tables.visibility_cooldowns.map(r => r.scope).sort()).toEqual(['host', 'ip']);
  });

  it('accepts a bare host and normalises it', async () => {
    stubFetch();
    const { env, db } = freeEnv();
    const resp = await callCheck(env, { host: 'www.example.com' });
    expect(resp.status).toBe(200);
    expect(db._tables.ai_visibility[0].host).toBe('example.com');
  });

  it('rejects a second check in the same month (429 quota_exhausted)', async () => {
    stubFetch();
    const { env, db } = freeEnv();
    expect((await callCheck(env, { url: 'https://example.com' })).status).toBe(200);
    // Drop the windows so the quota check is what answers, not the cooldowns.
    db._tables.visibility_cooldowns.length = 0;
    const resp = await callCheck(env, { url: 'https://other-example.com' });
    expect(resp.status).toBe(429);
    const data = await resp.json();
    expect(data.code).toBe('quota_exhausted');
    expect(data.remaining).toBe(0);
    expect(data.retry_after).toBeGreaterThan(0);
    expect(db._tables.users[0].free_vis_used).toBe(1);
  });

  it('rejects a request that loses the optimistic lock (429 concurrent_request)', async () => {
    const { env, db } = freeEnv();
    const originalPrepare = db.prepare;
    let failNext = true;
    db.prepare = sql => {
      if (failNext && /free_vis_used=free_vis_used\+1/.test(sql)) {
        failNext = false;
        return { bind: () => ({ run: async () => ({ meta: { changes: 0 } }) }) };
      }
      return originalPrepare(sql);
    };
    const resp = await callCheck(env, { url: 'https://example.com' });
    expect(resp.status).toBe(429);
    expect((await resp.json()).code).toBe('concurrent_request');
    expect(db._tables.users[0].free_vis_used).toBe(0);
  });
});

describe('GET /auth/me exposes the free allowance', () => {
  async function callMe(env) {
    const url = new URL('https://worker.test/auth/me');
    return worker.fetch(new Request(url, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + (await makeToken(UID)) },
    }), env);
  }

  it('reports one remaining free check for an eligible google user', async () => {
    const { env } = freeEnv();
    const resp = await callMe(env);
    expect(resp.status).toBe(200);
    const { user } = await resp.json();
    expect(user.plan).toBe('free');
    expect(user.visibility_allowance).toMatchObject({ eligible: true, plan: 'free', remaining: 1, limit: 1, reason: null });
    expect(user.visibility_allowance.period_end).toBeGreaterThan(NOW);
  });

  it('does not spend the check just by reading it', async () => {
    const { env, db } = freeEnv();
    await callMe(env);
    await callMe(env);
    expect(db._tables.users[0].free_vis_used).toBe(0);
  });

  it('reports zero remaining once the check has been used', async () => {
    const { env } = freeEnv({ user: { free_vis_used: 1 } });
    const { user } = await (await callMe(env)).json();
    expect(user.visibility_allowance).toMatchObject({ eligible: false, remaining: 0, reason: 'quota_exhausted' });
  });

  it('reports the reason an ineligible user is blocked', async () => {
    const { env } = freeEnv({ user: { provider: 'email', email: 'free@example.com' } });
    const { user } = await (await callMe(env)).json();
    expect(user.visibility_allowance).toMatchObject({ eligible: false, remaining: 0, reason: 'google_required' });
  });

  it('gives Pro callers the Pro limit', async () => {
    const { env } = freeEnv();
    env.DB._tables.subscriptions.push({ email: 'free@gmail.com', plan: 'pro', status: 'active', current_period_end: FUTURE });
    const { user } = await (await callMe(env)).json();
    expect(user.plan).toBe('pro');
    expect(user.visibility_allowance).toMatchObject({ eligible: true, plan: 'pro', remaining: 30, limit: 30 });
  });
});
