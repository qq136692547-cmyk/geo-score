/**
 * GeoScore Payment + Auth Worker
 * 
 * Features:
 *  - Creem webhook receiver (subscription lifecycle)
 *  - Email verification code login (via Resend)
 *  - Google OAuth login (ID token verification via Google JWKS)
 *  - JWT session token signing/verification
 *  - Subscription status API
 *  - Pro monitoring API + weekly scheduled audits (see pro.js)
 * 
 * Deploy: wrangler deploy
 * 
 * Secrets (wrangler secret put):
 *   CREEM_WEBHOOK_SECRET  - webhook signing secret from Creem
 *   CREEM_API_KEY         - Creem API key
 *   GEOSCORE_API_TOKEN    - token for protecting legacy status API
 *   RESEND_API_KEY        - Resend API key for sending verification emails
 *   JWT_SECRET            - HMAC secret for signing JWTs
 *   GOOGLE_CLIENT_ID      - Google OAuth Client ID
 */
import { verifyJWT, resolvePlan, hmacSha256, base64Url, constantTimeEqual, handleProRoutes, runScheduledAudits } from './pro.js';
import { freeVisibilityAllowance } from './visibilityQuota.js';

// Plan mapping: Creem product ID -> plan name
// v1.5.0: Only Pro is offered for now. Studio/Agency are visible on pricing page as "Coming Soon".
const PLAN_MAP = {
  'prod_3hLh24EkJOL0jS0Jrf9zq5': 'pro',
};

