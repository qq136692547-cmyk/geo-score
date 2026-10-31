import { describe, it, expect } from 'vitest';
import { resolvePlan } from '../../worker/pro.js';
import { createMockDb } from './mock-db.js';

const NOW = Math.floor(Date.now() / 1000);

describe('resolvePlan', () => {
  it('treats a missing current_period_end as expired, not as permanent Pro', async () => {
    const db = createMockDb({
      subscriptions: [{ email: 'null@example.com', plan: 'pro', status: 'active', current_period_end: null }],
    });
    const plan = await resolvePlan({ email: 'null@example.com' }, { DB: db });
    expect(plan).toBe('free');
  });

  it('keeps Pro while the period is still in the future', async () => {
    const db = createMockDb({
      subscriptions: [{ email: 'ok@example.com', plan: 'pro', status: 'active', current_period_end: NOW + 86400 }],
    });
    expect(await resolvePlan({ email: 'ok@example.com' }, { DB: db })).toBe('pro');
  });

  it('downgrades once the period has ended', async () => {
    const db = createMockDb({
      subscriptions: [{ email: 'old@example.com', plan: 'pro', status: 'active', current_period_end: NOW - 86400 }],
    });
    expect(await resolvePlan({ email: 'old@example.com' }, { DB: db })).toBe('free');
    expect(db._tables.subscriptions[0].status).toBe('expired');
  });

  it('returns free for a canceled subscription', async () => {
    const db = createMockDb({
      subscriptions: [{ email: 'c@example.com', plan: 'pro', status: 'canceled', current_period_end: NOW + 86400 }],
    });
    expect(await resolvePlan({ email: 'c@example.com' }, { DB: db })).toBe('free');
  });
});
