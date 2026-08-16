/**
 * GeoScore Pro Monitoring Module
 * - JWT verify + plan resolution (shared with payments.js)
 * - Pro API: sites CRUD (max 5 domains), cloud audit history, PDF export
 * - Scheduled weekly audits with regression alerts (Resend)
 *
 * Auth contract: Authorization: Bearer <jwt> (signed by payments.js)
 */
import { auditUrl } from './lib/node-scanner.js';
import { renderAuditPdf } from './lib/pdf.js';

const MAX_SITES = 5;
const ALERT_THRESHOLD = 10;        // score drop >= 10 triggers email
const FAILURE_ALERT_AFTER = 3;     // consecutive failures before email
const RETENTION_DAYS = 30;
const SITE_CONCURRENCY = 3;        // bounded concurrency for cron batches

// ============ SHARED SECURITY UTILITIES ============

export function base64Url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

export function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function hmacSha256(message, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyJWT(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expectedSignature = await hmacSha256(header + '.' + payload, secret);
  if (!constantTimeEqual(signature, expectedSignature)) return null;
  try {
    const decoded = JSON.parse(base64UrlDecode(payload));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

// ============ PLAN / AUTH ============

/**
 * Resolve effective plan from the subscriptions table.
 * Active/trialing with valid current_period_end => sub plan; otherwise free.
 * Downgrades expired subscriptions so stale webhook state cannot leak Pro access.
 */
export async function resolvePlan(user, env) {
  if (!user || !user.email) return 'free';
  const sub = await env.DB.prepare(
    `SELECT plan, status, current_period_end FROM subscriptions WHERE email=?`
  ).bind(user.email).first();
  if (sub && (sub.status === 'active' || sub.status === 'trialing')) {
    const now = Math.floor(Date.now() / 1000);
    if (!sub.current_period_end || sub.current_period_end >= now) {
      return sub.plan || 'free';
    }
    // Period ended: downgrade
    await env.DB.prepare(
      `UPDATE subscriptions SET status='expired', updated_at=? WHERE email=?`
    ).bind(now, user.email).run();
    await env.DB.prepare(
      `UPDATE users SET plan='free', subscription_id=null, updated_at=? WHERE email=?`
    ).bind(now, user.email).run();
  }
  return 'free';
}

async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const payload = await verifyJWT(auth.slice(7), env.JWT_SECRET);
  if (!payload) return null;
  const user = await env.DB.prepare(
    `SELECT id, email, name, avatar, provider, plan FROM users WHERE id=?`
  ).bind(payload.uid).first();
  if (!user) return null;
  user.plan = await resolvePlan(user, env);
  return user;
}

function generateId(prefix) {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  return prefix + hex;
}

function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function normalizeHost(rawUrl) {
  const u = new URL(rawUrl);
  return u.hostname.replace(/^www\./, '').toLowerCase();
}

function normalizeAuditUrl(rawUrl) {
  const u = new URL(rawUrl);
  const path = u.pathname.replace(/\/$/, '') || '/';
  return u.origin + path;
}

// ============ PRO API ============

export async function handleProRoutes(request, env, corsHeaders, url, path) {
  if (path === '/api/checkout' && request.method === 'POST') return handleCreateCheckout(request, env, corsHeaders);
  if (path === '/api/sites' && request.method === 'GET') return handleListSites(request, env, corsHeaders);
  if (path === '/api/sites' && request.method === 'POST') return handleAddSite(request, env, corsHeaders);
  if (path === '/api/sites' && request.method === 'DELETE') return handleDeleteSite(request, env, corsHeaders, url);
  if (path === '/api/audits' && request.method === 'GET') return handleListAudits(request, env, corsHeaders, url);
  if (path === '/api/audits' && request.method === 'POST') return handleSaveAudit(request, env, corsHeaders);
  const pdfMatch = path.match(/^\/api\/audits\/([^/]+)\/pdf$/);
  if (pdfMatch && request.method === 'GET') return handleAuditPdf(request, env, corsHeaders, pdfMatch[1]);
  return json({ error: 'Not Found' }, 404, corsHeaders);
}

async function assertProUser(request, env, corsHeaders) {
  const user = await requireAuth(request, env);
  if (!user) return { error: json({ error: 'Unauthorized' }, 401, corsHeaders) };
  if (user.plan !== 'pro') return { error: json({ error: 'Pro plan required' }, 403, corsHeaders) };
  return { user };
}

async function handleListSites(request, env, corsHeaders) {
  const guard = await assertProUser(request, env, corsHeaders);
  if (guard.error) return guard.error;
  const user = guard.user;
  const rows = await env.DB.prepare(
    `SELECT id, host, url, status, last_audit_at, last_score, last_success_at, consecutive_failures, created_at
     FROM sites WHERE user_id=? AND status='active' ORDER BY created_at ASC`
  ).bind(user.id).all();
  return json({ sites: rows.results }, 200, corsHeaders);
}

async function handleAddSite(request, env, corsHeaders) {
  const guard = await assertProUser(request, env, corsHeaders);
  if (guard.error) return guard.error;
  const user = guard.user;
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, corsHeaders); }
  const raw = String(body.url || '').trim();
  if (!raw) return json({ error: 'Missing url' }, 400, corsHeaders);

  let host, normalized;
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
    host = normalizeHost(withProto);
    normalized = normalizeAuditUrl(withProto);
  } catch {
    return json({ error: 'Invalid URL' }, 400, corsHeaders);
  }

  const count = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM sites WHERE user_id=? AND status='active'`
  ).bind(user.id).first();
  if ((count?.c || 0) >= MAX_SITES) {
    return json({ error: 'Monitor limit reached (' + MAX_SITES + ' domains)' }, 409, corsHeaders);
  }

  const dup = await env.DB.prepare(
    `SELECT id FROM sites WHERE user_id=? AND host=?`
  ).bind(user.id, host).first();
  if (dup) return json({ error: 'Domain already monitored' }, 409, corsHeaders);

  const id = generateId('s_');
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT INTO sites (id, user_id, email, host, url, status, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?)`
  ).bind(id, user.id, user.email, host, normalized, now).run();

  return json({ site: { id, host, url: normalized, status: 'active', created_at: now } }, 201, corsHeaders);
}

