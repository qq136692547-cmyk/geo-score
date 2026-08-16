import { describe, it, expect, afterEach, vi } from 'vitest';
import { handleProRoutes, base64Url, hmacSha256 } from '../../worker/pro.js';
import { createMockDb } from './mock-db.js';

const JWT_SECRET = 'test-secret';
const FUTURE = Math.floor(Date.now() / 1000) + 7 * 86400;

async function makeToken(uid) {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ uid, exp: FUTURE }));
  const signature = await hmacSha256(header + '.' + payload, JWT_SECRET);
  return header + '.' + payload + '.' + signature;
}

function makeEnv(userPlan = 'pro') {
  const db = createMockDb({
    users: [{ id: 'u_1', email: 'pro@example.com', name: 'Pro User', plan: userPlan }],
    subscriptions: userPlan === 'pro'
      ? [{ email: 'pro@example.com', plan: 'pro', status: 'active', current_period_end: FUTURE }]
      : [],
  });
  return { env: { DB: db, JWT_SECRET }, db, user: { id: 'u_1' } };
}

async function call(method, path, e, body) {
  const headers = { Authorization: 'Bearer ' + (await makeToken(e.user.id)) };
  const init = { method, headers };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['Content-Type'] = 'application/json';
  }
  const url = new URL('https://worker.test' + path);
  return handleProRoutes(new Request(url, init), e.env, {}, url, url.pathname);
}

describe('Pro API auth', () => {
  it('rejects a request without token (401)', async () => {
    const { env } = makeEnv('pro');
    const url = new URL('https://worker.test/api/sites');
    const resp = await handleProRoutes(new Request(url), env, {}, url, '/api/sites');
    expect(resp.status).toBe(401);
  });

  it('rejects a free-tier user (403)', async () => {
    const e = makeEnv('free');
    const resp = await call('GET', '/api/sites', e);
    expect(resp.status).toBe(403);
    const data = await resp.json();
    expect(data.error).toContain('Pro');
  });
});

describe('sites CRUD', () => {
  it('adds a site with a normalized host (201)', async () => {
    const e = makeEnv('pro');
    const resp = await call('POST', '/api/sites', e, { url: 'https://www.Example.com/path/' });
    expect(resp.status).toBe(201);
    const data = await resp.json();
    expect(data.site.host).toBe('example.com');
    expect(data.site.url).toBe('https://www.example.com/path');
  });

  it('rejects a duplicate domain even with www (409)', async () => {
    const e = makeEnv('pro');
    await call('POST', '/api/sites', e, { url: 'https://example.com' });
    const resp = await call('POST', '/api/sites', e, { url: 'https://www.example.com' });
    expect(resp.status).toBe(409);
    expect((await resp.json()).error).toContain('already monitored');
  });

  it('enforces the 5-domain quota (409)', async () => {
    const e = makeEnv('pro');
    for (let i = 1; i <= 5; i++) {
      await call('POST', '/api/sites', e, { url: 'https://site' + i + '.example.com' });
    }
    const resp = await call('POST', '/api/sites', e, { url: 'https://site6.example.com' });
    expect(resp.status).toBe(409);
    expect((await resp.json()).error).toContain('5');
  });

  it('lists monitored sites for the owner', async () => {
    const e = makeEnv('pro');
    await call('POST', '/api/sites', e, { url: 'https://alpha.example.com' });
    const resp = await call('GET', '/api/sites', e);
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data.sites).toHaveLength(1);
    expect(data.sites[0].host).toBe('alpha.example.com');
  });

  it('deletes a site and cascades its cloud audits', async () => {
    const e = makeEnv('pro');
    const created = await (await call('POST', '/api/sites', e, { url: 'https://gamma.example.com' })).json();
    e.db._tables.audits.push({ id: 'a_1', site_id: created.site.id, user_id: e.user.id, created_at: 1 });
    const resp = await call('DELETE', '/api/sites?id=' + created.site.id, e);
    expect(resp.status).toBe(200);
    expect(e.db._tables.sites).toHaveLength(0);
    expect(e.db._tables.audits).toHaveLength(0);
  });

  it('returns 404 when deleting an unknown site', async () => {
    const e = makeEnv('pro');
    const resp = await call('DELETE', '/api/sites?id=s_missing', e);
    expect(resp.status).toBe(404);
  });

  it('rejects an invalid URL (400)', async () => {
    const e = makeEnv('pro');
    const resp = await call('POST', '/api/sites', e, { url: 'not a url' });
    expect(resp.status).toBe(400);
  });
});

