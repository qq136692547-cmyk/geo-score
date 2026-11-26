#!/usr/bin/env node
/**
 * Submit geoscore.help URLs to IndexNow (Bing / Yandex / participating search engines).
 *
 * Usage:
 *   node --use-env-proxy scripts/indexnow-submit.mjs [--dry-run] [--url https://geoscore.help/...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const INDEXNOW_HOST = 'geoscore.help';
export const INDEXNOW_KEY = 'b4e8f1c3d9a742e6850f2c9a1d6e3b74';
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
export const INDEXNOW_BATCH_LIMIT = 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, '..');

/** Extract and deduplicate <loc> URLs from a sitemap XML string. */
export function parseSitemapUrls(xmlContent) {
  if (typeof xmlContent !== 'string' || !xmlContent.trim()) {
    throw new Error('Sitemap XML content is empty');
  }
  const seen = new Set();
  const urls = [];
  const locRegex = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let match;
  while ((match = locRegex.exec(xmlContent)) !== null) {
    const url = match[1].trim();
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  if (urls.length === 0) {
    throw new Error('No <loc> URLs found in sitemap XML');
  }
  return urls;
}

/** Verify the public static key verification file exists and matches INDEXNOW_KEY. */
export function verifyPublicKeyFile(repoRoot = REPO_ROOT) {
  const keyPath = path.join(repoRoot, 'public', `${INDEXNOW_KEY}.txt`);
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Missing IndexNow key file: ${keyPath}`);
  }
  const content = fs.readFileSync(keyPath, 'utf8').trim();
  if (content !== INDEXNOW_KEY) {
    throw new Error(`IndexNow key mismatch in ${keyPath}`);
  }
  return keyPath;
}

/** Build and validate an IndexNow submission JSON payload. */
export function buildIndexNowPayload(urls, host = INDEXNOW_HOST, key = INDEXNOW_KEY) {
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error('urlList must be a non-empty array');
  }
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
    throw new Error(`Invalid IndexNow key format: ${key}`);
  }
  const cleaned = [];
  const seen = new Set();
  for (const raw of urls) {
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error(`Invalid URL in urlList: ${raw}`);
    }
    if (parsed.hostname !== host) {
      throw new Error(`URL host mismatch (${parsed.hostname} !== ${host}): ${raw}`);
    }
    const href = parsed.toString();
    if (!seen.has(href)) {
      seen.add(href);
      cleaned.push(href);
    }
  }
  return {
    host,
    key,
    keyLocation: `https://${host}/${key}.txt`,
    urlList: cleaned,
  };
}

/** POST URLs in chunks to IndexNow API (returns per-batch HTTP results). */
export async function submitIndexNow(urls, { dryRun = false, fetchImpl = fetch, repoRoot = REPO_ROOT } = {}) {
  verifyPublicKeyFile(repoRoot);
  const fullPayload = buildIndexNowPayload(urls);

  if (dryRun) {
    return [{ status: 'DRY_RUN', count: fullPayload.urlList.length, payload: fullPayload }];
  }

  const results = [];
  for (let i = 0; i < fullPayload.urlList.length; i += INDEXNOW_BATCH_LIMIT) {
    const batch = fullPayload.urlList.slice(i, i + INDEXNOW_BATCH_LIMIT);
    const body = {
      host: fullPayload.host,
      key: fullPayload.key,
      keyLocation: fullPayload.keyLocation,
      urlList: batch,
    };
    const res = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (res.status !== 200 && res.status !== 202) {
      throw new Error(`IndexNow API returned HTTP ${res.status}: ${text || res.statusText}`);
    }
    results.push({ status: res.status, count: batch.length, body: text });
  }
  return results;
}

function parseCliArgs(argv) {
  let dryRun = false;
  const customUrls = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--url') {
      const next = argv[++i];
      if (!next) throw new Error('--url requires a URL argument');
      customUrls.push(next);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { dryRun, customUrls };
}

async function main() {
  const { dryRun, customUrls } = parseCliArgs(process.argv.slice(2));
  const urls =
    customUrls.length > 0
      ? customUrls
      : parseSitemapUrls(fs.readFileSync(path.join(REPO_ROOT, 'public', 'sitemap.xml'), 'utf8'));
  const results = await submitIndexNow(urls, { dryRun });
  if (dryRun) {
    console.log(JSON.stringify(results[0], null, 2));
  } else {
    for (const r of results) {
      console.log(`IndexNow submitted ${r.count} URLs -> HTTP ${r.status}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('IndexNow submission failed:', err.message);
    process.exit(1);
  });
}
