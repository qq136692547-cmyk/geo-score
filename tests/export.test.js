import { describe, it, expect } from 'vitest';
import { exportMarkdown, exportJson, exportCsv } from '../src/lib/export.js';

const mockResult = {
  url: 'example.com',
  timestamp: 1700000000000,
  score: 85,
  level: 'Good',
  dimensions: {
    aiCrawlability: { score: 10, maxScore: 12, percentage: 83, passed: 4, total: 6, checks: [
      { id: 'oai-searchbot', label: 'OAI-SearchBot allowed', passed: true },
      { id: 'ccbot', label: 'CCBot access', passed: false }
    ]},
    metaSocial: { score: 8, maxScore: 10, percentage: 80, passed: 4, total: 5, checks: [] }
  },
  negativeSignals: { deductions: [
    { id: 'popups', label: 'Popup interference', deduction: 3, severity: 'medium' }
  ]},
  recommendations: [
    { priority: 'high', issue: 'Missing llms.txt', fix: 'Create llms.txt' },
    { priority: 'medium', issue: 'Thin content', fix: 'Add more content' }
  ]
};

describe('export functions', () => {
  it('should export markdown with all sections', () => {
    const md = exportMarkdown(mockResult);
    expect(md).toContain('# GEO Audit Report: example.com');
    expect(md).toContain('Score:** 85/100');
    expect(md).toContain('aiCrawlability');
    expect(md).toContain('[x] OAI-SearchBot allowed');
    expect(md).toContain('[ ] CCBot access');
    expect(md).toContain('Negative Signals');
    expect(md).toContain('Recommendations');
    expect(md).toContain('[high]');
  });

  it('should export JSON with full structure', () => {
    const json = exportJson(mockResult);
    const parsed = JSON.parse(json);
    expect(parsed.url).toBe('example.com');
    expect(parsed.score).toBe(85);
    expect(parsed.dimensions.aiCrawlability.checks.length).toBe(2);
  });

  it('should export CSV with dimension rows', () => {
    const csv = exportCsv(mockResult);
    expect(csv).toContain('Dimension,Score,MaxScore,Passed,Total');
    expect(csv).toContain('aiCrawlability,10,12,4,6');
    expect(csv).toContain('metaSocial,8,10,4,5');
  });
});
