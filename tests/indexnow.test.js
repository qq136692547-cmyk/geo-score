import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  INDEXNOW_HOST,
  INDEXNOW_KEY,
  REPO_ROOT,
  parseSitemapUrls,
  verifyPublicKeyFile,
  buildIndexNowPayload,
  submitIndexNow,
} from '../scripts/indexnow-submit.mjs';

describe('IndexNow configuration and submission helper', () => {
  it('has a valid static key file in public/ matching INDEXNOW_KEY', () => {
    const keyPath = verifyPublicKeyFile(REPO_ROOT);
    expect(path.basename(keyPath)).toBe(`${INDEXNOW_KEY}.txt`);
    expect(INDEXNOW_KEY).toMatch(/^[a-zA-Z0-9-]{8,128}$/);
    const raw = fs.readFileSync(keyPath, 'utf8');
    expect(raw.trim()).toBe(INDEXNOW_KEY);
  });

  it('parses all URLs from public/sitemap.xml cleanly', () => {
    const xml = fs.readFileSync(path.join(REPO_ROOT, 'public', 'sitemap.xml'), 'utf8');
    const urls = parseSitemapUrls(xml);
    expect(urls.length).toBeGreaterThanOrEqual(50);
    expect(urls).toContain('https://geoscore.help/');
    expect(urls).toContain('https://geoscore.help/zh/pricing/');
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('builds a valid IndexNow payload and rejects off-host URLs', () => {
    const payload = buildIndexNowPayload([
      'https://geoscore.help/',
      'https://geoscore.help/pricing/',
      'https://geoscore.help/',
    ]);
    expect(payload).toEqual({
      host: INDEXNOW_HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
      urlList: ['https://geoscore.help/', 'https://geoscore.help/pricing/'],
    });

    expect(() => buildIndexNowPayload(['https://example.com/'])).toThrow(/host mismatch/i);
    expect(() => buildIndexNowPayload([])).toThrow(/non-empty/i);
  });

  it('supports dry-run without triggering network fetch and posts cleanly with mock fetch', async () => {
    let called = 0;
    const dryResults = await submitIndexNow(['https://geoscore.help/'], {
      dryRun: true,
      fetchImpl: async () => {
        called++;
        return new Response('', { status: 200 });
      },
    });
    expect(called).toBe(0);
    expect(dryResults[0].status).toBe('DRY_RUN');
    expect(dryResults[0].count).toBe(1);

    const liveResults = await submitIndexNow(['https://geoscore.help/', 'https://geoscore.help/zh/'], {
      fetchImpl: async (endpoint, init) => {
        called++;
        expect(endpoint).toBe('https://api.indexnow.org/indexnow');
        expect(init.method).toBe('POST');
        const parsed = JSON.parse(init.body);
        expect(parsed.urlList).toEqual(['https://geoscore.help/', 'https://geoscore.help/zh/']);
        return new Response('', { status: 202 });
      },
    });
    expect(called).toBe(1);
    expect(liveResults).toEqual([{ status: 202, count: 2, body: '' }]);
  });
});
