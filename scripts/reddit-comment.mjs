import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/13669/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');

const url = process.argv[2];
const text = process.argv[3];
if (!url || !text) throw new Error('Usage: node reddit-comment.mjs <url> "comment"');

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().includes('reddit.com'));
if (!page) throw new Error('No Reddit tab found');

const oldUrl = url.replace('https://www.reddit.com', 'https://old.reddit.com');
await page.goto(oldUrl, { waitUntil: 'domcontentloaded' });
const editor = page.locator('textarea[name="text"]').first();
await editor.waitFor({ state: 'visible', timeout: 15000 });
await editor.fill(text);
const draft = await editor.inputValue();
if (!draft.includes(text.slice(0, 30))) throw new Error('Draft text not inserted correctly');
await page.locator('button:has-text("save")').first().click();
await page.waitForTimeout(3000);
console.log(JSON.stringify({ status: 'posted', url: page.url(), draft }, null, 2));
await browser.close();
