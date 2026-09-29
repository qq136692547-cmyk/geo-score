/**
 * Consent gate (public/scripts/consent.js) — behavioural tests.
 *
 * The module is loaded and executed for real inside a minimal DOM stub, so what
 * is asserted here is the shipping code, not a reimplementation of it. This
 * cannot prove that a browser actually fetches/executes the injected <script>
 * elements, but it does pin the gating contract: which loaders are created, in
 * which order, with which stored state, and that none of them are created
 * before an opt-in exists.
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
const AD_WRAPPER_ID = 'geoscore-ad-native';
const NATIVE_LOADER_ID = 'geoscore-script-ad-native';
const SOCIAL_LOADER_ID = 'geoscore-script-ad-social';
const GA_LOADER_ID = 'geoscore-script-ga';

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
      // Browsers make an appended element reachable by id — the module's
      // duplicate guard relies on that, so the stub must behave the same.
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
      // First control in document order inside the banner.
      return doc._els['consent-analytics'] || null;
    },
    click() {
      if (this.listeners.click) this.listeners.click();
    }
  };
}

const BANNER_IDS = [
  'geoscore-consent-banner',
  AD_WRAPPER_ID,
  'container-817fcedcc7910b47268adaf373773c40',
  'consent-analytics',
  'consent-ads',
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
  // Mirror the markup: the ad slot is server-rendered with the `hidden` attribute.
  elements[AD_WRAPPER_ID].hidden = true;
  elements[AD_WRAPPER_ID].setAttribute('hidden', '');

  const window = { dataLayer: undefined, gtag: undefined };

  // Record the queue state at the exact moment each loader is appended, so the
  // "gtag is ready before the library is requested" contract is provable.
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
    // Silence the module in case it ever decides to log.
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

  it('defaults both switches to off', () => {
    const env = createConsentEnv();
    expect(env.elements['consent-analytics'].checked).toBe(false);
    expect(env.elements['consent-ads'].checked).toBe(false);
  });

  it('keeps the ad slot hidden and leaves gtag undefined', () => {
    const env = createConsentEnv();
    expect(env.elements[AD_WRAPPER_ID].hidden).toBe(true);
    expect(env.window.dataLayer).toBeUndefined();
    expect(env.window.gtag).toBeUndefined();
  });

  it('fails closed on an unreadable stored record', () => {
    const env = createConsentEnv({ rawRecord: 'not-json{' });
    expect(env.consentAttribute()).toBe('pending');
    expect(env.loads()).toEqual([]);
  });
});

describe('consent gate — accept all', () => {
  it('injects GA then both ad loaders, in that order', () => {
    const env = createConsentEnv();
    env.click('consent-accept-all');
    expect(env.loads()).toEqual([GA_LOADER_ID, NATIVE_LOADER_ID, SOCIAL_LOADER_ID]);
  });

  it('has dataLayer and gtag ready before the GA library is requested', () => {
    const env = createConsentEnv();
    env.click('consent-accept-all');
    const ga = env.injected.find((entry) => entry.id === GA_LOADER_ID);
    expect(ga.dataLayerLen).toBe(2);
    expect(ga.gtagType).toBe('function');
    expect(ga.queue.map((args) => args[0])).toEqual(['js', 'config']);
    expect(ga.queue[1][1]).toBe('G-98LLHZ0GDM');
    expect(ga.queue[1][2]).toEqual({ anonymize_ip: true });
  });

  it('persists the choice and hides the panel', () => {
    const env = createConsentEnv();
    env.click('consent-accept-all');
    expect(env.consentAttribute()).toBe('decided');
    expect(env.stored()).toEqual({
      analytics: true,
      ads: true,
      ts: expect.any(Number)
    });
  });

  it('reveals the ad slot before the ad loader runs', () => {
    const env = createConsentEnv();
    env.click('consent-accept-all');
    expect(env.elements[AD_WRAPPER_ID].hidden).toBe(false);
  });

  it('marks both loaders async and keeps data-cfasync on the native one', () => {
    const env = createConsentEnv();
    env.click('consent-accept-all');
    const native = env.injected.find((entry) => entry.id === NATIVE_LOADER_ID);
    const social = env.injected.find((entry) => entry.id === SOCIAL_LOADER_ID);
    expect(native.async).toBe(true);
    expect(social.async).toBe(true);
    expect(native.cfasync).toBe('false');
  });

  it('never reuses a markup id for an injected script (duplicate-guard regression)', () => {
    // Regression: the native loader was once given id="geoscore-ad-native",
    // the same id as the ad wrapper div, so injectScript()'s getElementById
    // guard treated it as already present and the loader was silently skipped.
    const env = createConsentEnv();
    env.click('consent-accept-all');
    const ids = env.injected.map((entry) => entry.id);
    expect(ids).toContain(NATIVE_LOADER_ID);
    expect(ids).not.toContain(AD_WRAPPER_ID);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not inject twice on repeated clicks', () => {
    const env = createConsentEnv();
    env.click('consent-accept-all');
    env.click('consent-accept-all');
    env.click('consent-save');
    env.click('consent-open');
    env.click('consent-accept-all');
    expect(env.loads()).toEqual([GA_LOADER_ID, NATIVE_LOADER_ID, SOCIAL_LOADER_ID]);
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
    expect(env.elements[AD_WRAPPER_ID].hidden).toBe(true);
  });
});

describe('consent gate — save individual switches', () => {
  it('injects only GA when analytics is ticked', () => {
    const env = createConsentEnv();
    env.elements['consent-analytics'].checked = true;
    env.click('consent-save');
    expect(env.loads()).toEqual([GA_LOADER_ID]);
    expect(env.stored()).toMatchObject({ analytics: true, ads: false });
    expect(env.elements[AD_WRAPPER_ID].hidden).toBe(true);
  });

  it('injects only the ad loaders when advertising is ticked', () => {
    const env = createConsentEnv();
    env.elements['consent-ads'].checked = true;
    env.click('consent-save');
    expect(env.loads()).toEqual([NATIVE_LOADER_ID, SOCIAL_LOADER_ID]);
    expect(env.window.gtag).toBeUndefined();
    expect(env.stored()).toMatchObject({ analytics: false, ads: true });
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
    expect(env.elements[AD_WRAPPER_ID].hidden).toBe(true);
  });

  it('ads only', () => {
    const env = createConsentEnv({ record: { analytics: false, ads: true, ts: 1 } });
    expect(env.loads()).toEqual([NATIVE_LOADER_ID, SOCIAL_LOADER_ID]);
    expect(env.elements[AD_WRAPPER_ID].hidden).toBe(false);
  });

  it('both', () => {
    const env = createConsentEnv({ record: { analytics: true, ads: true, ts: 1 } });
    expect(env.loads()).toEqual([GA_LOADER_ID, NATIVE_LOADER_ID, SOCIAL_LOADER_ID]);
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
    expect(env.elements['consent-ads'].checked).toBe(false);
  });

  it('moves focus to the first control of the panel', () => {
    const env = createConsentEnv({ record: { analytics: false, ads: true, ts: 1 } });
    env.click('consent-open');
    expect(env.elements['consent-analytics'].focused).toBe(true);
  });

  it('applies a withdrawal without injecting anything new', () => {
    const env = createConsentEnv({ record: { analytics: true, ads: true, ts: 1 } });
    const before = env.loads().length;
    env.click('consent-open');
    env.click('consent-essential');
    expect(env.stored()).toMatchObject({ analytics: false, ads: false });
    expect(env.consentAttribute()).toBe('decided');
    expect(env.loads().length).toBe(before);
  });
});
