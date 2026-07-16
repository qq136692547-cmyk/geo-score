import { describe, it, expect } from 'vitest';
import { analyzeLlmstxt } from '../../src/lib/analyzers/llmstxt.js';
import fs from 'fs';
import path from 'path';

const fixturesDir = path.join(import.meta.dirname, '../fixtures');

describe('analyzeLlmstxt', () => {
  it('should pass most checks for good llms.txt', () => {
    const txt = fs.readFileSync(path.join(fixturesDir, 'llms-good.txt'), 'utf-8');
    const result = analyzeLlmstxt(txt);
    expect(result.passed).toBeGreaterThanOrEqual(3);
    expect(result.score).toBeGreaterThan(0);
  });

  it('should fail all checks for missing llms.txt', () => {
    const result = analyzeLlmstxt(null);
    expect(result.passed).toBe(0);
    expect(result.score).toBe(0);
  });
});
