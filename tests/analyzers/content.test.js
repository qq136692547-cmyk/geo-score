import { describe, it, expect } from 'vitest';
import { analyzeContent } from '../../src/lib/analyzers/content.js';
import fs from 'fs';
import path from 'path';

const fixturesDir = path.join(import.meta.dirname, '../fixtures');

describe('analyzeContent', () => {
  it('should pass multiple checks for good page', () => {
    const html = fs.readFileSync(path.join(fixturesDir, 'page-good.html'), 'utf-8');
    const result = analyzeContent(html);
    expect(result.passed).toBeGreaterThanOrEqual(3);
  });

  it('should return zero for null HTML', () => {
    const result = analyzeContent(null);
    expect(result.score).toBe(0);
  });
});