const PLAN_PRICES = {
  pro: 900,  // $9.00
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://geoscore.help',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // --- Auth routes ---
    if (path === '/auth/send-code' && request.method === 'POST') {
      return handleSendCode(request, env, corsHeaders);
    }
    if (path === '/auth/verify' && request.method === 'POST') {
      return handleVerifyCode(request, env, corsHeaders);
    }
    if (path === '/auth/google' && request.method === 'POST') {
      return handleGoogleLogin(request, env, corsHeaders);
    }
    if (path === '/auth/me' && request.method === 'GET') {
      return handleMe(request, env, corsHeaders);
    }

    // --- Payment webhook ---
    if (path === '/webhook' && request.method === 'POST') {
      return handleWebhook(request, env, corsHeaders);
    }

    // --- Subscription status ---
    if (path === '/api/subscription' && request.method === 'GET') {
      return handleSubscriptionCheck(request, env, corsHeaders, url);
    }

    // --- Pro monitoring API (sites, audits, PDF) ---
    if (path.startsWith('/api/')) {
      return handleProRoutes(request, env, corsHeaders, url, path);
    }

    // --- Health ---
    if (path === '/health') {
      return new Response(JSON.stringify({ status: 'ok', time: Date.now() }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },

  // Weekly scheduled audits (cron "0 3 * * 1")
  async scheduled(event, env, ctx) {
    try {
      const summary = await runScheduledAudits(env);
      console.log('scheduled complete:', JSON.stringify(summary));
    } catch (err) {
      console.error('scheduled error:', err);
    }
  },
};

// ============ AUTH ============

/**
 * POST /auth/send-code
 * Body: { email: "user@example.com" }
 * Generates a 6-digit code, stores in D1, sends via Resend.
 */
async function handleSendCode(request, env, corsHeaders) {
  try {
    const { email } = await request.json();
    if (!email || !isValidEmail(email)) {
      return json({ error: 'Invalid email' }, 400, corsHeaders);
    }

    // Rate limit: max 1 code per 60s per email
    const recent = await env.DB.prepare(
      `SELECT created_at FROM verify_codes WHERE email=? AND created_at > ? ORDER BY created_at DESC LIMIT 1`
    ).bind(email, Math.floor(Date.now() / 1000) - 60).first();
    if (recent) {
      return json({ error: 'Please wait 60 seconds before requesting another code.' }, 429, corsHeaders);
    }

    // Clean up expired codes for this email
    await env.DB.prepare(
      `DELETE FROM verify_codes WHERE email=? AND expires_at < ?`
    ).bind(email, Math.floor(Date.now() / 1000)).run();

    // Generate 6-digit code (cryptographically secure)
    const randArr = new Uint32Array(1);
    crypto.getRandomValues(randArr);
    const code = String(randArr[0] % 900000 + 100000);
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 600; // 10 minutes

    // Store code
    await env.DB.prepare(
      `INSERT INTO verify_codes (email, code, expires_at) VALUES (?, ?, ?)`
    ).bind(email, code, expiresAt).run();

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL || 'GeoScore <onboarding@resend.dev>',
        to: [email],
        subject: 'Your GeoScore Login Code',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h1 style="color: #6366f1; margin-bottom: 24px;">GeoScore Login</h1>
            <p style="font-size: 16px; color: #374151;">Your verification code is:</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #6366f1; padding: 16px 0; text-align: center; background: #f5f3ff; border-radius: 8px; margin: 16px 0;">${code}</div>
            <p style="font-size: 14px; color: #6b7280;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="font-size: 12px; color: #9ca3af;">GeoScore - Free GEO Audit Tool<br>https://geoscore.help</p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      console.error('Resend error:', await emailResponse.text());
      return json({ error: 'Failed to send email' }, 500, corsHeaders);
    }

    return json({ success: true, message: 'Verification code sent' }, 200, corsHeaders);
  } catch (err) {
    console.error('send-code error:', err);
    return json({ error: 'Internal error' }, 500, corsHeaders);
  }
}

/**
 * POST /auth/verify
 * Body: { email, code }
 * Verifies code, creates/finds user, returns JWT.
 */
async function handleVerifyCode(request, env, corsHeaders) {
  try {
    const { email, code } = await request.json();
    if (!email || !code) {
      return json({ error: 'Missing email or code' }, 400, corsHeaders);
    }

    const now = Math.floor(Date.now() / 1000);

    // Check code (with attempts limit)
    const record = await env.DB.prepare(
      `SELECT * FROM verify_codes WHERE email=? AND code=? AND expires_at > ? ORDER BY created_at DESC LIMIT 1`
    ).bind(email, code, now).first();

    if (!record) {
      // Increment attempts on the most recent valid code for this email
      const recentCode = await env.DB.prepare(
        `SELECT * FROM verify_codes WHERE email=? AND expires_at > ? ORDER BY created_at DESC LIMIT 1`
      ).bind(email, now).first();
      if (recentCode) {
        const attempts = (recentCode.attempts || 0) + 1;
        if (attempts >= 5) {
          // Max attempts reached, delete the code
          await env.DB.prepare(
            `DELETE FROM verify_codes WHERE email=? AND code=?`
          ).bind(email, recentCode.code).run();
          return json({ error: 'Too many failed attempts. Please request a new code.' }, 429, corsHeaders);
        }
        // Update attempts count
        await env.DB.prepare(
          `UPDATE verify_codes SET attempts=? WHERE email=? AND code=?`
        ).bind(attempts, email, recentCode.code).run();
      }
      return json({ error: 'Invalid or expired code' }, 401, corsHeaders);
    }

    // Delete used code
    await env.DB.prepare(
      `DELETE FROM verify_codes WHERE email=? AND code=?`
    ).bind(email, code).run();

    // Find or create user
    let user = await env.DB.prepare(
      `SELECT * FROM users WHERE email=?`
    ).bind(email).first();

    if (!user) {
      const userId = generateId();
      await env.DB.prepare(
        `INSERT INTO users (id, email, provider, plan) VALUES (?, ?, 'email', 'free')`
      ).bind(userId, email).run();
      user = { id: userId, email, name: null, avatar: null, provider: 'email', plan: 'free' };
    }

    // Resolve effective plan (subscription may have changed)
    user.plan = await resolvePlan(user, env);

    // Sign JWT
    const token = await signJWT({ uid: user.id, email: user.email }, env.JWT_SECRET);

    return json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        provider: user.provider,
        plan: user.plan,
      },
    }, 200, corsHeaders);
  } catch (err) {
    console.error('verify error:', err);
    return json({ error: 'Internal error' }, 500, corsHeaders);
  }
}

/**
 * POST /auth/google
 * Body: { idToken: "google_id_token" }
 * Verifies Google ID token via Google JWKS, creates/finds user, returns JWT.
 */
