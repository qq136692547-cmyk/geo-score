import { describe, it, expect } from 'vitest';
import handler from '../../worker/payments.js';
import { createMockDb } from './mock-db.js';

const TOKEN = 'api-token';
const NOW = Math.floor(Date.now() / 1000);

function req(email) {
  return new Request(
    `https://worker.test/api/subscription?token=${TOKEN}&email=${encodeURIComponent(email)}`
  );
}

describe('/api/subscription', () => {
  it('reports free when current_period_end is NULL, matching resolvePlan', async () => {
    const db = createMockDb({
      subscriptions: [{ email: 'null@example.com', plan: 'pro', status: 'active', current_period_end: null }],
    });
    const resp = await handler.fetch(req('null@example.com'), { DB: db, GEOSCORE_API_TOKEN: TOKEN });
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.plan).toBe('free');
    expect(body.status).toBe('expired');
  });

  it('reports pro while the period is still in the future', async () => {
    const db = createMockDb({
      subscriptions: [{ email: 'ok@example.com', plan: 'pro', status: 'active', current_period_end: NOW + 86400 }],
    });
    const resp = await handler.fetch(req('ok@example.com'), { DB: db, GEOSCORE_API_TOKEN: TOKEN });
    const body = await resp.json();
    expect(body.plan).toBe('pro');
    expect(body.status).toBe('active');
  });

  it('reports studio and agency while the period is still in the future', async () => {
    const db = createMockDb({
      subscriptions: [
        { email: 'studio@example.com', plan: 'studio', status: 'active', current_period_end: NOW + 86400 },
        { email: 'agency@example.com', plan: 'agency', status: 'active', current_period_end: NOW + 86400 },
      ],
    });
    const respStudio = await (await handler.fetch(req('studio@example.com'), { DB: db, GEOSCORE_API_TOKEN: TOKEN })).json();
    expect(respStudio.plan).toBe('studio');
    expect(respStudio.status).toBe('active');

    const respAgency = await (await handler.fetch(req('agency@example.com'), { DB: db, GEOSCORE_API_TOKEN: TOKEN })).json();
    expect(respAgency.plan).toBe('agency');
    expect(respAgency.status).toBe('active');
  });

  it('reports free for a canceled subscription', async () => {
    const db = createMockDb({
      subscriptions: [{ email: 'c@example.com', plan: 'pro', status: 'canceled', current_period_end: NOW + 86400 }],
    });
    const body = await (await handler.fetch(req('c@example.com'), { DB: db, GEOSCORE_API_TOKEN: TOKEN })).json();
    expect(body.plan).toBe('free');
  });

  it('rejects a request without the token', async () => {
    const db = createMockDb();
    const resp = await handler.fetch(
      new Request('https://worker.test/api/subscription?email=a@b.com'),
      { DB: db, GEOSCORE_API_TOKEN: TOKEN }
    );
    expect(resp.status).toBe(401);
  });
});
