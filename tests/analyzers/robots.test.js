import { describe, it, expect } from 'vitest';
import { analyzeRobots } from '../../src/lib/analyzers/robots.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../fixtures');

const gptbot = r => r.checks.find(c => c.id === 'gptbot').passed;

describe('analyzeRobots', () => {
  it('should pass all checks for good robots.txt', () => {
    const txt = fs.readFileSync(path.join(fixturesDir, 'robots-good.txt'), 'utf-8');
    const result = analyzeRobots(txt);
    expect(result.passed).toBe(result.total);
    expect(result.score).toBeGreaterThan(0);
  });

  it('should pass all checks for a missing robots.txt', () => {
    // No file means no restriction (RFC 9309). The old expectation here was
    // passed === 0, which is the defect this file now guards against.
    const result = analyzeRobots(null);
    expect(result.passed).toBe(result.total);
  });

  it('should return low score for restrictive robots.txt', () => {
    const txt = fs.readFileSync(path.join(fixturesDir, 'robots-bad.txt'), 'utf-8');
    const result = analyzeRobots(txt);
    expect(result.passed).toBeLessThan(result.total);
  });

  it('should return correct check count', () => {
    const result = analyzeRobots('User-agent: *\nAllow: /');
    expect(result.checks.length).toBe(20);
  });
});

// The cases below are the regression tests for the defect fixed on 2026-10-04.
// Before the fix, every one of these returned passed=false, i.e. "this bot is
// blocked", which is wrong: a robots.txt that never mentions an AI crawler
// leaves it on the permissive default.
describe('AI crawler verdicts follow RFC 9309', () => {
  it('treats a missing robots.txt as allowed for every bot', () => {
    // No file at all means no restriction. This is the single most common case on
    // the web, and the old check scored it as a total block.
    const r = analyzeRobots(null);
    expect(r.passed).toBe(r.total);
  });

  it('treats an empty robots.txt as allowed', () => {
    expect(gptbot(analyzeRobots(''))).toBe(true);
    expect(gptbot(analyzeRobots('   \n\n'))).toBe(true);
  });

  it('treats a file that never mentions the bot as allowed', () => {
    // dev.to's real shape: a wildcard group with only partial Disallow rules.
    const devto = `User-agent: *

# Utility/internal endpoints
Disallow: /og/

# Auth/account pages
Disallow: /login
Disallow: /signup

Sitemap: https://dev.to/sitemap.xml`;
    const r = analyzeRobots(devto);
    expect(gptbot(r)).toBe(true);
    expect(r.checks.find(c => c.id === 'claudebot').passed).toBe(true);
    expect(r.checks.find(c => c.id === 'google-extended').passed).toBe(true);
  });

  it('does not treat partial Disallow rules as a site-wide block', () => {
    const txt = 'User-agent: *\nDisallow: /admin\nDisallow: /private\nDisallow: /*?q=';
    expect(gptbot(analyzeRobots(txt))).toBe(true);
  });

  it('blocks a bot that is explicitly disallowed at the root', () => {
    expect(gptbot(analyzeRobots('User-agent: GPTBot\nDisallow: /'))).toBe(false);
  });

  it('blocks a bot caught by a wildcard root Disallow', () => {
    const r = analyzeRobots('User-agent: *\nDisallow: /');
    expect(gptbot(r)).toBe(false);
    expect(r.checks.find(c => c.id === 'claudebot').passed).toBe(false);
  });

  it('ignores a commented-out Disallow', () => {
    expect(gptbot(analyzeRobots('User-agent: *\n# Disallow: /\nAllow: /'))).toBe(true);
  });

  it('lets a bot-specific group override the wildcard group', () => {
    // dev.to-style blanket block, but GPTBot is explicitly allowed back.
    const txt = 'User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /';
    const r = analyzeRobots(txt);
    expect(gptbot(r)).toBe(true);
    // Other bots still fall under the wildcard block.
    expect(r.checks.find(c => c.id === 'claudebot').passed).toBe(false);
  });

  it('respects the longest-match rule when a narrower Allow exists', () => {
    // Disallow: / blocks everything; Allow: /public re-permits one subtree, so the
    // site is still not fully open.
    const txt = 'User-agent: *\nDisallow: /\nAllow: /public';
    expect(gptbot(analyzeRobots(txt))).toBe(false);
  });

  it('honours an empty Disallow as allow-all', () => {
    expect(gptbot(analyzeRobots('User-agent: *\nDisallow:'))).toBe(true);
  });

  it('merges multiple groups naming the same bot', () => {
    // Two separate GPTBot groups: one blocks, one allows. Merged, the site is
    // blocked because a root Disallow survives the merge.
    const txt = 'User-agent: GPTBot\nDisallow: /admin\n\nUser-agent: GPTBot\nDisallow: /';
    expect(gptbot(analyzeRobots(txt))).toBe(false);
  });

  it('groups consecutive User-agent lines into one rule block', () => {
    const txt = 'User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /';
    const r = analyzeRobots(txt);
    expect(gptbot(r)).toBe(false);
    expect(r.checks.find(c => c.id === 'claudebot').passed).toBe(false);
  });

  it('scores a permissive wildcard file at the maximum', () => {
    const r = analyzeRobots('User-agent: *\nAllow: /');
    expect(r.score).toBe(r.maxScore);
  });

  it('keeps the weighted score proportional for a single blocked tier-1 bot', () => {
    // One of six tier-1 bots (weight 3) blocked. Total weight across the three
    // tiers is 6*3 + 7*2 + 7*1 = 39.
    const r = analyzeRobots('User-agent: GPTBot\nDisallow: /');
    const maxWeighted = r.checks.reduce((s, c) => s + c.weight, 0);
    const earned = r.checks.filter(c => c.passed).reduce((s, c) => s + c.weight, 0);
    expect(maxWeighted).toBe(39);
    expect(earned).toBe(36);
    expect(r.score).toBe(Math.round((36 / 39) * 12));
  });

  it('does not let a narrow wildcard rule block a bot that has its own group', () => {
    // The `*` group blocks the whole site, but GPTBot is named in the second
    // group with no rules at all, so the wildcard group must be ignored for it.
    const txt = 'User-agent: *\nDisallow: /\n\nUser-agent: GPTBot';
    const r = analyzeRobots(txt);
    expect(gptbot(r)).toBe(true);
    expect(r.checks.find(c => c.id === 'claudebot').passed).toBe(false);
  });

  it('lets a root Allow inside the wildcard group override a root Disallow', () => {
    const r = analyzeRobots('User-agent: *\nDisallow: /\nAllow: /');
    expect(r.passed).toBe(r.total);
  });

  it('treats a bare * as covering the whole site', () => {
    expect(gptbot(analyzeRobots('User-agent: GPTBot\nDisallow: *'))).toBe(false);
  });

  it('does not treat /* as a narrower rule than /', () => {
    // Both cover the root, so the tie resolves to the least restrictive rule.
    expect(gptbot(analyzeRobots('User-agent: *\nDisallow: /\nAllow: /*'))).toBe(true);
  });

  it('scores a site that blocks every bot at zero', () => {
    const r = analyzeRobots(fs.readFileSync(path.join(fixturesDir, 'robots-bad.txt'), 'utf-8'));
    expect(r.passed).toBe(0);
    expect(r.score).toBe(0);
  });
});
