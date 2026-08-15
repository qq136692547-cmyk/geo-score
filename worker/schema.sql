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
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_verify_codes_email ON verify_codes(email);
CREATE INDEX IF NOT EXISTS idx_verify_codes_expires ON verify_codes(expires_at);