async function handleGoogleLogin(request, env, corsHeaders) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return json({ error: 'Missing idToken' }, 400, corsHeaders);
    }

    // Verify Google ID token
    const googleResp = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );

    if (!googleResp.ok) {
      return json({ error: 'Invalid Google token' }, 401, corsHeaders);
    }

    const payload = await googleResp.json();

    // Verify audience matches our client ID
    if (payload.aud !== env.GOOGLE_CLIENT_ID) {
      return json({ error: 'Token audience mismatch' }, 401, corsHeaders);
    }

    const email = payload.email;
    const name = payload.name || '';
    const avatar = payload.picture || '';

    if (!email) {
      return json({ error: 'No email in Google token' }, 400, corsHeaders);
    }

    // Find or create user
    let user = await env.DB.prepare(
      `SELECT * FROM users WHERE email=?`
    ).bind(email).first();

    if (!user) {
      const userId = generateId();
      await env.DB.prepare(
        `INSERT INTO users (id, email, name, avatar, provider) VALUES (?, ?, ?, ?, 'google')`
      ).bind(userId, email, name, avatar).run();
      user = { id: userId, email, name, avatar, provider: 'google', plan: 'free' };
    } else {
      // Update name/avatar if changed
      await env.DB.prepare(
        `UPDATE users SET name=?, avatar=?, updated_at=? WHERE email=?`
      ).bind(name, avatar, Math.floor(Date.now() / 1000), email).run();
      user.name = name;
      user.avatar = avatar;
    }

    // Resolve effective plan
    user.plan = await resolvePlan(user, env);

    const token = await signJWT({ uid: user.id, email: user.email }, env.JWT_SECRET);

    return json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        provider: user.provider,
        plan: user.plan,
      },
    }, 200, corsHeaders);
  } catch (err) {
    console.error('google login error:', err);
    return json({ error: 'Internal error' }, 500, corsHeaders);
  }
}

/**
 * GET /auth/me
 * Header: Authorization: Bearer <jwt>
 * Returns current user info.
 */
async function handleMe(request, env, corsHeaders) {
  try {
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return json({ error: 'No token' }, 401, corsHeaders);
    }

    const token = auth.slice(7);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload) {
      return json({ error: 'Invalid token' }, 401, corsHeaders);
    }

    const user = await env.DB.prepare(
      `SELECT id, email, name, avatar, provider, plan FROM users WHERE id=?`
    ).bind(payload.uid).first();

    if (!user) {
      return json({ error: 'User not found' }, 404, corsHeaders);
    }

    // Resolve effective plan (checks subscription expiry too)
    user.plan = await resolvePlan(user, env);

    // Free-tier AI visibility allowance (PRD §12.5). Read-only: the quota is only
    // claimed by POST /api/visibility/check, so a page view can never spend it.
    user.visibility_allowance = await freeVisibilityAllowance(env, user, Math.floor(Date.now() / 1000), user.plan);

    return json({ user }, 200, corsHeaders);
  } catch (err) {
    console.error('me error:', err);
    return json({ error: 'Internal error' }, 500, corsHeaders);
  }
}

// ============ WEBHOOK ============

// Creem real payloads use *_date ISO strings; tests/legacy mocks use unix seconds.
// Returns unix seconds for the subscription period end (or the fallback).
function periodEndSeconds(object, fallback) {
  const raw = object?.current_period_end_date ?? object?.current_period_end
    ?? object?.trial_end_date ?? object?.trial_end ?? object?.next_transaction_date;
  if (typeof raw === 'number') return Math.floor(raw);
  if (typeof raw === 'string') {
    const ms = Date.parse(raw);
    if (!Number.isNaN(ms)) return Math.floor(ms / 1000);
  }
  return fallback;
}

