// Split a GSC query rows set into "winnable" vs "hopeless" by average position.
//
// WHY THIS EXISTS
//   The window average position (~69 for this site) is an aggregate. It hides
//   whether ANY query is already near page one. A page ranking 80 will not move
//   because of a title rewrite; one ranking 12 might. Acting on the aggregate
//   wastes the only cheap lever available (title/meta on pages already close).
//
//   So: position is the gate, impressions rank the survivors by payoff.
//
// CAVEAT (recorded in the report, not hidden here)
//   `position` is a GSC *average* over the whole window for that query. A query
//   that sat at 5 for one day and 60 for a month still averages high. Screening
//   on the average therefore UNDER-counts winnable queries. Treat the output as
//   a lower bound, never as the complete set.

export const WINNABLE_DEFAULTS = { maxPos: 30, minImpressions: 3 };

export function isWinnable(row, { maxPos, minImpressions } = WINNABLE_DEFAULTS) {
  if (!row || typeof row !== 'object') return false;
  const pos = Number(row.position);
  const imp = Number(row.impressions);
  if (!Number.isFinite(pos) || !Number.isFinite(imp)) return false;
  if (pos <= 0 || imp <= 0) return false;
  return imp >= minImpressions && pos <= maxPos;
}

export function winnable(rows, opts = WINNABLE_DEFAULTS) {
  const cfg = { ...WINNABLE_DEFAULTS, ...opts };
  return (rows || [])
    .map((r) => ({ row: r, ok: isWinnable(r, cfg) }))
    .filter((x) => x.ok)
    .map((x) => x.row)
    .sort((a, b) => Number(b.impressions) - Number(a.impressions));
}

// What fraction of total impressions sit in winnable queries.
// Denominator is the caller's window total, not the sum of the rows passed in --
// those are only a top-N subset and must never be treated as the total.
export function winnableShare(rows, windowImpressions, opts = WINNABLE_DEFAULTS) {
  const total = Number(windowImpressions);
  if (!Number.isFinite(total) || total <= 0) return null;
  const sum = winnable(rows, opts).reduce((a, r) => a + Number(r.impressions), 0);
  return { sum, total, share: sum / total };
}
