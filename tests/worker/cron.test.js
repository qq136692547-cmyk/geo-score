import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../worker/lib/node-scanner.js', () => ({
  auditUrl: vi.fn(),
}));

import { runScheduledAudits } from '../../worker/pro.js';
import { auditUrl } from '../../worker/lib/node-scanner.js';
import { createMockDb } from './mock-db.js';

const sentEmails = [];

beforeEach(() => {
  sentEmails.length = 0;
  vi.mocked(auditUrl).mockReset();
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    if (String(url).includes('resend.com')) {
      sentEmails.push(JSON.parse(init.body));
      return new Response('{}', { status: 200 });
    }
    return new Response('Not Found', { status: 404 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function site(overrides = {}) {
  return {
    id: 's_1', user_id: 'u_1', email: 'owner@example.com',
    host: 'example.com', url: 'https://example.com',
    status: 'active', last_score: null, last_audit_at: null,
    last_success_at: null, consecutive_failures: 0,
    ...overrides,
  };
}

function makeEnv(sites, extra = {}) {
  const db = createMockDb({
    users: [{ id: 'u_1', email: 'owner@example.com', plan: 'pro' }],
    sites,
    audits: extra.audits || [],
  });
  return { DB: db, RESEND_API_KEY: 'test-key', JWT_SECRET: 'x' };
}

function okResult(score) {
  return {
    url: 'https://example.com', score, level: 'Good', summary: 'ok',
    dimensions: {}, negativeSignals: [], promptInjection: [], recommendations: [], raw: {},
  };
}

describe('weekly scheduled audits', () => {
  it('records a successful audit and updates the site', async () => {
    vi.mocked(auditUrl).mockResolvedValue(okResult(71));
    const env = makeEnv([site()]);
    const summary = await runScheduledAudits(env);
    expect(summary).toEqual({ sites: 1, success: 1, failed: 0, alerts: 0, visibility: null });
    const s = env.DB._tables.sites[0];
    expect(s.last_score).toBe(71);
    expect(s.last_success_at).toBeTruthy();
    expect(s.consecutive_failures).toBe(0);
    expect(env.DB._tables.audits).toHaveLength(1);
    expect(env.DB._tables.audits[0].status).toBe('ok');
    expect(env.DB._tables.audits[0].source).toBe('scheduled');
    expect(sentEmails).toHaveLength(0);
  });

  it('marks a failed audit and preserves the last successful score', async () => {
    vi.mocked(auditUrl).mockRejectedValue(new Error('fetch failed'));
    const env = makeEnv([site({ last_score: 70 })]);
    const summary = await runScheduledAudits(env);
    expect(summary.failed).toBe(1);
    const s = env.DB._tables.sites[0];
    expect(s.consecutive_failures).toBe(1);
    expect(s.last_score).toBe(70);
    expect(env.DB._tables.audits[0].status).toBe('failed');
    expect(sentEmails).toHaveLength(0);
  });

  it('emails the owner after 3 consecutive failures and resets the counter', async () => {
    vi.mocked(auditUrl).mockRejectedValue(new Error('blocked'));
    const env = makeEnv([site({ consecutive_failures: 2 })]);
    const summary = await runScheduledAudits(env);
    expect(summary.failed).toBe(1);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].subject).toContain('unable to audit');
    expect(env.DB._tables.sites[0].consecutive_failures).toBe(0);
  });

  it('sends a regression alert when the score drops by 10+ points', async () => {
    vi.mocked(auditUrl).mockResolvedValue(okResult(70));
    const env = makeEnv([site({ last_score: 85 })]);
    const summary = await runScheduledAudits(env);
    expect(summary.alerts).toBe(1);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].subject).toContain('regression');
  });

  it('does not alert when the score drop is below 10 points', async () => {
    vi.mocked(auditUrl).mockResolvedValue(okResult(78));
    const env = makeEnv([site({ last_score: 85 })]);
    await runScheduledAudits(env);
    expect(sentEmails).toHaveLength(0);
  });

  it('deletes audit history older than 30 days', async () => {
    vi.mocked(auditUrl).mockResolvedValue(okResult(60));
    const now = Math.floor(Date.now() / 1000);
    const env = makeEnv([site()], {
      audits: [
        { id: 'a_old', site_id: 's_1', user_id: 'u_1', created_at: now - 31 * 86400 },
        { id: 'a_new', site_id: 's_1', user_id: 'u_1', created_at: now - 1 * 86400 },
      ],
    });
    await runScheduledAudits(env);
    const remaining = env.DB._tables.audits.map(a => a.id);
    expect(remaining).not.toContain('a_old');
    expect(remaining).toContain('a_new');
  });

  it('handles 5 failing sites in bounded batches', async () => {
    vi.mocked(auditUrl).mockRejectedValue(new Error('down'));
    const env = makeEnv([1, 2, 3, 4, 5].map(i => site({
      id: 's_' + i,
      host: 'site' + i + '.example.com',
      url: 'https://site' + i + '.example.com',
    })));
    const summary = await runScheduledAudits(env);
    expect(summary).toEqual({ sites: 5, success: 0, failed: 5, alerts: 0, visibility: null });
  });
});
