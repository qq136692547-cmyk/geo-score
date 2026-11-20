/**
 * GeoScore Chrome Extension - Content Script
 *
 * Runs inside the web page context to perform:
 * 1. CSR DOM extraction & same-origin endpoint fetching (with 401/403/SSO auth fallback)
 * 2. In-Page X-Ray DOM inspection & Shadow DOM overlay highlighting
 */

export function safePathname(urlString) {
  try {
    return new URL(urlString, 'http://localhost').pathname;
  } catch {
    return '';
  }
}

export function headersObj(headers) {
  const result = {};
  if (!headers) return result;
  if (typeof headers.forEach === 'function') {
    headers.forEach((val, key) => {
      result[String(key).toLowerCase()] = val;
    });
  } else if (typeof headers.entries === 'function') {
    for (const [key, val] of headers.entries()) {
      result[String(key).toLowerCase()] = val;
    }
  } else if (typeof headers === 'object') {
    for (const key of Object.keys(headers)) {
      result[String(key).toLowerCase()] = headers[key];
    }
  }
  return result;
}

export function extractContentPageUrl(html, origin) {
  if (!html) return origin + '/about';
  const patterns = [
    /href=["'](\/[^"']*(?:blog|review|article|post|news|guide)\/[^"']*)["']/i,
    /href=["'](\/[^"']*(?:blog|review|article|post|news|guide)["'])/i,
  ];
  for (let i = 0; i < patterns.length; i++) {
    const match = html.match(patterns[i]);
    if (match && match[1]) {
      const href = match[1].replace(/["']$/, '');
      if (href.startsWith('/')) return origin + href;
      if (href.startsWith('http') && href.includes(origin)) return href;
    }
  }
  return origin + '/about';
}

export async function fetchSameOrigin(targetUrl, { timeoutMs = 6000 } = {}) {
  let usedAuthFallback = false;
  try {
    let signal;
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      try {
        signal = AbortSignal.timeout(timeoutMs);
      } catch {}
    }
    if (!signal) {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), timeoutMs);
      signal = ctrl.signal;
    }

    let res = await fetch(targetUrl, {
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'follow',
      signal,
    });

    const pathname = safePathname(res.url);
    const winPathname = typeof window !== 'undefined' && window.location ? window.location.pathname : '';
    const isLoginRedirect = Boolean(
      res.redirected &&
      /\/(login|signin|sign-in|auth|sso)\b/i.test(pathname) &&
      !/\/(login|signin|sign-in|auth|sso)\b/i.test(winPathname)
    );

    if ((!res.ok && (res.status === 401 || res.status === 403)) || isLoginRedirect) {
      let retrySignal;
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        try {
          retrySignal = AbortSignal.timeout(timeoutMs);
        } catch {}
      }
      if (!retrySignal) {
        const retryCtrl = new AbortController();
        setTimeout(() => retryCtrl.abort(), timeoutMs);
        retrySignal = retryCtrl.signal;
      }

      res = await fetch(targetUrl, {
        credentials: 'include',
        cache: 'no-store',
        redirect: 'follow',
        signal: retrySignal,
      });
      usedAuthFallback = true;
    }

    const contentType = res.headers && typeof res.headers.get === 'function'
      ? (res.headers.get('content-type') || '')
      : '';
    const body = typeof res.text === 'function' ? await res.text() : '';

    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url,
      contentType,
      headers: headersObj(res.headers),
      body,
      usedAuthFallback,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      finalUrl: targetUrl,
      contentType: '',
      headers: {},
      body: null,
      usedAuthFallback,
      error: err ? err.message : 'Network error',
    };
  }
}

