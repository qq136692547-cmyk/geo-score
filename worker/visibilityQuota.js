/**
 * Free-tier AI visibility quota and abuse control.
 * Implements PRD §12.5 (decision order steps 3-7) and §12.6 (free vs Pro data boundary).
 *
 * Paid tiers are unaffected by everything in this file; it only decides whether a
 * non-Pro user may spend one free simulation and how often.
 */

// Free users get exactly one check per period, Pro gets a soft monthly cap (PRD §12.7).
export const FREE_VIS_LIMIT = 1;
export const PRO_VIS_LIMIT = 30;

// PRD §12.5 step 4: IP 24h, host 72h.
export const FREE_IP_COOLDOWN_SEC = 24 * 3600;
export const FREE_HOST_COOLDOWN_SEC = 72 * 3600;

// PRD §12.7: free runs a single engine so the per-user cost stays bounded.
export const FREE_ENGINES = ['chatgpt'];

/**
 * Disposable / relay mailbox domains. Abuse normalisation only - never used to
 * rewrite or reject a real contact address (PRD §12.5 step 3).
 * Extend without touching code by pointing DISPOSABLE_EMAIL_DOMAINS at a
 * comma-separated list.
 */
const DISPOSABLE_DEFAULTS = [
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
  'temp-mail.org', 'throwawaymail.com', 'yopmail.com', 'trashmail.com',
  'sharklasers.com', 'getnada.com', 'dispostable.com', 'maildrop.cc',
  'fakeinbox.com', 'mailnesia.com', 'mytemp.email', 'tempr.email',
  'emailondeck.com', 'moakt.com', 'mohmal.com', 'spam4.me',
];

export function disposableDomains(env) {
  const extra = String((env && env.DISPOSABLE_EMAIL_DOMAINS) || '')
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(Boolean);
  return extra.length ? DISPOSABLE_DEFAULTS.concat(extra) : DISPOSABLE_DEFAULTS;
}

/**
 * Lowercase and drop the +tag suffix so `a+1@x.com` and `a+2@x.com` count as one
 * identity for abuse checks. Callers must still store the address the user typed.
 */
export function normalizeEmailForAbuse(email) {
  const raw = String(email || '').trim().toLowerCase();
  const at = raw.lastIndexOf('@');
  if (at <= 0) return raw;
  const local = raw.slice(0, at).split('+')[0];
  return local + raw.slice(at);
}

export function isDisposableEmail(email, env) {
  const norm = normalizeEmailForAbuse(email);
  const at = norm.lastIndexOf('@');
  if (at < 0) return false;
  return disposableDomains(env).indexOf(norm.slice(at + 1)) >= 0;
}

// ============ PERIOD ============

/** Unix seconds at the start of the current UTC month. */
export function currentPeriodStartUtc(now) {
  const d = new Date(now * 1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000);
}

/** Unix seconds at the start of the next UTC month (reported to the client as period_end). */
export function currentPeriodEndUtc(now) {
  const d = new Date(now * 1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000);
}

// ============ SSRF GUARD ============

function ipv4Blocked(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  if (octets.some(o => o > 255)) return 'malformed IP';
  const [a, b] = octets;
  if (a === 0) return 'reserved 0.0.0.0/8';
  if (a === 10) return 'private 10/8';
  if (a === 127) return 'loopback 127/8';
  if (a === 169 && b === 254) return 'link-local 169.254/16';
  if (a === 172 && b >= 16 && b <= 31) return 'private 172.16/12';
  if (a === 192 && b === 168) return 'private 192.168/16';
  if (a === 100 && b >= 64 && b <= 127) return 'carrier NAT 100.64/10';
  if (a === 192 && b === 0 && octets[2] === 0) return 'reserved 192.0.0/24';
  if (a === 198 && (b === 18 || b === 19)) return 'benchmark 198.18/15';
  if (a >= 224) return 'multicast/reserved 224/4';
  return null;
}

