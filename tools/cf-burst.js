// Burst detection for Cloudflare Web Analytics day buckets.
//
// Split out of cf-traffic.mjs so tests can import it without that script's
// network calls running as an import side effect.
//
// WHY THIS SHAPE
//   The first version tested peakShare >= 0.5 alone. It did not flag
//   2026-10-03 -- the one day on this site that is unambiguously a script --
//   because its 255 pv landed across 5 hours with a peak of 116, giving
//   peakShare 0.455. That put 80% of the month's traffic into the "human"
//   bucket and produced a 29.9 pv/day average that was pure noise.
//
//   An ABSOLUTE peak term is required, not just a ratio: a script that spreads
//   over a few hours still has an hourly peak no human day reaches.
//
// THE TEST
//   burst when peakHour >= 10 AND (peakShare >= 0.4 OR pathCount >= 8)
//     peakHour >= 10  - no human day here has ever put 10 pv in one hour
//     peakShare >= 0.4 - one hour dominating the day is not browsing
//     pathCount >= 8  - near-total path coverage in a day means a crawl
//
//   Plus a threshold-independent self-check: a day holding >40% of the window
//   is flagged whatever the above said, because at that point the window total
//   describes that day rather than the site.
//
// This is a heuristic, not proof. It exists to force a human to look, not to
// let anyone quote the "human" total without reading the flagged days first.

export const PEAK_ABS = 10;
export const PEAK_SHARE = 0.4;
export const PATH_COUNT = 8;
export const WINDOW_SHARE = 0.4;

export function classifyDay({ pv = 0, peakHour = 0, pathCount = 0, windowTotal = 0 } = {}) {
  const reasons = [];
  const share = pv > 0 ? peakHour / pv : 0;

  if (peakHour >= PEAK_ABS && share >= PEAK_SHARE) {
    reasons.push(`single hour ${peakHour} pv = ${Math.round(share * 100)}% of day`);
  }
  if (peakHour >= PEAK_ABS && pathCount >= PATH_COUNT) {
    reasons.push(`${pathCount} paths in one day`);
  }
  if (windowTotal > 0 && pv / windowTotal > WINDOW_SHARE) {
    reasons.push(`day = ${Math.round((pv / windowTotal) * 100)}% of window`);
  }

  return { burst: reasons.length > 0, reasons };
}