async function handleDeleteSite(request, env, corsHeaders, url) {
  const guard = await assertProUser(request, env, corsHeaders);
  if (guard.error) return guard.error;
  const user = guard.user;
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Missing id' }, 400, corsHeaders);

  const site = await env.DB.prepare(
    `SELECT id FROM sites WHERE id=? AND user_id=?`
  ).bind(id, user.id).first();
  if (!site) return json({ error: 'Site not found' }, 404, corsHeaders);

  // Cascade-delete cloud history for this site, then the site
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM audits WHERE site_id=?`).bind(id),
    env.DB.prepare(`DELETE FROM sites WHERE id=?`).bind(id),
  ]);
  return json({ success: true }, 200, corsHeaders);
}

async function handleListAudits(request, env, corsHeaders, url) {
  const guard = await assertProUser(request, env, corsHeaders);
  if (guard.error) return guard.error;
  const user = guard.user;
  const siteId = url.searchParams.get('site_id');
  let limit = parseInt(url.searchParams.get('limit') || '20', 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100;

  let rows;
  if (siteId) {
    const site = await env.DB.prepare(
      `SELECT id FROM sites WHERE id=? AND user_id=?`
    ).bind(siteId, user.id).first();
    if (!site) return json({ error: 'Site not found' }, 404, corsHeaders);
    rows = await env.DB.prepare(
      `SELECT id, site_id, url, host, score, level, summary, source, status, error, created_at
       FROM audits WHERE user_id=? AND site_id=? ORDER BY created_at DESC LIMIT ?`
    ).bind(user.id, siteId, limit).all();
  } else {
    rows = await env.DB.prepare(
      `SELECT id, site_id, url, host, score, level, summary, source, status, error, created_at
       FROM audits WHERE user_id=? ORDER BY created_at DESC LIMIT ?`
    ).bind(user.id, limit).all();
  }
  return json({ audits: rows.results }, 200, corsHeaders);
}

/**
 * Whitelist + validate an audit result from the client (manual save).
 * Ensures stored rows have the same shape as cron-produced audits.
 */
function sanitizeAuditResult(result) {
  const clean = {};
  clean.url = typeof result.url === 'string' ? result.url.slice(0, 2048) : '';
  clean.score = Number(result.score);
  clean.level = typeof result.level === 'string' ? result.level.slice(0, 32) : '';
  clean.summary = typeof result.summary === 'string' ? result.summary.slice(0, 500) : '';
  clean.dimensions = result.dimensions && typeof result.dimensions === 'object' ? JSON.stringify(result.dimensions) : '{}';
  clean.negative_signals = result.negativeSignals && typeof result.negativeSignals === 'object' ? JSON.stringify(result.negativeSignals) : '{}';
  clean.prompt_injection = result.promptInjection && typeof result.promptInjection === 'object' ? JSON.stringify(result.promptInjection) : '{}';
  clean.recommendations = Array.isArray(result.recommendations) ? JSON.stringify(result.recommendations.slice(0, 50)) : '[]';
  if (result.raw && typeof result.raw === 'object') {
    clean.raw = JSON.stringify({ robotsTxt: result.raw.robotsTxt || null, llmsTxt: result.raw.llmsTxt || null, pageHtml: (result.raw.pageHtml || '').slice(0, 500) });
  } else {
    clean.raw = '{}';
  }
  return clean;
}

async function handleSaveAudit(request, env, corsHeaders) {
  const guard = await assertProUser(request, env, corsHeaders);
  if (guard.error) return guard.error;
  const user = guard.user;
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, corsHeaders); }
  const raw = String(body.url || '').trim();
  const result = body.result;
  if (!raw || !result || typeof result !== 'object') {
    return json({ error: 'Missing url or result' }, 400, corsHeaders);
  }
  const score = Number(result.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return json({ error: 'Invalid score' }, 400, corsHeaders);
  }

  let host, normalized;
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
    host = normalizeHost(withProto);
    normalized = normalizeAuditUrl(withProto);
  } catch {
    return json({ error: 'Invalid URL' }, 400, corsHeaders);
  }

  const clean = sanitizeAuditResult(result);
  // Link manual saves to a monitored site with the same host so they appear
  // in that site's cloud history.
  const site = await env.DB.prepare(
    
`
SELECT id FROM sites WHERE user_id=? AND host=? LIMIT 1
`
  ).bind(user.id, host).first();
  const siteId = site ? site.id : null;
  const id = generateId('a_');
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT INTO audits (id, user_id, email, site_id, url, host, score, level, summary, dimensions, negative_signals, prompt_injection, recommendations, raw, source, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'ok', ?)`
  ).bind(id, user.id, user.email, siteId, normalized, host, clean.score, clean.level, clean.summary,
    clean.dimensions, clean.negative_signals, clean.prompt_injection, clean.recommendations, clean.raw, now).run();

  return json({ audit: { id, url: normalized, host, score: clean.score, created_at: now } }, 201, corsHeaders);
}

