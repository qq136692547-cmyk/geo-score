import { describe, it, expect } from 'vitest';
import { analyzeSchema, extractJsonLd } from '../../src/lib/analyzers/schema.js';
import fs from 'fs';
import path from 'path';

const fixturesDir = path.join(import.meta.dirname, '../fixtures');

describe('analyzeSchema', () => {
  it('should detect Organization, Article, FAQPage schemas in good page', () => {
    const html = fs.readFileSync(path.join(fixturesDir, 'page-good.html'), 'utf-8');
    const result = analyzeSchema(html);
    expect(result.passed).toBeGreaterThanOrEqual(3);
  });

  it('should return zero score for null HTML', () => {
    const result = analyzeSchema(null);
    expect(result.score).toBe(0);
  });
});

describe('extractJsonLd', () => {
  it('should extract 3 JSON-LD blocks from good page', () => {
    const html = fs.readFileSync(path.join(fixturesDir, 'page-good.html'), 'utf-8');
    const blocks = extractJsonLd(html);
    expect(blocks.length).toBe(3);
  });

  it('should return empty array for HTML without JSON-LD', () => {
    const blocks = extractJsonLd('<html><body>No schema</body></html>');
    expect(blocks.length).toBe(0);
  });
});
