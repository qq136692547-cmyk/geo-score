import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/13669/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');

const text = process.argv[2];
const image = process.argv[3];
if (!text) throw new Error('Usage: node x-post.mjs "text" [image]');

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().includes('x.com'));
if (!page) throw new Error('No X tab found');

await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded' });
const editor = page.locator('#layers [data-testid="tweetTextarea_0"]').last();
await editor.waitFor({ timeout: 15000 });
await editor.click();
await page.keyboard.insertText(text);
if (image) {
  await page.setInputFiles('#layers [data-testid="fileInput"]', image);
  await page.waitForSelector('#layers [data-testid="attachments"] img, #layers [aria-label="媒体"] img', { timeout: 20000 });
}
await page.waitForTimeout(1000);
const draft = await editor.innerText();
if (!draft.includes(text.slice(0, 30))) throw new Error('Draft text not inserted correctly');
const button = page.locator('#layers [data-testid="tweetButton"]').last();
await button.waitFor({ timeout: 15000 });
await button.click();
await page.waitForTimeout(3000);
console.log(JSON.stringify({ status: 'posted', draft }, null, 2));
await browser.close();