export async function collectGeoData() {
  const csrHtml = typeof document !== 'undefined' && document.documentElement
    ? document.documentElement.outerHTML
    : '';
  const url = typeof window !== 'undefined' && window.location ? window.location.href : '';
  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
  const title = typeof document !== 'undefined' ? (document.title || '') : '';

  const [ssr, robots, llms, sitemap, aiTxt, aiSummary, aiFaq, about] = await Promise.all([
    fetchSameOrigin(url, { timeoutMs: 7000 }),
    fetchSameOrigin(`${origin}/robots.txt`, { timeoutMs: 6000 }),
    fetchSameOrigin(`${origin}/llms.txt`, { timeoutMs: 6000 }),
    fetchSameOrigin(`${origin}/sitemap.xml`, { timeoutMs: 6000 }),
    fetchSameOrigin(`${origin}/.well-known/ai.txt`, { timeoutMs: 6000 }),
    fetchSameOrigin(`${origin}/ai/summary.json`, { timeoutMs: 6000 }),
    fetchSameOrigin(`${origin}/ai/faq.json`, { timeoutMs: 6000 }),
    fetchSameOrigin(`${origin}/about`, { timeoutMs: 3000 }),
  ]);

  const candidateHtml = (ssr && ssr.ok && ssr.body) ? ssr.body : csrHtml;
  const contentPageUrl = extractContentPageUrl(candidateHtml, origin);

  let content;
  if (contentPageUrl && contentPageUrl !== `${origin}/about` && contentPageUrl !== url) {
    content = await fetchSameOrigin(contentPageUrl, { timeoutMs: 3000 });
  } else {
    content = about;
  }

  return {
    url,
    origin,
    title,
    csrHtml,
    ssr,
    endpoints: {
      robots,
      llms,
      sitemap,
      aiTxt,
      aiSummary,
      aiFaq,
      about,
      content,
    },
  };
}

export function queryTargetElements(target = {}) {
  if (typeof document === 'undefined') return [];

  const checkId = (target.checkId || '').toLowerCase();
  const dimKey = (target.dimensionKey || '').toLowerCase();

  let elements = [];

  if (checkId.includes('question-headings') || checkId.includes('question') || checkId.includes('faq')) {
    elements = Array.from(document.querySelectorAll('h2, h3'));
  } else if (checkId === 'h1' || checkId.includes('heading') || checkId.includes('mixed-signals')) {
    elements = Array.from(document.querySelectorAll('h1'));
    if (elements.length === 0) {
      elements = Array.from(document.querySelectorAll('main, header, body')).slice(0, 3);
    }
  } else if (checkId.includes('images-alt') || checkId.includes('img') || checkId.includes('alt')) {
    elements = Array.from(document.querySelectorAll('img:not([alt]), img[alt=""]'));
  } else if (checkId.includes('passage-density') || checkId.includes('wordcount') || checkId.includes('thin-content')) {
    const ps = Array.from(document.querySelectorAll('main p, article p, p'));
    elements = ps.sort((a, b) => (b.textContent || '').length - (a.textContent || '').length).slice(0, 12);
  } else if (checkId.includes('blockquote-count') || checkId.includes('cite-tags') || checkId.includes('citation')) {
    elements = Array.from(document.querySelectorAll('blockquote, cite, main p, article p'));
  } else if (checkId.includes('lists') || checkId.includes('data-tables') || checkId.includes('table')) {
    elements = Array.from(document.querySelectorAll('ul, ol, table, main, article'));
  } else if (checkId.includes('excessive-cta') || checkId.includes('cta')) {
    const ctaRe = /buy now|sign up|subscribe|get started|shop now|free trial|contact us/i;
    const candidates = Array.from(document.querySelectorAll('a, button'));
    elements = candidates.filter((el) => ctaRe.test(el.textContent || ''));
  } else if (checkId.includes('popup') || checkId.includes('dialog') || checkId.includes('modal')) {
    elements = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"], .modal, .popup'));
  } else if (checkId.includes('broken-links') || checkId.includes('link')) {
    elements = Array.from(document.querySelectorAll('a[href="#"], a[href^="javascript:"], a[href=""]'));
  } else if (
    checkId.includes('hidden-text') ||
    checkId.includes('system-instructions') ||
    checkId.includes('ignore-instructions') ||
    checkId.includes('promptinjection') ||
    dimKey.includes('promptinjection')
  ) {
    const all = Array.from(document.querySelectorAll('*'));
    elements = all.filter((el) => {
      if (el.id === 'geoscore-xray-host') return false;
      const style = el.getAttribute('style') || '';
      const isHiddenStyle = /display\s*:\s*none/i.test(style) ||
                            /visibility\s*:\s*hidden/i.test(style) ||
                            /font-size\s*:\s*0/i.test(style);
      const textLen = (el.textContent || '').trim().length;
      return isHiddenStyle && textLen > 30;
    });
  } else if (
    checkId.includes('author') ||
    checkId.includes('timestamp') ||
    checkId.includes('trust-pages') ||
    checkId.includes('accessibility-aria') ||
    checkId.includes('metasocial') ||
    checkId.includes('structureddata') ||
    dimKey.includes('eeat') ||
    dimKey.includes('brand') ||
    dimKey.includes('freshness')
  ) {
    elements = Array.from(document.querySelectorAll('time, [rel="author"], header, nav, main, footer'));
  } else {
    elements = Array.from(document.querySelectorAll('h1, h2, main, article'));
  }

  return elements.slice(0, 12);
}

