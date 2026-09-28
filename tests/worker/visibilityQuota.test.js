import { describe, it, expect } from 'vitest';
import { createMockDb } from './mock-db.js';
import {
  FREE_VIS_LIMIT,
  PRO_VIS_LIMIT,
  currentPeriodStartUtc,
  currentPeriodEndUtc,
  normalizeEmailForAbuse,
  isDisposableEmail,
  inspectPublicUrl,
  evaluateFreeEligibility,
  freeVisibilityAllowance,
  consumeFreeCheck,
} from '../../worker/visibilityQuota.js';

const SEPT = Date.UTC(2026, 8, 15, 12, 0, 0) / 1000;
const OCT = Date.UTC(2026, 9, 3, 12, 0, 0) / 1000;

function userRow(over = {}) {
  return {
    id: 'u_1', email: 'a@gmail.com', name: 'A', avatar: null,
    provider: 'google', plan: 'free', free_vis_used: 0, free_vis_period_start: null,
    ...over,
  };
}

function envWith(rows) {
  const db = createMockDb({ users: rows });
  return { env: { DB: db }, db };
}

describe('period boundaries (UTC months)', () => {
  it('starts and ends on the UTC month boundary', () => {
    expect(currentPeriodStartUtc(SEPT)).toBe(Date.UTC(2026, 8, 1) / 1000);
    expect(currentPeriodEndUtc(SEPT)).toBe(Date.UTC(2026, 9, 1) / 1000);
  });

  it('keeps the same month for every instant inside it, including month end', () => {
    const lastSecond = Date.UTC(2026, 8, 30, 23, 59, 59) / 1000;
    const firstSecond = Date.UTC(2026, 9, 1, 0, 0, 0) / 1000;
    expect(currentPeriodStartUtc(lastSecond)).toBe(Date.UTC(2026, 8, 1) / 1000);
    expect(currentPeriodStartUtc(firstSecond)).toBe(Date.UTC(2026, 9, 1) / 1000);
  });
});

describe('email abuse normalisation', () => {
  it('lowercases and drops the +tag suffix', () => {
    expect(normalizeEmailForAbuse('  A+1@Gmail.COM ')).toBe('a@gmail.com');
    expect(normalizeEmailForAbuse('a+2@gmail.com')).toBe(normalizeEmailForAbuse('a+9@gmail.com'));
  });

  it('leaves an address without a tag untouched apart from case', () => {
    expect(normalizeEmailForAbuse('First.Last@Example.com')).toBe('first.last@example.com');
  });

  it('flags known disposable domains and passes normal ones', () => {
    expect(isDisposableEmail('x@mailinator.com', {})).toBe(true);
    expect(isDisposableEmail('x+tag@YOPMAIL.com', {})).toBe(true);
    expect(isDisposableEmail('a@gmail.com', {})).toBe(false);
  });

  it('accepts extra domains from the environment without a redeploy', () => {
    expect(isDisposableEmail('x@throwaway.dev', {})).toBe(false);
    expect(isDisposableEmail('x@throwaway.dev', { DISPOSABLE_EMAIL_DOMAINS: 'throwaway.dev, junk.io' })).toBe(true);
  });
});

