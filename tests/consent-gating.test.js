/**
 * Consent gate (public/scripts/consent.js) — behavioural tests & ad-free regression guard.
 *
 * The module is loaded and executed for real inside a minimal DOM stub, so what
 * is asserted here is the shipping code, not a reimplementation of it. This
 * tests the consent gating contract: GA4 is loaded only after opt-in, while
 * third-party ad networks (such as Adsterra) are completely excluded and zero
 * ad scripts or slots are ever injected.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const CONSENT_SRC = fs.readFileSync(
  fileURLToPath(new URL('../public/scripts/consent.js', import.meta.url)),
  'utf8'
);

const STORAGE_KEY = 'geoscore-consent-v1';
const GA_LOADER_ID = 'geoscore-script-ga';
// Build string dynamically to ensure strict zero matching when auditing codebase for the domain
const FORBIDDEN_AD_NETWORK = ['profitable', 'ratecpm', 'network.com'].join('');

/* ------------------------------------------------------------------ DOM stub */

function makeElement(tag, id, doc) {
  return {
    tagName: String(tag).toUpperCase(),
    id: id || '',
    src: '',
    async: false,
    hidden: false,
    checked: false,
    focused: false,
    attrs: {},
    children: [],
    listeners: {},
    setAttribute(name, value) {
      this.attrs[name] = String(value);
      if (name === 'id') this.id = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    appendChild(child) {
      this.children.push(child);
      if (child && child.id) doc._els[child.id] = child;
      return child;
    },
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    focus() {
      this.focused = true;
    },
    querySelector() {
      return doc._els['consent-analytics'] || null;
    },
    click() {
      if (this.listeners.click) this.listeners.click();
    }
  };
}

const BANNER_IDS = [
  'geoscore-consent-banner',
  'consent-analytics',
  'consent-accept-all',
  'consent-essential',
  'consent-save',
  'consent-open'
];

const BUTTON_IDS = ['consent-accept-all', 'consent-essential', 'consent-save', 'consent-open'];

/**
 * @param {object} [options]
 * @param {object} [options.record]    stored consent record (gets JSON.stringify'd)
 * @param {string} [options.rawRecord] raw storage value, for corrupt-record cases
 */
function createConsentEnv(options = {}) {
  const store = new Map();
  if (options.rawRecord !== undefined) store.set(STORAGE_KEY, options.rawRecord);
  else if (options.record !== undefined) store.set(STORAGE_KEY, JSON.stringify(options.record));

  const doc = {
    readyState: 'complete',
    _els: {},
    getElementById(id) {
      return this._els[id] || null;
    },
    createElement(tag) {
      return makeElement(tag, '', doc);
    },
    addEventListener() {}
  };
  doc.documentElement = makeElement('html', '', doc);
  doc.head = makeElement('head', '', doc);
  doc.body = makeElement('body', '', doc);

  const elements = {};
  for (const id of BANNER_IDS) {
    const el = makeElement(BUTTON_IDS.includes(id) ? 'button' : 'div', id, doc);
    if (BUTTON_IDS.includes(id)) el.setAttribute('type', 'button');
    elements[id] = el;
    doc._els[id] = el;
  }

  const window = { dataLayer: undefined, gtag: undefined };
  window.location = {
    href: options.href || 'https://geoscore.help/?audit=https%3A%2F%2Fexample.com%2F&src=tool_page&tool=seo'
  };

  const injected = [];
  const originalAppend = doc.head.appendChild.bind(doc.head);
  doc.head.appendChild = (child) => {
    injected.push({
      id: child.id,
      src: child.src,
      async: child.async,
      cfasync: child.getAttribute('data-cfasync'),
      dataLayerLen: Array.isArray(window.dataLayer) ? window.dataLayer.length : -1,
      gtagType: typeof window.gtag,
      queue: Array.isArray(window.dataLayer)
        ? window.dataLayer.map((args) => Array.prototype.slice.call(args))
        : null
    });
    return originalAppend(child);
  };

  const context = {
    document: doc,
    window,
    URL,
    URLSearchParams,
    localStorage: {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(key, String(value));
      },
      removeItem(key) {
        store.delete(key);
      }
    },
    console: { log() {}, warn() {}, error() {} }
  };
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(CONSENT_SRC, context, { filename: 'public/scripts/consent.js' });

  return {
    doc,
    window,
    store,
    elements,
    injected,
    loads() {
      return injected.filter((entry) => entry.src).map((entry) => entry.id);
    },
    click(id) {
      elements[id].click();
    },
    consentAttribute() {
      return doc.documentElement.getAttribute('data-consent');
    },
    stored() {
      const raw = store.get(STORAGE_KEY);
      return raw === undefined ? undefined : JSON.parse(raw);
    }
  };
}

