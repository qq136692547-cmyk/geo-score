import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_PUBLISHER_ID,
  DEFAULT_EXTENSION_ID,
  parseEnvContent,
  buildCwsEndpoints,
  createServiceAccountJwt,
  getAccessToken,
  fetchItemStatus,
  uploadPackageZip,
  publishItem,
} from '../../extension/scripts/publish-cws.mjs';

describe('Chrome Web Store Publish API v2 script', () => {
  it('parses secrets env files cleanly while ignoring comments and quotes', () => {
    const parsed = parseEnvContent(
      '# comment\nCWS_CLIENT_ID="abc-123"\nCWS_CLIENT_SECRET=\'sec-456\'\nCWS_REFRESH_TOKEN=ref-789\n'
    );
    expect(parsed).toEqual({
      CWS_CLIENT_ID: 'abc-123',
      CWS_CLIENT_SECRET: 'sec-456',
      CWS_REFRESH_TOKEN: 'ref-789',
    });
  });

  it('builds official Chrome Web Store API v2 endpoints', () => {
    const ep = buildCwsEndpoints(DEFAULT_PUBLISHER_ID, DEFAULT_EXTENSION_ID);
    expect(ep.fetchStatus).toBe(
      `https://chromewebstore.googleapis.com/v2/publishers/${DEFAULT_PUBLISHER_ID}/items/${DEFAULT_EXTENSION_ID}:fetchStatus`
    );
    expect(ep.upload).toBe(
      `https://chromewebstore.googleapis.com/upload/v2/publishers/${DEFAULT_PUBLISHER_ID}/items/${DEFAULT_EXTENSION_ID}:upload`
    );
    expect(ep.publish).toBe(
      `https://chromewebstore.googleapis.com/v2/publishers/${DEFAULT_PUBLISHER_ID}/items/${DEFAULT_EXTENSION_ID}:publish`
    );
  });

  it('creates a valid RS256 signed JWT for Service Account auth', () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const jwt = createServiceAccountJwt(
      { client_email: 'cws@example.iam.gserviceaccount.com', private_key: privateKey },
      1700000000
    );
    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();
    const sigBuf = Buffer.from(parts[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    expect(verifier.verify(publicKey, sigBuf)).toBe(true);
  });

  it('exchanges OAuth refresh token and uploads + publishes via v2 API', async () => {
    const tmpZip = path.join(os.tmpdir(), `cws-test-${Date.now()}.zip`);
    fs.writeFileSync(tmpZip, Buffer.from('PK\x03\x04dummy-zip'));
    try {
      const fetchMock = vi.fn(async (url, opts) => {
        if (url === 'https://oauth2.googleapis.com/token') {
          return { ok: true, status: 200, json: async () => ({ access_token: 'tok-live-123' }) };
        }
        if (url.endsWith(':upload')) {
          expect(opts.headers.Authorization).toBe('Bearer tok-live-123');
          expect(opts.headers['Content-Type']).toBe('application/zip');
          return { ok: true, status: 200, json: async () => ({ uploadState: 'SUCCEEDED', crxVersion: '1.9.0' }) };
        }
        if (url.endsWith(':publish')) {
          return { ok: true, status: 200, json: async () => ({ state: 'PENDING_REVIEW' }) };
        }
        if (url.endsWith(':fetchStatus')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ submittedItemRevisionStatus: { state: 'PENDING_REVIEW' } }),
          };
        }
        throw new Error(`Unexpected URL: ${url}`);
      });

      const config = {
        publisherId: DEFAULT_PUBLISHER_ID,
        extensionId: DEFAULT_EXTENSION_ID,
        zipPath: tmpZip,
        clientId: 'cid',
        clientSecret: 'csec',
        refreshToken: 'cref',
        serviceAccountPath: '',
        envFilePath: 'secrets/cws.env',
      };

      const token = await getAccessToken(config, fetchMock);
      expect(token).toBe('tok-live-123');
      const up = await uploadPackageZip(config, token, fetchMock);
      expect(up.uploadState).toBe('SUCCEEDED');
      const pub = await publishItem(config, token, fetchMock);
      expect(pub.state).toBe('PENDING_REVIEW');
      const st = await fetchItemStatus(config, token, fetchMock);
      expect(st.submittedItemRevisionStatus.state).toBe('PENDING_REVIEW');
    } finally {
      fs.rmSync(tmpZip, { force: true });
    }
  });

  it('fails loudly when credentials are missing or upload returns FAILED', async () => {
    await expect(
      getAccessToken({
        clientId: '',
        clientSecret: '',
        refreshToken: '',
        serviceAccountPath: '',
        envFilePath: 'secrets/cws.env',
      })
    ).rejects.toThrow(/Missing Chrome Web Store API credentials/);

    const tmpZip = path.join(os.tmpdir(), `cws-fail-${Date.now()}.zip`);
    fs.writeFileSync(tmpZip, Buffer.from('PK\x03\x04dummy'));
    try {
      const failFetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ uploadState: 'FAILED', itemError: [{ errorCode: 'INVALID_MANIFEST' }] }),
      }));
      await expect(
        uploadPackageZip(
          { publisherId: DEFAULT_PUBLISHER_ID, extensionId: DEFAULT_EXTENSION_ID, zipPath: tmpZip },
          'tok',
          failFetch
        )
      ).rejects.toThrow(/uploadState=FAILED/);
    } finally {
      fs.rmSync(tmpZip, { force: true });
    }
  });
});