async function handleAuditPdf(request, env, corsHeaders, id) {
  const guard = await assertProUser(request, env, corsHeaders);
  if (guard.error) return guard.error;
  const user = guard.user;
  const audit = await env.DB.prepare(
    `SELECT id, url, score, level, summary, dimensions, recommendations, created_at FROM audits WHERE id=? AND user_id=?`
  ).bind(id, user.id).first();
  if (!audit) return json({ error: 'Audit not found' }, 404, corsHeaders);

  const bytes = renderAuditPdf(audit);
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="geo-audit-' + id + '.pdf"',
      ...corsHeaders,
    },
  });
}

const CREEM_CHECKOUT_API = env => (env.CREEM_API_BASE || 'https://api.creem.io') + '/v1/checkouts';
const CREEM_CHECKOUT_KEY = env => (env.CREEM_API_BASE || '').includes('test-api') ? (env.CREEM_API_KEY_TEST || env.CREEM_API_KEY) : env.CREEM_API_KEY;
const CREEM_PRODUCT_ID = 'prod_3hLh24EkJOL0jS0Jrf9zq5';
const CREEM_SUCCESS_URL = 'https://geoscore.help/pricing/?checkout=success';

/**
 * POST /api/checkout
 * Creates a Creem checkout session bound to the signed-in user's email so the
 * checkout.completed webhook can activate the correct account.
 */
