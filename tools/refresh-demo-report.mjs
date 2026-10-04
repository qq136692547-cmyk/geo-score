#!/usr/bin/env node
/**
 * refresh-demo-report.mjs — regenerate `data/demo-report.json` from a REAL audit.
 *
 * WHY THIS FILE EXISTS
 * The demo report pages (/report/demo/ and /zh/report/demo/) used to hardcode a
 * fictional audit of example.com: a 72/100 "Good" score, 11 dimension scores,
 * 20 crawler verdicts and 7 recommendations. None of those numbers were ever
 * produced by this product. They were invented marketing copy, and they were
 * internally inconsistent — the 11 listed dimension scores weighted to 69.2, not
 * the 72 the page claimed.
 *
 * This script replaces the fiction with the product's own output. It runs the
 * real scanner against the real site and writes the result to
 * `data/demo-report.json`, which the pages import.
 *
 * ⚠️  RE-RUN THIS AFTER ANY CHANGE TO SCORING OR ANALYZER LOGIC.
 *     `src/lib/scoring.js` and `src/lib/analyzers/*.js` decide these numbers.
 *     If you touch them and do not re-run this script, the published demo page
 *     will silently disagree with what the product actually tells users.
 *
 * Usage:
 *   node tools/refresh-demo-report.mjs
 *   node tools/refresh-demo-report.mjs https://example.org   # override target
 *
 * Exit code is non-zero if the self-check at the bottom fails, so this is safe
 * to run in CI.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { auditUrl } from '../src/lib/node-scanner.js';
import { DIMENSION_WEIGHTS, TOTAL_WEIGHT } from '../src/lib/scoring.js';

const TARGET = process.argv[2] || 'https://n8n.io/';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'demo-report.json');

/**
 * Display order and labels for the 11 dimensions. Must stay in the order the
 * pages render them. `label` is English, `labelZh` is the Chinese equivalent
 * used by /zh/report/demo/.
 */
const DISPLAY_ORDER = [
  { key: 'aiCrawlability', label: 'AI Crawlability (Robots.txt)', labelZh: 'AI 可爬性 (Robots.txt)' },
  { key: 'aiGuidance', label: 'AI Guidance (llms.txt)', labelZh: 'AI 引导 (llms.txt)' },
  { key: 'structuredData', label: 'Structured Data (Schema)', labelZh: '结构化数据 (Schema)' },
  { key: 'metaSocial', label: 'Meta & Social Tags', labelZh: 'Meta 和社交标签' },
  { key: 'contentQuality', label: 'Content Quality', labelZh: '内容质量' },
  { key: 'eeat', label: 'E-E-A-T Signals', labelZh: 'E-E-A-T 信号' },
  { key: 'brandEntity', label: 'Brand & Entity', labelZh: '品牌和实体' },
  { key: 'citationReadiness', label: 'Citation Readiness', labelZh: '引用就绪度' },
  { key: 'discoveryEndpoints', label: 'Discovery Endpoints', labelZh: '发现端点' },
  { key: 'agentFriendliness', label: 'Agent-Friendliness', labelZh: 'Agent 友好性' },
  { key: 'freshness', label: 'Freshness & Maintenance', labelZh: '新鲜度和维护' },
];

/** robots.js tier weight -> the label the pages display. */
const TIER_BY_WEIGHT = { 3: 'T1', 2: 'T2', 1: 'T3' };

/** recommendations.js priority -> the label the pages display. */
const PRIORITY_BY_LEVEL = { high: 'P0', medium: 'P1', low: 'P2' };

/** promptInjection.js severity -> points deducted, per scoring.js. */
const PI_SEVERITY_POINTS = { critical: 4, high: 3, medium: 2, low: 1 };

const r = await auditUrl(TARGET);

// --- dimensions -------------------------------------------------------------
const dimensions = DISPLAY_ORDER.map(({ key, label, labelZh }) => {
  const d = r.dimensions[key];
  if (!d) throw new Error(`scanner returned no dimension "${key}"`);
  return {
    key,
    label,
    labelZh,
    pct: d.maxScore > 0 ? Math.round((d.score / d.maxScore) * 100) : 0,
    // Raw weight out of TOTAL_WEIGHT (98). Deliberately NOT a percentage:
    // 12/98 is 12.2%, and the 11 weights sum to 98, not 100. The pages show
    // this value as-is (e.g. "x12") rather than inventing a percent.
    weight: DIMENSION_WEIGHTS[key],
    score: d.score,
    maxScore: d.maxScore,
  };
});

const seen = new Set(Object.keys(r.dimensions));
for (const { key } of DISPLAY_ORDER) seen.delete(key);
if (seen.size) throw new Error(`scanner returned dimensions not in DISPLAY_ORDER: ${[...seen]}`);

// --- AI crawler verdicts ----------------------------------------------------
const aiBots = r.dimensions.aiCrawlability.checks.map((c) => ({
  bot: c.label.split(' (')[0],
  tier: TIER_BY_WEIGHT[c.weight] || 'T3',
  allowed: c.passed,
}));

