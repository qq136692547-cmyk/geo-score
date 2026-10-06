/**
 * ga4-admin.mjs — GA4 Admin API helper for custom dimensions.
 *
 * WHY: the Data API can only tell us "querying customEvent:X returned 400",
 * which is an indirect way to learn whether X is registered. The Admin API
 * lists them directly, and tells us whether this service account has any
 * access to the property at all — Data API access does not imply Admin access.
 *
 * Credentials: secrets/ga4-reader.json (gitignored).
 *
 * Usage:
 *   node tools/ga4-admin.mjs list
 *   node tools/ga4-admin.mjs create <name> [...]
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROPERTY_ID = process.env.GA4_PROPERTY_ID || '546156702';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const ADMIN = 'https://analyticsadmin.googleapis.com/v1beta';

const key = JSON.parse(readFileSync(join(REPO, 'secrets', 'ga4-reader.json'), 'utf8'));

function b64(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function token(scope) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const c = b64(JSON.stringify({ iss: key.client_email, scope, aud: TOKEN_URI, iat: now, exp: now + 3600 }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${h}.${c}`);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: `${h}.${c}.${b64(signer.sign(key.private_key))}`,
  });
  const r = await fetch(TOKEN_URI, { method: 'POST', body });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`token failed: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

const cmd = process.argv[2] || 'list';

if (cmd === 'list') {
  const t = await token('https://www.googleapis.com/auth/analytics.readonly');
  const r = await fetch(`${ADMIN}/properties/${PROPERTY_ID}/customDimensions?pageSize=200`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  const j = await r.json();
  console.log(`HTTP ${r.status}`);
  if (!r.ok) {
    console.log(JSON.stringify(j).slice(0, 600));
    process.exit(1);
  }
  const dims = j.customDimensions || [];
  console.log(`\n已注册的自定义维度：${dims.length} 个`);
  for (const d of dims) {
    console.log(
      `  ${d.parameterName.padEnd(18)} scope=${(d.scope || '').replace('DIMENSION_SCOPE_', '')}` +
        `  display=${d.displayName || '-'}`
    );
  }
}

if (cmd === 'create') {
  const names = process.argv.slice(3);
  if (!names.length) {
    console.error('usage: node tools/ga4-admin.mjs create <paramName> [...]');
    process.exit(1);
  }
  const t = await token('https://www.googleapis.com/auth/analytics.edit');
  for (const n of names) {
    const r = await fetch(`${ADMIN}/properties/${PROPERTY_ID}/customDimensions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parameterName: n,
        displayName: n,
        scope: 'EVENT',
        description: 'GeoScore event parameter',
      }),
    });
    const j = await r.json();
    if (r.ok) {
      console.log(`  OK      ${n}  (${j.name})`);
    } else {
      console.log(`  FAILED  ${n}  HTTP ${r.status} ${String(j.error && j.error.message || '').slice(0, 160)}`);
    }
  }
}
