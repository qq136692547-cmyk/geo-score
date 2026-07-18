import { describe, it, expect, beforeEach } from 'vitest';
import { getHistory, addToHistory, clearHistory, getUrlHistory, getComparisonData } from '../src/lib/history.js';

// Mock localStorage
const store = {};
global.localStorage = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, val) => { store[key] = String(val); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};

const mockResult = {
  url: 'https://example.com',
  score: 85,
  level: 'Good',
  timestamp: 1700000000000,
  dimensions: {
    aiCrawlability: { score: 10, maxScore: 12, percentage: 83, checks: [], passed: 0, total: 0 },
    metaSocial: { score: 8, maxScore: 10, percentage: 80, checks: [], passed: 0, total: 1 },
  }
};

const mockResult2 = {
  url: 'https://test.org',
  score: 45,
  level: 'Basic',
  timestamp: 1700000001000,
  dimensions: {}
};

describe('GEO history', () => {
  beforeEach(() => {
    clearHistory();
  });

  it('should start with empty history', () => {
    expect(getHistory()).toEqual([]);
  });

  it('should add entry to history', () => {
    const entry = addToHistory(mockResult);
    expect(entry.url).toBe('example.com');
    expect(entry.score).toBe(85);
    const history = getHistory();
    expect(history.length).toBe(1);
    expect(history[0].url).toBe('example.com');
  });

  it('should keep only 50 entries max', () => {
    for (let i = 0; i < 60; i++) {
      addToHistory({ ...mockResult, url: `https://site${i}.com`, score: i, timestamp: Date.now() + i });
    }
    expect(getHistory().length).toBe(50);
  });

  it('should deduplicate by URL keeping latest', () => {
    const e1 = addToHistory(mockResult);
    const e2 = addToHistory({ ...mockResult, score: 90, timestamp: 1700000002000 });
    const history = getHistory();
    expect(history.length).toBe(1);
    expect(history[0].score).toBe(90);
  });

  it('should get URL-specific history', () => {
    addToHistory(mockResult);
    addToHistory(mockResult2);
    const urlHist = getUrlHistory('example.com');
    expect(urlHist.length).toBe(1);
    expect(urlHist[0].url).toBe('example.com');
  });

  it('should return empty for nonexistent URL', () => {
    expect(getUrlHistory('nonexistent.com')).toEqual([]);
  });

  it('should get comparison data for multiple URLs', () => {
    addToHistory(mockResult);
    addToHistory(mockResult2);
    const comp = getComparisonData(['https://example.com', 'https://test.org']);
    expect(comp.length).toBe(2);
    expect(comp[0].url).toBe('example.com');
    expect(comp[1].url).toBe('test.org');
  });

  it('should clear all history', () => {
    addToHistory(mockResult);
    clearHistory();
    expect(getHistory()).toEqual([]);
  });
});
