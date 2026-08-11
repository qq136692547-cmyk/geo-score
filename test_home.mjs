import fs from 'fs';
import { analyzeNegativeSignals } from './src/lib/analyzers/negativeSignals.js';

const html = fs.readFileSync('dist/index.html', 'utf-8');
const r = analyzeNegativeSignals(html);
console.log('Popups:', r.checks.find(c => c.id === 'popups').passed);
console.log('Keyword stuffing:', r.checks.find(c => c.id === 'keyword-stuffing').passed, '(' + r.checks.find(c => c.id === 'keyword-stuffing').label + ')');
console.log('Missing author:', r.checks.find(c => c.id === 'missing-author').passed);
console.log('Deductions:', r.deductions.length, 'total:', r.score);
r.deductions.forEach(d => console.log('  -', d.id, '-', d.deduction));