/** Expand an IPv6 literal into eight 16-bit groups, resolving `::`. */
function expandIpv6(host) {
  const zone = host.indexOf('%');
  const addr = zone >= 0 ? host.slice(0, zone) : host;
  const halves = addr.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  let groups;
  if (halves.length === 2) {
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    groups = head.concat(new Array(fill).fill('0')).concat(tail);
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  const nums = groups.map(g => (g === '' ? 0 : (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN)));
  return nums.some(Number.isNaN) ? null : nums;
}

function ipv6Blocked(host) {
  const groups = expandIpv6(host.toLowerCase());
  if (!groups) return 'malformed IPv6';
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  const highZero = groups.slice(0, 7).every(g => g === 0);
  if (highZero && g7 === 0) return 'unspecified ::';
  if (highZero && g7 === 1) return 'loopback ::1';
  if ((g0 & 0xfe00) === 0xfc00) return 'unique local fc00::/7';
  if ((g0 & 0xffc0) === 0xfe80) return 'link-local fe80::/10';
  // IPv4-mapped (::ffff:a.b.c.d) and legacy IPv4-compatible (::a.b.c.d) addresses.
  // The URL parser rewrites the dotted form to hex, so the hex groups are what we
  // actually receive; compare on the decoded groups, never on the raw text.
  const mapped = groups.slice(0, 5).every(g => g === 0) && g5 === 0xffff;
  const compatible = groups.slice(0, 6).every(g => g === 0);
  if (mapped || compatible) {
    const dotted = [g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff].join('.');
    const inner = ipv4Blocked(dotted);
    if (inner) return inner;
    return mapped ? null : 'IPv4-compatible address';
  }
  return null;
}

/**
 * PRD §12.6: the free path accepts a client-supplied URL, so the Worker must
 * refuse anything that is not a public http(s) address.
 *
 * Residual risk: this is a literal-address check. A hostname may still resolve
 * to a private address (DNS rebinding), which Cloudflare's fetch will follow.
 * Closing that fully needs resolution-time filtering that Workers do not expose,
 * so free-tier exposure is bounded by the quota and cooldown instead.
 */
export function inspectPublicUrl(rawInput) {
  let parsed;
  try {
    parsed = new URL(String(rawInput || '').trim());
  } catch (e) {
    return { ok: false, reason: 'unparseable URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'only http/https allowed' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'credentials in URL' };
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host) return { ok: false, reason: 'missing host' };
  if (host === 'localhost' || host.endsWith('.localhost')) return { ok: false, reason: 'localhost' };
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) {
    return { ok: false, reason: 'internal TLD' };
  }
  const reason = host.indexOf(':') >= 0 ? ipv6Blocked(host) : ipv4Blocked(host);
  if (reason) return { ok: false, reason };
  return { ok: true, url: parsed.toString(), host: host.replace(/^www\./, '') };
}

// ============ ELIGIBILITY & QUOTA ============

/**
 * PRD §12.5 step 3. Only Google accounts qualify for the free simulation: it is
 * the cheapest identity signal that resists throwaway signups.
 */
export function evaluateFreeEligibility(user, env) {
  if (!user) return { eligible: false, reason: 'not_authenticated' };
  if (String(user.provider || '').toLowerCase() !== 'google') {
    return { eligible: false, reason: 'google_required' };
  }
  if (!user.email) return { eligible: false, reason: 'email_required' };
  if (isDisposableEmail(user.email, env)) {
    return { eligible: false, reason: 'disposable_email' };
  }
  return { eligible: true, reason: null };
}

async function readUsage(env, userId) {
  const row = await env.DB.prepare(
    'SELECT free_vis_used, free_vis_period_start FROM users WHERE id=?'
  ).bind(userId).first();
  return {
    used: row && Number.isFinite(row.free_vis_used) ? row.free_vis_used : 0,
    periodStart: row && Number.isFinite(row.free_vis_period_start) ? row.free_vis_period_start : null,
  };
}

/**
 * PRD §12.5 steps 5-6: roll the period over, then report what is left.
 * Pure read - never mutates, so it is safe to call from GET /auth/me.
 */
export async function freeVisibilityAllowance(env, user, now, plan) {
  const periodEnd = currentPeriodEndUtc(now);
  if (plan === 'pro') {
    return { eligible: true, plan: 'pro', remaining: PRO_VIS_LIMIT, limit: PRO_VIS_LIMIT, period_end: periodEnd, reason: null };
  }
  const eligibility = evaluateFreeEligibility(user, env);
  if (!eligibility.eligible) {
    return { eligible: false, plan: 'free', remaining: 0, limit: FREE_VIS_LIMIT, period_end: periodEnd, reason: eligibility.reason };
  }
  const usage = await readUsage(env, user.id);
  const rolledOver = usage.periodStart !== currentPeriodStartUtc(now);
  const used = rolledOver ? 0 : usage.used;
  return {
    eligible: used < FREE_VIS_LIMIT,
    plan: 'free',
    remaining: Math.max(0, FREE_VIS_LIMIT - used),
    limit: FREE_VIS_LIMIT,
    period_end: periodEnd,
    reason: used < FREE_VIS_LIMIT ? null : 'quota_exhausted',
  };
}

/**
 * PRD §12.5 steps 5-7: roll over, then grab the single slot with an optimistic
 * lock. The conditional UPDATE is what makes concurrency safe - two parallel
 * requests compare-and-set the same expected value and exactly one wins, so a
 * double-click cannot buy two simulations.
 */
export async function consumeFreeCheck(env, user, now) {
  const periodStart = currentPeriodStartUtc(now);
  const usage = await readUsage(env, user.id);

  if (usage.periodStart !== periodStart) {
    await env.DB.prepare(
      'UPDATE users SET free_vis_used=0, free_vis_period_start=?, updated_at=? WHERE id=?'
    ).bind(periodStart, now, user.id).run();
    usage.used = 0;
  }

  if (usage.used >= FREE_VIS_LIMIT) {
    return { ok: false, reason: 'quota_exhausted', used: usage.used };
  }

  const res = await env.DB.prepare(
    'UPDATE users SET free_vis_used=free_vis_used+1, updated_at=? WHERE id=? AND free_vis_used=?'
  ).bind(now, user.id, usage.used).run();

  if (!res || !res.meta || res.meta.changes !== 1) {
    return { ok: false, reason: 'concurrent_request', used: usage.used };
  }
  return { ok: true, used: usage.used + 1 };
}

/**
 * PRD §12.5 step 3 (anti-abuse normalisation): a user must not be able to chain
 * free checks by re-registering aliases of the same mailbox.
 */
export function cooldownScopeKey(user) {
  return normalizeEmailForAbuse(user.email);
}

/** Normalised host for cooldown + storage, mirroring the Pro path. */
export function normalizeHost(rawInput) {
  return String(rawInput || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
}