describe('cloud audit history and PDF', () => {
  function auditResult(score, overrides = {}) {
    return {
      score, level: 'Good', summary: 'ok',
      dimensions: {}, negativeSignals: [], promptInjection: [],
      recommendations: [{ issue: 'Add llms.txt', fix: 'Create /llms.txt' }],
      raw: {}, ...overrides,
    };
  }

  it('saves a manual audit result (201)', async () => {
    const e = makeEnv('pro');
    const resp = await call('POST', '/api/audits', e, { url: 'https://example.com', result: auditResult(82) });
    expect(resp.status).toBe(201);
    const data = await resp.json();
    expect(data.audit.score).toBe(82);
    expect(data.audit.host).toBe('example.com');
  });

  it('rejects an out-of-range score (400)', async () => {
    const e = makeEnv('pro');
    const resp = await call('POST', '/api/audits', e, { url: 'https://example.com', result: auditResult(101) });
    expect(resp.status).toBe(400);
  });

  it('lists saved audits', async () => {
    const e = makeEnv('pro');
    await call('POST', '/api/audits', e, { url: 'https://one.example.com', result: auditResult(70) });
    await call('POST', '/api/audits', e, { url: 'https://two.example.com', result: auditResult(80) });
    const resp = await call('GET', '/api/audits', e);
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data.audits).toHaveLength(2);
  });
  it('links a manual save to a matching monitored site', async () => {
    const e = makeEnv('pro');
    const site = await (await call('POST', '/api/sites', e, { url: 'https://example.com' })).json();
    await call('POST', '/api/audits', e, { url: 'https://www.example.com/page', result: auditResult(77) });
    const resp = await call('GET', '/api/audits?site_id=' + site.site.id, e);
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data.audits).toHaveLength(1);
    expect(data.audits[0].host).toBe('example.com');
  });

  it('exports a PDF for a saved audit', async () => {
    const e = makeEnv('pro');
    const saved = await (await call('POST', '/api/audits', e, {
      url: 'https://pdf.example.com',
      result: auditResult(90, { level: 'Excellent', summary: 'Great' }),
    })).json();
    const resp = await call('GET', '/api/audits/' + saved.audit.id + '/pdf', e);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toBe('application/pdf');
    const bytes = await resp.arrayBuffer();
    const head = new TextDecoder().decode(bytes.slice(0, 8));
    expect(head.startsWith('%PDF')).toBe(true);
  });

describe('checkout session', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('creates a Creem checkout bound to the signed-in user email', async () => {
    let sentBody = null;
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      sentBody = JSON.parse(init.body);
      return new Response(JSON.stringify({
        id: 'ch_1',
        checkout_url: 'https://checkout.creem.io/ch_1',
        product_id: 'prod_x',
        status: 'pending',
      }), { status: 200 });
    }));
    const e = makeEnv('free');
    e.env.CREEM_API_KEY = 'test-creem-key';
    const resp = await call('POST', '/api/checkout', e, {});
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data.checkout_url).toBe('https://checkout.creem.io/ch_1');
    expect(sentBody.product_id).toBe('prod_3hLh24EkJOL0jS0Jrf9zq5');
    expect(sentBody.customer.email).toBe('pro@example.com');
  });

  it('rejects checkout without a token (401)', async () => {
    const { env } = makeEnv('free');
    const url = new URL('https://worker.test/api/checkout');
    const resp = await handleProRoutes(new Request(url, { method: 'POST' }), env, {}, url, '/api/checkout');
    expect(resp.status).toBe(401);
  });
});});


