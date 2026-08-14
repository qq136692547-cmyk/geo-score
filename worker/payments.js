/**
 * GeoScore Payment Worker
 * 
 * Receives Creem webhooks and stores subscription state in Cloudflare D1.
 * Also provides a simple API for the frontend to check subscription status.
 * 
 * Deploy: wrangler deploy --name geoscore-payments
 * 
 * D1 Schema:
 *   CREATE TABLE subscriptions (
 *     email TEXT PRIMARY KEY,
 *     plan TEXT NOT NULL,           -- 'pro' | 'studio' | 'agency'
 *     status TEXT NOT NULL,         -- 'active' | 'canceled' | 'past_due' | 'trialing'
 *     customer_id TEXT,
 *     subscription_id TEXT,
 *     current_period_end INTEGER,   -- unix timestamp
 *     created_at INTEGER DEFAULT (strftime('%s','now')),
 *     updated_at INTEGER DEFAULT (strftime('%s','now'))
 *   );
 * 
 * Environment variables (wrangler secret):
 *   CREEM_WEBHOOK_SECRET - webhook signing secret from Creem dashboard
 *   CREEM_API_KEY        - Creem API key for verifying checkout sessions
 *   GEOSCORE_API_TOKEN   - token for protecting the status API endpoint
 */

// Plan mapping: Creem product ID → plan name
// Update these after creating products in Creem dashboard
const PLAN_MAP = {
  'prod_pro': 'pro',
  'prod_studio': 'studio',
  'prod_agency': 'agency',
};

// Price mapping (for reference)
const PLAN_PRICES = {
  pro: 1900,     // $19.00
  studio: 4900,  // $49.00
  agency: 8900,  // $89.00
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // POST /webhook — Creem webhook endpoint
    if (path === '/webhook' && request.method === 'POST') {
      return handleWebhook(request, env, corsHeaders);
    }

    // GET /api/subscription?email=xxx — check subscription status
    if (path === '/api/subscription' && request.method === 'GET') {
      return handleSubscriptionCheck(request, env, corsHeaders, url);
    }

    // GET /health — health check
    if (path === '/health') {
      return new Response(JSON.stringify({ status: 'ok', time: Date.now() }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};

/**
 * Handle Creem webhook events
 */
async function handleWebhook(request, env, corsHeaders) {
  try {
    const rawBody = await request.text();
    
    // Verify webhook signature
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

    // Handle different event types
    switch (eventType) {
      case 'checkout.completed': {
        // New purchase or subscription start
        const customer = object?.customer;
        const product = object?.product;
        const email = customer?.email;
        const plan = PLAN_MAP[product?.id] || inferPlanFromPrice(product?.price);

        if (!email || !plan) {
          console.log('Missing email or plan', { email, plan, productId: product?.id });
          break;
        }

        await env.DB.prepare(
          `INSERT INTO subscriptions (email, plan, status, customer_id, subscription_id, current_period_end, updated_at)
           VALUES (?, ?, 'active', ?, ?, ?, ?)
           ON CONFLICT(email) DO UPDATE SET
             plan=excluded.plan, status=excluded.status, customer_id=excluded.customer_id,
             subscription_id=excluded.subscription_id, current_period_end=excluded.current_period_end,
             updated_at=excluded.updated_at`
        ).bind(
          email,
          plan,
          customer?.id || '',
          object?.subscription_id || '',
          object?.current_period_end || Math.floor(Date.now() / 1000) + 30 * 86400,
          Math.floor(Date.now() / 1000)
        ).run();
        break;
      }

      case 'subscription.active':
      case 'subscription.paid':
      case 'subscription.update': {
        const customer = object?.customer;
        const email = customer?.email;
        const product = object?.product;
        const plan = PLAN_MAP[product?.id] || inferPlanFromPrice(product?.price);

        if (!email) break;

        await env.DB.prepare(
          `UPDATE subscriptions SET plan=?, status='active', current_period_end=?, updated_at=?
           WHERE email=?`
        ).bind(
          plan || 'pro',
          object?.current_period_end || Math.floor(Date.now() / 1000) + 30 * 86400,
          Math.floor(Date.now() / 1000),
          email
        ).run();
        break;
      }

      case 'subscription.canceled':
      case 'subscription.expired': {
        const email = object?.customer?.email;
        if (!email) break;

        await env.DB.prepare(
          `UPDATE subscriptions SET status='canceled', updated_at=? WHERE email=?`
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

      case 'subscription.scheduled_cancel': {
        // Subscription will cancel at period end — keep active until then
        break;
      }

      case 'subscription.trialing': {
        const customer = object?.customer;
        const email = customer?.email;
        const product = object?.product;
        const plan = PLAN_MAP[product?.id] || 'pro';

        if (!email) break;

        await env.DB.prepare(
          `INSERT INTO subscriptions (email, plan, status, customer_id, subscription_id, current_period_end, updated_at)
           VALUES (?, ?, 'trialing', ?, ?, ?, ?)
           ON CONFLICT(email) DO UPDATE SET
             plan=excluded.plan, status=excluded.status, updated_at=excluded.updated_at`
        ).bind(
          email, plan, customer?.id || '', object?.id || '',
          object?.trial_end || Math.floor(Date.now() / 1000) + 7 * 86400,
          Math.floor(Date.now() / 1000)
        ).run();
        break;
      }

      case 'refund.created': {
        // Could log refunds, but don't change subscription status
        // (subscription.canceled will handle that separately)
        break;
      }

      default:
        // Unhandled event type — log but don't error
        console.log('Unhandled event type:', eventType);
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('Internal Error', { status: 500, headers: corsHeaders });
  }
}

/**
 * Check subscription status by email
 * GET /api/subscription?email=xxx&token=yyy
 */
async function handleSubscriptionCheck(request, env, corsHeaders, url) {
  // Simple token auth
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
    return new Response(JSON.stringify({ plan: 'free', status: 'none' }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // Check if subscription has expired
  const now = Math.floor(Date.now() / 1000);
  if (result.current_period_end && result.current_period_end < now && result.status === 'active') {
    await env.DB.prepare(
      `UPDATE subscriptions SET status='expired', updated_at=? WHERE email=?`
    ).bind(now, email).run();
    result.status = 'expired';
  }

  return new Response(JSON.stringify({
    plan: result.plan,
    status: result.status,
    current_period_end: result.current_period_end,
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

/**
 * Infer plan from price amount (fallback if product ID not in map)
 */
function inferPlanFromPrice(price) {
  if (!price) return null;
  const amount = typeof price === 'number' ? price : parseInt(price, 10);
  if (amount === 1900) return 'pro';
  if (amount === 4900) return 'studio';
  if (amount === 8900) return 'agency';
  return null;
}

/**
 * HMAC-SHA256 using Web Crypto API
 */
async function hmacSha256(message, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
