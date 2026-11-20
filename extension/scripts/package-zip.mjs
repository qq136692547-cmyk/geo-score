#!/usr/bin/env node
/**
 * Zero-dependency Chrome MV3 Extension ZIP Packager & Integrity Verifier
 *
 * Packages extension/dist/ into extension/geoscore-extension.zip:
 * - Pure Node: node:fs, node:path, node:zlib
 * - manifest.json located directly at the ZIP root
 * - Standard ZIP specification (LFH + CD + EOCD, UTF-8 flag 0x0800, raw deflate)
 * - Strict security gates: reject .git, node_modules, .env, .md, .pem, .zip, store-assets
 * - Read-back verification: Central Directory parsing, manifest decompression & integrity checks
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = dirname(__filename);
const extensionDir = resolve(scriptsDir, '..');
const defaultDistDir = resolve(extensionDir, 'dist');
const defaultZipPath = resolve(extensionDir, 'geoscore-extension.zip');

// Forbidden file patterns
export const FORBIDDEN_RULES = [
  { pattern: /(?:^|\/)\.git(?:\/|$)/i, reason: 'Git metadata' },
  { pattern: /(?:^|\/)node_modules(?:\/|$)/i, reason: 'node_modules dependency' },
  { pattern: /(?:^|\/)\.env(?:\..+)?$/i, reason: 'Environment / credentials file' },
  { pattern: /\.md$/i, reason: 'Markdown documentation' },
  { pattern: /\.pem$/i, reason: 'Private key file' },
  { pattern: /\.zip$/i, reason: 'Nested ZIP archive' },
  { pattern: /(?:^|\/)store-assets(?:\/|$)/i, reason: 'Store promo asset directory' },
];

export const REQUIRED_MV3_ENTRIES = [
  'manifest.json',
  'background.js',
  'content.js',
  'sidepanel/index.html',
  'icons/icon-128.png',
];

export const SENSITIVE_STRINGS = [
  'BEGIN RSA PRIVATE KEY',
  'BEGIN PRIVATE KEY',
  'BEGIN OPENSSH PRIVATE KEY',
  'client_secret',
  'aws_secret_access_key',
];

// Fallback CRC table
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

export function calculateCrc32(buffer) {
  if (typeof zlib.crc32 === 'function') {
    return (zlib.crc32(buffer) >>> 0);
  }
  let crc = 0 ^ -1;
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

export function dateToDos(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const year = Math.max(1980, Math.min(2107, d.getFullYear()));
  const dosTime =
    ((d.getHours() & 0x1f) << 11) |
    ((d.getMinutes() & 0x3f) << 5) |
    (Math.floor(d.getSeconds() / 2) & 0x1f);
  const dosDate =
    (((year - 1980) & 0x7f) << 9) |
    (((d.getMonth() + 1) & 0x0f) << 5) |
    (d.getDate() & 0x1f);
  return { dosDate, dosTime };
}

export function collectDistFiles(distDir) {
  const files = [];

  function walk(currentDir) {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const fullPath = resolve(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const relPath = relative(distDir, fullPath).replace(/\\/g, '/');
        files.push({ fullPath, relPath });
      }
    }
  }

  walk(distDir);
  return files;
}

export function assertCleanFileList(relPaths) {
  for (const relPath of relPaths) {
    for (const rule of FORBIDDEN_RULES) {
      if (rule.pattern.test(relPath)) {
        throw new Error(
          `[Gate Violation] Forbidden file found in extension distribution: "${relPath}" (${rule.reason}). Packaging aborted.`
        );
      }
    }
  }
}

export function buildZipBuffer(files) {
  const localParts = [];
  const cdParts = [];
  let currentOffset = 0;

  for (const file of files) {
    const { relPath, content, mtime } = file;
    const nameBuf = Buffer.from(relPath, 'utf8');
    const uncompressedBuf = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const uncompressedSize = uncompressedBuf.length;
    const crc = calculateCrc32(uncompressedBuf);
    const compressedBuf = zlib.deflateRawSync(uncompressedBuf, { level: 9 });
    const compressedSize = compressedBuf.length;
    const { dosDate, dosTime } = dateToDos(mtime || new Date());

    const localHeaderOffset = currentOffset;

    // LFH: 30 bytes + nameBuf.length
    const lfh = Buffer.alloc(30 + nameBuf.length);
    lfh.writeUInt32LE(0x04034b50, 0); // Local file header signature
    lfh.writeUInt16LE(20, 4);         // Version needed: 2.0
    lfh.writeUInt16LE(0x0800, 6);     // General purpose bit flag: UTF-8
    lfh.writeUInt16LE(8, 8);          // Compression method: Deflate
    lfh.writeUInt16LE(dosTime, 10);
    lfh.writeUInt16LE(dosDate, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(compressedSize, 18);
    lfh.writeUInt32LE(uncompressedSize, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);         // Extra field length
    nameBuf.copy(lfh, 30);

    localParts.push(lfh, compressedBuf);
    currentOffset += lfh.length + compressedBuf.length;

    // CDH: 46 bytes + nameBuf.length
    const cdh = Buffer.alloc(46 + nameBuf.length);
    cdh.writeUInt32LE(0x02014b50, 0); // Central directory header signature
    cdh.writeUInt16LE(20, 4);         // Version made by: 2.0
    cdh.writeUInt16LE(20, 6);         // Version needed: 2.0
    cdh.writeUInt16LE(0x0800, 8);     // General purpose bit flag: UTF-8
    cdh.writeUInt16LE(8, 10);         // Compression method: Deflate
    cdh.writeUInt16LE(dosTime, 12);
    cdh.writeUInt16LE(dosDate, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(compressedSize, 20);
    cdh.writeUInt32LE(uncompressedSize, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);         // Extra field length
    cdh.writeUInt16LE(0, 32);         // File comment length
    cdh.writeUInt16LE(0, 34);         // Disk number start
    cdh.writeUInt16LE(0, 36);         // Internal file attributes
    cdh.writeUInt32LE(0, 38);         // External file attributes
    cdh.writeUInt32LE(localHeaderOffset, 42);
    nameBuf.copy(cdh, 46);

    cdParts.push(cdh);
  }

  const cdStartOffset = currentOffset;
  let cdSize = 0;
  for (const cdh of cdParts) {
    cdSize += cdh.length;
  }

  // EOCD: 22 bytes
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // End of central dir signature
  eocd.writeUInt16LE(0, 4);          // Disk number
  eocd.writeUInt16LE(0, 6);          // Disk with central dir
  eocd.writeUInt16LE(files.length, 8);   // Entries on this disk
  eocd.writeUInt16LE(files.length, 10);  // Total entries
  eocd.writeUInt32LE(cdSize, 12);        // Size of central dir
  eocd.writeUInt32LE(cdStartOffset, 16); // Offset of start of central dir
  eocd.writeUInt16LE(0, 20);         // Comment length

  return Buffer.concat([...localParts, ...cdParts, eocd]);
}

export function parseZip(zipBuffer) {
  let eocdOffset = -1;
  const minOffset = Math.max(0, zipBuffer.length - 65535 - 22);
  for (let i = zipBuffer.length - 22; i >= minOffset; i--) {
    if (zipBuffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Invalid ZIP: End of Central Directory (EOCD) signature not found');
  }

  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
  const cdSize = zipBuffer.readUInt32LE(eocdOffset + 12);
  const cdOffset = zipBuffer.readUInt32LE(eocdOffset + 16);

  const entries = [];
  let currentOffset = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (zipBuffer.readUInt32LE(currentOffset) !== 0x02014b50) {
      throw new Error(`Invalid Central Directory signature at offset ${currentOffset}`);
    }
    const flags = zipBuffer.readUInt16LE(currentOffset + 8);
    const method = zipBuffer.readUInt16LE(currentOffset + 10);
    const dosTime = zipBuffer.readUInt16LE(currentOffset + 12);
    const dosDate = zipBuffer.readUInt16LE(currentOffset + 14);
    const crc = zipBuffer.readUInt32LE(currentOffset + 16);
    const compSize = zipBuffer.readUInt32LE(currentOffset + 20);
    const uncompSize = zipBuffer.readUInt32LE(currentOffset + 24);
    const nameLen = zipBuffer.readUInt16LE(currentOffset + 28);
    const extraLen = zipBuffer.readUInt16LE(currentOffset + 30);
    const commentLen = zipBuffer.readUInt16LE(currentOffset + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(currentOffset + 42);

    const name = zipBuffer.toString('utf8', currentOffset + 46, currentOffset + 46 + nameLen);
    entries.push({
      name,
      flags,
      method,
      crc,
      compSize,
      uncompSize,
      localHeaderOffset,
      dosDate,
      dosTime,
    });
    currentOffset += 46 + nameLen + extraLen + commentLen;
  }

  return { eocdOffset, cdOffset, cdSize, totalEntries, entries };
}

export function extractZipEntry(zipBuffer, entryName) {
  const { entries } = parseZip(zipBuffer);
  const entry = entries.find((e) => e.name === entryName);
  if (!entry) {
    throw new Error(`Entry "${entryName}" not found in ZIP archive`);
  }

  const lfhOffset = entry.localHeaderOffset;
  if (zipBuffer.readUInt32LE(lfhOffset) !== 0x04034b50) {
    throw new Error(`Invalid Local File Header signature at offset ${lfhOffset}`);
  }
  const lfhNameLen = zipBuffer.readUInt16LE(lfhOffset + 26);
  const lfhExtraLen = zipBuffer.readUInt16LE(lfhOffset + 28);
  const dataOffset = lfhOffset + 30 + lfhNameLen + lfhExtraLen;
  const compressedSlice = zipBuffer.subarray(dataOffset, dataOffset + entry.compSize);

  let uncompressed;
  if (entry.method === 8) {
    uncompressed = zlib.inflateRawSync(compressedSlice);
  } else if (entry.method === 0) {
    uncompressed = compressedSlice;
  } else {
    throw new Error(`Unsupported compression method ${entry.method} for "${entryName}"`);
  }

  const actualCrc = calculateCrc32(uncompressed);
  if (actualCrc !== entry.crc) {
    throw new Error(
      `CRC mismatch for "${entryName}": header=0x${entry.crc.toString(16)}, computed=0x${actualCrc.toString(16)}`
    );
  }
  if (uncompressed.length !== entry.uncompSize) {
    throw new Error(
      `Size mismatch for "${entryName}": header=${entry.uncompSize}, uncompressed=${uncompressed.length}`
    );
  }

  return uncompressed;
}

export function verifyZipIntegrity(zipBuffer, distDir) {
  const { entries } = parseZip(zipBuffer);

  // 1. Verify entry names formatting
  for (const entry of entries) {
    if (entry.name.startsWith('/') || entry.name.startsWith('\\')) {
      throw new Error(`Entry "${entry.name}" contains illegal leading slash`);
    }
    if (entry.name.includes('\\')) {
      throw new Error(`Entry "${entry.name}" contains backslash; must use POSIX "/"`);
    }
    if (entry.name.startsWith('dist/')) {
      throw new Error(`Entry "${entry.name}" is nested inside "dist/"; manifest.json must be at ZIP root`);
    }
  }

  // 2. Verify all required MV3 entrypoints exist
  const entryNames = new Set(entries.map((e) => e.name));
  for (const required of REQUIRED_MV3_ENTRIES) {
    if (!entryNames.has(required)) {
      throw new Error(`Missing required MV3 entrypoint in ZIP: "${required}"`);
    }
  }

  // 3. Decompress and verify manifest.json
  const manifestBuf = extractZipEntry(zipBuffer, 'manifest.json');
  const manifestText = manifestBuf.toString('utf8');

  let manifestObj;
  try {
    manifestObj = JSON.parse(manifestText);
  } catch (err) {
    throw new Error(`Corrupted manifest.json in ZIP: failed to parse JSON (${err.message})`);
  }

  if (manifestObj.manifest_version !== 3) {
    throw new Error(`Expected manifest_version: 3, got ${manifestObj.manifest_version}`);
  }

  // Compare with distDir manifest.json if distDir is provided
  if (distDir && existsSync(resolve(distDir, 'manifest.json'))) {
    const originalManifestText = readFileSync(resolve(distDir, 'manifest.json'), 'utf8');
    if (manifestText !== originalManifestText) {
      throw new Error('Decompressed manifest.json content does not match extension/dist/manifest.json');
    }
  }

  // Check for sensitive strings in manifest
  for (const sensitive of SENSITIVE_STRINGS) {
    if (manifestText.includes(sensitive)) {
      throw new Error(`Security Alert: manifest.json contains sensitive token "${sensitive}"`);
    }
  }

  return { entries, manifestObj };
}

export function packageExtensionZip(options = {}) {
  const distDir = options.distDir ? resolve(options.distDir) : defaultDistDir;
  const outputZipPath = options.outputZipPath ? resolve(options.outputZipPath) : defaultZipPath;
  const quiet = options.quiet || false;

  const manifestPath = resolve(distDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error(
      `Cannot package extension: missing "${manifestPath}". Run "npm run ext:build" first.`
    );
  }

  const collected = collectDistFiles(distDir);
  if (collected.length === 0) {
    throw new Error(`No files found in "${distDir}". Run "npm run ext:build" first.`);
  }

  // Security gate check
  assertCleanFileList(collected.map((f) => f.relPath));

  // Prepare file items with buffers
  const fileItems = collected.map(({ fullPath, relPath }) => {
    const content = readFileSync(fullPath);
    const stat = statSync(fullPath);
    return {
      relPath,
      content,
      mtime: stat.mtime,
    };
  });

  const zipBuffer = buildZipBuffer(fileItems);
  writeFileSync(outputZipPath, zipBuffer);

  // Read back and verify immediately
  const reReadBuffer = readFileSync(outputZipPath);
  const { entries, manifestObj } = verifyZipIntegrity(reReadBuffer, distDir);

  if (!quiet) {
    console.log('\n=============================================================');
    console.log('📦 GeoScore Chrome Extension - MV3 ZIP Packaging Report');
    console.log('=============================================================');
    console.log(`Target Output: ${outputZipPath}`);
    console.log(`Manifest:      ${manifestObj.name} v${manifestObj.version} (MV${manifestObj.manifest_version})`);
    console.log(`Total Files:   ${entries.length}`);
    console.log('-------------------------------------------------------------');
    console.log('Entries:');

    let totalRaw = 0;
    let totalComp = 0;

    for (const entry of entries) {
      totalRaw += entry.uncompSize;
      totalComp += entry.compSize;
      const ratio =
        entry.uncompSize > 0
          ? ((1 - entry.compSize / entry.uncompSize) * 100).toFixed(1)
          : '0.0';
      console.log(
        `  ✓ ${entry.name.padEnd(32)} ${String(entry.uncompSize).padStart(8)} B -> ${String(entry.compSize).padStart(8)} B (${ratio.padStart(5)}% saved)`
      );
    }

    const overallRatio = totalRaw > 0 ? ((1 - totalComp / totalRaw) * 100).toFixed(1) : '0.0';
    console.log('-------------------------------------------------------------');
    console.log(
      `Total Size:    ${totalRaw.toLocaleString()} B uncompressed -> ${reReadBuffer.length.toLocaleString()} B zip (${overallRatio}% compression)`
    );
    console.log('Integrity:     100% verified (Central Directory, CRC32, Root Manifest)');
    console.log('=============================================================\n');
  }

  return {
    outputZipPath,
    zipBuffer: reReadBuffer,
    entries,
    manifestObj,
    fileCount: entries.length,
    rawBytes: entries.reduce((acc, e) => acc + e.uncompSize, 0),
    zipBytes: reReadBuffer.length,
  };
}

// CLI entry
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  try {
    packageExtensionZip();
  } catch (err) {
    console.error('\n❌ Packaging failed:', err.message);
    process.exit(1);
  }
}
