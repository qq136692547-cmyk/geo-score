/**
 * GeoScore CLI — audit any website's GEO (Generative Engine Optimization) score.
 *
 * Usage:
 *   geoscore <url> [options]
 *
 * Options:
 *   --json    Output full results as JSON
 *   --html    Output an HTML report page
 *   --fix     Generate fix files (llms.txt, robots.txt, jsonld) to ./geo-fixes/
 *   --quiet   Only output the numeric score
 *   --help    Show this help message
 */
import { auditUrl } from './node-scanner.js';
import { generateFixFiles } from './fixGenerator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HELP_TEXT = `
GeoScore CLI — Audit your website's visibility to AI search engines

Usage:
  geoscore <url> [options]

Options:
  --json     Output full audit results as JSON
  --html     Output an HTML report page (writes to stdout)
  --fix      Generate fix files (llms.txt, robots.txt, jsonld) to ./geo-fixes/
  --quiet    Only output the numeric score (0-100)
  --help, -h Show this help message

Examples:
  geoscore https://example.com
  geoscore example.com --json
  geoscore https://example.com --fix
  geoscore https://example.com --quiet

Exit codes:
  0  Success
  1  Argument error
  2  Network/fetch error
`;

const DIMENSION_LABELS = {
  aiCrawlability: 'AI Crawlability',
  aiGuidance: 'AI Guidance',
  structuredData: 'Structured Data',
  metaSocial: 'Meta & Social Tags',
  contentQuality: 'Content Quality',
  eeat: 'E-E-A-T Signals',
  brandEntity: 'Brand & Entity',
  citationReadiness: 'Citation Readiness',
  discoveryEndpoints: 'Discovery Endpoints',
  agentFriendliness: 'Agent-Friendliness',
  freshness: 'Freshness',
};

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0) {
    return { error: 'No URL provided. Usage: geoscore <url> [options]' };
  }

  const opts = {
    url: null,
    json: false,
    html: false,
    fix: false,
    quiet: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--html') {
      opts.html = true;
    } else if (arg === '--fix') {
      opts.fix = true;
    } else if (arg === '--quiet') {
      opts.quiet = true;
    } else if (!arg.startsWith('-')) {
      if (!opts.url) {
        opts.url = arg;
      } else {
        return { error: 'Unexpected argument: ' + arg };
      }
    } else {
      return { error: 'Unknown option: ' + arg };
    }
  }

  if (!opts.help && !opts.url) {
    return { error: 'No URL provided. Usage: geoscore <url> [options]' };
  }

  return opts;
}

function progressBar(percentage) {
  const filled = Math.round(percentage / 10);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);
  return bar;
}

function formatHumanReport(result) {
  const lines = [];
  lines.push('GeoScore Audit: ' + result.url);
  lines.push('Score: ' + result.score + '/100 (' + result.level + ')');
  lines.push('');

  lines.push('Dimensions:');
  for (const [key, dim] of Object.entries(result.dimensions)) {
    const label = (DIMENSION_LABELS[key] || key).padEnd(22);
    const bar = progressBar(dim.percentage);
    const pct = String(dim.percentage).padStart(3) + '%';
    const weighted = dim.weightedScore.toFixed(1) + '/' + dim.weight;
    lines.push('  ' + label + ' ' + bar + '  ' + pct + '  (' + weighted + ')');
  }

  // Negative signals
  if (result.negativeSignals && result.negativeSignals.deductions && result.negativeSignals.deductions.length > 0) {
    const totalDeduction = result.negativeSignals.deductions.reduce((s, d) => s + d.deduction, 0);
    lines.push('');
    lines.push('Negative Signals: ' + result.negativeSignals.deductions.length + ' found (-' + totalDeduction + ' points)');
    for (const d of result.negativeSignals.deductions) {
      lines.push('  - ' + d.label + ' (-' + d.deduction + ')');
    }
  }

  // Recommendations (top 10)
  if (result.recommendations && result.recommendations.length > 0) {
    lines.push('');
    lines.push('Recommendations:');
    const maxRecs = Math.min(result.recommendations.length, 10);
    for (let i = 0; i < maxRecs; i++) {
      const rec = result.recommendations[i];
      lines.push('  ' + (i + 1) + '. ' + rec.issue);
      if (rec.fix) {
        lines.push('     \u2192 ' + rec.fix);
      }
    }
    if (result.recommendations.length > maxRecs) {
      lines.push('  ... and ' + (result.recommendations.length - maxRecs) + ' more');
    }
  }

  lines.push('');
  lines.push('Run with --json for machine-readable output.');

  return lines.join('\n');
}

function formatHtmlReport(result) {
  let dims = '';
  for (const [key, dim] of Object.entries(result.dimensions)) {
    const label = DIMENSION_LABELS[key] || key;
    const color = dim.percentage >= 80 ? '#22c55e' : dim.percentage >= 60 ? '#eab308' : dim.percentage >= 36 ? '#f97316' : '#ef4444';
    dims += '<tr><td>' + escapeHtml(label) + '</td>';
    dims += '<td><div class="bar"><div class="bar-fill" style="width:' + dim.percentage + '%;background:' + color + '"></div></div></td>';
    dims += '<td>' + dim.percentage + '%</td>';
    dims += '<td>' + dim.weightedScore.toFixed(1) + '/' + dim.weight + '</td></tr>';
  }

  let negs = '';
  if (result.negativeSignals && result.negativeSignals.deductions && result.negativeSignals.deductions.length > 0) {
    negs = '<h2>Negative Signals</h2><ul>';
    for (const d of result.negativeSignals.deductions) {
      negs += '<li>' + escapeHtml(d.label) + ' (-' + d.deduction + ')</li>';
    }
    negs += '</ul>';
  }

  let recs = '';
  if (result.recommendations && result.recommendations.length > 0) {
    recs = '<h2>Recommendations</h2><ol>';
    for (const rec of result.recommendations.slice(0, 15)) {
      recs += '<li><strong>' + escapeHtml(rec.issue) + '</strong>';
      if (rec.fix) recs += '<br><span class="fix">' + escapeHtml(rec.fix) + '</span>';
      recs += '</li>';
    }
    recs += '</ol>';
  }

  const scoreColor = result.score >= 86 ? '#22c55e' : result.score >= 68 ? '#3b82f6' : result.score >= 36 ? '#eab308' : '#ef4444';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GeoScore Report &mdash; ${escapeHtml(result.url)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
  h1 { font-size: 1.5rem; }
  .score { font-size: 3rem; font-weight: 800; color: ${scoreColor}; }
  .level { font-size: 1.2rem; color: #666; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
  th { text-align: left; padding: 0.5rem; border-bottom: 2px solid #e5e7eb; font-size: 0.85rem; text-transform: uppercase; color: #6b7280; }
  td { padding: 0.5rem; border-bottom: 1px solid #f3f4f6; }
  .bar { width: 120px; height: 10px; background: #e5e7eb; border-radius: 5px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 5px; }
  .fix { color: #6b7280; font-size: 0.9rem; }
  .url { color: #6b7280; word-break: break-all; }
  .timestamp { color: #9ca3af; font-size: 0.85rem; }
  h2 { margin-top: 2rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.5rem; }
</style>
</head>
<body>
<h1>GeoScore Audit Report</h1>
<p class="url">${escapeHtml(result.url)}</p>
<p class="timestamp">${escapeHtml(result.timestamp)}</p>
<div class="score">${result.score}<span style="font-size:1.5rem;color:#9ca3af">/100</span></div>
<p class="level">${escapeHtml(result.level)}</p>
<p>${escapeHtml(result.summary || '')}</p>

<h2>Dimensions</h2>
<table>
<thead><tr><th>Dimension</th><th>Progress</th><th>Score</th><th>Weighted</th></tr></thead>
<tbody>
${dims}
</tbody>
</table>

${negs}
${recs}
</body>
</html>`;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function writeFixFiles(result) {
  const fixDir = path.resolve(process.cwd(), 'geo-fixes');
  if (!fs.existsSync(fixDir)) {
    fs.mkdirSync(fixDir, { recursive: true });
  }

  const fixes = generateFixFiles(result);
  const written = [];

  for (const [key, file] of Object.entries(fixes)) {
    const filePath = path.join(fixDir, file.filename);
    fs.writeFileSync(filePath, file.content, 'utf8');
    written.push(file.filename);
  }

  return { dir: fixDir, files: written };
}

