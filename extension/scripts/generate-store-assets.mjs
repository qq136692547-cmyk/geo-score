/**
 * GeoScore Chrome Web Store & Edge Add-ons Promotional Asset Generator
 *
 * Renders 6 production-grade promotional screenshots and store tiles using
 * local headless Chrome / Edge and transcodes them to strictly 24-bit RGB PNG
 * (colorType = 2, bitDepth = 8, no Alpha channel) with pure Node.js (node:zlib).
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storeAssetsDir = path.resolve(__dirname, '../store-assets');

// 1. Browser Detection
function detectBrowserPath() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Neither Google Chrome nor Microsoft Edge was found on this system.');
}

// 2. Pure Node PNG RGB24 (colorType = 2) Transcoder
let crcTable = null;
function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
  }
  return crcTable;
}

function calcCrc32(buf) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const target = Buffer.concat([typeBuf, data]);
  const crcVal = calcCrc32(target);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Reads any 8-bit RGBA (colorType=6) or RGB (colorType=2) PNG buffer,
 * unfilters all scanlines, composites against #0f172a if RGBA,
 * and encodes strictly as standard 24-bit RGB (colorType=2) PNG.
 */
function transcodeToRgb24Png(inputBuf, bgHex = '0f172a') {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (inputBuf[i] !== sig[i]) throw new Error('Invalid PNG signature');
  }

  let pos = 8;
  let ihdr = null;
  const idatChunks = [];

  while (pos < inputBuf.length) {
    const chunkLen = inputBuf.readUInt32BE(pos);
    const chunkType = inputBuf.toString('ascii', pos + 4, pos + 8);
    const chunkData = inputBuf.subarray(pos + 8, pos + 8 + chunkLen);

    if (chunkType === 'IHDR') {
      const width = chunkData.readUInt32BE(0);
      const height = chunkData.readUInt32BE(4);
      const bitDepth = chunkData[8];
      const colorType = chunkData[9];
      const comp = chunkData[10];
      const filter = chunkData[11];
      const interlace = chunkData[12];
      ihdr = { width, height, bitDepth, colorType, comp, filter, interlace };
    } else if (chunkType === 'IDAT') {
      idatChunks.push(chunkData);
    } else if (chunkType === 'IEND') {
      break;
    }
    pos += 12 + chunkLen;
  }

  if (!ihdr) throw new Error('Missing IHDR chunk in PNG');
  if (ihdr.bitDepth !== 8) throw new Error(`Unsupported bit depth: ${ihdr.bitDepth}`);
  if (ihdr.colorType !== 2 && ihdr.colorType !== 6) {
    throw new Error(`Unsupported color type: ${ihdr.colorType}`);
  }
  if (ihdr.interlace !== 0) throw new Error('Interlaced PNG not supported');

  const { width, height, colorType } = ihdr;
  const bpp = colorType === 6 ? 4 : 3;

  const compressedData = Buffer.concat(idatChunks);
  const inflated = zlib.inflateSync(compressedData);

  const lineBytes = width * bpp;
  const expectedInflatedSize = height * (1 + lineBytes);
  if (inflated.length !== expectedInflatedSize) {
    throw new Error(`Inflated size mismatch: expected ${expectedInflatedSize}, got ${inflated.length}`);
  }

  const recon = Buffer.alloc(height * lineBytes);
  let srcOffset = 0;

  for (let y = 0; y < height; y++) {
    const filterType = inflated[srcOffset++];
    const rowStart = y * lineBytes;
    const prevRowStart = (y - 1) * lineBytes;

    for (let x = 0; x < lineBytes; x++) {
      const raw = inflated[srcOffset++];
      const a = x >= bpp ? recon[rowStart + x - bpp] : 0;
      const b = y > 0 ? recon[prevRowStart + x] : 0;
      const c = (y > 0 && x >= bpp) ? recon[prevRowStart + x - bpp] : 0;

      let val = 0;
      switch (filterType) {
        case 0: // None
          val = raw;
          break;
        case 1: // Sub
          val = (raw + a) & 0xff;
          break;
        case 2: // Up
          val = (raw + b) & 0xff;
          break;
        case 3: // Average
          val = (raw + Math.floor((a + b) / 2)) & 0xff;
          break;
        case 4: // Paeth
          val = (raw + paethPredictor(a, b, c)) & 0xff;
          break;
        default:
          throw new Error(`Unknown filter type ${filterType} at scanline ${y}`);
      }
      recon[rowStart + x] = val;
    }
  }

  const bgR = parseInt(bgHex.slice(0, 2), 16);
  const bgG = parseInt(bgHex.slice(2, 4), 16);
  const bgB = parseInt(bgHex.slice(4, 6), 16);

  // Convert to pure RGB Buffer (width * height * 3)
  const rgbBuffer = Buffer.alloc(width * height * 3);
  if (colorType === 6) {
    for (let i = 0; i < width * height; i++) {
      const srcIdx = i * 4;
      const dstIdx = i * 3;
      const r = recon[srcIdx];
      const g = recon[srcIdx + 1];
      const b = recon[srcIdx + 2];
      const a = recon[srcIdx + 3];

      if (a === 255) {
        rgbBuffer[dstIdx] = r;
        rgbBuffer[dstIdx + 1] = g;
        rgbBuffer[dstIdx + 2] = b;
      } else if (a === 0) {
        rgbBuffer[dstIdx] = bgR;
        rgbBuffer[dstIdx + 1] = bgG;
        rgbBuffer[dstIdx + 2] = bgB;
      } else {
        const factor = a / 255;
        rgbBuffer[dstIdx] = Math.round(r * factor + bgR * (1 - factor));
        rgbBuffer[dstIdx + 1] = Math.round(g * factor + bgG * (1 - factor));
        rgbBuffer[dstIdx + 2] = Math.round(b * factor + bgB * (1 - factor));
      }
    }
  } else {
    recon.copy(rgbBuffer);
  }

  // Encode as strict 24-bit RGB PNG (colorType = 2, bitDepth = 8)
  const rowBytes = width * 3;
  const rawScanlines = Buffer.alloc(height * (1 + rowBytes));
  for (let y = 0; y < height; y++) {
    const rawOffset = y * (1 + rowBytes);
    rawScanlines[rawOffset] = 0; // Filter 0 (None)
    rgbBuffer.copy(rawScanlines, rawOffset + 1, y * rowBytes, (y + 1) * rowBytes);
  }

  const deflated = zlib.deflateSync(rawScanlines, { level: 9 });

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrBuf = Buffer.alloc(13);
  ihdrBuf.writeUInt32BE(width, 0);
  ihdrBuf.writeUInt32BE(height, 4);
  ihdrBuf[8] = 8; // 8 bits per sample
  ihdrBuf[9] = 2; // colorType 2 = RGB (No Alpha)
  ihdrBuf[10] = 0; // compression 0
  ihdrBuf[11] = 0; // filter 0
  ihdrBuf[12] = 0; // interlace 0

  const ihdrChunk = makeChunk('IHDR', ihdrBuf);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// 3. HTML Templates for 6 Assets

