import { describe, it, expect } from 'vitest';
import handler from '../../worker/payments.js';
import { hmacSha256 } from '../../worker/pro.js';
import { createMockDb } from './mock-db.js';

const SECRET = 'webhook-secret';
const PRO_PRODUCT_ID = 'prod_3hLh24EkJOL0jS0Jrf9zq5';

async function postWebhook(db, rawBody) {
  const signature = await hmacSha256(rawBody, SECRET);
  const req = new Request('https://worker.test/webhook', {
    method: 'POST',
    headers: { 'creem-signature': signature, 'Content-Type': 'application/json' },
    body: rawBody,
  });
  return handler.fetch(req, { DB: db, CREEM_WEBHOOK_SECRET: SECRET });
}

function checkoutEvent(email = 'buyer@example.com') {
  return JSON.stringify({
    id: 'evt_checkout_123',
    event_type: 'checkout.completed',
    data: {
      object: {
        id: 'cs_123',
        subscription_id: 'sub_123',
        customer: { id: 'cus_1', email },
        product: { id: PRO_PRODUCT_ID, price: 900 },
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
      },
    },
  });
}

describe('Creem webhook', () => {
  it('activates Pro on checkout.completed', async () => {
    const db = createMockDb({ users: [{ id: 'u_1', email: 'buyer@example.com', plan: 'free' }] });
    const resp = await postWebhook(db, checkoutEvent());
    expect(resp.status).toBe(200);
    const sub = db._tables.subscriptions[0];
    expect(sub.plan).toBe('pro');
    expect(sub.status).toBe('active');
    expect(sub.subscription_id).toBe('sub_123');
    expect(db._tables.users[0].plan).toBe('pro');
  });

  it('rejects a missing signature (401)', async () => {
    const db = createMockDb();
    const resp = await handler.fetch(
      new Request('https://worker.test/webhook', { method: 'POST', body: '{}' }),
      { DB: db, CREEM_WEBHOOK_SECRET: SECRET }
    );
    expect(resp.status).toBe(401);
  });

  it('rejects an invalid signature (401)', async () => {
    const db = createMockDb();
    const rawBody = checkoutEvent();
    const req = new Request('https://worker.test/webhook', {
      method: 'POST',
      headers: { 'creem-signature': 'deadbeef' },
      body: rawBody,
    });
    const resp = await handler.fetch(req, { DB: db, CREEM_WEBHOOK_SECRET: SECRET });
    expect(resp.status).toBe(401);
  });

  it('does nothing when the checkout has no email', async () => {
    const db = createMockDb();
    const resp = await postWebhook(db, checkoutEvent(''));
    expect(resp.status).toBe(200);
    expect(db._tables.subscriptions).toHaveLength(0);
  });

  it('downgrades to free on subscription.canceled', async () => {
    const db = createMockDb({
      users: [{ id: 'u_1', email: 'buyer@example.com', plan: 'pro' }],
      subscriptions: [{ email: 'buyer@example.com', plan: 'pro', status: 'active' }],
    });
    const rawBody = JSON.stringify({
      event_type: 'subscription.canceled',
      data: { object: { customer: { email: 'buyer@example.com' } } },
    });
    const resp = await postWebhook(db, rawBody);
    expect(resp.status).toBe(200);
    expect(db._tables.subscriptions[0].status).toBe('canceled');
    expect(db._tables.users[0].plan).toBe('free');
  });

  it('upserts a Pro subscription on subscription.active', async () => {
    const db = createMockDb({ users: [{ id: 'u_1', email: 'buyer@example.com', plan: 'free' }] });
    const rawBody = JSON.stringify({
      event_type: 'subscription.active',
      data: {
        object: {
          id: 'sub_9',
          customer: { id: 'cus_9', email: 'buyer@example.com' },
          product: { id: PRO_PRODUCT_ID },
        },
      },
    });
    const resp = await postWebhook(db, rawBody);
    expect(resp.status).toBe(200);
    expect(db._tables.subscriptions[0].plan).toBe('pro');
    expect(db._tables.subscriptions[0].subscription_id).toBe('sub_9');
  });

  it('processes a duplicate event only once (event_id dedup)', async () => {
    const db = createMockDb();
    const body = checkoutEvent('dup@example.com');
    const r1 = await postWebhook(db, body);
    const r2 = await postWebhook(db, body);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(db._tables.subscriptions).toHaveLength(1);
    expect(db._tables.webhook_events).toHaveLength(1);
  });

  it('handles the real Creem payload shape (camelCase eventType, top-level object, subscription object)', async () => {
    const db = createMockDb({ users: [{ id: 'u_2', email: 'real@example.com', plan: 'free' }] });
    const rawBody = JSON.stringify({
      id: 'evt_real1',
      eventType: 'checkout.completed',
      created_at: 1728734325927,
      object: {
        id: 'ch_real1',
        object: 'checkout',
        product: { id: PRO_PRODUCT_ID, price: 900 },
        customer: { id: 'cus_real1', email: 'real@example.com' },
        subscription: { id: 'sub_real1', object: 'subscription', status: 'active' },
        status: 'completed',
      },
    });
    const resp = await postWebhook(db, rawBody);
    expect(resp.status).toBe(200);
    const sub = db._tables.subscriptions[0];
    expect(sub.subscription_id).toBe('sub_real1');
    expect(sub.plan).toBe('pro');
  });

  it('parses current_period_end_date ISO strings on subscription.paid', async () => {
    const db = createMockDb();
    const endIso = '2026-09-17T00:00:00.000Z';
    const rawBody = JSON.stringify({
      id: 'evt_paid1',
      eventType: 'subscription.paid',
      object: {
        id: 'sub_paid1',
        product: { id: PRO_PRODUCT_ID },
        customer: { id: 'cus_paid1', email: 'paid@example.com' },
        current_period_end_date: endIso,
      },
    });
    const resp = await postWebhook(db, rawBody);
    expect(resp.status).toBe(200);
    expect(db._tables.subscriptions[0].current_period_end).toBe(Math.floor(Date.parse(endIso) / 1000));
  });

  it('allows reprocessing after a failed attempt (dedup marker rolled back)', async () => {
    let failNext = true;
    const db = createMockDb();
    const failing = {
      prepare(sql) {
        const inner = db.prepare(sql);
        return {
          bind: (...args) => {
            if (failNext && /INSERT INTO subscriptions/i.test(sql)) throw new Error('db down');
            return inner.bind(...args);
          },
          first: (...a) => inner.first(...a),
          all: (...a) => inner.all(...a),
          run: (...a) => inner.run(...a),
        };
      },
    };
    const resp1 = await postWebhook(failing, checkoutEvent('retry@example.com'));
    expect(resp1.status).toBe(500);
    expect(db._tables.webhook_events).toHaveLength(0);
    failNext = false;
    const resp2 = await postWebhook(db, checkoutEvent('retry@example.com'));
    expect(resp2.status).toBe(200);
    expect(db._tables.subscriptions).toHaveLength(1);
  });

  it('accepts events signed with the test webhook secret', async () => {
    const db = createMockDb();
    const rawBody = JSON.stringify({
      id: 'evt_test1',
      event_type: 'subscription.active',
      data: { object: { id: 'sub_t1', product: { id: PRO_PRODUCT_ID }, customer: { id: 'cus_t1', email: 'test@example.com' } } },
    });
    const signature = await hmacSha256(rawBody, 'test-secret');
    const req = new Request('https://worker.test/webhook', {
      method: 'POST',
      headers: { 'creem-signature': signature, 'Content-Type': 'application/json' },
      body: rawBody,
    });
    const resp = await handler.fetch(req, { DB: db, CREEM_WEBHOOK_SECRET: SECRET, CREEM_WEBHOOK_SECRET_TEST: 'test-secret' });
    expect(resp.status).toBe(200);
    expect(db._tables.subscriptions[0].subscription_id).toBe('sub_t1');
  });
});
