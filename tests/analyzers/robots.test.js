import { describe, it, expect } from 'vitest';
import { analyzeRobots } from '../../src/lib/analyzers/robots.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../fixtures');

describe('analyzeRobots', () => {
  it('should pass all checks for good robots.txt', () => {
    const txt = fs.readFileSync(path.join(fixturesDir, 'robots-good.txt'), 'utf-8');
    const result = analyzeRobots(txt);
    expect(result.passed).toBe(result.total);
    expect(result.score).toBeGreaterThan(0);
  });

  it('should fail all checks for missing robots.txt', () => {
    const result = analyzeRobots(null);
    expect(result.passed).toBe(0);
  });

  it('should return low score for restrictive robots.txt', () => {
    const txt = fs.readFileSync(path.join(fixturesDir, 'robots-bad.txt'), 'utf-8');
    const result = analyzeRobots(txt);
    expect(result.passed).toBeLessThan(result.total);
  });

  it('should return correct check count', () => {
    const result = analyzeRobots('User-agent: *\nAllow: /');
    expect(result.checks.length).toBe(6);
  });
});
