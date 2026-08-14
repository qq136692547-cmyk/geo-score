-- GeoScore D1 Schema
-- Run via: wrangler d1 execute geoscore-db --file=schema.sql

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