async function handleWebhook(request, env, corsHeaders) {
  let eventId = '';
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('creem-signature');
    if (!signature) {
      return new Response('Missing signature', { status: 401, headers: corsHeaders });
    }

    // Accept the production secret always. The test-mode secret is only honoured
    // when ALLOW_TEST_WEBHOOK is explicitly enabled (staging only): a sandbox
    // event must never be able to write the production subscriptions table.
    // 2026-11-01: production had CREEM_WEBHOOK_SECRET_TEST set, so nine sandbox
    // events (one of them a hand-made "evt_replay_embed_*" replay) landed in the
    // live table and made a self-test look like a $9 subscriber.
    const secrets = [env.CREEM_WEBHOOK_SECRET];
    if (env.ALLOW_TEST_WEBHOOK === 'true' && env.CREEM_WEBHOOK_SECRET_TEST) {
      secrets.push(env.CREEM_WEBHOOK_SECRET_TEST);
    }
    let signatureValid = false;
    for (const secret of secrets) {
      if (!secret) continue;
      if (constantTimeEqual(signature, await hmacSha256(rawBody, secret))) { signatureValid = true; break; }
    }
    if (!signatureValid) {
      return new Response('Invalid signature', { status: 401, headers: corsHeaders });
    }

    const event = JSON.parse(rawBody);
    // Creem uses event_type (snake_case); also accept eventType for forward-compat
    const eventType = event.event_type || event.eventType;
    const object = event.data?.object || event.data || event.object;

    // Idempotency: Creem retries each event up to 5 times; dedupe by event id.
    eventId = event.id || event.event_id || '';
    const now = Math.floor(Date.now() / 1000);
    if (eventId) {
      const dedup = await env.DB.prepare(
        `INSERT INTO webhook_events (event_id, event_type, received_at, processed_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(event_id) DO NOTHING`
      ).bind(eventId, eventType || '', now, now).run();
      if (dedup.meta && dedup.meta.changes === 0) {
        return new Response('OK', { status: 200, headers: corsHeaders });
      }
    }

    switch (eventType) {
      case 'checkout.completed': {
        const customer = object?.customer;
        const email = customer?.email;
        const plan = resolvePlanFromPayload(object, env);
        // Creem checkout payload nests the subscription object; legacy mocks use subscription_id
        const subId = object?.subscription?.id || object?.subscription_id || '';
        if (!email || !plan) break;
        // A completed checkout with no subscription id is not a subscription
        // purchase (one-off, $0, sandbox) - never activate Pro on it.
        if (!subId) { console.warn('checkout.completed without subscription id, ignored'); break; }
        // An explicitly zero amount means nothing was charged.
        if (chargedAmount(object) === 0) { console.warn('checkout.completed with zero amount, ignored'); break; }
        const now = Math.floor(Date.now() / 1000);

        await env.DB.prepare(
          `INSERT INTO subscriptions (email, plan, status, customer_id, subscription_id, current_period_end, updated_at)
           VALUES (?, ?, 'active', ?, ?, ?, ?)
           ON CONFLICT(email) DO UPDATE SET
             plan=excluded.plan, status=excluded.status, customer_id=excluded.customer_id,
             subscription_id=excluded.subscription_id, current_period_end=excluded.current_period_end,
             updated_at=excluded.updated_at`
        ).bind(email, plan, customer?.id || '', subId,
          periodEndSeconds(object, now + 30 * 86400), now).run();

        // Also update users table plan
        await env.DB.prepare(
          `UPDATE users SET plan=?, subscription_id=?, updated_at=? WHERE email=?`
        ).bind(plan, subId, now, email).run();
        break;
      }

      case 'subscription.active':
      case 'subscription.paid':
      case 'subscription.update': {
        const email = object?.customer?.email;
        const plan = resolvePlanFromPayload(object, env);
        // No fallback to 'pro': an unknown product id used to be upgraded to the
        // paid tier here, which is how a $0/sandbox subscription became "active".
        if (!email || !plan) { console.warn('subscription event without a resolvable plan, ignored'); break; }
        if (chargedAmount(object) === 0) { console.warn('subscription event with zero amount, ignored'); break; }
        const now = Math.floor(Date.now() / 1000);

        // Use upsert (INSERT ... ON CONFLICT) instead of UPDATE to handle missing rows
        await env.DB.prepare(
          `INSERT INTO subscriptions (email, plan, status, customer_id, subscription_id, current_period_end, updated_at)
           VALUES (?, ?, 'active', ?, ?, ?, ?)
           ON CONFLICT(email) DO UPDATE SET
             plan=excluded.plan, status='active', customer_id=excluded.customer_id,
             subscription_id=excluded.subscription_id, current_period_end=excluded.current_period_end,
             updated_at=excluded.updated_at`
        ).bind(email, plan, object?.customer?.id || '', object?.id || '',
          periodEndSeconds(object, now + 30 * 86400), now).run();

        await env.DB.prepare(
          `UPDATE users SET plan=?, updated_at=? WHERE email=?`
        ).bind(plan, now, email).run();
        break;
      }

      case 'subscription.canceled':
      case 'subscription.expired': {
        const email = object?.customer?.email;
        if (!email) break;
        const now = Math.floor(Date.now() / 1000);
        await env.DB.prepare(
          `UPDATE subscriptions SET status='canceled', updated_at=? WHERE email=?`
        ).bind(now, email).run();
        // Clear plan and subscription_id on users table
        await env.DB.prepare(
          `UPDATE users SET plan='free', subscription_id=null, updated_at=? WHERE email=?`
        ).bind(now, email).run();
        break;
      }

      case 'subscription.past_due': {
        const email = object?.customer?.email;
        if (!email) break;
        await env.DB.prepare(
          `UPDATE subscriptions SET status='past_due', updated_at=? WHERE email=?`
        ).bind(Math.floor(Date.now() / 1000), email).run();
        break;
      }

      case 'subscription.trialing': {
        const email = object?.customer?.email;
        const plan = resolvePlanFromPayload(object, env);
        if (!email || !plan) break;

        await env.DB.prepare(
          `INSERT INTO subscriptions (email, plan, status, customer_id, subscription_id, current_period_end, updated_at)
           VALUES (?, ?, 'trialing', ?, ?, ?, ?)
           ON CONFLICT(email) DO UPDATE SET
             plan=excluded.plan, status=excluded.status, updated_at=excluded.updated_at`
        ).bind(email, plan, object?.customer?.id || '', object?.id || '',
          periodEndSeconds(object, Math.floor(Date.now() / 1000) + 7 * 86400),
          Math.floor(Date.now() / 1000)).run();
        break;
      }

      default:
        console.log('Unhandled event type:', eventType);
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('Webhook error:', err);
    // Roll back the dedup marker so Creem's retry can reprocess the event.
    if (eventId && env && env.DB) {
      try {
        await env.DB.prepare('DELETE FROM webhook_events WHERE event_id=?').bind(eventId).run();
      } catch (_) { /* best-effort */ }
    }
    return new Response('Internal Error', { status: 500, headers: corsHeaders });
  }
}

