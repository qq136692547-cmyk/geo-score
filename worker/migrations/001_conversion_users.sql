-- Migration 001 — free AI visibility quota on users
-- Run once:  wrangler d1 execute geoscore-db --file=worker/migrations/001_conversion_users.sql
--
-- SQLite has no "ADD COLUMN IF NOT EXISTS". Re-running raises
-- "duplicate column name: free_vis_used" — safe to ignore, nothing is modified.
--
-- free_vis_used          : count of free AI visibility checks consumed in the current period
-- free_vis_period_start  : unix ts when the current period began (reset rollover is calcued in worker/pro.js)

ALTER TABLE users ADD COLUMN free_vis_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN free_vis_period_start INTEGER;
