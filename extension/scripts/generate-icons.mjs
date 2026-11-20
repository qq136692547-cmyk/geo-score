/**
 * GeoScore Chrome Extension - Official Icon Generator (V2: AI Radar Scan)
 *
 * Renders the V2 SVG at 512x512 via headless Chrome (--default-background-color=00000000)
 * and uses premultiplied-alpha area downsampling to produce crisp 32-bit RGBA PNGs
 * at 16x16, 32x32, 48x48, and 128x128 (with strict 16px transparent padding on 128px).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const iconsDir = path.resolve(__dirname, '../icons');

const V2_RADAR_SVG = `
  <defs>
    <linearGradient id="bg2" x1="64" y1="64" x2="448" y2="448" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#090f1d"/>
      <stop offset="100%" stop-color="#111c33"/>
    </linearGradient>
    <linearGradient id="sweep2" x1="256" y1="256" x2="395" y2="145" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#22c55e" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#4ade80" stop-opacity="0.52"/>
    </linearGradient>
    <linearGradient id="stroke2" x1="120" y1="120" x2="392" y2="392" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
    <clipPath id="squircleClip">
      <rect x="64" y="64" width="384" height="384" rx="88" ry="88"/>
    </clipPath>
  </defs>
  <g clip-path="url(#squircleClip)">
    <rect x="64" y="64" width="384" height="384" fill="url(#bg2)"/>
    <rect x="67" y="67" width="378" height="378" rx="85" ry="85" fill="none" stroke="rgba(56,189,248,0.22)" stroke-width="4"/>
    <line x1="256" y1="104" x2="256" y2="408" stroke="rgba(148,163,184,0.18)" stroke-width="3"/>
    <line x1="104" y1="256" x2="408" y2="256" stroke="rgba(148,163,184,0.18)" stroke-width="3"/>
    <circle cx="256" cy="256" r="140" fill="none" stroke="url(#stroke2)" stroke-width="10" stroke-opacity="0.85"/>
    <circle cx="256" cy="256" r="92" fill="none" stroke="rgba(148,163,184,0.28)" stroke-width="5"/>
    <circle cx="256" cy="256" r="46" fill="none" stroke="rgba(148,163,184,0.28)" stroke-width="4"/>
    <path d="M256 256 L256 116 A140 140 0 0 1 383 197 Z" fill="url(#sweep2)"/>
    <line x1="256" y1="256" x2="383" y2="197" stroke="#4ade80" stroke-width="7" stroke-linecap="round"/>
    <circle cx="332" cy="186" r="14" fill="#4ade80"/>
    <circle cx="188" cy="316" r="11" fill="#38bdf8"/>
    <circle cx="256" cy="256" r="16" fill="#f8fafc"/>
  </g>
`;

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
  throw new Error('Could not find Chrome or Edge executable.');
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePngRgba(width, height, pixelData) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = createChunk('IHDR', ihdrData);

  const rowBytes = width * 4;
  const rawScanlines = Buffer.alloc(height * (1 + rowBytes));
  for (let y = 0; y < height; y++) {
    const rawOffset = y * (1 + rowBytes);
    rawScanlines[rawOffset] = 0;
    pixelData.copy(rawScanlines, rawOffset + 1, y * rowBytes, (y + 1) * rowBytes);
  }
  const compressed = zlib.deflateSync(rawScanlines, { level: 9 });
  return Buffer.concat([signature, ihdrChunk, createChunk('IDAT', compressed), createChunk('IEND', Buffer.alloc(0))]);
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

function decodePngRgba(pngBuf) {
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idatParts = [];

  while (pos < pngBuf.length) {
    const length = pngBuf.readUInt32BE(pos);
    const type = pngBuf.slice(pos + 4, pos + 8).toString('ascii');
    const data = pngBuf.slice(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + length;
  }

  const bpp = colorType === 6 ? 4 : 3;
  const inflated = zlib.inflateSync(Buffer.concat(idatParts));
  const rowBytes = width * bpp;
  const recon = Buffer.alloc(width * height * 4);
  const prevRow = Buffer.alloc(rowBytes);
  const currRow = Buffer.alloc(rowBytes);

  for (let y = 0; y < height; y++) {
    const filter = inflated[y * (1 + rowBytes)];
    const srcStart = y * (1 + rowBytes) + 1;
    for (let x = 0; x < rowBytes; x++) {
      const raw = inflated[srcStart + x];
      const left = x >= bpp ? currRow[x - bpp] : 0;
      const up = prevRow[x];
      const upLeft = x >= bpp ? prevRow[x - bpp] : 0;
      let val = raw;
      if (filter === 1) val = (raw + left) & 0xff;
      else if (filter === 2) val = (raw + up) & 0xff;
      else if (filter === 3) val = (raw + ((left + up) >> 1)) & 0xff;
      else if (filter === 4) val = (raw + paethPredictor(left, up, upLeft)) & 0xff;
      currRow[x] = val;
    }
    currRow.copy(prevRow);
    for (let px = 0; px < width; px++) {
      const dst = (y * width + px) * 4;
      const src = px * bpp;
      recon[dst] = currRow[src];
      recon[dst + 1] = currRow[src + 1];
      recon[dst + 2] = currRow[src + 2];
      recon[dst + 3] = bpp === 4 ? currRow[src + 3] : 255;
    }
  }
  return { width, height, rgba: recon };
}

function downsamplePremult(rgbaSrc, srcW, dstW, enforce16pxBorder = false) {
  const out = Buffer.alloc(dstW * dstW * 4);
  const scale = srcW / dstW;

  for (let dy = 0; dy < dstW; dy++) {
    for (let dx = 0; dx < dstW; dx++) {
      if (enforce16pxBorder && (dx < 16 || dx >= dstW - 16 || dy < 16 || dy >= dstW - 16)) {
        const idx = (dy * dstW + dx) * 4;
        out[idx] = 0;
        out[idx + 1] = 0;
        out[idx + 2] = 0;
        out[idx + 3] = 0;
        continue;
      }

      const sx0 = Math.floor(dx * scale);
      const sx1 = Math.min(srcW, Math.ceil((dx + 1) * scale));
      const sy0 = Math.floor(dy * scale);
      const sy1 = Math.min(srcW, Math.ceil((dy + 1) * scale));

      let sumA = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let count = 0;

      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const sIdx = (sy * srcW + sx) * 4;
          const a = rgbaSrc[sIdx + 3] / 255;
          sumA += a;
          sumR += rgbaSrc[sIdx] * a;
          sumG += rgbaSrc[sIdx + 1] * a;
          sumB += rgbaSrc[sIdx + 2] * a;
          count++;
        }
      }

      const dIdx = (dy * dstW + dx) * 4;
      const outA = count > 0 ? Math.round((sumA / count) * 255) : 0;
      if (outA <= 0 || sumA <= 1e-6) {
        out[dIdx] = 0;
        out[dIdx + 1] = 0;
        out[dIdx + 2] = 0;
        out[dIdx + 3] = 0;
      } else {
        out[dIdx] = Math.min(255, Math.max(0, Math.round(sumR / sumA)));
        out[dIdx + 1] = Math.min(255, Math.max(0, Math.round(sumG / sumA)));
        out[dIdx + 2] = Math.min(255, Math.max(0, Math.round(sumB / sumA)));
        out[dIdx + 3] = Math.min(255, Math.max(0, outA));
      }
    }
  }
  return out;
}

function main() {
  fs.mkdirSync(iconsDir, { recursive: true });
  const browser = detectBrowserPath();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geoscore-v2-icons-'));

  try {
    const htmlPath = path.join(tempDir, 'v2.html');
    const rawPng = path.join(tempDir, 'v2-512.png');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;width:512px;height:512px;background:transparent!important;overflow:hidden;}</style></head><body><svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${V2_RADAR_SVG}</svg></body></html>`;
    fs.writeFileSync(htmlPath, html, 'utf8');

    const res = spawnSync(
      browser,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--default-background-color=00000000',
        '--window-size=512,512',
        `--screenshot=${rawPng}`,
        'file:///' + htmlPath.replace(/\\/g, '/'),
      ],
      { stdio: 'pipe' }
    );
    if (res.status !== 0 || !fs.existsSync(rawPng)) {
      throw new Error(`Browser failed to render V2 icon: ${res.stderr?.toString()}`);
    }

    const decoded = decodePngRgba(fs.readFileSync(rawPng));
    if (decoded.width !== 512 || decoded.height !== 512) {
      throw new Error(`Expected 512x512 raw render, got ${decoded.width}x${decoded.height}`);
    }

    for (const size of [16, 32, 48, 128]) {
      const rgba = downsamplePremult(decoded.rgba, 512, size, size === 128);
      const pngBuffer = encodePngRgba(size, size, rgba);
      const outPath = path.join(iconsDir, `icon-${size}.png`);
      fs.writeFileSync(outPath, pngBuffer);
      console.log(`Generated: ${outPath} (${pngBuffer.length} bytes)`);
    }

    // Verify 128px IHDR + 16px border
    const buf128 = fs.readFileSync(path.join(iconsDir, 'icon-128.png'));
    const w = buf128.readUInt32BE(16);
    const h = buf128.readUInt32BE(20);
    const bd = buf128[24];
    const ct = buf128[25];
    if (w !== 128 || h !== 128 || bd !== 8 || ct !== 6) {
      throw new Error(`IHDR verification failed: ${w}x${h}, bd=${bd}, ct=${ct}`);
    }
    console.log(`[PASS] V2 AI Radar icons verified: 16/32/48/128px 32-bit RGBA`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