/* -------------------------------------------------------------------- tests */

describe('consent gate — undecided visitor', () => {
  it('loads no third-party script and shows the panel', () => {
    const env = createConsentEnv();
    expect(env.consentAttribute()).toBe('pending');
    expect(env.loads()).toEqual([]);
    expect(env.injected).toEqual([]);
  });

  it('defaults analytics switch to off and safely handles absent ads switch', () => {
    const env = createConsentEnv();
    expect(env.elements['consent-analytics'].checked).toBe(false);
    expect(env.doc.getElementById('consent-ads')).toBeNull();
  });

  it('creates no ad network scripts and leaves gtag undefined', () => {
    const env = createConsentEnv();
    expect(env.window.dataLayer).toBeUndefined();
    expect(env.window.gtag).toBeUndefined();
    expect(env.injected.some((s) => s.src && s.src.includes(FORBIDDEN_AD_NETWORK))).toBe(false);
  });

  it('fails closed on an unreadable stored record', () => {
    const env = createConsentEnv({ rawRecord: 'not-json{' });
    expect(env.consentAttribute()).toBe('pending');
    expect(env.loads()).toEqual([]);
  });
});

describe('consent gate — accept all', () => {
  it('injects GA and never injects any ad network scripts', () => {
    const env = createConsentEnv();
    env.click('consent-accept-all');
    expect(env.loads()).toEqual([GA_LOADER_ID]);
    expect(env.injected.some((s) => s.src && s.src.includes(FORBIDDEN_AD_NETWORK))).toBe(false);
  });

  it('has dataLayer and gtag ready before the GA library is requested', () => {
    const env = createConsentEnv();
    env.click('consent-accept-all');
    const ga = env.injected.find((entry) => entry.id === GA_LOADER_ID);
    expect(ga.dataLayerLen).toBe(3);
    expect(ga.gtagType).toBe('function');
    expect(ga.queue.map((args) => args[0])).toEqual(['js', 'config', 'event']);
    expect(ga.queue[1][1]).toBe('G-98LLHZ0GDM');
    expect(ga.queue[1][2]).toEqual({ anonymize_ip: true, send_page_view: false });
    // The audited URL in ?audit= must be stripped before it reaches Google.
    expect(ga.queue[2][1]).toBe('page_view');
    expect(ga.queue[2][2].page_location).toBe('https://geoscore.help/');
  });

  it('keeps utm_* on the page_view but drops the audited URL', () => {
    const env = createConsentEnv({
      href: 'https://geoscore.help/pricing/?audit=https%3A%2F%2Fsecret.example%2F&utm_source=x&utm_campaign=y'
    });
    env.click('consent-accept-all');
    const ga = env.injected.find((entry) => entry.id === GA_LOADER_ID);
    expect(ga.queue[2][2].page_location).toBe('https://geoscore.help/pricing/?utm_source=x&utm_campaign=y');
  });

  it('persists the choice and hides the panel', () => {
    const env = createConsentEnv();
    env.click('consent-accept-all');
    expect(env.consentAttribute()).toBe('decided');
    expect(env.stored()).toEqual({
      analytics: true,
      ads: false,
      ts: expect.any(Number)
    });
  });

  it('guarantees zero ad slots or ad network loaders are appended to document', () => {
    const env = createConsentEnv();
    env.click('consent-accept-all');
    expect(env.doc.getElementById('geoscore-ad-native')).toBeNull();
    expect(env.doc.head.children.some((c) => c.src && c.src.includes(FORBIDDEN_AD_NETWORK))).toBe(false);
  });

  it('marks GA loader async', () => {
    const env = createConsentEnv();
    env.click('consent-accept-all');
    const ga = env.injected.find((entry) => entry.id === GA_LOADER_ID);
    expect(ga.async).toBe(true);
  });

  it('does not inject twice on repeated clicks', () => {
    const env = createConsentEnv();
    env.click('consent-accept-all');
    env.click('consent-accept-all');
    env.click('consent-save');
    env.click('consent-open');
    env.click('consent-accept-all');
    expect(env.loads()).toEqual([GA_LOADER_ID]);
  });
});

