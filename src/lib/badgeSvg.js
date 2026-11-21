/**
 * Pure SVG badge generator and domain validator for GeoScore live badges.
 * Zero Node or DOM dependencies.
 */

const RESERVED_SUFFIXES = [
  '.local',
  '.internal',
  '.arpa',
  '.localhost',
  '.test',
  '.invalid',
  '.example',
  '.onion',
  '.lan',
  '.corp',
  '.home',
];

const DOMAIN_RE =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.(?:[a-z]{2,63}|xn--[a-z0-9]{2,59})$/;

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function estimateSegmentWidth(text, minWidth) {
  const len = String(text || '').length;
  return Math.max(minWidth, Math.round(len * 6.8 + 14));
}

export function parseBadgeDomain(rawParam) {
  if (typeof rawParam !== 'string') return null;
  let host = rawParam.trim().replace(/\.svg$/i, '').toLowerCase();
  if (host.length < 4 || host.length > 253) return null;
  if (host === 'localhost') return null;
  if (!DOMAIN_RE.test(host)) return null;
  for (let i = 0; i < RESERVED_SUFFIXES.length; i++) {
    if (host.endsWith(RESERVED_SUFFIXES[i])) return null;
  }
  return host;
}

export function renderBadgeSvg({ score, level, status } = {}) {
  const leftText = 'GeoScore';
  let rightText = 'unavailable';
  let rightColor = '#64748b';

  if (status === 'invalid') {
    rightText = 'invalid';
    rightColor = '#64748b';
  } else if (status === 'unavailable' || typeof score !== 'number' || !Number.isFinite(score)) {
    rightText = 'unavailable';
    rightColor = '#64748b';
  } else {
    const rounded = Math.round(score);
    rightText = `${rounded}/100`;
    if (score >= 80) rightColor = '#16a34a';
    else if (score >= 60) rightColor = '#2563eb';
    else if (score >= 40) rightColor = '#ca8a04';
    else rightColor = '#dc2626';
  }

  const leftWidth = estimateSegmentWidth(leftText, 64);
  const rightWidth = estimateSegmentWidth(rightText, 50);
  const totalWidth = leftWidth + rightWidth;
  const leftCenter = (leftWidth / 2).toFixed(1);
  const rightCenter = (leftWidth + rightWidth / 2).toFixed(1);
  const label = level && rightColor !== '#64748b'
    ? `GeoScore: ${rightText} (${level})`
    : `GeoScore: ${rightText}`;

  const safeRightText = escapeXml(rightText);
  const safeLabel = escapeXml(label);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${safeLabel}">` +
      `<title>${safeLabel}</title>` +
      `<linearGradient id="s" x2="0" y2="100%">` +
        `<stop offset="0" stop-color="#bbb" stop-opacity=".1"/>` +
        `<stop offset="1" stop-opacity=".1"/>` +
      `</linearGradient>` +
      `<clipPath id="r">` +
        `<rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>` +
      `</clipPath>` +
      `<g clip-path="url(#r)">` +
        `<rect width="${leftWidth}" height="20" fill="#1e293b"/>` +
        `<rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${rightColor}"/>` +
        `<rect width="${totalWidth}" height="20" fill="url(#s)"/>` +
      `</g>` +
      `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">` +
        `<text aria-hidden="true" x="${leftCenter}" y="15" fill="#010101" fill-opacity=".3">${leftText}</text>` +
        `<text x="${leftCenter}" y="14">${leftText}</text>` +
        `<text aria-hidden="true" x="${rightCenter}" y="15" fill="#010101" fill-opacity=".3">${safeRightText}</text>` +
        `<text x="${rightCenter}" y="14">${safeRightText}</text>` +
      `</g>` +
    `</svg>`
  );
}

export function buildBadgeEmbedSnippets(host) {
  const cleanHost = parseBadgeDomain(host);
  if (!cleanHost) return null;
  const badgeUrl = `https://geoscore.help/badge/${cleanHost}.svg`;
  const auditUrl = `https://geoscore.help/?audit=${encodeURIComponent('https://' + cleanHost + '/')}`;
  return {
    badgeUrl,
    auditUrl,
    markdown: `[![GeoScore AI Readiness](${badgeUrl})](${auditUrl})`,
    html: `<a href="${auditUrl}" target="_blank" rel="noopener"><img src="${badgeUrl}" alt="GeoScore AI Readiness" height="20" /></a>`,
  };
}