export function clearXRayHost() {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('geoscore-xray-host');
  if (existing) {
    existing.remove();
  }
}

export function renderXRayHost(target = {}, elements = []) {
  if (typeof document === 'undefined') return;
  clearXRayHost();

  const isZh = Boolean(target.isZh);
  const titleText = target.label || target.checkId || (isZh ? 'DOM 检查项' : 'DOM Check');
  const count = elements.length;

  const host = document.createElement('div');
  host.id = 'geoscore-xray-host';
  host.style.position = 'absolute';
  host.style.top = '0';
  host.style.left = '0';
  host.style.width = '100%';
  host.style.height = '100%';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '2147483647';

  const shadow = host.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .xray-bar {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      color: #f8fafc;
      padding: 10px 18px;
      border-radius: 9999px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
      border: 1px solid rgba(255,255,255,0.2);
      pointer-events: auto;
      z-index: 2147483647;
      animation: xray-fade-in 0.25s ease-out;
    }
    .xray-badge {
      background: #ef4444;
      color: #ffffff;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
    }
    .xray-btn {
      background: rgba(255,255,255,0.15);
      border: none;
      color: #f1f5f9;
      cursor: pointer;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      transition: background 0.15s;
    }
    .xray-btn:hover {
      background: rgba(255,255,255,0.3);
    }
    .xray-box {
      position: absolute;
      border: 2px solid #ef4444;
      background: rgba(239, 68, 68, 0.15);
      border-radius: 4px;
      pointer-events: none;
      z-index: 2147483640;
      box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
      transition: all 0.2s ease-in-out;
    }
    .xray-tag {
      position: absolute;
      top: -20px;
      left: -2px;
      background: #ef4444;
      color: white;
      font-size: 11px;
      font-family: sans-serif;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 3px;
      white-space: nowrap;
    }
    .xray-warning-banner {
      position: fixed;
      top: 64px;
      left: 50%;
      transform: translateX(-50%);
      background: #7f1d1d;
      color: #fef2f2;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-family: sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      pointer-events: auto;
      max-width: 90vw;
      text-align: center;
      border: 1px solid #f87171;
    }
    @keyframes xray-fade-in {
      from { opacity: 0; transform: translate(-50%, -10px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }
  `;
  shadow.appendChild(styleEl);

  const bar = document.createElement('div');
  bar.className = 'xray-bar';

  const titleSpan = document.createElement('span');
  titleSpan.textContent = `X-Ray: ${titleText}`;

  const countSpan = document.createElement('span');
  countSpan.className = 'xray-badge';
  countSpan.textContent = `${count} ${isZh ? '处' : 'found'}`;

  const clearBtn = document.createElement('button');
  clearBtn.className = 'xray-btn';
  clearBtn.textContent = isZh ? '✕ 清除高亮' : '✕ Clear X-Ray';
  if (typeof clearBtn.addEventListener === 'function') {
    clearBtn.addEventListener('click', () => clearXRayHost());
  } else {
    clearBtn.onclick = () => clearXRayHost();
  }

  bar.appendChild(titleSpan);
  bar.appendChild(countSpan);
  bar.appendChild(clearBtn);
  shadow.appendChild(bar);

  let hasHiddenWarning = false;
  const hiddenSelectors = [];

  const scrollX = typeof window !== 'undefined' ? (window.scrollX || window.pageXOffset || 0) : 0;
  const scrollY = typeof window !== 'undefined' ? (window.scrollY || window.pageYOffset || 0) : 0;

  elements.forEach((el, index) => {
    let rect = { top: 0, left: 0, width: 0, height: 0 };
    if (typeof el.getBoundingClientRect === 'function') {
      rect = el.getBoundingClientRect();
    }
    const isZeroSize = rect.width === 0 && rect.height === 0;

    if (isZeroSize) {
      hasHiddenWarning = true;
      const tag = el.tagName ? el.tagName.toLowerCase() : 'element';
      const idStr = el.id ? `#${el.id}` : '';
      const clsStr = el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/)[0]}` : '';
      hiddenSelectors.push(`${tag}${idStr}${clsStr}`);
      return;
    }

    const box = document.createElement('div');
    box.className = 'xray-box';
    box.style.top = `${rect.top + scrollY}px`;
    box.style.left = `${rect.left + scrollX}px`;
    box.style.width = `${Math.max(rect.width, 10)}px`;
    box.style.height = `${Math.max(rect.height, 10)}px`;

    const tagEl = document.createElement('div');
    tagEl.className = 'xray-tag';
    const tag = el.tagName ? el.tagName.toLowerCase() : 'el';
    tagEl.textContent = `#${index + 1} <${tag}>`;
    box.appendChild(tagEl);

    shadow.appendChild(box);
  });

  if (hasHiddenWarning) {
    const warnBanner = document.createElement('div');
    warnBanner.className = 'xray-warning-banner';
    warnBanner.textContent = isZh
      ? `⚠️ 发现不可见的隐藏注入/隐藏文本节点：${hiddenSelectors.slice(0, 3).join(', ')}`
      : `⚠️ Detected hidden injected/invisible DOM nodes: ${hiddenSelectors.slice(0, 3).join(', ')}`;
    shadow.appendChild(warnBanner);
  }

  if (document.body) {
    document.body.appendChild(host);
  }

  if (elements.length > 0 && typeof elements[0].scrollIntoView === 'function') {
    try {
      elements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {}
  }
}

export function handleXRayHighlight(target) {
  const elements = queryTargetElements(target);
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      renderXRayHost(target, elements);
    });
  } else {
    renderXRayHost(target, elements);
  }
  return { ok: true, matchedCount: elements.length };
}

// Idempotent registration inside Chrome extension environment
if (typeof window !== 'undefined') {
  if (window.__geoscoreContentLoaded) {
    // Already loaded, do not re-register message listeners
  } else {
    window.__geoscoreContentLoaded = true;
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (!msg || !msg.type) return;

        if (msg.type === 'COLLECT_GEO_DATA') {
          collectGeoData()
            .then((payload) => {
              sendResponse({ ok: true, payload });
            })
            .catch((err) => {
              sendResponse({ ok: false, error: err ? err.message : 'Collection error' });
            });
          return true; // Keep message channel open for async response
        }

        if (msg.type === 'XRAY_HIGHLIGHT') {
          const res = handleXRayHighlight(msg.target);
          sendResponse(res);
          return false;
        }

        if (msg.type === 'XRAY_CLEAR') {
          clearXRayHost();
          sendResponse({ ok: true });
          return false;
        }
      });
    }
  }
}
