-- GeoScore D1 Schema
-- Run via: wrangler d1 execute geoscore-db --file=schema.sql

-- Subscriptions (existing, linked by email)
CREATE TABLE IF NOT EXISTS subscriptions (
  email TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'none',
  customer_id TEXT,
  subscription_id TEXT,
  current_period_end INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);

-- Users (login system)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar TEXT,
  provider TEXT NOT NULL DEFAULT 'email',  -- 'google' | 'email'
  plan TEXT NOT NULL DEFAULT 'free',        -- 'free' | 'pro' | 'studio' | 'agency'
  subscription_id TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Email verification codes
CREATE TABLE IF NOT EXISTS verify_codes (
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_verify_codes_email ON verify_codes(email);
CREATE INDEX IF NOT EXISTS idx_verify_codes_expires ON verify_codes(expires_at);
-- ============ PRO MONITORING (v1.6) ============

-- Monitored sites (Pro: max 5 per user)
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  host TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_audit_at INTEGER,
  last_score INTEGER,
  last_success_at INTEGER,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_user_host ON sites(user_id, host);
CREATE INDEX IF NOT EXISTS idx_sites_user ON sites(user_id);

-- Cloud audit history (30-day retention)
CREATE TABLE IF NOT EXISTS audits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  site_id TEXT,
  url TEXT NOT NULL,
  host TEXT NOT NULL,
  score INTEGER NOT NULL,
  level TEXT,
  summary TEXT,
  dimensions TEXT,
  negative_signals TEXT,
  prompt_injection TEXT,
  recommendations TEXT,
  raw TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'ok',
  error TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_audits_user_created ON audits(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audits_site_created ON audits(site_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audits_created ON audits(created_at);

-- Processed webhook events (idempotency: Creem retries each event up to 5 times)
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT,
  received_at INTEGER,
  processed_at INTEGER
);

-- ============ AI VISIBILITY (v1.8) ============

-- Per-engine AI recommendation simulation results (one row per engine per check batch)
CREATE TABLE IF NOT EXISTS ai_visibility (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  site_id TEXT,
  host TEXT NOT NULL,
  url TEXT NOT NULL,
  engine TEXT NOT NULL,
  query TEXT,
  mentioned INTEGER NOT NULL DEFAULT 0,
  cited INTEGER NOT NULL DEFAULT 0,
  sentiment TEXT,
  snippet TEXT,
  raw TEXT,
  error TEXT,
  checked_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_visibility_host_time ON ai_visibility(host, checked_at);
CREATE INDEX IF NOT EXISTS idx_ai_visibility_site_time ON ai_visibility(site_id, checked_at);
