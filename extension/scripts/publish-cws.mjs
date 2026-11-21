#!/usr/bin/env node
/**
 * GeoScore Chrome Extension - Official Chrome Web Store Publish API v2 CLI
 *
 * Automates uploading and submitting `extension/geoscore-extension.zip`
 * to Chrome Web Store without manual browser file uploads.
 *
 * Modes:
 *   --status   Fetch current published / submitted revision status
 *   --upload   Upload ZIP draft only
 *   --publish  Upload ZIP draft and submit for review
 *   --auth     Run one-time local OAuth 2.0 flow to save refresh token into secrets/cws.env
 *
 * Credentials (env vars or secrets/cws.env, gitignored):
 *   Option A (OAuth 2.0): CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN
 *   Option B (Service Account): CWS_SERVICE_ACCOUNT_PATH (path to JSON key)
 *   Optional overrides: CWS_PUBLISHER_ID, CWS_EXTENSION_ID, CWS_ZIP_PATH
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

export const DEFAULT_PUBLISHER_ID = 'eac6e209-ec65-4c0b-aa48-c249d37ad106';
export const DEFAULT_EXTENSION_ID = 'cboppgehhkhaamcgfcikhekkdaelichn';
export const DEFAULT_ZIP_PATH = path.resolve(PROJECT_ROOT, 'extension/geoscore-extension.zip');
export const DEFAULT_ENV_PATH = path.resolve(PROJECT_ROOT, 'secrets/cws.env');
export const CWS_SCOPE = 'https://www.googleapis.com/auth/chromewebstore';

export function parseEnvContent(content) {
  const out = {};
  if (!content || typeof content !== 'string') return out;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function loadCwsConfig(env = process.env, envFilePath = DEFAULT_ENV_PATH) {
  let fileVars = {};
  if (envFilePath && fs.existsSync(envFilePath)) {
    fileVars = parseEnvContent(fs.readFileSync(envFilePath, 'utf8'));
  }
  const merged = { ...fileVars, ...env };
  return {
    publisherId: (merged.CWS_PUBLISHER_ID || DEFAULT_PUBLISHER_ID).trim(),
    extensionId: (merged.CWS_EXTENSION_ID || DEFAULT_EXTENSION_ID).trim(),
    zipPath: path.resolve(PROJECT_ROOT, merged.CWS_ZIP_PATH || DEFAULT_ZIP_PATH),
    clientId: (merged.CWS_CLIENT_ID || '').trim(),
    clientSecret: (merged.CWS_CLIENT_SECRET || '').trim(),
    refreshToken: (merged.CWS_REFRESH_TOKEN || '').trim(),
    serviceAccountPath: (merged.CWS_SERVICE_ACCOUNT_PATH || '').trim(),
    envFilePath,
  };
}

export function buildCwsEndpoints(publisherId, extensionId) {
  if (!publisherId || !extensionId) {
    throw new Error('Missing publisherId or extensionId for Chrome Web Store API v2.');
  }
  const pub = encodeURIComponent(publisherId);
  const item = encodeURIComponent(extensionId);
  return {
    fetchStatus: `https://chromewebstore.googleapis.com/v2/publishers/${pub}/items/${item}:fetchStatus`,
    upload: `https://chromewebstore.googleapis.com/upload/v2/publishers/${pub}/items/${item}:upload`,
    publish: `https://chromewebstore.googleapis.com/v2/publishers/${pub}/items/${item}:publish`,
  };
}

function base64Url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function createServiceAccountJwt(sa, nowSec = Math.floor(Date.now() / 1000)) {
  if (!sa || !sa.client_email || !sa.private_key) {
    throw new Error('Invalid Service Account JSON: missing client_email or private_key.');
  }
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      iss: sa.client_email,
      scope: CWS_SCOPE,
      aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
      iat: nowSec,
      exp: nowSec + 3600,
    })
  );
  const signingInput = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = base64Url(signer.sign(sa.private_key));
  return `${signingInput}.${signature}`;
}

export async function getAccessToken(config, fetchFn = fetch) {
  if (config.serviceAccountPath) {
    const absPath = path.resolve(PROJECT_ROOT, config.serviceAccountPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Service account JSON not found at ${absPath}`);
    }
    const sa = JSON.parse(fs.readFileSync(absPath, 'utf8'));
    const assertion = createServiceAccountJwt(sa);
    const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
    const resp = await fetchFn(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.access_token) {
      throw new Error(`Service Account token exchange failed (${resp.status}): ${JSON.stringify(data)}`);
    }
    return data.access_token;
  }

  if (config.clientId && config.clientSecret && config.refreshToken) {
    const resp = await fetchFn('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.access_token) {
      throw new Error(`OAuth refresh token exchange failed (${resp.status}): ${JSON.stringify(data)}`);
    }
    return data.access_token;
  }

  throw new Error(
    `Missing Chrome Web Store API credentials. Set CWS_CLIENT_ID + CWS_CLIENT_SECRET + CWS_REFRESH_TOKEN (or CWS_SERVICE_ACCOUNT_PATH) in ${config.envFilePath} or environment variables.`
  );
}

export async function fetchItemStatus(config, accessToken, fetchFn = fetch) {
  const { fetchStatus } = buildCwsEndpoints(config.publisherId, config.extensionId);
  const resp = await fetchFn(fetchStatus, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`fetchStatus failed (${resp.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

export async function uploadPackageZip(config, accessToken, fetchFn = fetch) {
  if (!fs.existsSync(config.zipPath)) {
    throw new Error(`Extension ZIP not found at ${config.zipPath}. Run "npm run ext:package" first.`);
  }
  const zipBytes = fs.readFileSync(config.zipPath);
  const { upload } = buildCwsEndpoints(config.publisherId, config.extensionId);
  const resp = await fetchFn(upload, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/zip',
    },
    body: zipBytes,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`upload failed (${resp.status}): ${JSON.stringify(data)}`);
  }
  if (data.uploadState && data.uploadState !== 'SUCCEEDED' && data.uploadState !== 'IN_PROGRESS') {
    throw new Error(`upload returned non-success uploadState=${data.uploadState}: ${JSON.stringify(data)}`);
  }
  return data;
}

export async function publishItem(config, accessToken, fetchFn = fetch) {
  const { publish } = buildCwsEndpoints(config.publisherId, config.extensionId);
  const resp = await fetchFn(publish, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`publish failed (${resp.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function runOAuthSetup(config) {
  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      `To run --auth, first put CWS_CLIENT_ID and CWS_CLIENT_SECRET into ${config.envFilePath} (or env vars).`
    );
  }

  const state = crypto.randomBytes(16).toString('hex');
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', CWS_SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  console.log('\nOpen this URL in your browser to authorize Chrome Web Store Publish API:\n');
  console.log(authUrl.toString());
  console.log(`\nWaiting for OAuth callback on ${redirectUri} ...`);

  try {
    const urlStr = authUrl.toString();
    const openCmd =
      process.platform === 'win32'
        ? `start "" "${urlStr}"`
        : process.platform === 'darwin'
          ? `open "${urlStr}"`
          : `xdg-open "${urlStr}"`;
    exec(openCmd, () => {});
  } catch {}

  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('OAuth authorization timed out after 5 minutes.'));
    }, 5 * 60 * 1000);

    server.on('request', (req, res) => {
      try {
        const reqUrl = new URL(req.url || '/', redirectUri);
        if (reqUrl.pathname !== '/oauth2callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const returnedState = reqUrl.searchParams.get('state');
        const err = reqUrl.searchParams.get('error');
        const authCode = reqUrl.searchParams.get('code');
        if (err) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`Authorization failed: ${err}`);
          clearTimeout(timer);
          server.close();
          reject(new Error(`OAuth error: ${err}`));
          return;
        }
        if (!authCode || returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Invalid OAuth state or missing code.');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Chrome Web Store API authorization succeeded! You may close this tab.');
        clearTimeout(timer);
        server.close();
        resolve(authCode);
      } catch (e) {
        clearTimeout(timer);
        server.close();
        reject(e);
      }
    });
  });

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const tokenData = await resp.json().catch(() => ({}));
  if (!resp.ok || !tokenData.refresh_token) {
    throw new Error(`Failed to obtain refresh_token (${resp.status}): ${JSON.stringify(tokenData)}`);
  }

  fs.mkdirSync(path.dirname(config.envFilePath), { recursive: true });
  const envBody = [
    `CWS_PUBLISHER_ID=${config.publisherId}`,
    `CWS_EXTENSION_ID=${config.extensionId}`,
    `CWS_CLIENT_ID=${config.clientId}`,
    `CWS_CLIENT_SECRET=${config.clientSecret}`,
    `CWS_REFRESH_TOKEN=${tokenData.refresh_token}`,
    '',
  ].join('\n');
  fs.writeFileSync(config.envFilePath, envBody, 'utf8');
  console.log(`\nSaved OAuth credentials to ${config.envFilePath}. You can now run: npm run ext:publish`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const config = loadCwsConfig();

  if (args.has('--auth')) {
    await runOAuthSetup(config);
    return;
  }

  const accessToken = await getAccessToken(config);

  if (args.has('--status')) {
    const status = await fetchItemStatus(config, accessToken);
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  if (args.has('--upload') || args.has('--publish')) {
    console.log(`Uploading ${config.zipPath} to Chrome Web Store (item=${config.extensionId})...`);
    const uploadRes = await uploadPackageZip(config, accessToken);
    console.log('Upload response:', JSON.stringify(uploadRes, null, 2));

    if (args.has('--publish')) {
      console.log('Submitting uploaded revision for Chrome Web Store review...');
      const publishRes = await publishItem(config, accessToken);
      console.log('Publish response:', JSON.stringify(publishRes, null, 2));

      const finalStatus = await fetchItemStatus(config, accessToken);
      console.log('Current item status:', JSON.stringify(finalStatus, null, 2));
    }
    return;
  }

  console.log('Usage: node extension/scripts/publish-cws.mjs [--status | --upload | --publish | --auth]');
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectRun) {
  main().catch((err) => {
    console.error('[publish-cws] ERROR:', err.message);
    process.exit(1);
  });
}
