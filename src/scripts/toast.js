/**
 * GeoScore toast notifications
 * Non-blocking replacement for the browser alert dialog.
 * showToast(message, type) where type is 'info' | 'success' | 'error'.
 * Messages stack; messages auto-dismiss (info/success ~5s, error ~8s).
 * Styling reuses the site design tokens and the existing .card class.
 */

var CONTAINER_ID = 'geoscore-toast-container';

var DURATIONS = { info: 5000, success: 5000, error: 8000 };

var ACCENTS = {
  info: 'var(--color-brand-400)',
  success: 'var(--color-geo-500)',
  error: 'var(--color-danger-400)'
};

function getContainer() {
  var host = document.getElementById(CONTAINER_ID);
  if (host) return host;
  host = document.createElement('div');
  host.id = CONTAINER_ID;
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  host.style.position = 'fixed';
  host.style.right = '1rem';
  host.style.bottom = '1rem';
  host.style.zIndex = '9999';
  host.style.display = 'flex';
  host.style.flexDirection = 'column';
  host.style.gap = '0.5rem';
  host.style.maxWidth = 'min(22rem, calc(100vw - 2rem))';
  host.style.pointerEvents = 'none';
  document.body.appendChild(host);
  return host;
}

export function showToast(message, type) {
  var kind = (type === 'success' || type === 'error') ? type : 'info';
  var host = getContainer();

  var el = document.createElement('div');
  el.className = 'card slide-up';
  el.style.padding = '0.75rem 1rem';
  el.style.display = 'flex';
  el.style.alignItems = 'flex-start';
  el.style.gap = '0.5rem';
  el.style.fontSize = '0.875rem';
  el.style.lineHeight = '1.4';
  el.style.color = 'var(--color-text-primary)';
  el.style.borderLeft = '2px solid ' + ACCENTS[kind];
  el.style.boxShadow = '0 8px 30px rgba(0,0,0,0.2)';
  el.style.pointerEvents = 'auto';

  if (kind === 'info') {
    el.appendChild(document.createTextNode(String(message == null ? '' : message)));
  } else {
    var mark = document.createElement('span');
    mark.textContent = kind === 'error' ? '\u2715' : '\u2713';
    mark.style.color = ACCENTS[kind];
    mark.style.flexShrink = '0';
    el.appendChild(mark);
    el.appendChild(document.createTextNode(String(message == null ? '' : message)));
  }

  host.appendChild(el);

  setTimeout(function() {
    el.style.transition = 'opacity 200ms ease, transform 200ms ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(function() {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 200);
  }, DURATIONS[kind]);
}
