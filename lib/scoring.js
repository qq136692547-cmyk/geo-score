const DIMENSION_WEIGHTS = {
  aiCrawlability: 12,
  aiGuidance: 12,
  structuredData: 14,
  metaSocial: 10,
  contentQuality: 12,
  eeat: 8,
  brandEntity: 8,
  citationReadiness: 8,
  discoveryEndpoints: 6,
  agentFriendliness: 4,
  freshness: 4,
};
const TOTAL_WEIGHT = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);

function computeScore(dimensions, negativeResult) {
  const dimensionScores = {};
  let weightedSum = 0;

  for (const [key, dim] of Object.entries(dimensions)) {
    const weight = DIMENSION_WEIGHTS[key];
    const dimScore = dim.maxScore > 0 ? (dim.score / dim.maxScore) * weight : 0;
    dimensionScores[key] = {
      ...dim,
      weight,
      weightedScore: Math.round(dimScore * 10) / 10,
      percentage: dim.maxScore > 0 ? Math.round((dim.score / dim.maxScore) * 100) : 0,
    };
    weightedSum += dimScore;
  }

  let total = Math.round((weightedSum / TOTAL_WEIGHT) * 100);
  const deduction = negativeResult?.deductions?.reduce((s, d) => s + (d.deduction || 0), 0) || 0;
  total = Math.max(0, total - deduction);

  let level;
  if (total >= 86) level = 'Excellent';
  else if (total >= 68) level = 'Good';
  else if (total >= 36) level = 'Basic';
  else level = 'Critical';

  return { total, level, dimensions: dimensionScores, deduction };
}

export { computeScore, DIMENSION_WEIGHTS, TOTAL_WEIGHT };
