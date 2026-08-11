import { analyzeNegativeSignals } from './src/lib/analyzers/negativeSignals.js';

const spammyHtml = `<!DOCTYPE html>
<html><head>
  <title>Buy Now</title>
</head><body>
  <h1>Buy Now Cheap Deals</h1>
  <p>buy now buy now buy now buy now buy now buy now buy now cheap cheap cheap cheap cheap cheap cheap cheap cheap cheap deals deals deals deals deals deals deals Subscribe Subscribe Subscribe Subscribe Subscribe Subscribe Free Trial Free Trial Free Trial Free Trial Get Started Get Started Get Started Get Started Shop Now Shop Now Shop Now Shop Now Contact Us Contact Us Contact Us</p>
  <div class="modal overlay popup">Special offer!</div>
  <div class="modal overlay popup">Another popup!</div>
  <div class="modal overlay popup">Subscribe now!</div>
  <a href="#">empty</a>
  <a href="#">broken</a>
  <a href="#">dead</a>
  <a href="#">also dead</a>
  <a href="#">too many</a>
</body></html>`;

const result = analyzeNegativeSignals(spammyHtml);
console.log('Deductions:', result.deductions.length);
console.log('Passed:', result.passed + '/' + result.total);
result.checks.forEach(c => console.log('  ' + c.id + ': ' + c.passed + ' (' + c.label + ')'));
console.log('Score deduction:', result.score);
