import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/13669/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');

const url = process.env.CDP_URL || 'http://127.0.0.1:9222';
const browser = await chromium.connectOverCDP(url);
const context = browser.contexts()[0];

const command = process.argv[2] || 'list';
const arg = process.argv[3] || '';

if (command === 'list') {
  const pages = [];
  for (const page of context.pages()) {
    pages.push({ url: page.url(), title: await page.title() });
  }
  console.log(JSON.stringify(pages, null, 2));
} else if (command === 'open') {
  const page = await context.newPage();
  await page.goto(arg, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log(JSON.stringify({ url: page.url(), title: await page.title() }, null, 2));
} else if (command === 'select') {
  const page = context.pages().find(p => p.url().includes(arg));
  if (!page) throw new Error(`No page matching ${arg}`);
  await page.bringToFront();
  console.log(JSON.stringify({ url: page.url(), title: await page.title() }, null, 2));
} else if (command === 'goto') {
  const page = context.pages().find(p => p.url().includes(arg));
  if (!page) throw new Error(`No page matching ${arg}`);
  const target = process.argv[4];
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log(JSON.stringify({ url: page.url(), title: await page.title() }, null, 2));
} else if (command === 'eval') {
  const page = context.pages().find(p => p.url().includes(arg));
  if (!page) throw new Error(`No page matching ${arg}`);
  const expression = process.argv.slice(4).join(' ');
  console.log(JSON.stringify(await page.evaluate(expression), null, 2));
} else if (command === 'shot') {
  const page = context.pages().find(p => p.url().includes(arg));
  if (!page) throw new Error(`No page matching ${arg}`);
  const file = process.argv[4];
  await page.screenshot({ path: file, fullPage: false });
  console.log(JSON.stringify({ url: page.url(), file }, null, 2));
} else if (command === 'close') {
  const page = context.pages().find(p => p.url().includes(arg));
  if (page) await page.close();
  console.log('closed');
}

await browser.close();