function getCommonCss(width, height) {
  return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background-color: #0f172a;
      color: #f8fafc;
      font-family: 'Segoe UI', 'Microsoft YaHei', system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }
    .font-mono {
      font-family: 'Consolas', 'Courier New', monospace;
    }
    .gradient-text-hero {
      background: linear-gradient(135deg, #22c55e 0%, #38bdf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .gradient-text-brand {
      background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  `;
}

function templateScreenshot1() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${getCommonCss(1280, 800)}
    .canvas {
      width: 1280px;
      height: 800px;
      padding: 44px 48px;
      display: flex;
      gap: 36px;
      position: relative;
      background: radial-gradient(circle at 10% 15%, rgba(34, 197, 94, 0.12) 0%, transparent 45%),
                  radial-gradient(circle at 90% 85%, rgba(59, 130, 246, 0.12) 0%, transparent 45%),
                  #0f172a;
    }
    .left-col {
      width: 530px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      z-index: 2;
    }
    .top-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.35);
      color: #60a5fa;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      padding: 6px 14px;
      border-radius: 9999px;
      width: fit-content;
    }
    .main-title {
      font-size: 44px;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.5px;
      margin-top: 14px;
      color: #f8fafc;
    }
    .main-subtitle {
      font-size: 15.5px;
      line-height: 1.5;
      color: #94a3b8;
      margin-top: 12px;
    }
    .pill-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 18px;
    }
    .pill-card {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 12px;
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    .pill-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .pill-title {
      font-size: 14px;
      font-weight: 700;
      color: #f1f5f9;
    }
    .pill-desc {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.35;
      margin-top: 2px;
    }
    .stats-strip {
      display: flex;
      gap: 16px;
      padding: 14px 18px;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 12px;
      align-items: center;
      justify-content: space-between;
    }
    .stat-item {
      text-align: center;
    }
    .stat-num {
      font-size: 20px;
      font-weight: 800;
      color: #22c55e;
    }
    .stat-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .right-col {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
    }
    .mock-panel {
      width: 100%;
      height: 712px;
      background: #1e293b;
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .panel-header {
      height: 48px;
      background: #0f172a;
      border-bottom: 1px solid rgba(148, 163, 184, 0.15);
      padding: 0 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .panel-body {
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      overflow: hidden;
      flex: 1;
    }
    .score-banner {
      background: #0f172a;
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 12px;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      gap: 18px;
    }
    .score-circle {
      position: relative;
      width: 80px;
      height: 80px;
      flex-shrink: 0;
    }
    .dim-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .dim-card {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 8px;
      padding: 10px 12px;
    }
    .progress-bar-bg {
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 9999px;
      overflow: hidden;
      margin-top: 6px;
    }
    .fix-files-box {
      background: #090d16;
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="left-col">
      <div>
        <div class="top-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          Chrome Web Store & Edge Add-ons
        </div>
        <h1 class="main-title">
          11 Dimensions<br>
          <span class="gradient-text-hero">85 Strict Checks</span>
        </h1>
        <p class="main-subtitle">
          Next-generation Generative Engine Optimization (GEO) & AI Search Readiness auditor for modern web engineering.
        </p>
      </div>

      <div class="pill-stack">
        <div class="pill-card">
          <div class="pill-icon" style="background: rgba(34, 197, 94, 0.15); color: #22c55e;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </div>
          <div>
            <div class="pill-title">Zero &lt;all_urls&gt; Permission</div>
            <div class="pill-desc">Strictly inspects only the active tab upon click. 100% private, zero background telemetry.</div>
          </div>
        </div>

        <div class="pill-card">
          <div class="pill-icon" style="background: rgba(59, 130, 246, 0.15); color: #3b82f6;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          </div>
          <div>
            <div class="pill-title">100% In-Browser Local Audit</div>
            <div class="pill-desc">Client-side DOM & SSR differential engine delivers complete reports in under 800ms.</div>
          </div>
        </div>

        <div class="pill-card">
          <div class="pill-icon" style="background: rgba(14, 165, 233, 0.15); color: #0ea5e9;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </div>
          <div>
            <div class="pill-title">Auto-Generate Fix Files</div>
            <div class="pill-desc">One-click creation of production-ready llms.txt, AI robots.txt rules, and JSON-LD schemas.</div>
          </div>
        </div>
      </div>

      <div class="stats-strip">
        <div class="stat-item">
          <div class="stat-num">11</div>
          <div class="stat-label">Dimensions</div>
        </div>
        <div style="width: 1px; height: 28px; background: rgba(148, 163, 184, 0.2);"></div>
        <div class="stat-item">
          <div class="stat-num">85</div>
          <div class="stat-label">Audit Checks</div>
        </div>
        <div style="width: 1px; height: 28px; background: rgba(148, 163, 184, 0.2);"></div>
        <div class="stat-item">
          <div class="stat-num">&lt;800ms</div>
          <div class="stat-label">Audit Time</div>
        </div>
        <div style="width: 1px; height: 28px; background: rgba(148, 163, 184, 0.2);"></div>
        <div class="stat-item">
          <div class="stat-num" style="color: #38bdf8;">MV3</div>
          <div class="stat-label">Architecture</div>
        </div>
      </div>
    </div>

    <div class="right-col">
      <div class="mock-panel">
        <div class="panel-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 22px; height: 22px; background: linear-gradient(135deg, #22c55e, #3b82f6); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 11px; color: white;">G</div>
            <span style="font-weight: 700; font-size: 13px; color: #f8fafc;">GeoScore Auditor</span>
            <span style="background: rgba(34, 197, 94, 0.15); color: #22c55e; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">v1.8.0</span>
          </div>
          <div style="font-size: 11px; color: #94a3b8; display: flex; align-items: center; gap: 6px;">
            <span style="width: 6px; height: 6px; border-radius: 9999px; background: #22c55e;"></span>
            example.com
          </div>
        </div>

        <div class="panel-body">
          <div class="score-banner">
            <div class="score-circle">
              <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3.5" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="url(#scoreGrad)" stroke-width="3.5" stroke-dasharray="92, 100" stroke-linecap="round" />
                <defs>
                  <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#22c55e" />
                    <stop offset="100%" stop-color="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
              <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <span style="font-size: 22px; font-weight: 900; line-height: 1; color: #f8fafc;">92</span>
                <span style="font-size: 9px; color: #94a3b8; font-weight: 600;">/ 100</span>
              </div>
            </div>
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="background: rgba(34, 197, 94, 0.2); color: #22c55e; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">Excellent · AI Ready</span>
              </div>
              <div style="font-size: 12px; color: #cbd5e1; margin-top: 6px; font-weight: 600;">81 Passed · 4 Advisories · 0 Critical Errors</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">High probability of top-tier citation in ChatGPT & Perplexity</div>
            </div>
          </div>

          <div class="dim-grid">
            <div class="dim-card">
              <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 600; color: #cbd5e1;">
                <span>Content Architecture</span>
                <span style="color: #22c55e;">96%</span>
              </div>
              <div class="progress-bar-bg"><div style="width: 96%; height: 100%; background: #22c55e;"></div></div>
            </div>
            <div class="dim-card">
              <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 600; color: #cbd5e1;">
                <span>AI Crawlability & robots</span>
                <span style="color: #22c55e;">100%</span>
              </div>
              <div class="progress-bar-bg"><div style="width: 100%; height: 100%; background: #22c55e;"></div></div>
            </div>
            <div class="dim-card">
              <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 600; color: #cbd5e1;">
                <span>Structured Data (JSON-LD)</span>
                <span style="color: #22c55e;">92%</span>
              </div>
              <div class="progress-bar-bg"><div style="width: 92%; height: 100%; background: #22c55e;"></div></div>
            </div>
            <div class="dim-card">
              <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 600; color: #cbd5e1;">
                <span>llms.txt Specification</span>
                <span style="color: #38bdf8;">88%</span>
              </div>
              <div class="progress-bar-bg"><div style="width: 88%; height: 100%; background: #38bdf8;"></div></div>
            </div>
            <div class="dim-card">
              <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 600; color: #cbd5e1;">
                <span>Semantic Citations</span>
                <span style="color: #22c55e;">90%</span>
              </div>
              <div class="progress-bar-bg"><div style="width: 90%; height: 100%; background: #22c55e;"></div></div>
            </div>
            <div class="dim-card">
              <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 600; color: #cbd5e1;">
                <span>SSR vs CSR Integrity</span>
                <span style="color: #22c55e;">95%</span>
              </div>
              <div class="progress-bar-bg"><div style="width: 95%; height: 100%; background: #22c55e;"></div></div>
            </div>
          </div>

          <div class="fix-files-box">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 700; color: #f1f5f9;">Generated Fix Files (Ready to Deploy)</span>
              <span style="font-size: 10px; color: #22c55e; font-weight: 700; background: rgba(34, 197, 94, 0.15); padding: 2px 6px; border-radius: 4px;">3 Ready</span>
            </div>
            <div style="display: flex; gap: 8px;">
              <div style="flex: 1; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 6px; padding: 6px 10px; font-size: 11px;">
                <div class="font-mono" style="color: #38bdf8; font-weight: 600;">llms.txt</div>
                <div style="color: #94a3b8; font-size: 10px;">1.4 KB · Verified</div>
              </div>
              <div style="flex: 1; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 6px; padding: 6px 10px; font-size: 11px;">
                <div class="font-mono" style="color: #38bdf8; font-weight: 600;">robots.txt</div>
                <div style="color: #94a3b8; font-size: 10px;">+3 AI Crawlers</div>
              </div>
              <div style="flex: 1; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 6px; padding: 6px 10px; font-size: 11px;">
                <div class="font-mono" style="color: #38bdf8; font-weight: 600;">json-ld-schema</div>
                <div style="color: #94a3b8; font-size: 10px;">Org &amp; WebSite</div>
              </div>
            </div>
            <div style="background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 8px; border-radius: 6px; text-align: center; font-size: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);">
              ⚡ Preview, Copy &amp; Download Fix Files
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function templateScreenshot2() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${getCommonCss(1280, 800)}
    .canvas {
      width: 1280px;
      height: 800px;
      padding: 40px 48px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      background: radial-gradient(circle at 20% 20%, rgba(239, 68, 68, 0.08) 0%, transparent 45%),
                  radial-gradient(circle at 80% 80%, rgba(34, 197, 94, 0.08) 0%, transparent 45%),
                  #0f172a;
    }
    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.35);
      color: #f87171;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 9999px;
      margin-bottom: 8px;
    }
    .main-title {
      font-size: 34px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #f8fafc;
      line-height: 1.2;
    }
    .main-subtitle {
      font-size: 14.5px;
      color: #94a3b8;
      margin-top: 6px;
    }
    .split-container {
      display: flex;
      gap: 24px;
      margin-top: 20px;
      flex: 1;
      position: relative;
    }
    .card {
      flex: 1;
      border-radius: 16px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    .card-crawler {
      background: #0d131f;
      border: 1px solid rgba(239, 68, 68, 0.45);
    }
    .card-browser {
      background: #0f1c2b;
      border: 1px solid rgba(34, 197, 94, 0.45);
    }
    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .metric-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin: 14px 0;
    }
    .metric-box {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 10px 12px;
      text-align: center;
    }
    .code-window {
      background: #060911;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 12px 14px;
      font-size: 11.5px;
      line-height: 1.5;
      overflow: hidden;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .alert-banner {
      border-radius: 10px;
      padding: 12px 16px;
      margin-top: 14px;
    }
    .vs-circle {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 48px;
      height: 48px;
      border-radius: 9999px;
      background: #1e293b;
      border: 2px solid rgba(148, 163, 184, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 900;
      color: #f8fafc;
      box-shadow: 0 0 25px rgba(0, 0, 0, 0.8);
      z-index: 10;
    }
    .bottom-bar {
      margin-top: 18px;
      background: rgba(30, 41, 59, 0.5);
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 12px;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="top-header">
      <div>
        <div class="badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          Deep Dive: Crawler Reality Check
        </div>
        <h1 class="main-title">
          SSR Raw HTML vs CSR Live DOM Analysis
        </h1>
        <p class="main-subtitle">
          Detect invisible JavaScript rendering traps before search engine crawlers ignore your content.
        </p>
      </div>
      <div style="background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 8px; padding: 6px 14px; font-size: 12px; color: #94a3b8;">
        Target: <span class="font-mono" style="color: #38bdf8;">next-app.example.com</span>
      </div>
    </div>

    <div class="split-container">
      <div class="card card-crawler">
        <div class="card-top">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2v4a4 4 0 0 0 8 0v-4h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"></path></svg>
            <span style="font-weight: 700; font-size: 15px; color: #fca5a5;">AI Crawler View (Raw SSR)</span>
          </div>
          <div style="display: flex; gap: 4px;">
            <span style="background: rgba(239, 68, 68, 0.2); color: #f87171; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">GPTBot</span>
            <span style="background: rgba(239, 68, 68, 0.2); color: #f87171; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">Perplexity</span>
          </div>
        </div>

        <div class="metric-row">
          <div class="metric-box">
            <div style="font-size: 24px; font-weight: 900; color: #ef4444;">142</div>
            <div style="font-size: 11px; color: #94a3b8; font-weight: 600;">SSR Words</div>
          </div>
          <div class="metric-box">
            <div style="font-size: 24px; font-weight: 900; color: #ef4444;">0</div>
            <div style="font-size: 11px; color: #94a3b8; font-weight: 600;">Schemas</div>
          </div>
          <div class="metric-box">
            <div style="font-size: 24px; font-weight: 900; color: #f59e0b;">1</div>
            <div style="font-size: 11px; color: #94a3b8; font-weight: 600;">H1 Only</div>
          </div>
        </div>

        <div class="code-window font-mono">
          <div style="color: #64748b; font-size: 10px; margin-bottom: 6px;">&lt;!-- Raw HTTP Response Payload (No JavaScript executed) --&gt;</div>
          <div style="color: #94a3b8;">&lt;<span style="color: #f87171;">div</span> <span style="color: #38bdf8;">id</span>=<span style="color: #fde047;">"__next"</span>&gt;</div>
          <div style="color: #94a3b8; padding-left: 14px;">&lt;<span style="color: #f87171;">div</span> <span style="color: #38bdf8;">class</span>=<span style="color: #fde047;">"skeleton-loader"</span>&gt;Loading app...&lt;/<span style="color: #f87171;">div</span>&gt;</div>
          <div style="color: #94a3b8; padding-left: 14px;">&lt;<span style="color: #f87171;">script</span> <span style="color: #38bdf8;">src</span>=<span style="color: #fde047;">"/static/chunks/app.js"</span> <span style="color: #38bdf8;">defer</span>&gt;&lt;/<span style="color: #f87171;">script</span>&gt;</div>
          <div style="color: #94a3b8;">&lt;/<span style="color: #f87171;">div</span>&gt;</div>
          <div style="margin-top: 10px; color: #f87171; font-size: 11px; line-height: 1.4;">
            // Result: AI crawler exits before React hydrates dynamic content.
          </div>
        </div>

        <div class="alert-banner" style="background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444;">
          <div style="font-weight: 800; font-size: 13.5px; color: #ef4444; display: flex; align-items: center; gap: 6px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            ⚠️ JS Rendering Trap: 89% Content Missing Without JS
          </div>
          <div style="font-size: 12px; color: #fca5a5; margin-top: 4px;">
            AI Visibility Survival Rate: 11% · High risk of complete crawler omission
          </div>
        </div>
      </div>

      <div class="vs-circle">VS</div>

      <div class="card card-browser">
        <div class="card-top">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polygon points="12 8 8 12 12 16 12 8"></polygon><line x1="16" y1="12" x2="12" y2="12"></line></svg>
            <span style="font-weight: 700; font-size: 15px; color: #86efac;">Human Browser View (Hydrated DOM)</span>
          </div>
          <div style="display: flex; gap: 4px;">
            <span style="background: rgba(34, 197, 94, 0.2); color: #86efac; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">Chrome V8</span>
            <span style="background: rgba(34, 197, 94, 0.2); color: #86efac; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">Hydrated</span>
          </div>
        </div>

        <div class="metric-row">
          <div class="metric-box">
            <div style="font-size: 24px; font-weight: 900; color: #22c55e;">1,280</div>
            <div style="font-size: 11px; color: #94a3b8; font-weight: 600;">Live Words</div>
          </div>
          <div class="metric-box">
            <div style="font-size: 24px; font-weight: 900; color: #22c55e;">3</div>
            <div style="font-size: 11px; color: #94a3b8; font-weight: 600;">Valid Schemas</div>
          </div>
          <div class="metric-box">
            <div style="font-size: 24px; font-weight: 900; color: #22c55e;">14</div>
            <div style="font-size: 11px; color: #94a3b8; font-weight: 600;">H1-H3 Tree</div>
          </div>
        </div>

        <div class="code-window font-mono">
          <div style="color: #64748b; font-size: 10px; margin-bottom: 6px;">&lt;!-- Hydrated DOM Memory Model (After Client Execution) --&gt;</div>
          <div style="color: #94a3b8;">&lt;<span style="color: #86efac;">main</span> <span style="color: #38bdf8;">class</span>=<span style="color: #fde047;">"full-article"</span>&gt;</div>
          <div style="color: #94a3b8; padding-left: 14px;">&lt;<span style="color: #86efac;">h1</span>&gt;Comprehensive Guide to Modern GEO Architecture&lt;/<span style="color: #86efac;">h1</span>&gt;</div>
          <div style="color: #94a3b8; padding-left: 14px;">&lt;<span style="color: #86efac;">p</span>&gt;AI models prioritize direct, semantically structured answers...&lt;/<span style="color: #86efac;">p</span>&gt;</div>
          <div style="color: #94a3b8; padding-left: 14px;">&lt;<span style="color: #86efac;">script</span> <span style="color: #38bdf8;">type</span>=<span style="color: #fde047;">"application/ld+json"</span>&gt;{"@type":"Article",...}&lt;/<span style="color: #86efac;">script</span>&gt;</div>
          <div style="color: #94a3b8;">&lt;/<span style="color: #86efac;">main</span>&gt;</div>
          <div style="margin-top: 10px; color: #86efac; font-size: 11px; line-height: 1.4;">
            // Complete semantic graph available to human users and desktop engines.
          </div>
        </div>

        <div class="alert-banner" style="background: rgba(34, 197, 94, 0.15); border: 1px solid #22c55e;">
          <div style="font-weight: 800; font-size: 13.5px; color: #22c55e; display: flex; align-items: center; gap: 6px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            ✅ Full DOM Architecture Verified
          </div>
          <div style="font-size: 12px; color: #86efac; margin-top: 4px;">
            Remediation: Pre-render critical AI content via SSG or edge dynamic rendering
          </div>
        </div>
      </div>
    </div>

    <div class="bottom-bar">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 700; color: #f8fafc;">GeoScore Dual-Track Differential Engine:</span>
        <span style="color: #94a3b8;">Compares raw fetch() payload against document.body in real time.</span>
      </div>
      <div style="display: flex; gap: 8px;">
        <span style="background: rgba(59, 130, 246, 0.2); color: #38bdf8; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px;">Automatic Diff Metric</span>
        <span style="background: rgba(34, 197, 94, 0.2); color: #22c55e; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px;">1-Click SSG Export</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function templateScreenshot3() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${getCommonCss(1280, 800)}
    .canvas {
      width: 1280px;
      height: 800px;
      padding: 36px 44px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      background: radial-gradient(circle at 75% 25%, rgba(59, 130, 246, 0.1) 0%, transparent 45%),
                  radial-gradient(circle at 25% 75%, rgba(239, 68, 68, 0.08) 0%, transparent 45%),
                  #0f172a;
    }
    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(14, 165, 233, 0.15);
      border: 1px solid rgba(14, 165, 233, 0.35);
      color: #38bdf8;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 9999px;
      margin-bottom: 8px;
    }
    .main-title {
      font-size: 34px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #f8fafc;
      line-height: 1.2;
    }
    .main-subtitle {
      font-size: 14.5px;
      color: #94a3b8;
      margin-top: 6px;
    }
    .main-content {
      display: flex;
      gap: 24px;
      margin-top: 18px;
      flex: 1;
    }
    .mock-webpage {
      flex: 1.4;
      background: #0b1320;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }
    .browser-bar {
      height: 38px;
      background: #1e293b;
      border-bottom: 1px solid rgba(148, 163, 184, 0.15);
      padding: 0 14px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .url-pill {
      background: #0f172a;
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 6px;
      padding: 3px 12px;
      font-size: 11px;
      color: #94a3b8;
      flex: 1;
      max-width: 380px;
    }
    .xray-action-bar {
      background: #101c30;
      border-bottom: 1px solid rgba(14, 165, 233, 0.3);
      padding: 8px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
    }
    .page-body {
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow: hidden;
      flex: 1;
    }
    .xray-target {
      position: relative;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .xray-tag {
      position: absolute;
      top: -10px;
      left: 12px;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    }
    .sidepanel-col {
      flex: 1;
      background: #1e293b;
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 14px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    .finding-card {
      background: #0f172a;
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="top-header">
      <div>
        <div class="badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          In-Page Diagnostics
        </div>
        <h1 class="main-title">
          In-Page X-Ray Live DOM Visualizer
        </h1>
        <p class="main-subtitle">
          Pinpoint exact GEO violations and semantic gaps visually directly on your live webpage layout.
        </p>
      </div>
      <div style="background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 8px; padding: 6px 14px; font-size: 12px; color: #86efac; font-weight: 700;">
        Active Overlay Mode
      </div>
    </div>

    <div class="main-content">
      <div class="mock-webpage">
        <div class="browser-bar">
          <div style="display: flex; gap: 6px;">
            <span style="width: 10px; height: 10px; border-radius: 9999px; background: #ef4444;"></span>
            <span style="width: 10px; height: 10px; border-radius: 9999px; background: #f59e0b;"></span>
            <span style="width: 10px; height: 10px; border-radius: 9999px; background: #22c55e;"></span>
          </div>
          <div class="url-pill font-mono">
            https://example.com/tutorials/ai-search-readiness
          </div>
        </div>

        <div class="xray-action-bar">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 800; color: #38bdf8;">🩻 In-Page X-Ray:</span>
            <span style="color: #cbd5e1; font-weight: 600;">2 Violations Highlighted</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <span style="background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">Clear X-Ray</span>
            <span style="background: #22c55e; color: #0f172a; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 800;">Fix in DOM</span>
          </div>
        </div>

        <div class="page-body">
          <div class="xray-target" style="border: 2px dashed #ef4444; background: rgba(239, 68, 68, 0.08);">
            <div class="xray-tag" style="background: #ef4444; color: white;">#1 &lt;h1&gt; Missing Question Format</div>
            <div style="font-size: 20px; font-weight: 800; color: #f8fafc; margin-top: 4px;">
              Enterprise Architecture Guide for AI Search Engines
            </div>
            <div style="font-size: 12px; color: #fca5a5; margin-top: 6px; line-height: 1.4;">
              💡 Suggestion: Rephrase as a direct question heading ("How Do Enterprise Systems Optimize for AI Search?") for answer extraction.
            </div>
          </div>

          <p style="font-size: 13px; color: #94a3b8; line-height: 1.5;">
            Generative answering engines extract information based on query-to-answer semantic symmetry. Plain statement headers often lose priority to direct conversational answer blocks.
          </p>

          <div class="xray-target" style="border: 2px dashed #f59e0b; background: rgba(245, 158, 11, 0.08);">
            <div class="xray-tag" style="background: #f59e0b; color: #0f172a;">#2 &lt;img&gt; Missing Alt Text</div>
            <div style="display: flex; gap: 14px; align-items: center; margin-top: 4px;">
              <div style="width: 64px; height: 50px; background: rgba(245, 158, 11, 0.2); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #f59e0b; font-size: 18px;">
                🖼️
              </div>
              <div style="flex: 1;">
                <div style="font-size: 13px; font-weight: 700; color: #fde68a;">Architecture Diagram (No Alt Attribute)</div>
                <div style="font-size: 11.5px; color: #cbd5e1; margin-top: 2px;">
                  Multimodal LLMs (ChatGPT Vision, Gemini) cannot interpret this asset without descriptive metadata.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="sidepanel-col">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-weight: 800; font-size: 14px; color: #f8fafc;">Diagnostic Findings</span>
            <span style="background: rgba(239, 68, 68, 0.15); color: #f87171; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">3 Issues Found</span>
          </div>

          <div class="finding-card" style="border-left: 3px solid #ef4444;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 12px; font-weight: 700; color: #fca5a5;">Soft 404 Detected</span>
              <span style="font-size: 9px; font-weight: 800; background: #ef4444; color: white; padding: 1px 5px; border-radius: 3px;">CRITICAL</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px; line-height: 1.35;">
              /llms.txt returned HTTP 200 with HTML SPA shell instead of raw text/markdown.
            </div>
            <div style="margin-top: 8px;">
              <span style="background: rgba(59, 130, 246, 0.15); color: #38bdf8; font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 4px; cursor: pointer;">🔍 Highlight in Page</span>
            </div>
          </div>

          <div class="finding-card" style="border-left: 3px solid #ef4444;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 12px; font-weight: 700; color: #fca5a5;">H1 Query Format Gap</span>
              <span style="font-size: 9px; font-weight: 800; background: #ef4444; color: white; padding: 1px 5px; border-radius: 3px;">HIGH</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px; line-height: 1.35;">
              Main header lacks conversational natural query format for answer extraction.
            </div>
            <div style="margin-top: 8px;">
              <span style="background: rgba(59, 130, 246, 0.15); color: #38bdf8; font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 4px; cursor: pointer;">🔍 Highlight in Page</span>
            </div>
          </div>

          <div class="finding-card" style="border-left: 3px solid #f59e0b;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-size: 12px; font-weight: 700; color: #fde68a;">Missing Diagram Alt Text</span>
              <span style="font-size: 9px; font-weight: 800; background: #f59e0b; color: #0f172a; padding: 1px 5px; border-radius: 3px;">MED</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px; line-height: 1.35;">
              Image asset lacks alt attribute and schema.org caption markup.
            </div>
            <div style="margin-top: 8px;">
              <span style="background: rgba(59, 130, 246, 0.15); color: #38bdf8; font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 4px; cursor: pointer;">🔍 Highlight in Page</span>
            </div>
          </div>
        </div>

        <div style="background: linear-gradient(135deg, #3b82f6, #22c55e); color: white; padding: 10px; border-radius: 8px; text-align: center; font-size: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
          ⚡ Auto-Generate Page Fixes
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function templateScreenshot4() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${getCommonCss(1280, 800)}
    .canvas {
      width: 1280px;
      height: 800px;
      padding: 36px 44px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      background: radial-gradient(circle at 85% 15%, rgba(34, 197, 94, 0.1) 0%, transparent 45%),
                  radial-gradient(circle at 15% 85%, rgba(59, 130, 246, 0.1) 0%, transparent 45%),
                  #0f172a;
    }
    .top-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 12px;
      padding: 10px 18px;
    }
    .host-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #f1f5f9;
    }
    .diff-badge {
      background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
      color: white;
      padding: 8px 18px;
      border-radius: 9999px;
      font-size: 18px;
      font-weight: 900;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.35);
    }
    .main-grid {
      display: flex;
      gap: 24px;
      margin-top: 18px;
      flex: 1;
    }
    .left-panel {
      width: 440px;
      background: #1e293b;
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 16px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    .right-editor {
      flex: 1;
      background: #090d16;
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }
    .editor-header {
      height: 42px;
      background: #0f172a;
      border-bottom: 1px solid rgba(148, 163, 184, 0.15);
      padding: 0 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .editor-body {
      padding: 20px;
      font-size: 13.5px;
      line-height: 1.6;
      color: #e2e8f0;
      overflow: hidden;
      flex: 1;
    }
    .toast-pill {
      background: rgba(34, 197, 94, 0.2);
      border: 1px solid #22c55e;
      color: #86efac;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 14px 20px;
    }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="top-strip">
      <div class="host-badge font-mono">
        <span style="width: 8px; height: 8px; border-radius: 9999px; background: #22c55e; box-shadow: 0 0 8px #22c55e;"></span>
        http://localhost:3000
        <span style="background: rgba(34, 197, 94, 0.15); color: #22c55e; font-size: 11px; padding: 2px 8px; border-radius: 4px; margin-left: 6px;">Localhost Mode</span>
      </div>
      <div class="diff-badge">
        <span>64 ➔ 88 (+24 pts) 🎉</span>
      </div>
      <div style="font-size: 12px; color: #94a3b8;">
        Newly Fixed: <span style="color: #f1f5f9; font-weight: 600;">llms.txt · JSON-LD · GPTBot Allow</span>
      </div>
    </div>

    <div class="main-grid">
      <div class="left-panel">
        <div>
          <div style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">
            Developer Closed-Loop Workflow
          </div>
          <div style="font-size: 22px; font-weight: 800; color: #f8fafc; margin-top: 4px;">
            Instant AI Prompts
          </div>
          <p style="font-size: 13px; color: #94a3b8; margin-top: 6px; line-height: 1.4;">
            Audit local pre-production builds with zero permissions. Turn diagnostic findings into structured instructions for your AI editor.
          </p>

          <div style="margin-top: 18px; display: flex; flex-direction: column; gap: 10px;">
            <div style="background: #0f172a; border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 8px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; color: #cbd5e1; font-weight: 600;">Port 3000 (Next.js App)</span>
              <span style="color: #22c55e; font-size: 12px; font-weight: 800;">✓ Connected</span>
            </div>
            <div style="background: #0f172a; border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 8px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; color: #cbd5e1; font-weight: 600;">Schema Organization Injected</span>
              <span style="color: #22c55e; font-size: 12px; font-weight: 800;">✓ Verified</span>
            </div>
            <div style="background: #0f172a; border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 8px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; color: #cbd5e1; font-weight: 600;">robots.txt AI Crawlers Allowed</span>
              <span style="color: #22c55e; font-size: 12px; font-weight: 800;">✓ Verified</span>
            </div>
          </div>
        </div>

        <div style="background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.35); border-radius: 12px; padding: 16px;">
          <div style="font-size: 13px; font-weight: 800; color: #60a5fa; margin-bottom: 6px;">
            🤖 Copy Fix Prompt for Cursor / Claude Code
          </div>
          <div style="font-size: 11.5px; color: #cbd5e1; line-height: 1.4;">
            Generates standardized, context-aware markdown instructions with exact project file targets.
          </div>
          <div style="margin-top: 12px; background: linear-gradient(135deg, #3b82f6, #22c55e); color: white; padding: 9px; border-radius: 8px; text-align: center; font-size: 12.5px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);">
            Copy Prompt to Clipboard
          </div>
        </div>
      </div>

      <div class="right-editor">
        <div class="editor-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="display: flex; gap: 5px;">
              <span style="width: 10px; height: 10px; border-radius: 9999px; background: #ef4444;"></span>
              <span style="width: 10px; height: 10px; border-radius: 9999px; background: #f59e0b;"></span>
              <span style="width: 10px; height: 10px; border-radius: 9999px; background: #22c55e;"></span>
            </div>
            <span class="font-mono" style="font-size: 12px; color: #cbd5e1; font-weight: 600; margin-left: 8px;">fix-localhost-geo.md — Cursor Composer</span>
          </div>
          <span style="background: rgba(34, 197, 94, 0.15); color: #22c55e; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">Markdown Ready</span>
        </div>

        <div class="editor-body font-mono">
          <div style="color: #60a5fa; font-weight: 700;"># Fix GeoScore Recommendations for http://localhost:3000</div>
          <div style="color: #94a3b8;">Audit Diff: <span style="color: #22c55e;">64/100 ➔ 88/100 (+24 pts)</span></div>
          <br>
          <div style="color: #e2e8f0;">Please apply the following 3 high-impact GEO remediations:</div>
          <br>
          <div style="color: #fde047;">1. Create \`/public/llms.txt\`:</div>
          <div style="color: #94a3b8; padding-left: 16px;">- Add concise project summary, API endpoints, and clean markdown paths.</div>
          <div style="color: #94a3b8; padding-left: 16px;">- Follow the official llms.txt standard specification.</div>
          <br>
          <div style="color: #fde047;">2. Inject Organization JSON-LD in \`app/layout.tsx\`:</div>
          <div style="color: #94a3b8; padding-left: 16px;">- Set "@type": "Organization", "name": "GeoScore", "url": "http://localhost:3000"</div>
          <div style="color: #94a3b8; padding-left: 16px;">- Include social links and logo url for brand authority.</div>
          <br>
          <div style="color: #fde047;">3. Update \`public/robots.txt\`:</div>
          <div style="color: #94a3b8; padding-left: 16px;">- User-agent: GPTBot / Allow: /</div>
          <div style="color: #94a3b8; padding-left: 16px;">- User-agent: PerplexityBot / Allow: /</div>
        </div>

        <div class="toast-pill">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Prompt copied to clipboard! Paste directly into Cursor Composer (Cmd+I) or Claude Code.
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function templateScreenshot5() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${getCommonCss(1280, 800)}
    .canvas {
      width: 1280px;
      height: 800px;
      padding: 36px 44px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      background: radial-gradient(circle at 10% 20%, rgba(59, 130, 246, 0.1) 0%, transparent 45%),
                  radial-gradient(circle at 90% 80%, rgba(34, 197, 94, 0.1) 0%, transparent 45%),
                  #0f172a;
    }
    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.35);
      color: #86efac;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 9999px;
      margin-bottom: 8px;
    }
    .main-title {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #f8fafc;
      line-height: 1.2;
    }
    .main-subtitle {
      font-size: 14px;
      color: #94a3b8;
      margin-top: 4px;
    }
    .ecosystem-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 14px;
      margin-top: 14px;
    }
    .eco-card {
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 12px;
      padding: 12px 14px;
    }
    .bilingual-split {
      display: flex;
      gap: 20px;
      margin-top: 14px;
      flex: 1;
    }
    .lang-card {
      flex: 1;
      background: #1e293b;
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 14px;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 15px 30px rgba(0, 0, 0, 0.35);
    }
    .footer-bar {
      margin-top: 14px;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 10px;
      padding: 10px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="top-header">
      <div>
        <div class="badge">
          ✦ Open Source GEO Ecosystem
        </div>
        <h1 class="main-title">
          Unified GEO Engine Across All Your Tools
        </h1>
        <p class="main-subtitle">
          Complete open-source developer toolkit for AI Search Optimization: Web, Chrome MV3, CLI, and MCP.
        </p>
      </div>
      <div style="background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; padding: 6px 14px; font-size: 12px; color: #60a5fa; font-weight: 700;">
        Bilingual Support · English &amp; 简体中文
      </div>
    </div>

    <div class="ecosystem-row">
      <div class="eco-card">
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; color: #f8fafc;">
          <span>🌐 Web App</span>
        </div>
        <div class="font-mono" style="font-size: 12px; color: #38bdf8; margin-top: 4px; font-weight: 600;">geoscore.help</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Instant web audits &amp; reports</div>
      </div>
      <div class="eco-card">
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; color: #f8fafc;">
          <span>🧩 Extension</span>
        </div>
        <div class="font-mono" style="font-size: 12px; color: #22c55e; margin-top: 4px; font-weight: 600;">Manifest V3</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Side Panel &amp; DOM X-Ray</div>
      </div>
      <div class="eco-card">
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; color: #f8fafc;">
          <span>⚡ Zero-Dep CLI</span>
        </div>
        <div class="font-mono" style="font-size: 11px; color: #fde047; margin-top: 4px; font-weight: 600;">npx geoscore</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">CI/CD &amp; Git hooks ready</div>
      </div>
      <div class="eco-card">
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; color: #f8fafc;">
          <span>🤖 MCP Server</span>
        </div>
        <div class="font-mono" style="font-size: 12px; color: #c084fc; margin-top: 4px; font-weight: 600;">geoscore-mcp</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Claude &amp; Cursor agent tool</div>
      </div>
    </div>

    <div class="bilingual-split">
      <div class="lang-card" style="border-top: 3px solid #3b82f6;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-weight: 800; font-size: 14px; color: #f8fafc;">English Interface</span>
            <span style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px;">GLOBAL VERSION</span>
          </div>

          <div style="background: #0f172a; border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 10px; padding: 12px 14px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 20px; font-weight: 900; color: #22c55e;">92 / 100</div>
                <div style="font-size: 10.5px; color: #94a3b8;">Overall AI Readiness</div>
              </div>
              <span style="background: rgba(34, 197, 94, 0.2); color: #22c55e; font-size: 10px; font-weight: 800; padding: 3px 6px; border-radius: 4px;">EXCELLENT</span>
            </div>
          </div>

          <div style="font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 8px;">Key Verification Checks (11 Dimensions · 85 Checks):</div>
          <div style="display: flex; flex-direction: column; gap: 7px; font-size: 11.5px; color: #94a3b8;">
            <div style="color: #e2e8f0;">✓ Semantic Architecture &amp; Citations (96%)</div>
            <div style="color: #e2e8f0;">✓ AI Crawlability &amp; robots.txt (100%)</div>
            <div style="color: #e2e8f0;">✓ Schema.org Structured Data (92%)</div>
            <div style="color: #e2e8f0;">✓ llms.txt Specification Standard (88%)</div>
            <div style="color: #e2e8f0;">✓ SSR vs CSR AI Visibility Survival (100%)</div>
            <div style="color: #e2e8f0;">✓ Prompt Injection &amp; Negative Signal Guard (Pass)</div>
          </div>
          <div style="margin-top: 12px; background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 8px; padding: 9px 12px; font-size: 11px; color: #93c5fd;">
            🤖 Cursor / Claude Fix Prompt &amp; In-Page X-Ray Highlights Ready
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 14px;">
          <div style="flex: 1; background: #3b82f6; color: white; padding: 8px; border-radius: 6px; text-align: center; font-size: 11.5px; font-weight: 700;">Audit Active Tab</div>
          <div style="flex: 1; background: rgba(255, 255, 255, 0.08); color: #cbd5e1; padding: 8px; border-radius: 6px; text-align: center; font-size: 11.5px; font-weight: 600;">Export llms.txt</div>
        </div>
      </div>

      <div class="lang-card" style="border-top: 3px solid #22c55e;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-weight: 800; font-size: 14px; color: #f8fafc;">简体中文界面</span>
            <span style="background: rgba(34, 197, 94, 0.2); color: #86efac; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px;">母语本地化</span>
          </div>

          <div style="background: #0f172a; border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 10px; padding: 12px 14px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 20px; font-weight: 900; color: #22c55e;">92 / 100</div>
                <div style="font-size: 10.5px; color: #94a3b8;">整体 AI 搜索就绪度</div>
              </div>
              <span style="background: rgba(34, 197, 94, 0.2); color: #22c55e; font-size: 10px; font-weight: 800; padding: 3px 6px; border-radius: 4px;">极佳评分</span>
            </div>
          </div>

          <div style="font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 8px;">核心评估校验项（11 维度 · 85 项检查）：</div>
          <div style="display: flex; flex-direction: column; gap: 7px; font-size: 11.5px; color: #94a3b8;">
            <div style="color: #e2e8f0;">✓ 语义架构与 AI 引用率 (96%)</div>
            <div style="color: #e2e8f0;">✓ AI 爬虫可抓取性与 robots.txt (100%)</div>
            <div style="color: #e2e8f0;">✓ Schema.org 结构化数据 (92%)</div>
            <div style="color: #e2e8f0;">✓ llms.txt 规范完整度 (88%)</div>
            <div style="color: #e2e8f0;">✓ SSR vs CSR 渲染存活率检测 (100%)</div>
            <div style="color: #e2e8f0;">✓ Prompt 注入与负向信号安全检测 (通过)</div>
          </div>
          <div style="margin-top: 12px; background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(34, 197, 94, 0.25); border-radius: 8px; padding: 9px 12px; font-size: 11px; color: #86efac;">
            🤖 支持一键复制 Cursor / Claude 修复指令与网页 X-Ray 原位高亮
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 14px;">
          <div style="flex: 1; background: #22c55e; color: #0f172a; padding: 8px; border-radius: 6px; text-align: center; font-size: 11.5px; font-weight: 800;">检测当前页面</div>
          <div style="flex: 1; background: rgba(255, 255, 255, 0.08); color: #cbd5e1; padding: 8px; border-radius: 6px; text-align: center; font-size: 11.5px; font-weight: 600;">一键生成 llms.txt</div>
        </div>
      </div>
    </div>

    <div class="footer-bar">
      <div>MIT Open Source License · 100% Client-Side Privacy</div>
      <div style="display: flex; gap: 12px; font-weight: 600; color: #cbd5e1;">
        <span>ChatGPT Ready</span> ·
        <span>Perplexity Ready</span> ·
        <span>Claude Ready</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function templatePromoTile() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${getCommonCss(440, 280)}
    .canvas {
      width: 440px;
      height: 280px;
      padding: 24px 26px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      background: radial-gradient(circle at 15% 20%, rgba(34, 197, 94, 0.22) 0%, transparent 60%),
                  radial-gradient(circle at 85% 80%, rgba(59, 130, 246, 0.22) 0%, transparent 60%),
                  #0f172a;
      border: 1px solid rgba(148, 163, 184, 0.25);
    }
    .top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logo-badge {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .icon-cube {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #22c55e 0%, #3b82f6 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 16px;
      color: white;
      box-shadow: 0 0 16px rgba(34, 197, 94, 0.4);
    }
    .brand-name {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #f8fafc;
    }
    .score-badge {
      border: 2px solid #22c55e;
      background: rgba(34, 197, 94, 0.15);
      border-radius: 9999px;
      padding: 3px 10px;
      font-weight: 900;
      font-size: 14px;
      color: #22c55e;
      display: flex;
      align-items: center;
      gap: 4px;
      box-shadow: 0 0 12px rgba(34, 197, 94, 0.25);
    }
    .hero-title {
      font-size: 34px;
      font-weight: 900;
      line-height: 1.15;
      letter-spacing: -0.8px;
      color: #f8fafc;
      margin: 8px 0;
    }
    .capsule-row {
      display: flex;
      gap: 8px;
    }
    .capsule {
      flex: 1;
      text-align: center;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.2px;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="top-row">
      <div class="logo-badge">
        <div class="icon-cube">G</div>
        <span class="brand-name">GeoScore</span>
      </div>
      <div class="score-badge">
        <span>85</span>
        <span style="font-size: 10px; opacity: 0.85;">CHECKS</span>
      </div>
    </div>

    <div class="hero-title">
      AI SEO &amp; GEO<br>
      <span class="gradient-text-hero">Auditor MV3</span>
    </div>

    <div class="capsule-row">
      <div class="capsule" style="background: rgba(255, 255, 255, 0.08); color: #f1f5f9; border: 1px solid rgba(255, 255, 255, 0.15);">
        11 Dimensions
      </div>
      <div class="capsule" style="background: rgba(34, 197, 94, 0.15); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.35);">
        SSR/CSR Diff
      </div>
      <div class="capsule" style="background: rgba(59, 130, 246, 0.15); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.35);">
        100% Local
      </div>
    </div>
  </div>
</body>
</html>`;
}

// 4. Asset Definitions
const ASSETS = [
  {
    filename: 'screenshot-1-hero-85-checks.png',
    width: 1280,
    height: 800,
    html: templateScreenshot1(),
    requiresNoChinese: true,
  },
  {
    filename: 'screenshot-2-ssr-vs-csr-diff.png',
    width: 1280,
    height: 800,
    html: templateScreenshot2(),
    requiresNoChinese: true,
  },
  {
    filename: 'screenshot-3-inpage-xray.png',
    width: 1280,
    height: 800,
    html: templateScreenshot3(),
    requiresNoChinese: true,
  },
  {
    filename: 'screenshot-4-cursor-prompt-localhost.png',
    width: 1280,
    height: 800,
    html: templateScreenshot4(),
    requiresNoChinese: true,
  },
  {
    filename: 'screenshot-5-ecosystem-bilingual.png',
    width: 1280,
    height: 800,
    html: templateScreenshot5(),
    requiresNoChinese: false, // Explicit bilingual showcase
  },
  {
    filename: 'promo-tile-440x280.png',
    width: 440,
    height: 280,
    html: templatePromoTile(),
    requiresNoChinese: true,
  },
];

// 5. Execution Pipeline
async function generateStoreAssets() {
  console.log('=== GeoScore Store Asset Generator ===');
  const browserPath = detectBrowserPath();
  console.log(`Detected browser: ${browserPath}`);

  if (!fs.existsSync(storeAssetsDir)) {
    fs.mkdirSync(storeAssetsDir, { recursive: true });
    console.log(`Created store-assets directory at ${storeAssetsDir}`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geoscore-store-'));
  console.log(`Using temporary render workspace: ${tempDir}`);

  try {
    for (const asset of ASSETS) {
      console.log(`\nRendering ${asset.filename} (${asset.width}x${asset.height})...`);

      // Verify Chinese characters rule for foreign store assets
      if (asset.requiresNoChinese) {
        const chineseMatch = asset.html.match(/[\u4e00-\u9fa5]/);
        if (chineseMatch) {
          throw new Error(`Localization violation: Found unexpected Chinese character '${chineseMatch[0]}' in foreign asset ${asset.filename}`);
        }
      }

      const tempHtmlPath = path.join(tempDir, `${asset.filename}.html`);
      const tempPngPath = path.join(tempDir, `${asset.filename}.raw.png`);
      const finalOutputPath = path.join(storeAssetsDir, asset.filename);

      fs.writeFileSync(tempHtmlPath, asset.html, 'utf-8');

      const fileUrl = 'file:///' + tempHtmlPath.replace(/\\/g, '/');
      const chromeArgs = [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--default-background-color=0f172a',
        `--window-size=${asset.width},${asset.height}`,
        `--screenshot=${tempPngPath}`,
        fileUrl,
      ];

      const renderRes = spawnSync(browserPath, chromeArgs, { stdio: 'pipe' });
      if (renderRes.status !== 0) {
        throw new Error(`Browser failed to render ${asset.filename}: ${renderRes.stderr?.toString() || 'Unknown error'}`);
      }

      if (!fs.existsSync(tempPngPath)) {
        throw new Error(`Browser did not output PNG file for ${asset.filename}`);
      }

      const rawBuffer = fs.readFileSync(tempPngPath);
      const rgb24Buffer = transcodeToRgb24Png(rawBuffer, '0f172a');

      fs.writeFileSync(finalOutputPath, rgb24Buffer);
      console.log(`✓ Generated and transcoded: ${finalOutputPath} (${rgb24Buffer.length} bytes)`);

      // Clean up temporary files for this asset
      if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);
      if (fs.existsSync(tempPngPath)) fs.unlinkSync(tempPngPath);
    }

    // 6. Strict IHDR Binary Header Validation
    console.log('\n=== Strict IHDR Binary Header Verification ===');
    const existingFiles = fs.readdirSync(storeAssetsDir);
    console.log(`Files found in store-assets/:`, existingFiles);

    if (existingFiles.length !== 6) {
      throw new Error(`Expected exactly 6 files in store-assets/, but found ${existingFiles.length}`);
    }

    for (const asset of ASSETS) {
      const filePath = path.join(storeAssetsDir, asset.filename);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Missing expected asset: ${asset.filename}`);
      }

      const buf = fs.readFileSync(filePath);
      if (buf.length < 33) {
        throw new Error(`${asset.filename}: File size too small (${buf.length} bytes)`);
      }

      // Check PNG signature
      const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      for (let i = 0; i < 8; i++) {
        if (buf[i] !== sig[i]) throw new Error(`${asset.filename}: Invalid PNG signature`);
      }

      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      const bitDepth = buf[24];
      const colorType = buf[25];

      console.log(`[VERIFY] ${asset.filename}:`);
      console.log(`  - Dimensions : ${width}x${height} (Expected: ${asset.width}x${asset.height})`);
      console.log(`  - Bit Depth  : ${bitDepth} (Expected: 8)`);
      console.log(`  - Color Type : ${colorType} (Expected: 2 = 24-bit RGB without Alpha)`);
      console.log(`  - File Size  : ${(buf.length / 1024).toFixed(1)} KB (${buf.length} bytes)`);

      if (width !== asset.width || height !== asset.height) {
        throw new Error(`${asset.filename}: Dimension mismatch: got ${width}x${height}, expected ${asset.width}x${asset.height}`);
      }
      if (bitDepth !== 8) {
        throw new Error(`${asset.filename}: Bit depth mismatch: got ${bitDepth}, expected 8`);
      }
      if (colorType !== 2) {
        throw new Error(`${asset.filename}: Color type mismatch: got ${colorType}, expected 2 (RGB24 without Alpha)`);
      }
    }

    console.log('\n🎉 ALL 6 STORE ASSETS VALIDATED SUCCESSFULLY! STRICT 24-BIT RGB (colorType=2) CONFIRMED.');
  } finally {
    // Clean up temporary workspace directory
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {
      // Ignore cleanup error
    }
  }
}

generateStoreAssets().catch((err) => {
  console.error('\n❌ Fatal error generating store assets:', err);
  process.exit(1);
});
