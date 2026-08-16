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
});
