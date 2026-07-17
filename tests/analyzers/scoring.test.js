import { describe, it, expect } from 'vitest';
import { computeScore } from '../../src/lib/scoring.js';

describe('computeScore', () => {
  const makeDim = (score, maxScore) => ({
    score, maxScore, checks: [], passed: 0, total: 0
  });

  const perfectDims = {
    aiCrawlability: makeDim(12, 12),
    aiGuidance: makeDim(12, 12),
    structuredData: makeDim(14, 14),
    metaSocial: makeDim(10, 10),
    contentQuality: makeDim(12, 12),
    eeat: makeDim(8, 8),
    brandEntity: makeDim(8, 8),
    citationReadiness: makeDim(8, 8),
    discoveryEndpoints: makeDim(6, 6),
    agentFriendliness: makeDim(4, 4),
    freshness: makeDim(4, 4),
  };

  it('should return 100 for perfect scores with no deductions', () => {
    const result = computeScore(perfectDims, { deductions: [] });
    expect(result.total).toBe(100);
    expect(result.level).toBe('Excellent');
  });

  it('should return 0 for all zeros', () => {
    const dims = Object.fromEntries(
      Object.keys(perfectDims).map(k => [k, makeDim(0, 1)])
    );
    const result = computeScore(dims, { deductions: [] });
    expect(result.total).toBe(0);
    expect(result.level).toBe('Critical');
  });

  it('should apply deductions', () => {
    const result = computeScore(perfectDims, {
      deductions: [{ id: 'test', label: 'test', deduction: 20, severity: 'high' }]
    });
    expect(result.total).toBe(80);
  });

  it('should not go below 0 with deductions', () => {
    const result = computeScore(perfectDims, {
      deductions: [{ id: 'test', label: 'test', deduction: 200, severity: 'high' }]
    });
    expect(result.total).toBe(0);
  });
});