export async function handleCreateCheckout(request, env, corsHeaders) {
  const user = await requireAuth(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401, corsHeaders);
  if (!env.CREEM_API_KEY) return json({ error: 'Checkout unavailable' }, 503, corsHeaders);
  let body = {};
  try { body = await request.json(); } catch (e) {}
  const productId = String(body.product_id || CREEM_PRODUCT_ID);
  const successUrl = String(body.success_url || CREEM_SUCCESS_URL).slice(0, 2048);
  const checkoutRes = await fetch(CREEM_CHECKOUT_API(env), {
    method: 'POST',
    headers: {
      'x-api-key': CREEM_CHECKOUT_KEY(env),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product_id: productId,
      success_url: successUrl,
      customer: { email: user.email },
    }),
  });
  let data = null;
  try { data = await checkoutRes.json(); } catch (e) {}
  if (!checkoutRes.ok || !data || !data.checkout_url) {
    return json({ error: 'Failed to create checkout' }, 502, corsHeaders);
  }
  return json({ checkout_url: data.checkout_url }, 200, corsHeaders);
}
// ============ EMAIL (Resend) ============

async function sendEmail(env, to, subject, html) {
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GeoScore Monitor <noreply@geoscore.help>',
        to: [to],
        subject,
        html,
      }),
    });
    return resp.ok;
  } catch (err) {
    console.error('sendEmail error:', err);
    return false;
  }
}

function sendRegressionAlert(env, email, url, prevScore, newScore) {
  const host = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return sendEmail(
    env, email,
    'GeoScore regression alert: ' + host,
    '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">' +
    '<h2 style="color:#ef4444;">GEO score dropped</h2>' +
    '<p style="font-size:15px;color:#374151;">Your monitored site <strong>' + host + '</strong> dropped from <strong>' + prevScore + '</strong> to <strong>' + newScore + '</strong> (>= 10 points).</p>' +
    '<p style="font-size:13px;color:#6b7280;">Run a fresh audit at <a href="https://geoscore.help" style="color:#6366f1;">geoscore.help</a> to see what changed.</p>' +
    '</div>'
  );
}

function sendFailureAlert(env, email, url, error) {
  const host = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return sendEmail(
    env, email,
    'GeoScore monitor: unable to audit ' + host,
    '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">' +
    '<h2 style="color:#f59e0b;">Audit failing</h2>' +
    '<p style="font-size:15px;color:#374151;">We could not audit <strong>' + host + '</strong> for 3 consecutive weeks. The site may be blocking our crawler or offline.</p>' +
    '<p style="font-size:13px;color:#6b7280;">Last error: ' + String(error || '').slice(0, 300) + '</p>' +
    '<p style="font-size:13px;color:#6b7280;">No action needed if this is expected; audits will keep retrying weekly.</p>' +
    '</div>'
  );
}

// ============ SCHEDULED AUDITS (weekly cron) ============

/**
 * Audit one monitored site: run scanner, store audit row, compare score,
 * send regression alert if drop >= ALERT_THRESHOLD, update site state.
 * Failure policy: store failed row, bump consecutive_failures,
 * email user after FAILURE_ALERT_AFTER consecutive failures, then reset counter.
 */