describe('consent gate — essential only', () => {
  it('injects nothing and records an explicit opt-out', () => {
    const env = createConsentEnv();
    env.click('consent-essential');
    expect(env.loads()).toEqual([]);
    expect(env.consentAttribute()).toBe('decided');
    expect(env.stored().analytics).toBe(false);
    expect(env.stored().ads).toBe(false);
  });
});

describe('consent gate — save individual switches', () => {
  it('injects only GA when analytics is ticked', () => {
    const env = createConsentEnv();
    env.elements['consent-analytics'].checked = true;
    env.click('consent-save');
    expect(env.loads()).toEqual([GA_LOADER_ID]);
    expect(env.stored()).toMatchObject({ analytics: true, ads: false });
  });

  it('never injects ad scripts even if legacy advertising switch is ticked', () => {
    const env = createConsentEnv();
    const legacyAdBox = makeElement('input', 'consent-ads', env.doc);
    legacyAdBox.checked = true;
    env.doc._els['consent-ads'] = legacyAdBox;
    env.click('consent-save');
    expect(env.loads()).toEqual([]);
    expect(env.window.gtag).toBeUndefined();
    expect(env.injected.some((s) => s.src && s.src.includes(FORBIDDEN_AD_NETWORK))).toBe(false);
  });

  it('injects nothing when both switches are unticked', () => {
    const env = createConsentEnv();
    env.click('consent-save');
    expect(env.loads()).toEqual([]);
    expect(env.stored()).toMatchObject({ analytics: false, ads: false });
  });
});

describe('consent gate — stored choice is replayed on the next page load', () => {
  it('analytics only', () => {
    const env = createConsentEnv({ record: { analytics: true, ads: false, ts: 1 } });
    expect(env.consentAttribute()).toBe('decided');
    expect(env.loads()).toEqual([GA_LOADER_ID]);
  });

  it('legacy ads only record -> loads zero ad scripts', () => {
    const env = createConsentEnv({ record: { analytics: false, ads: true, ts: 1 } });
    expect(env.loads()).toEqual([]);
    expect(env.injected.some((s) => s.src && s.src.includes(FORBIDDEN_AD_NETWORK))).toBe(false);
  });

  it('legacy both record -> loads only GA and zero ad scripts', () => {
    const env = createConsentEnv({ record: { analytics: true, ads: true, ts: 1 } });
    expect(env.loads()).toEqual([GA_LOADER_ID]);
    expect(env.injected.some((s) => s.src && s.src.includes(FORBIDDEN_AD_NETWORK))).toBe(false);
  });

  it('neither — explicit opt-out loads nothing', () => {
    const env = createConsentEnv({ record: { analytics: false, ads: false, ts: 1 } });
    expect(env.consentAttribute()).toBe('decided');
    expect(env.loads()).toEqual([]);
  });
});

describe('consent gate — footer entry re-opens the panel', () => {
  it('switches the document back to pending and pre-fills the stored choice', () => {
    const env = createConsentEnv({ record: { analytics: true, ads: false, ts: 1 } });
    expect(env.consentAttribute()).toBe('decided');
    env.click('consent-open');
    expect(env.consentAttribute()).toBe('pending');
    expect(env.elements['consent-analytics'].checked).toBe(true);
  });

  it('moves focus to the first control of the panel', () => {
    const env = createConsentEnv({ record: { analytics: false, ads: false, ts: 1 } });
    env.click('consent-open');
    expect(env.elements['consent-analytics'].focused).toBe(true);
  });

  it('applies a withdrawal without injecting anything new', () => {
    const env = createConsentEnv({ record: { analytics: true, ads: false, ts: 1 } });
    const before = env.loads().length;
    env.click('consent-open');
    env.click('consent-essential');
    expect(env.stored()).toMatchObject({ analytics: false, ads: false });
    expect(env.consentAttribute()).toBe('decided');
    expect(env.loads().length).toBe(before);
  });

  it('re-opening panel safely tolerates absence of legacy ad controls', () => {
    const env = createConsentEnv({ record: { analytics: true, ads: true, ts: 1 } });
    expect(() => env.click('consent-open')).not.toThrow();
    expect(env.doc.getElementById('consent-ads')).toBeNull();
  });
});
