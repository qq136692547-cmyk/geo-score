import { describe, it, expect } from 'vitest';
import { analyzeDiscovery } from '../../src/lib/analyzers/discovery.js';

describe('analyzeDiscovery', () => {
  it('should pass all checks when all endpoints exist', () => {
    const result = analyzeDiscovery('User-agent: *\nAllow: /', { summary: true }, { faq: true });
    expect(result.passed).toBe(3);
    expect(result.score).toBe(6);
  });

  it('should partially pass when only ai.txt exists', () => {
    const result = analyzeDiscovery('User-agent: *\nAllow: /', null, null);
    expect(result.passed).toBe(1);
    expect(result.score).toBe(2);
  });

  it('should handle Error objects for endpoints', () => {
    const result = analyzeDiscovery(null, new Error('Not found'), new Error('Not found'));
    expect(result.passed).toBe(0);
    expect(result.score).toBe(0);
  });

  it('should fail all when nothing exists', () => {
    const result = analyzeDiscovery(null, null, null);
    expect(result.passed).toBe(0);
    expect(result.score).toBe(0);
  });
});
