import { describe, it, expect } from 'vitest';
import { analyzeMeta } from '../../src/lib/analyzers/meta.js';
import fs from 'fs';
import path from 'path';

const fixturesDir = path.join(import.meta.dirname, '../fixtures');

describe('analyzeMeta', () => {
  it('should detect all meta tags in good page', () => {
    const html = fs.readFileSync(path.join(fixturesDir, 'page-good.html'), 'utf-8');
    const result = analyzeMeta(html);
    expect(result.passed).toBeGreaterThanOrEqual(4);
  });

  it('should return zero for null HTML', () => {
    const result = analyzeMeta(null);
    expect(result.score).toBe(0);
  });
});