async function auditSite(site, env) {
  const now = Math.floor(Date.now() / 1000);
  try {
    const result = await auditUrl(site.url);
    const id = generateId('a_');
    await env.DB.prepare(
      `INSERT INTO audits (id, user_id, email, site_id, url, host, score, level, summary, dimensions, negative_signals, prompt_injection, recommendations, raw, source, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', 'ok', ?)`
    ).bind(
      id, site.user_id, site.email, site.id, result.url, site.host, result.score, result.level,
      result.summary, JSON.stringify(result.dimensions), JSON.stringify(result.negativeSignals),
      JSON.stringify(result.promptInjection), JSON.stringify(result.recommendations),
      JSON.stringify(result.raw), now
    ).run();

    let alerted = false;
    if (site.last_score != null && site.last_score - result.score >= ALERT_THRESHOLD) {
      await sendRegressionAlert(env, site.email, site.url, site.last_score, result.score);
      alerted = true;
    }

    await env.DB.prepare(
      `UPDATE sites SET last_audit_at=?, last_score=?, last_success_at=?, consecutive_failures=0 WHERE id=?`
    ).bind(now, result.score, now, site.id).run();

    return { ok: true, alerted };
  } catch (err) {
    const failId = generateId('a_');
    await env.DB.prepare(
      `INSERT INTO audits (id, user_id, email, site_id, url, host, score, level, summary, source, status, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 'failed', '', 'scheduled', 'failed', ?, ?)`
    ).bind(failId, site.user_id, site.email, site.id, site.url, site.host,
      String(err?.message || 'fetch failed').slice(0, 500), now).run();

    const next = (site.consecutive_failures || 0) + 1;
    if (next >= FAILURE_ALERT_AFTER) {
      await sendFailureAlert(env, site.email, site.url, err?.message);
      await env.DB.prepare(
        `UPDATE sites SET consecutive_failures=0, last_audit_at=? WHERE id=?`
      ).bind(now, site.id).run();
    } else {
      await env.DB.prepare(
        `UPDATE sites SET consecutive_failures=?, last_audit_at=? WHERE id=?`
      ).bind(next, now, site.id).run();
    }
    return { ok: false };
  }
}

export async function runScheduledAudits(env) {
  const now = Math.floor(Date.now() / 1000);

  // 1) Retention cleanup: drop audits older than RETENTION_DAYS
  await env.DB.prepare(
    `DELETE FROM audits WHERE created_at < ?`
  ).bind(now - RETENTION_DAYS * 86400).run();

  // 2) Load all active sites (keyset pagination)
  const sites = [];
  let cursor = null;
  for (;;) {
    const rows = cursor
      ? await env.DB.prepare(
          `SELECT * FROM sites WHERE status='active' AND id > ? ORDER BY id LIMIT 50`
        ).bind(cursor).all()
      : await env.DB.prepare(
          `SELECT * FROM sites WHERE status='active' ORDER BY id LIMIT 50`
        ).all();
    sites.push(...rows.results);
    if (rows.results.length < 50) break;
    cursor = rows.results[rows.results.length - 1].id;
  }

  // 3) Bounded-concurrency batches
  let success = 0, failed = 0, alerts = 0;
  for (let i = 0; i < sites.length; i += SITE_CONCURRENCY) {
    const batch = sites.slice(i, i + SITE_CONCURRENCY);
    const results = await Promise.allSettled(batch.map(site => auditSite(site, env)));
    results.forEach(r => {
      if (r.status === 'fulfilled') {
        if (r.value.ok) success++; else failed++;
        if (r.value.alerted) alerts++;
      } else {
        failed++;
      }
    });
  }

  console.log(JSON.stringify({
    cron: 'geo-score-pro',
    sites: sites.length,
    success,
    failed,
    alerts,
    at: now,
  }));
  return { sites: sites.length, success, failed, alerts };
}