// --- recommendations: top 7 by the product's own priority ordering ----------
const recommendations = r.recommendations.slice(0, 7).map((rec) => ({
  priority: PRIORITY_BY_LEVEL[rec.priority] || 'P2',
  // `issue` states what is wrong, which reads as the headline of a to-do item.
  text: rec.issue,
  // There is no impact/points figure anywhere in the real output. The old page
  // invented "+6 points" / "+8 points". Show which dimension raised it instead.
  impact: rec.dimension,
  dimensionKey: rec.dimensionKey,
}));

const negativeSignalPoints = r.negativeSignals.deductions.reduce((s, d) => s + (d.deduction || 0), 0);
const promptInjectionPoints = r.promptInjection.flags.reduce(
  (s, f) => s + (PI_SEVERITY_POINTS[f.severity] || 1),
  0
);

const data = {
  generatedAt: r.timestamp,
  url: r.url,
  // Bare hostname for inline prose ("on n8n.io"). The audited URL normalizes to
  // https://n8n.io — no trailing slash — so pages should not hardcode one.
  host: new URL(r.url).hostname,
  score: r.score,
  level: r.level,
  summary: r.summary,
  dimensions,
  dimensionsAboveSixty: dimensions.filter((d) => d.pct >= 60).length,
  dimensionCount: dimensions.length,
  aiBots,
  negativeSignals: r.negativeSignals.deductions.length,
  negativeSignalPoints,
  promptInjectionFlags: r.promptInjection.flags.length,
  promptInjectionPoints,
  recommendationCount: r.recommendations.length,
  recommendations,
};

writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');

// ---------------------------------------------------------------------------
// SELF-CHECK — the whole point of this file is that the published numbers are
// reproducible. If they drift from what the product computes, fail loudly.
// ---------------------------------------------------------------------------
const rows = dimensions.map((d) => {
  const exact = d.maxScore > 0 ? d.score / d.maxScore : 0;
  return { ...d, exact, weighted: exact * d.weight };
});
const weightedSum = rows.reduce((s, d) => s + d.weighted, 0);

console.log(`\nAudited ${data.url}`);
console.log(`Generated ${data.generatedAt}\n`);
console.log('  dimension                    score/max    pct  weight   weighted');
console.log('  ' + '-'.repeat(66));
for (const d of rows) {
  console.log(
    '  ' + d.key.padEnd(26) +
    `${d.score}/${d.maxScore}`.padEnd(12) +
    String(d.pct).padStart(4) +
    String(d.weight).padStart(8) +
    d.weighted.toFixed(3).padStart(11)
  );
}
console.log('  ' + '-'.repeat(66));
console.log('  weight total'.padEnd(39) + String(TOTAL_WEIGHT).padStart(8));

const weightSum = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
const pctSum = dimensions.reduce((s, d) => s + d.weight, 0);
const preDeduction = Math.round((weightedSum / TOTAL_WEIGHT) * 100);
const total = Math.max(0, preDeduction - negativeSignalPoints - promptInjectionPoints);
const pctApprox = Math.round(
  (rows.reduce((s, d) => s + (d.pct / 100) * d.weight, 0) / TOTAL_WEIGHT) * 100
);

console.log(`\n  weighted sum (exact ratios)  ${weightedSum.toFixed(4)}`);
console.log(`  / ${TOTAL_WEIGHT} * 100                  ${(weightedSum / TOTAL_WEIGHT * 100).toFixed(4)}`);
console.log(`  rounded, before deductions  ${preDeduction}`);
console.log(`  negative signal deductions  -${negativeSignalPoints}  (${data.negativeSignals} deduction(s))`);
console.log(`  prompt injection deduction  -${promptInjectionPoints}  (${data.promptInjectionFlags} flag(s))`);
console.log(`  expected score               ${total}`);
console.log(`  scanner-reported score       ${data.score}`);
console.log(`  score matches                ${total === data.score ? 'YES' : 'NO  <-- MISMATCH'}`);

// The rounded-pct approximation, which is NOT the same as the score once any
// deduction applies. Kept in the output so nobody re-derives it by hand.
console.log(`\n  (using rounded pct instead of exact ratios: ${pctApprox}` +
  `${pctApprox === preDeduction ? '' : `, differs from ${preDeduction} by ${pctApprox - preDeduction} due to rounding`})`);

const problems = [];
if (weightSum !== TOTAL_WEIGHT) problems.push(`DIMENSION_WEIGHTS sums to ${weightSum}, TOTAL_WEIGHT is ${TOTAL_WEIGHT}`);
if (pctSum !== TOTAL_WEIGHT) problems.push(`emitted dimension weights sum to ${pctSum}, expected ${TOTAL_WEIGHT}`);
if (dimensions.length !== DISPLAY_ORDER.length) problems.push(`emitted ${dimensions.length} dimensions, expected ${DISPLAY_ORDER.length}`);
if (aiBots.length !== 20) problems.push(`emitted ${aiBots.length} crawler verdicts, expected 20`);
if (data.dimensionsAboveSixty !== r.summary.match(/(\d+)\/11 dimensions/)?.[1] * 1) {
  problems.push(`dimensionsAboveSixty (${data.dimensionsAboveSixty}) disagrees with scanner summary`);
}
if (total !== data.score) problems.push(`weighted score ${total} != scanner score ${data.score}`);
if (data.score < 0 || data.score > 100) problems.push(`score ${data.score} out of range`);

if (problems.length) {
  console.error('\nSELF-CHECK FAILED:');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('\n  SELF-CHECK PASSED — written to data/demo-report.json\n');