// ============ SUBSCRIPTION CHECK ============

async function handleSubscriptionCheck(request, env, corsHeaders, url) {
  const token = url.searchParams.get('token');
  if (!env.GEOSCORE_API_TOKEN || token !== env.GEOSCORE_API_TOKEN) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const email = url.searchParams.get('email');
  if (!email) {
    return new Response('Missing email', { status: 400, headers: corsHeaders });
  }

  const result = await env.DB.prepare(
    `SELECT plan, status, current_period_end FROM subscriptions WHERE email=?`
  ).bind(email).first();

  if (!result) {
    return json({ plan: 'free', status: 'none' }, 200, corsHeaders);
  }

  const now = Math.floor(Date.now() / 1000);
  // Kept consistent with resolvePlan() in pro.js: a missing period end means
  // expired, not "never expires". Before 2026-11-01 this endpoint reported
  // plan=pro for a NULL period end while resolvePlan() had already downgraded
  // the same row, so the two authorisation paths disagreed.
  const activeStatus = result.status === 'active' || result.status === 'trialing';
  const periodValid = !!result.current_period_end && result.current_period_end >= now;
  if (activeStatus && !periodValid) {
    await env.DB.prepare(
      `UPDATE subscriptions SET status='expired', updated_at=? WHERE email=?`
    ).bind(now, email).run();
    result.status = 'expired';
  }
  // Computed from the pre-update status on purpose: `activeStatus` must not be
  // re-read after the downgrade, or the response would still say pro.
  const effectivePro = activeStatus && periodValid;

  return json({
    plan: effectivePro ? result.plan : 'free',
    status: result.status,
    current_period_end: result.current_period_end,
  }, 200, corsHeaders);
}

// ============ UTILITIES ============

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateId() {
  // Cryptographically secure random ID
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  return 'u_' + hex;
}

function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + 7 * 86400 }; // 7 days

  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = await hmacSha256(data, secret);
  return `${data}.${signature}`;
}

/**
 * Map a Creem product id to a plan name, including the product ids that live in
 * Worker secrets rather than in code. Returns null for anything unrecognised:
 * an unknown product must never be upgraded to Pro. Before 2026-11-01 the
 * subscription.* branch fell back to 'pro', so every unknown or $0 product
 * became a paid tier.
 */
function resolvePlanFromPayload(object, env) {
  const productId = object?.product?.id;
  // The product id is the only identity we trust. Falling back to the price let
  // a payload with no product id (or an empty one) plus price:900 become Pro -
  // the independent reviewer reproduced exactly that on 2026-11-01.
  if (!productId) {
    console.error('webhook: payload without a product id, refusing to grant a plan');
    return null;
  }
  if (PLAN_MAP[productId]) return PLAN_MAP[productId];
  if (env?.CREEM_PRODUCT_ID_MONTHLY && productId === env.CREEM_PRODUCT_ID_MONTHLY) return 'pro';
  if (env?.CREEM_PRODUCT_ID_ANNUAL && productId === env.CREEM_PRODUCT_ID_ANNUAL) return 'pro';
  // Loud on purpose: an unmatched id means a secret is missing, and the event
  // will be dropped. grep `unmatched product id` in `wrangler tail`.
  console.error('webhook: unmatched product id', productId);
  return null;
}

/**
 * Amount actually charged, in the smallest currency unit, when the payload says
 * so. null means "not stated" (older and simplified payloads) and is allowed
 * through; an explicit 0 means a $0 checkout and must never grant Pro.
 */
function chargedAmount(object) {
  const raw = object?.amount ?? object?.amount_paid ?? object?.order?.amount ?? object?.order?.amount_paid;
  if (raw === undefined || raw === null) return null;
  const n = typeof raw === 'number' ? raw : parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}


