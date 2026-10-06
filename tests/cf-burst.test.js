import { describe, it, expect } from 'vitest';
import { classifyDay } from '../tools/cf-burst.js';

// Every case below is a real day from geoscore.help (2026-09/10, Cloudflare
// Web Analytics, siteTag aae87fe93a3041d6b528a41c3ec00c29) or a synthetic case
// guarding a specific way the test can be wrong.
describe('classifyDay — real days from this site', () => {
  it('2026-10-03 (255 pv, peak 116, 21 paths) is burst', () => {
    // THE regression this file exists for. An earlier version of the test used
    // peakShare >= 0.5 alone; share here is 116/255 = 0.455, so the single
    // worst day on the site slipped into the "human" bucket and dragged the
    // month's average to a meaningless 29.9 pv/day.
    const r = classifyDay({ pv: 255, peakHour: 116, pathCount: 21, windowTotal: 320 });
    expect(r.burst).toBe(true);
  });

  it('2026-10-03 is flagged for the crawl shape too, not only the window share', () => {
    const r = classifyDay({ pv: 255, peakHour: 116, pathCount: 21, windowTotal: 320 });
    expect(r.reasons.some((s) => s.includes('21 paths'))).toBe(true);
  });

  it('2026-10-05 (31 pv, peak 20, SG midnight burst) is burst', () => {
    const r = classifyDay({ pv: 31, peakHour: 20, pathCount: 4, windowTotal: 320 });
    expect(r.burst).toBe(true);
  });

  it('2026-09-26 and 09-28 (10 pv, all in one hour) are burst', () => {
    // Small absolute numbers -- a 10 pv day is nothing on a normal site, but
    // 10 of 10 inside one hour is not a person reading anything.
    const r = classifyDay({ pv: 10, peakHour: 10, pathCount: 1, windowTotal: 320 });
    expect(r.burst).toBe(true);
  });

  it('2026-10-04 (6 pv, peak 3 — the day with 4 consented GA4 users) is NOT burst', () => {
    // This day has proof of humans in it: GA4 recorded 4 consented users.
    // If the test ever flags it, the test is wrong.
    const r = classifyDay({ pv: 6, peakHour: 3, pathCount: 2, windowTotal: 320 });
    expect(r.burst).toBe(false);
  });

  it('2026-10-02 (4 pv, peak 2) is NOT burst', () => {
    const r = classifyDay({ pv: 4, peakHour: 2, pathCount: 2, windowTotal: 320 });
    expect(r.burst).toBe(false);
  });

  it('2026-09-30 (3 pv, peak 1) is NOT burst', () => {
    const r = classifyDay({ pv: 3, peakHour: 1, pathCount: 1, windowTotal: 320 });
    expect(r.burst).toBe(false);
  });
});

describe('classifyDay — guards against the ways this can be wrong', () => {
  it('does not flag a genuinely busy day that is evenly spread', () => {
    // If this site ever gets real traffic, 100 pv/day spread over 24 hours
    // must NOT be flagged. A ratio-only test would be fine here; an
    // absolute-only test would flag it. Both terms are needed.
    const r = classifyDay({ pv: 100, peakHour: 8, pathCount: 5, windowTotal: 3000 });
    expect(r.burst).toBe(false);
  });

  it('flags via the window-share self-check even when the hourly shape looks fine', () => {
    // Threshold-independent: one day holding most of the window means the
    // window total describes that day, not the site.
    const r = classifyDay({ pv: 50, peakHour: 5, pathCount: 3, windowTotal: 100 });
    expect(r.burst).toBe(true);
    expect(r.reasons.some((s) => s.includes('% of window'))).toBe(true);
  });

  it('does not flag an empty day', () => {
    const r = classifyDay({ pv: 0, peakHour: 0, pathCount: 0, windowTotal: 320 });
    expect(r.burst).toBe(false);
    expect(r.reasons).toEqual([]);
  });

  it('does not divide by zero when windowTotal is 0', () => {
    expect(() => classifyDay({ pv: 0, peakHour: 0, pathCount: 0, windowTotal: 0 })).not.toThrow();
  });

  it('requires BOTH a high peak AND a shape signal — peak alone is not enough', () => {
    // A day with a high peak but flat-enough spread and few paths: if this
    // were flagged, the absolute term alone would be firing, which would
    // eventually misfire on a legitimately busy hour.
    const r = classifyDay({ pv: 400, peakHour: 30, pathCount: 4, windowTotal: 4000 });
    // share 30/400 = 0.075, paths 4, window share 0.10 -> none of the terms fire
    expect(r.burst).toBe(false);
  });
});
