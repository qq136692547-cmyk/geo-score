#!/usr/bin/env node
// Enable the Web Search Indexing API on the project with the same service
// account that gsc-request-indexing.mjs uses -- no console clicking needed.
//
// The 403 from urlNotifications:publish was NOT a permissions problem on the
// SA; it said the API itself has never been enabled on the project:
//   "Web Search Indexing API has not been used in project 154080569698
//    before or it is disabled."
// Enabling a service is itself an API call (Service Usage API). Whether this
// SA is allowed to do it depends on its project role -- if it lacks
// serviceusage.services.enable the call returns 403 and only a human with
// project-admin rights can grant that role. We find out by trying.

import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const KEY = JSON.parse(readFileSync('secrets/ga4-reader.json', 'utf8'));
const PROJECT = process.argv[2] || '154080569698';
const SERVICE = 'indexing.googleapis.com';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

const b64 = (b) => Buffer.from(b).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
const claims = b64(JSON.stringify({
  iss: KEY.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
}));
const signer = createSign('RSA-SHA256');
signer.update(`${header}.${claims}`);
const assertion = `${header}.${claims}.${b64(signer.sign(KEY.private_key))}`;

const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`,
})).json();
if (!tok.access_token) { console.error(`token failed: ${JSON.stringify(tok).slice(0, 300)}`); process.exit(1); }
const auth = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' };

// 1) Is the service already enabled?
const state = await fetch(`https://serviceusage.googleapis.com/v1/projects/${PROJECT}/services/${SERVICE}`, { headers: auth });
const sj = await state.json().catch(() => ({}));
console.log(`SA: ${KEY.client_email}`);
console.log(`当前状态: HTTP ${state.status}  state=${sj.state || JSON.stringify(sj).slice(0, 200)}`);
if (sj.state === 'ENABLED') { console.log('✅ 已启用，无需操作'); process.exit(0); }

// 2) Enable it
const res = await fetch(`https://serviceusage.googleapis.com/v1/projects/${PROJECT}/services/${SERVICE}:enable`, {
  method: 'POST', headers: auth, body: '{}',
});
const j = await res.json().catch(() => ({}));
if (res.ok) {
  console.log(`✅ 启用成功（或已在进行中）: ${j.name || '(ok)'}`);
  console.log('   现在可以重跑 tools/gsc-request-indexing.mjs');
} else {
  console.log(`❌ 启用失败: HTTP ${res.status}`);
  console.log(`   ${JSON.stringify(j).slice(0, 400)}`);
  console.log('   ⇒ SA 缺少项目级管理权限（需要 Service Usage Admin 或 Editor）。');
  console.log('     这是真实的凭据权限边界：给 SA 加角色或手动启用，都只能在有项目');
  console.log('     管理权的账号（浏览器）里完成。');
}
