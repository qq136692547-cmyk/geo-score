/**
 * Generate 4 high-craft 128x128 CWS Store Icon candidates (strict 32-bit RGBA,
 * centered 96x96 squircle with strict 16px transparent outer padding).
 *
 * Renders each SVG at 512x512 in headless Chrome with transparent background
 * (--default-background-color=00000000) and performs 4x4 premultiplied-alpha
 * downsampling to 128x128 for studio-grade anti-aliasing.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '..', 'store-assets', 'icon-candidates');

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

// CRC32 for PNG chunks
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
function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
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

  if (colorType !== 6 && colorType !== 2) {
    throw new Error(`Unsupported colorType ${colorType}`);
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

function downsample4xPremult(rgba512) {
  const srcW = 512;
  const dstW = 128;
  const out = Buffer.alloc(dstW * dstW * 4);

  for (let dy = 0; dy < dstW; dy++) {
    for (let dx = 0; dx < dstW; dx++) {
      // Enforce strict 16px transparent outer padding
      if (dx < 16 || dx >= 112 || dy < 16 || dy >= 112) {
        const idx = (dy * dstW + dx) * 4;
        out[idx] = 0;
        out[idx + 1] = 0;
        out[idx + 2] = 0;
        out[idx + 3] = 0;
        continue;
      }

      let sumA = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;

      for (let oy = 0; oy < 4; oy++) {
        for (let ox = 0; ox < 4; ox++) {
          const sx = dx * 4 + ox;
          const sy = dy * 4 + oy;
          const sIdx = (sy * srcW + sx) * 4;
          const a = rgba512[sIdx + 3] / 255;
          sumA += a;
          sumR += rgba512[sIdx] * a;
          sumG += rgba512[sIdx + 1] * a;
          sumB += rgba512[sIdx + 2] * a;
        }
      }

      const dIdx = (dy * dstW + dx) * 4;
      const outA = Math.round((sumA / 16) * 255);
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

function encodeRgbaPng(width, height, rgba) {
  const rowBytes = width * 4;
  const rawScanlines = Buffer.alloc(height * (1 + rowBytes));
  for (let y = 0; y < height; y++) {
    const rowOff = y * (1 + rowBytes);
    rawScanlines[rowOff] = 0; // Filter None
    rgba.copy(rawScanlines, rowOff + 1, y * rowBytes, (y + 1) * rowBytes);
  }
  const deflated = zlib.deflateSync(rawScanlines, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bitDepth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([sig, makeChunk('IHDR', ihdr), makeChunk('IDAT', deflated), makeChunk('IEND', Buffer.alloc(0))]);
}

function wrapHtml(svgContent) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 512px;
      height: 512px;
      background: transparent !important;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>
      <clipPath id="squircleClip">
        <rect x="64" y="64" width="384" height="384" rx="88" ry="88" />
      </clipPath>
    </defs>
    ${svgContent}
  </svg>
</body>
</html>`;
}

// 4 Studio-Grade Candidates (all strictly confined to 64..448 squircle inside 512x512)
const CANDIDATES = [
  {
    filename: 'icon-v1-score-gauge.png',
    label: 'V1: Dark Slate + Neon Score Gauge + Modern G',
    svg: `
      <defs>
        <linearGradient id="bg1" x1="64" y1="64" x2="448" y2="448" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#172554"/>
        </linearGradient>
        <radialGradient id="glow1" cx="256" cy="210" r="190" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#22c55e" stop-opacity="0.22"/>
          <stop offset="55%" stop-color="#3b82f6" stop-opacity="0.10"/>
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="ring1" x1="120" y1="120" x2="392" y2="392" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#4ade80"/>
          <stop offset="50%" stop-color="#22c55e"/>
          <stop offset="100%" stop-color="#38bdf8"/>
        </linearGradient>
      </defs>
      <g clip-path="url(#squircleClip)">
        <rect x="64" y="64" width="384" height="384" fill="url(#bg1)"/>
        <rect x="64" y="64" width="384" height="384" fill="url(#glow1)"/>
        <!-- Subtle inner glass border -->
        <rect x="67" y="67" width="378" height="378" rx="85" ry="85" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="4"/>
        <!-- Score Gauge Track -->
        <circle cx="256" cy="256" r="126" fill="none" stroke="rgba(148,163,184,0.16)" stroke-width="26"/>
        <!-- Score Gauge Arc (~82% arc) -->
        <circle cx="256" cy="256" r="126" fill="none" stroke="url(#ring1)" stroke-width="26"
          stroke-linecap="round" stroke-dasharray="630 800" transform="rotate(-118 256 256)"/>
        <!-- Sharp Geometric 'G' -->
        <path d="M294 218 C282 204 268 198 251 198 C218 198 194 222 194 256 C194 290 218 314 253 314 C283 314 304 296 308 268 L256 268"
          fill="none" stroke="#f8fafc" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- AI Sparkle Node at top-right of G -->
        <circle cx="322" cy="190" r="16" fill="#4ade80"/>
        <circle cx="322" cy="190" r="7" fill="#0f172a"/>
      </g>
    `,
  },
  {
    filename: 'icon-v2-ai-radar.png',
    label: 'V2: AI Radar Scan + Precision Target Nodes',
    svg: `
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
      </defs>
      <g clip-path="url(#squircleClip)">
        <rect x="64" y="64" width="384" height="384" fill="url(#bg2)"/>
        <rect x="67" y="67" width="378" height="378" rx="85" ry="85" fill="none" stroke="rgba(56,189,248,0.22)" stroke-width="4"/>
        <!-- Crosshairs -->
        <line x1="256" y1="104" x2="256" y2="408" stroke="rgba(148,163,184,0.18)" stroke-width="3"/>
        <line x1="104" y1="256" x2="408" y2="256" stroke="rgba(148,163,184,0.18)" stroke-width="3"/>
        <!-- Radar Rings -->
        <circle cx="256" cy="256" r="140" fill="none" stroke="url(#stroke2)" stroke-width="10" stroke-opacity="0.85"/>
        <circle cx="256" cy="256" r="92" fill="none" stroke="rgba(148,163,184,0.28)" stroke-width="5"/>
        <circle cx="256" cy="256" r="46" fill="none" stroke="rgba(148,163,184,0.28)" stroke-width="4"/>
        <!-- Radar Sweep Sector (0 deg to -65 deg) -->
        <path d="M256 256 L256 116 A140 140 0 0 1 383 197 Z" fill="url(#sweep2)"/>
        <line x1="256" y1="256" x2="383" y2="197" stroke="#4ade80" stroke-width="7" stroke-linecap="round"/>
        <!-- Detected AI Citation Targets -->
        <circle cx="332" cy="186" r="14" fill="#4ade80"/>
        <circle cx="188" cy="316" r="11" fill="#38bdf8"/>
        <!-- Core Hub -->
        <circle cx="256" cy="256" r="16" fill="#f8fafc"/>
      </g>
    `,
  },
  {
    filename: 'icon-v3-geo-gradient.png',
    label: 'V3: Vivid GEO Green-Blue Gradient + Bold White G Sparkle',
    svg: `
      <defs>
        <linearGradient id="bg3" x1="64" y1="64" x2="448" y2="448" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#16a34a"/>
          <stop offset="48%" stop-color="#0ea5e9"/>
          <stop offset="100%" stop-color="#2563eb"/>
        </linearGradient>
        <radialGradient id="shine3" cx="150" cy="130" r="280" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <g clip-path="url(#squircleClip)">
        <rect x="64" y="64" width="384" height="384" fill="url(#bg3)"/>
        <rect x="64" y="64" width="384" height="384" fill="url(#shine3)"/>
        <rect x="67" y="67" width="378" height="378" rx="85" ry="85" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="4"/>
        <!-- Bold High-Contrast White G Ring -->
        <path d="M312 184 C294 166 276 158 252 158 C194 158 152 200 152 256 C152 312 196 354 256 354 C310 354 348 318 352 266 L264 266"
          fill="none" stroke="#ffffff" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Crisp 4-point AI Star cleanly separated in upper-right -->
        <path d="M352 132 L360 156 L384 164 L360 172 L352 196 L344 172 L320 164 L344 156 Z" fill="#ffffff"/>
      </g>
    `,
  },
  {
    filename: 'icon-v4-xray-lens.png',
    label: 'V4: Dark Obsidian + X-Ray Magnifier + Pulse Check',
    svg: `
      <defs>
        <linearGradient id="bg4" x1="64" y1="64" x2="448" y2="448" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
        <linearGradient id="lens4" x1="130" y1="130" x2="360" y2="360" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#22c55e"/>
        </linearGradient>
      </defs>
      <g clip-path="url(#squircleClip)">
        <rect x="64" y="64" width="384" height="384" fill="url(#bg4)"/>
        <rect x="67" y="67" width="378" height="378" rx="85" ry="85" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="4"/>
        <!-- Subtle Code Grid Lines in Background -->
        <rect x="108" y="130" width="90" height="12" rx="6" fill="rgba(148,163,184,0.18)"/>
        <rect x="108" y="366" width="120" height="12" rx="6" fill="rgba(148,163,184,0.18)"/>
        <!-- Magnifying Lens Handle -->
        <line x1="308" y1="308" x2="386" y2="386" stroke="url(#lens4)" stroke-width="34" stroke-linecap="round"/>
        <!-- Lens Outer Circle -->
        <circle cx="234" cy="234" r="102" fill="#09111e" stroke="url(#lens4)" stroke-width="24"/>
        <!-- Check / Pulse inside Lens -->
        <path d="M188 238 L220 270 L282 198" fill="none" stroke="#4ade80" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- AI Sparkle Badge -->
        <path d="M356 124 L362 142 L380 148 L362 154 L356 172 L350 154 L332 148 L350 142 Z" fill="#38bdf8"/>
      </g>
    `,
  },
];

async function run() {
  const browser = detectBrowserPath();
  fs.mkdirSync(outDir, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geoscore-icons-'));

  try {
    for (const item of CANDIDATES) {
      const htmlPath = path.join(tempDir, `${item.filename}.html`);
      const rawPng = path.join(tempDir, `${item.filename}.raw.png`);
      const outPng = path.join(outDir, item.filename);

      fs.writeFileSync(htmlPath, wrapHtml(item.svg), 'utf8');
      const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
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
          fileUrl,
        ],
        { stdio: 'pipe' }
      );
      if (res.status !== 0 || !fs.existsSync(rawPng)) {
        throw new Error(`Failed rendering ${item.filename}: ${res.stderr?.toString()}`);
      }

      const decoded = decodePngRgba(fs.readFileSync(rawPng));
      if (decoded.width !== 512 || decoded.height !== 512) {
        throw new Error(`Expected 512x512 raw render, got ${decoded.width}x${decoded.height}`);
      }
      const downsampled = downsample4xPremult(decoded.rgba);
      const finalPng = encodeRgbaPng(128, 128, downsampled);
      fs.writeFileSync(outPng, finalPng);

      // Verify IHDR & strict 16px border alpha=0
      const w = finalPng.readUInt32BE(16);
      const h = finalPng.readUInt32BE(20);
      const bd = finalPng[24];
      const ct = finalPng[25];
      if (w !== 128 || h !== 128 || bd !== 8 || ct !== 6) {
        throw new Error(`IHDR verification failed for ${item.filename}`);
      }
      console.log(`✓ ${item.filename} (${finalPng.length} bytes, ${w}x${h}, colorType=${ct}) - ${item.label}`);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
