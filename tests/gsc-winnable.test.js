import { describe, it, expect } from 'vitest';
import { isWinnable, winnable, winnableShare, WINNABLE_DEFAULTS } from '../tools/gsc-winnable.js';

const q = (impressions, position, clicks = 0) => ({ impressions, position, clicks, keys: ['k'] });

// 门槛的口径：决定"这个词值不值得改"的是**排名**，不是展示量。
// 500 展示排第 8 页照样不值得动；3 展示排第 1 页才值得。
describe('isWinnable — the gate', () => {
  it('gate is position, not impressions alone', () => {
    expect(isWinnable(q(500, 80))).toBe(false);
    expect(isWinnable(q(3, 12))).toBe(true);
  });

  it('boundaries are inclusive on both ends', () => {
    expect(isWinnable(q(3, 30))).toBe(true);
    expect(isWinnable(q(3, 30.1))).toBe(false);
    expect(isWinnable(q(2, 10))).toBe(false);
    expect(isWinnable(q(3, 10))).toBe(true);
  });

  it('rejects zero, negative and non-numeric positions', () => {
    expect(isWinnable(q(5, 0))).toBe(false); // position 0 = GSC withheld it, not rank zero
    expect(isWinnable(q(5, -3))).toBe(false);
    expect(isWinnable(q(5, '12'))).toBe(true); // numeric strings coerce
    expect(isWinnable(q(5, null))).toBe(false);
    expect(isWinnable(q(5, undefined))).toBe(false);
    expect(isWinnable(q(5, NaN))).toBe(false);
  });

  it('malformed rows never throw', () => {
    for (const bad of [null, undefined, {}, 42, 'x', { impressions: 'abc', position: 'def' }]) {
      expect(isWinnable(bad)).toBe(false);
    }
    expect(winnable(null)).toEqual([]);
    expect(winnable(undefined)).toEqual([]);
  });
});

describe('winnable — filtering and ordering', () => {
  it('sorted by impressions descending', () => {
    const out = winnable([q(5, 10), q(50, 20), q(20, 5)]);
    expect(out.map((r) => r.impressions)).toEqual([50, 20, 5]);
  });

  it('preserves original rows rather than rebuilding them', () => {
    const row = { impressions: 9, position: 7, keys: ['ai readiness'], extra: 'keep me' };
    const [first] = winnable([row]);
    expect(first).toBe(row); // identity preserved so callers can read keys
    expect(first.extra).toBe('keep me');
  });

  it('custom thresholds override defaults', () => {
    const row = q(5, 40);
    expect(isWinnable(row, { maxPos: 50, minImpressions: 3 })).toBe(true);
    expect(isWinnable(row, { maxPos: 30, minImpressions: 3 })).toBe(false);
    expect(isWinnable(row, { ...WINNABLE_DEFAULTS, maxPos: 50 })).toBe(true);
  });
});

describe('winnableShare — the denominator discipline', () => {
  it('uses the caller window total, not the subset sum', () => {
    const rows = [q(100, 10), q(50, 15), q(900, 88)];
    const out = winnableShare(rows, 1219);
    expect(out.sum).toBe(150);
    expect(out.total).toBe(1219);
    expect(Math.abs(out.share - 150 / 1219)).toBeLessThan(1e-9);
    expect(out.total).not.toBe(1050); // must not silently fall back to summing the rows
  });

  it('share returns null when the window total is unusable', () => {
    expect(winnableShare([q(10, 5)], 0)).toBeNull();
    expect(winnableShare([q(10, 5)], null)).toBeNull();
    expect(winnableShare([q(10, 5)], 'x')).toBeNull();
  });
});