describe('inspectPublicUrl (SSRF guard)', () => {
  it('accepts ordinary public http and https URLs', () => {
    const http = inspectPublicUrl('http://example.com/page');
    expect(http.ok).toBe(true);
    expect(http.host).toBe('example.com');
    expect(inspectPublicUrl('https://example.com/').ok).toBe(true);
  });

  it('strips www and lowercases the host', () => {
    expect(inspectPublicUrl('https://WWW.Example.COM/x').host).toBe('example.com');
  });

  it.each([
    ['http://localhost/'],
    ['http://localhost:8080/'],
    ['http://app.localhost/'],
    ['http://127.0.0.1/'],
    ['http://127.9.9.9/'],
    ['http://0.0.0.0/'],
    ['http://10.1.2.3/'],
    ['http://172.16.0.1/'],
    ['http://172.31.255.254/'],
    ['http://192.168.1.1/'],
    ['http://169.254.169.254/'],
    ['http://100.64.0.1/'],
    ['http://198.18.0.1/'],
    ['http://224.0.0.1/'],
    ['http://[::1]/'],
    ['http://[fd00::1]/'],
    ['http://[fe80::1]/'],
    ['http://[::ffff:127.0.0.1]/'],
    // The URL parser rewrites the dotted form above into hex, so these are the
    // strings inspectPublicUrl actually receives - regression guard for a real
    // SSRF bypass where only the dotted form was matched.
    ['http://[::ffff:7f00:1]/'],
    ['http://[0:0:0:0:0:ffff:7f00:1]/'],
    ['http://[::ffff:a00:1]/'],
    ['http://[::ffff:c0a8:101]/'],
    ['http://[::ffff:a9fe:a9fe]/'],
    ['http://box.internal/'],
    ['http://thing.local/'],
    ['file:///etc/passwd'],
    ['ftp://example.com/'],
    ['gopher://example.com/'],
    ['not a url'],
    [''],
    ['https://user:pw@example.com/'],
  ])('rejects %s', (bad) => {
    const r = inspectPublicUrl(bad);
    expect(r.ok).toBe(false);
    expect(typeof r.reason).toBe('string');
  });

  it('still allows the neighbouring public ranges that merely look private', () => {
    expect(inspectPublicUrl('http://172.32.0.1/').ok).toBe(true);
    expect(inspectPublicUrl('http://11.0.0.1/').ok).toBe(true);
    expect(inspectPublicUrl('http://192.169.0.1/').ok).toBe(true);
  });

  it('does not reject a genuinely public IPv6 literal', () => {
    const r = inspectPublicUrl('http://[2606:4700::1111]/');
    expect(r.ok).toBe(true);
    expect(r.host).toBe('2606:4700::1111');
  });
});

describe('evaluateFreeEligibility', () => {
  it('requires a signed-in user', () => {
    expect(evaluateFreeEligibility(null, {})).toMatchObject({ eligible: false, reason: 'not_authenticated' });
  });

  it('requires the Google provider', () => {
    expect(evaluateFreeEligibility({ provider: 'email', email: 'a@gmail.com' }, {}))
      .toMatchObject({ eligible: false, reason: 'google_required' });
  });

  it('accepts a Google account with a real mailbox', () => {
    expect(evaluateFreeEligibility({ provider: 'google', email: 'a@gmail.com' }, {}))
      .toMatchObject({ eligible: true, reason: null });
  });

  it('rejects a Google account on a disposable mailbox', () => {
    expect(evaluateFreeEligibility({ provider: 'google', email: 'a@mailinator.com' }, {}))
      .toMatchObject({ eligible: false, reason: 'disposable_email' });
  });
});

