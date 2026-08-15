/**
 * GeoScore Payment + Auth Worker
 * 
 * Features:
 *  - Creem webhook receiver (subscription lifecycle)
 *  - Email verification code login (via Resend)
 *  - Google OAuth login (ID token verification via Google JWKS)
 *  - JWT session token signing/verification
 *  - Subscription status API
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

// Plan mapping: Creem product ID -> plan name
const PLAN_MAP = {
  'prod_pro': 'pro',
  'prod_studio': 'studio',
  'prod_agency': 'agency',
};

const PLAN_PRICES = {
  pro: 900,      // $9.00
  studio: 2900,  // $29.00
  agency: 5900,  // $59.00
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://geoscore.help',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

    // --- Health ---
    if (path === '/health') {
      return new Response(JSON.stringify({ status: 'ok', time: Date.now() }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
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

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
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
        from: 'GeoScore <noreply@geoscore.help>',
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

    // Check code
    const record = await env.DB.prepare(
      `SELECT * FROM verify_codes WHERE email=? AND code=? AND expires_at > ? ORDER BY created_at DESC LIMIT 1`
    ).bind(email, code, now).first();

    if (!record) {
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

    // Check subscription status
    const sub = await env.DB.prepare(
      `SELECT plan, status, current_period_end FROM subscriptions WHERE email=?`
    ).bind(email).first();
    if (sub && sub.status === 'active' || sub?.status === 'trialing') {
      user.plan = sub.plan;
    }

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

    // Check subscription
    const sub = await env.DB.prepare(
      `SELECT plan, status FROM subscriptions WHERE email=?`
    ).bind(email).first();
    if (sub && (sub.status === 'active' || sub.status === 'trialing')) {
      user.plan = sub.plan;
    }

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

    // Check subscription
    const sub = await env.DB.prepare(
      `SELECT plan, status, current_period_end FROM subscriptions WHERE email=?`
    ).bind(user.email).first();
    if (sub && (sub.status === 'active' || sub.status === 'trialing')) {
      user.plan = sub.plan;
    }

    return json({ user }, 200, corsHeaders);
  } catch (err) {
    console.error('me error:', err);
    return json({ error: 'Internal error' }, 500, corsHeaders);
  }
}

// ============ WEBHOOK ============

async function handleWebhook(request, env, corsHeaders) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('creem-signature');
    if (!signature) {
      return new Response('Missing signature', { status: 401, headers: corsHeaders });
    }

    const expectedSignature = await hmacSha256(rawBody, env.CREEM_WEBHOOK_SECRET);
    if (signature !== expectedSignature) {
      return new Response('Invalid signature', { status: 401, headers: corsHeaders });
    }

    const event = JSON.parse(rawBody);
    const { eventType, object } = event;

    switch (eventType) {
      case 'checkout.completed': {
        const customer = object?.customer;
        const product = object?.product;
        const email = customer?.email;
        const plan = PLAN_MAP[product?.id] || inferPlanFromPrice(product?.price);
        if (!email || !plan) break;

        await env.DB.prepare(
          `INSERT INTO subscriptions (email, plan, status, customer_id, subscription_id, current_period_end, updated_at)
           VALUES (?, ?, 'active', ?, ?, ?, ?)
           ON CONFLICT(email) DO UPDATE SET
             plan=excluded.plan, status=excluded.status, customer_id=excluded.customer_id,
             subscription_id=excluded.subscription_id, current_period_end=excluded.current_period_end,
             updated_at=excluded.updated_at`
        ).bind(email, plan, customer?.id || '', object?.subscription_id || '',
          object?.current_period_end || Math.floor(Date.now() / 1000) + 30 * 86400,
          Math.floor(Date.now() / 1000)).run();

        // Also update users table plan
        await env.DB.prepare(
          `UPDATE users SET plan=?, subscription_id=?, updated_at=? WHERE email=?`
        ).bind(plan, object?.subscription_id || '', Math.floor(Date.now() / 1000), email).run();
        break;
      }

      case 'subscription.active':
      case 'subscription.paid':
      case 'subscription.update': {
        const email = object?.customer?.email;
        const plan = PLAN_MAP[object?.product?.id] || inferPlanFromPrice(object?.product?.price);
        if (!email) break;

        await env.DB.prepare(
          `UPDATE subscriptions SET plan=?, status='active', current_period_end=?, updated_at=? WHERE email=?`
        ).bind(plan || 'pro', object?.current_period_end || Math.floor(Date.now() / 1000) + 30 * 86400,
          Math.floor(Date.now() / 1000), email).run();

        await env.DB.prepare(
          `UPDATE users SET plan=?, updated_at=? WHERE email=?`
        ).bind(plan || 'pro', Math.floor(Date.now() / 1000), email).run();
        break;
      }

      case 'subscription.canceled':
      case 'subscription.expired': {
        const email = object?.customer?.email;
        if (!email) break;
        await env.DB.prepare(
          `UPDATE subscriptions SET status='canceled', updated_at=? WHERE email=?`
        ).bind(Math.floor(Date.now() / 1000), email).run();
        await env.DB.prepare(
          `UPDATE users SET plan='free', updated_at=? WHERE email=?`
        ).bind(Math.floor(Date.now() / 1000), email).run();
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
        const plan = PLAN_MAP[object?.product?.id] || 'pro';
        if (!email) break;

        await env.DB.prepare(
          `INSERT INTO subscriptions (email, plan, status, customer_id, subscription_id, current_period_end, updated_at)
           VALUES (?, ?, 'trialing', ?, ?, ?, ?)
           ON CONFLICT(email) DO UPDATE SET
             plan=excluded.plan, status=excluded.status, updated_at=excluded.updated_at`
        ).bind(email, plan, object?.customer?.id || '', object?.id || '',
          object?.trial_end || Math.floor(Date.now() / 1000) + 7 * 86400,
          Math.floor(Date.now() / 1000)).run();
        break;
      }

      default:
        console.log('Unhandled event type:', eventType);
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('Webhook error:', err);
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
  if (result.current_period_end && result.current_period_end < now && result.status === 'active') {
    await env.DB.prepare(
      `UPDATE subscriptions SET status='expired', updated_at=? WHERE email=?`
    ).bind(now, email).run();
    result.status = 'expired';
  }

  return json({
    plan: result.plan,
    status: result.status,
    current_period_end: result.current_period_end,
  }, 200, corsHeaders);
}

// ============ UTILITIES ============

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateId() {
  return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
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

async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expectedSignature = await hmacSha256(`${header}.${payload}`, secret);
  if (signature !== expectedSignature) return null;

  try {
    const decoded = JSON.parse(atob(payload));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function base64Url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function inferPlanFromPrice(price) {
  if (!price) return null;
  const amount = typeof price === 'number' ? price : parseInt(price, 10);
  if (amount === 900) return 'pro';
  if (amount === 2900) return 'studio';
  if (amount === 5900) return 'agency';
  return null;
}

async function hmacSha256(message, secret) {
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