async function main() {
  const opts = parseArgs(process.argv);

  if (opts.error) {
    console.error('Error: ' + opts.error);
    console.error('Run "geoscore --help" for usage information.');
    process.exit(1);
  }

  if (opts.help) {
    console.log(HELP_TEXT.trim());
    process.exit(0);
  }

  // Handle --fix without audit first (needs audit result)
  try {
    const result = await auditUrl(opts.url);

    if (opts.quiet) {
      console.log(result.score);
      process.exit(0);
    }

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    }

    if (opts.html) {
      console.log(formatHtmlReport(result));
      process.exit(0);
    }

    if (opts.fix) {
      const fixInfo = writeFixFiles(result);
      console.log('Fix files generated in: ' + fixInfo.dir);
      for (const f of fixInfo.files) {
        console.log('  \u2713 ' + f);
      }
      console.log('');
      console.log('Also showing audit report:');
      console.log('');
      console.log(formatHumanReport(result));
      process.exit(0);
    }

    // Default: human-readable report
    console.log(formatHumanReport(result));
    process.exit(0);
  } catch (err) {
    console.error('Error: ' + (err.message || err));
    process.exit(2);
  }
}

// CLI module — main() is called by bin/geoscore.mjs

export { main, parseArgs, formatHumanReport, formatHtmlReport, writeFixFiles, HELP_TEXT };
