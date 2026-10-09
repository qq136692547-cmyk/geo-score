#!/usr/bin/env node
// Ask Google to re-crawl pages whose content substantively changed.
//
// WHY THIS IS A LEGITIMATE USE (gsc-indexing-triage discipline)
//   "Request indexing" is wasted effort when nothing changed. On 2026-10-08 the
//   homepage, /tools/ai-readiness-score/ and /pricing/ got new titles, H1s and
//   FAQ blocks -- that IS a substantive change, so asking Google to re-fetch is
//   the intended scenario, not spam.
//
// HOW IT WORKS
//   Indexing API v3 urlNotifications:publish, type=URL_UPDATED.
//   ⚠️ Scope is https://www.googleapis.com/auth/indexing -- NOT the webmasters
//   scope gsc-queries.mjs uses, so this needs its own token even though it is
//   the same service account.
//
// ⚠️ CAVEATS, so nobody is surprised later:
//   - Google documents this API for JobPosting/BroadcastEvent pages only. Using
//     it for normal pages is widely done but unofficial: it usually speeds up a
//     *re-fetch*, it does not guarantee re-ranking, and it does nothing for
//     pages Google has never shown interest in.
//   - The service account sits in this property as a RESTRICTED user. If
//     Google requires ownership for the publishing call, this fails with 403
//     and the fallback is a human clicking "Request indexing" in the UI.

import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const KEY = JSON.parse(readFileSync('secrets/ga4-reader.json', 'utf8'));
const SCOPE = 'https://www.googleapis.com/auth/indexing';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';

const URLS = [
  'https://geoscore.help/',
  'https://geoscore.help/tools/ai-readiness-score/',
  'https://geoscore.help/pricing/',
];

const b64 = (b) => Buffer.from(b).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
const claims = b64(JSON.stringify({
  iss: KEY.client_email, scope: SCOPE, aud: TOKEN_URI, iat: now, exp: now + 3600,
}));
const signer = createSign('RSA-SHA256');
signer.update(`${header}.${claims}`);
const assertion = `${header}.${claims}.${b64urlPadFree(signer.sign(KEY.private_key))}`;
function b64urlPadFree(buf) { return Buffer.from(buf).toString('base64url'); }

const tokRes = await fetch(TOKEN_URI, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`,
});
const tok = await tokRes.json();
if (!tok.access_token) {
  console.error(`token failed: ${tokRes.status} ${JSON.stringify(tok).slice(0, 300)}`);
  process.exit(1);
}
console.log(`SA: ${KEY.client_email}  scope: ${SCOPE}\n`);

for (const url of URLS) {
  const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, type: 'URL_UPDATED' }),
  });
  const j = await res.json().catch(() => ({}));
  if (res.ok) {
    console.log(`✅ ${url}\n   notifyTime: ${j.urlNotificationMetadata?.latestUpdate?.notifyTime || '(n/a)'}\n`);
  } else {
    console.log(`❌ ${url}\n   HTTP ${res.status}: ${JSON.stringify(j).slice(0, 300)}\n`);
  }
}
