/**
 * tools/ga4-funnel-check.mjs — the funnel invariant.
 *
 * The defect this guards against is a silent one: an event that never arrives
 * looks exactly like an event nobody triggered, and the numbers still add up to
 * something plausible. That is why "audit_completed 22 > audit_started 21" sat
 * in a handover document as a hard defect when it was really a historical
 * artefact from before the analytics queue shipped.
 *
 * Two layers here:
 *   1. the invariant itself (pure functions, testable without network)
 *   2. a source check that audit_started and audit_completed are still emitted
 *      as a pair, in order, inside the same try block — because the way this
 *      breaks in future is somebody editing one and not the other
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import {
  checkDay,
  isAfterFix,
  groupByDate,
  QUEUE_SHIPPED,
} from '../../tools/ga4-funnel-check.mjs';

describe('checkDay — the funnel cannot go backwards', () => {
  it('accepts a coherent day', () => {
    expect(checkDay('20261027', { audit_started: 4, audit_completed: 4, result_viewed: 4 })).toEqual([]);
  });

  it('accepts drop-off, which is the normal case', () => {
    // More people start than finish, more finish than scroll to the score.
    expect(checkDay('20261028', { audit_started: 5, audit_completed: 4, result_viewed: 3 })).toEqual([]);
  });

  it('flags completed > started', () => {
    const v = checkDay('20261005', { audit_started: 1, audit_completed: 2 });
    expect(v).toHaveLength(1);
    expect(v[0]).toContain('completed 2 > started 1');
  });

  it('flags viewed > completed', () => {
    const v = checkDay('20261012', { audit_started: 0, audit_completed: 0, result_viewed: 2 });
    expect(v).toHaveLength(1);
    expect(v[0]).toContain('viewed 2 > completed 0');
  });

  it('flags a day with events missing entirely', () => {
    const v = checkDay('20261012', { result_viewed: 2 });
    expect(v[0]).toContain('viewed 2 > completed 0');
  });

  it('treats missing keys as zero rather than NaN', () => {
    expect(checkDay('20261001', {})).toEqual([]);
  });
});

describe('isAfterFix — history is not a regression', () => {
  it('treats days before the queue as pre-fix', () => {
    expect(isAfterFix('20261005')).toBe(false);
    expect(isAfterFix('20261022')).toBe(false);
  });

  it('treats the ship date and later as current', () => {
    expect(isAfterFix(QUEUE_SHIPPED)).toBe(true);
    expect(isAfterFix('20261027')).toBe(true);
  });
});

describe('groupByDate', () => {
  it('pivots rows into date -> event -> count', () => {
    const rows = [
      { dimensionValues: [{ value: '20261027' }, { value: 'audit_started' }], metricValues: [{ value: '4' }] },
      { dimensionValues: [{ value: '20261027' }, { value: 'audit_completed' }], metricValues: [{ value: '3' }] },
    ];
    expect(groupByDate(rows)).toEqual({ 20261027: { audit_started: 4, audit_completed: 3 } });
  });

  it('returns an empty object for no rows', () => {
    expect(groupByDate([])).toEqual({});
    expect(groupByDate(undefined)).toEqual({});
  });
});

describe('boot.js — the two events must stay paired', () => {
  const src = fs.readFileSync('src/scripts/boot.js', 'utf8');

  it('still emits audit_started and audit_completed', () => {
    expect(src).toContain("geoTrack('audit_started'");
    expect(src).toContain("geoTrack('audit_completed'");
  });

  it('emits audit_started BEFORE audit_completed', () => {
    const started = src.indexOf("geoTrack('audit_started'");
    const completed = src.indexOf("geoTrack('audit_completed'");
    expect(started).toBeGreaterThan(-1);
    expect(completed).toBeGreaterThan(started);
  });

  it('emits them in the same function body, so neither can be reached alone', () => {
    // audit_started sits immediately before `await auditUrl(...)`, and
    // audit_completed immediately after. If somebody moves one into a different
    // code path, this gap explodes and the test fails.
    const started = src.indexOf("geoTrack('audit_started'");
    const completed = src.indexOf("geoTrack('audit_completed'");
    const between = src.slice(started, completed);
    expect(between).toContain('await auditUrl(');
    expect(between.length).toBeLessThan(2000);
  });
});