describe('freeVisibilityAllowance', () => {
  it('gives Pro the soft monthly cap and ignores the free counter', async () => {
    const { env } = envWith([userRow({ free_vis_used: 1 })]);
    const r = await freeVisibilityAllowance(env, { id: 'u_1', provider: 'google', email: 'a@gmail.com' }, SEPT, 'pro');
    expect(r).toMatchObject({ eligible: true, plan: 'pro', remaining: PRO_VIS_LIMIT, limit: PRO_VIS_LIMIT });
  });

  it('offers one free check to a fresh eligible user', async () => {
    const { env } = envWith([userRow()]);
    const r = await freeVisibilityAllowance(env, { id: 'u_1', provider: 'google', email: 'a@gmail.com' }, SEPT, 'free');
    expect(r).toMatchObject({ eligible: true, remaining: FREE_VIS_LIMIT, reason: null });
    expect(r.period_end).toBe(currentPeriodEndUtc(SEPT));
  });

  it('refuses once the single free check is spent', async () => {
    const { env } = envWith([userRow({ free_vis_used: 1, free_vis_period_start: currentPeriodStartUtc(SEPT) })]);
    const r = await freeVisibilityAllowance(env, { id: 'u_1', provider: 'google', email: 'a@gmail.com' }, SEPT, 'free');
    expect(r).toMatchObject({ eligible: false, remaining: 0, reason: 'quota_exhausted' });
  });

  it('rolls the allowance back over after the month changes', async () => {
    const { env } = envWith([userRow({ free_vis_used: 1, free_vis_period_start: currentPeriodStartUtc(SEPT) })]);
    const r = await freeVisibilityAllowance(env, { id: 'u_1', provider: 'google', email: 'a@gmail.com' }, OCT, 'free');
    expect(r).toMatchObject({ eligible: true, remaining: 1 });
  });

  it('surfaces the eligibility reason instead of a quota error', async () => {
    const { env } = envWith([userRow({ provider: 'email' })]);
    const r = await freeVisibilityAllowance(env, { id: 'u_1', provider: 'email', email: 'a@gmail.com' }, SEPT, 'free');
    expect(r).toMatchObject({ eligible: false, reason: 'google_required' });
  });
});

describe('consumeFreeCheck (optimistic lock)', () => {
  it('claims the free slot and records the period start', async () => {
    const { env, db } = envWith([userRow()]);
    const r = await consumeFreeCheck(env, { id: 'u_1' }, SEPT);
    expect(r).toEqual({ ok: true, used: 1 });
    expect(db._tables.users[0].free_vis_used).toBe(1);
    expect(db._tables.users[0].free_vis_period_start).toBe(currentPeriodStartUtc(SEPT));
  });

  it('refuses a second claim in the same period', async () => {
    const { env, db } = envWith([userRow()]);
    await consumeFreeCheck(env, { id: 'u_1' }, SEPT);
    const second = await consumeFreeCheck(env, { id: 'u_1' }, SEPT);
    expect(second).toEqual({ ok: false, reason: 'quota_exhausted', used: 1 });
    expect(db._tables.users[0].free_vis_used).toBe(1);
  });

  it('resets the counter when the period rolls over', async () => {
    const { env, db } = envWith([userRow({ free_vis_used: 1, free_vis_period_start: currentPeriodStartUtc(SEPT) })]);
    const r = await consumeFreeCheck(env, { id: 'u_1' }, OCT);
    expect(r).toEqual({ ok: true, used: 1 });
    expect(db._tables.users[0].free_vis_period_start).toBe(currentPeriodStartUtc(OCT));
  });

  it('loses the race when the conditional UPDATE matches nothing', async () => {
    const { db } = envWith([userRow()]);
    const originalPrepare = db.prepare;
    db.prepare = sql => {
      if (/free_vis_used=free_vis_used\+1/.test(sql)) {
        return { bind: () => ({ run: async () => ({ meta: { changes: 0 } }) }) };
      }
      return originalPrepare(sql);
    };
    const r = await consumeFreeCheck({ DB: db }, { id: 'u_1' }, SEPT);
    expect(r).toMatchObject({ ok: false, reason: 'concurrent_request' });
  });

  it('does not increment when the lock fails, so a retry can still succeed', async () => {
    const { env, db } = envWith([userRow()]);
    const originalPrepare = db.prepare;
    let failNext = true;
    db.prepare = sql => {
      if (failNext && /free_vis_used=free_vis_used\+1/.test(sql)) {
        failNext = false;
        return { bind: () => ({ run: async () => ({ meta: { changes: 0 } }) }) };
      }
      return originalPrepare(sql);
    };
    expect((await consumeFreeCheck(env, { id: 'u_1' }, SEPT)).ok).toBe(false);
    expect(db._tables.users[0].free_vis_used).toBe(0);
    expect((await consumeFreeCheck(env, { id: 'u_1' }, SEPT)).ok).toBe(true);
  });
});
