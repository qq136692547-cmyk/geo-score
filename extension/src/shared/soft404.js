/**
 * GeoScore Chrome Extension - Soft 404 & SPA Fallback Detector
 *
 * Detects servers returning HTTP 200 with HTML/SPA shells for non-HTML endpoints
 * (e.g. /robots.txt, /llms.txt, /.well-known/ai.txt, /sitemap.xml, /ai/summary.json).
 */

const HTML_CONTENT_TYPE_RE = /text\/html|application\/xhtml\+xml/i;
const HTML_MARKERS_RE = /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<div\s+id=["'](?:root|__next|app)["']/i;

export function inspectFetchedResource({
  url = '',
  status = 200,
  ok = true,
  contentType = '',
  body = '',
  expectedType = 'text',
} = {}) {
  const isHttpOk = (status >= 200 && status < 300) || Boolean(ok);
  const textBody = typeof body === 'string' ? body : (body ? String(body) : '');
  const trimmed = textBody.trim();

  // If HTTP request failed with non-2xx status
  if (!isHttpOk) {
    return {
      url,
      expectedType,
      status,
      isSoft404: false,
      valid: false,
      cleanBody: null,
      reason: `HTTP status ${status}`,
      data: null,
    };
  }

  // Check 1: HTML Content-Type on non-HTML resource
  const hasHtmlContentType = HTML_CONTENT_TYPE_RE.test(contentType || '');

  // Check 2: Body contains HTML / SPA shell markers
  const hasHtmlBodyMarkers = HTML_MARKERS_RE.test(trimmed);

  // Check 3: SPA fallback with scripts and empty text
  const isSpaShell = hasHtmlBodyMarkers || (
    trimmed.includes('<script') &&
    trimmed.includes('</script>') &&
    !trimmed.includes('User-agent:') &&
    !trimmed.includes('<urlset') &&
    !trimmed.includes('<sitemapindex') &&
    (trimmed.includes('<div') || trimmed.includes('<title'))
  );

  if (hasHtmlContentType || hasHtmlBodyMarkers || isSpaShell) {
    return {
      url,
      expectedType,
      status,
      isSoft404: true,
      valid: false,
      cleanBody: null,
      reason: hasHtmlContentType
        ? `Server returned HTML Content-Type (${contentType}) for ${expectedType}`
        : `Server returned 200 OK with HTML/SPA shell instead of ${expectedType}`,
      data: null,
    };
  }

  // Type-specific structural checks
  if (expectedType === 'json') {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed !== null && typeof parsed === 'object') {
        return {
          url,
          expectedType,
          status,
          isSoft404: false,
          valid: true,
          cleanBody: trimmed,
          reason: null,
          data: parsed,
        };
      }
      return {
        url,
        expectedType,
        status,
        isSoft404: false,
        valid: false,
        cleanBody: null,
        reason: 'JSON parsed to non-object primitive',
        data: null,
      };
    } catch (err) {
      return {
        url,
        expectedType,
        status,
        isSoft404: false,
        valid: false,
        cleanBody: null,
        reason: `Invalid JSON syntax: ${err.message}`,
        data: null,
      };
    }
  }

  if (expectedType === 'xml') {
    const isXmlTagPresent = /<urlset|<sitemapindex|<\?xml/i.test(trimmed);
    if (isXmlTagPresent) {
      return {
        url,
        expectedType,
        status,
        isSoft404: false,
        valid: true,
        cleanBody: trimmed,
        reason: null,
        data: null,
      };
    }
    return {
      url,
      expectedType,
      status,
      isSoft404: false,
      valid: false,
      cleanBody: null,
      reason: 'Missing expected XML/Sitemap root tags (<urlset, <sitemapindex, or <?xml)',
      data: null,
    };
  }

  // robots, llms, aitxt, text
  return {
    url,
    expectedType,
    status,
    isSoft404: false,
    valid: true,
    cleanBody: trimmed,
    reason: null,
    data: null,
  };
}
