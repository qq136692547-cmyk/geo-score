import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

import {
  packageExtensionZip,
  parseZip,
  extractZipEntry,
  verifyZipIntegrity,
  assertCleanFileList,
  calculateCrc32,
  dateToDos,
  REQUIRED_MV3_ENTRIES,
  FORBIDDEN_RULES,
} from '../../extension/scripts/package-zip.mjs';

const __filename = fileURLToPath(import.meta.url);
const currentDir = dirname(__filename);
const projectRoot = resolve(currentDir, '../..');
const extDir = resolve(projectRoot, 'extension');
const distDir = resolve(extDir, 'dist');
const zipPath = resolve(extDir, 'geoscore-extension.zip');

describe('Chrome Extension MV3 - ZIP Packager & Verification', () => {
  let packageResult;
  let zipBuffer;

  beforeAll(() => {
    // Ensure dist exists; run packaging once for test suite
    if (!existsSync(resolve(distDir, 'manifest.json'))) {
      throw new Error('extension/dist/manifest.json must exist before running package tests. Run npm run ext:build first.');
    }
    packageResult = packageExtensionZip({ distDir, outputZipPath: zipPath, quiet: true });
    zipBuffer = readFileSync(zipPath);
  });

  describe('Archive Structure & Root Placement', () => {
    it('creates geoscore-extension.zip on disk', () => {
      expect(existsSync(zipPath)).toBe(true);
      expect(zipBuffer.length).toBeGreaterThan(1000);
    });

    it('places manifest.json directly at the ZIP root', () => {
      const { entries } = parseZip(zipBuffer);
      const manifestEntry = entries.find((e) => e.name === 'manifest.json');
      expect(manifestEntry).toBeDefined();

      // Ensure no dist/ prefix or leading slash
      expect(entries.some((e) => e.name.startsWith('dist/'))).toBe(false);
      expect(entries.some((e) => e.name.startsWith('/') || e.name.startsWith('\\'))).toBe(false);
    });

    it('contains all required Chrome MV3 entry points', () => {
      const { entries } = parseZip(zipBuffer);
      const entryNames = entries.map((e) => e.name);

      for (const required of REQUIRED_MV3_ENTRIES) {
        expect(entryNames).toContain(required);
      }

      // Check key assets
      expect(entryNames).toContain('icons/icon-16.png');
      expect(entryNames).toContain('icons/icon-32.png');
      expect(entryNames).toContain('icons/icon-48.png');
      expect(entryNames).toContain('icons/icon-128.png');
      expect(entryNames).toContain('sidepanel/index.css');
      expect(entryNames).toContain('sidepanel/index.js');
      expect(entryNames).toContain('_locales/en/messages.json');
      expect(entryNames).toContain('_locales/zh_CN/messages.json');
    });

    it('uses standard POSIX forward slashes for all entry names', () => {
      const { entries } = parseZip(zipBuffer);
      for (const entry of entries) {
        expect(entry.name).not.toContain('\\');
      }
    });
  });

  describe('Security & Purity Gate', () => {
    it('contains zero forbidden files (.md, .env, .git, node_modules, .pem, .zip, store-assets)', () => {
      const { entries } = parseZip(zipBuffer);
      const names = entries.map((e) => e.name);

      for (const name of names) {
        for (const rule of FORBIDDEN_RULES) {
          expect(rule.pattern.test(name)).toBe(false);
        }
      }
    });

    it('assertCleanFileList rejects forbidden file patterns', () => {
      expect(() => assertCleanFileList(['manifest.json', 'README.md'])).toThrow(/Forbidden file/);
      expect(() => assertCleanFileList(['.git/HEAD'])).toThrow(/Forbidden file/);
      expect(() => assertCleanFileList(['node_modules/vite/package.json'])).toThrow(/Forbidden file/);
      expect(() => assertCleanFileList(['.env'])).toThrow(/Forbidden file/);
      expect(() => assertCleanFileList(['.env.production'])).toThrow(/Forbidden file/);
      expect(() => assertCleanFileList(['key.pem'])).toThrow(/Forbidden file/);
      expect(() => assertCleanFileList(['archive.zip'])).toThrow(/Forbidden file/);
      expect(() => assertCleanFileList(['store-assets/promo-1280x800.png'])).toThrow(/Forbidden file/);
    });

    it('assertCleanFileList passes on valid extension files', () => {
      expect(() =>
        assertCleanFileList([
          'manifest.json',
          'background.js',
          'content.js',
          'sidepanel/index.html',
          'sidepanel/index.css',
          'sidepanel/index.js',
          'icons/icon-128.png',
          '_locales/en/messages.json',
        ])
      ).not.toThrow();
    });
  });

  describe('Lossless Decompression & Content Verification', () => {
    it('decompresses manifest.json matching extension/dist/manifest.json identically', () => {
      const extractedBuf = extractZipEntry(zipBuffer, 'manifest.json');
      const expectedText = readFileSync(resolve(distDir, 'manifest.json'), 'utf8');

      expect(extractedBuf.toString('utf8')).toBe(expectedText);

      const parsed = JSON.parse(extractedBuf.toString('utf8'));
      expect(parsed.manifest_version).toBe(3);
      expect(parsed.name).toBe('__MSG_extName__');
      expect(parsed.version).toMatch(/^\d+\.\d+\.\d+/);
      expect(parsed.background.service_worker).toBe('background.js');
    });

    it('manifest.json does not contain any sensitive private keys or secrets', () => {
      const extractedBuf = extractZipEntry(zipBuffer, 'manifest.json');
      const manifestStr = extractedBuf.toString('utf8');

      expect(manifestStr).not.toContain('PRIVATE KEY');
      expect(manifestStr).not.toContain('client_secret');
      expect(manifestStr).not.toContain('aws_secret_access_key');
    });

    it('decompresses background.js and sidepanel/index.html with valid CRC32', () => {
      const bgBuf = extractZipEntry(zipBuffer, 'background.js');
      expect(bgBuf.length).toBeGreaterThan(1000);
      expect(bgBuf.toString('utf8')).toContain('chrome.runtime');

      const sidepanelBuf = extractZipEntry(zipBuffer, 'sidepanel/index.html');
      expect(sidepanelBuf.toString('utf8')).toContain('<!DOCTYPE html>');
    });

    it('verifyZipIntegrity passes on the generated package', () => {
      const result = verifyZipIntegrity(zipBuffer, distDir);
      expect(result.manifestObj.manifest_version).toBe(3);
      expect(result.entries.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Edge Cases & Error Handling', () => {
    it('throws when trying to extract non-existent entry', () => {
      expect(() => extractZipEntry(zipBuffer, 'ghost-file.js')).toThrow(/not found in ZIP archive/);
    });

    it('throws when packaging with missing manifest.json', () => {
      const fakeDir = resolve(projectRoot, 'tests/fixtures/empty-test-dir');
      mkdirSync(fakeDir, { recursive: true });
      try {
        expect(() => packageExtensionZip({ distDir: fakeDir })).toThrow(/missing.*manifest\.json/);
      } finally {
        rmSync(fakeDir, { recursive: true, force: true });
      }
    });

    it('throws when parsing buffer with invalid signature', () => {
      const invalidBuf = Buffer.from('not a zip file at all');
      expect(() => parseZip(invalidBuf)).toThrow(/Invalid ZIP/);
    });

    it('calculates CRC32 correctly for standard buffers', () => {
      const emptyCrc = calculateCrc32(Buffer.alloc(0));
      expect(emptyCrc).toBe(0);

      const helloCrc = calculateCrc32(Buffer.from('hello'));
      expect(helloCrc).toBe(907060870);
    });

    it('converts Date to valid MS-DOS format', () => {
      const testDate = new Date('2026-11-16T12:30:00Z');
      const { dosDate, dosTime } = dateToDos(testDate);
      expect(dosDate).toBeGreaterThan(0);
      expect(dosTime).toBeGreaterThan(0);
      expect(dosDate).toBeLessThanOrEqual(0xffff);
      expect(dosTime).toBeLessThanOrEqual(0xffff);
    });
  });
});
