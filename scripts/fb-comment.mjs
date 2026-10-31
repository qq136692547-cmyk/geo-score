import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/13669/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');

const url = process.argv[2];
const text = process.argv[3];
if (!url || !text) throw new Error('Usage: node fb-comment.mjs <url> "comment"');

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().includes('facebook.com'));
if (!page) throw new Error('No Facebook tab found');

await page.goto(url, { waitUntil: 'domcontentloaded' });
const editor = page.locator('[contenteditable="true"][role="textbox"]').last();
await editor.waitFor({ state: 'visible', timeout: 15000 });
await editor.click();
await page.keyboard.insertText(text);
await page.waitForTimeout(1000);
const draft = await editor.innerText();
if (!draft.includes(text.slice(0, 30))) throw new Error('Draft text not inserted correctly');
await page.keyboard.press('Enter');
await page.waitForTimeout(3000);
console.log(JSON.stringify({ status: 'posted', url: page.url(), draft }, null, 2));
await browser.close();
