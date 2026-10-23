/**
 * GeoScore consent gate (M4-b)
 *
 * Nothing from a third party is requested until the visitor says so. The GA4
 * library and both Adsterra loaders used to sit in the page as eager
 * <script async src> tags; they are now created here and only after the
 * matching consent flag is true.
 *
 * Two pieces work together:
 *   1. a tiny inline script in <head> flips <html data-consent> to "pending"
 *      or "decided" before first paint, so the banner never flashes, and
 *   2. this file, which owns the stored state, the banner wiring and the
 *      script injection.
 *
 * The banner markup and all of its copy live in the two Layouts (rendered
 * per language), so there is no second i18n system in here — this module
 * carries no user-facing strings at all.
 *
 * Storage: localStorage["geoscore-consent-v1"] = {"analytics":bool,"ads":bool,"ts":number}
 * Key absent = undecided = show the banner and load nothing.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'geoscore-consent-v1';
  var GA_ID = 'G-98LLHZ0GDM';

  // Third-party endpoints, injected only after the matching consent flag.
  var GA_SRC = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  var AD_NATIVE_SRC = 'https://pl31399123.profitableratecpmnetwork.com/817fcedcc7910b47268adaf373773c40/invoke.js';
  var AD_SOCIAL_SRC = 'https://pl31398814.profitableratecpmnetwork.com/46/04/d0/4604d02cf773095b4a63e7ac55239136.js';

  var NATIVE_WRAPPER_ID = 'geoscore-ad-native';
  var NATIVE_SLOT_ID = 'container-817fcedcc7910b47268adaf373773c40';

  // Ids of the <script> elements this module creates. They are deliberately
  // different from every markup id (e.g. the ad wrapper is "geoscore-ad-native"),
  // because injectScript() dedupes on getElementById.
  var GA_SCRIPT_ID = 'geoscore-script-ga';
  var AD_NATIVE_SCRIPT_ID = 'geoscore-script-ad-native';
  var AD_SOCIAL_SCRIPT_ID = 'geoscore-script-ad-social';

  var analyticsLoaded = false;
  var adsLoaded = false;

  function readStored() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        analytics: parsed.analytics === true,
        ads: parsed.ads === true,
        ts: typeof parsed.ts === 'number' ? parsed.ts : 0
      };
    } catch (e) {
      return null;
    }
  }

  function store(analytics, ads) {
    var state = { analytics: analytics === true, ads: ads === true, ts: new Date().getTime() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* private mode / storage disabled: the choice still applies to this page */
    }
    window.__geoscoreConsent = { decided: true, analytics: state.analytics, ads: state.ads };
    return state;
  }

  function setBannerVisible(visible) {
    document.documentElement.setAttribute('data-consent', visible ? 'pending' : 'decided');
  }

  function markDecidedInDocument() {
    // The banner is server-rendered; only CSS (html[data-consent="pending"])
    // decides whether it is on screen.
    document.documentElement.setAttribute('data-consent', 'decided');
  }

  function injectScript(id, src, extraAttr, onload) {
    if (document.getElementById(id)) {
      // The tag is already there, so no load event will fire for it. Call the
      // callback anyway -- a cached script is already "loaded" from the page's
      // point of view, and skipping it would strand whatever the caller queued.
      if (onload) { try { onload(); } catch (e) { } }
      return;
    }
    var el = document.createElement('script');
    el.id = id;
    el.async = true;
    el.src = src;
    if (extraAttr) {
      for (var key in extraAttr) {
        if (Object.prototype.hasOwnProperty.call(extraAttr, key)) el.setAttribute(key, extraAttr[key]);
      }
    }
    if (onload) el.addEventListener('load', onload);
    document.head.appendChild(el);
  }

  function loadAnalytics() {
    if (analyticsLoaded) return;
    analyticsLoaded = true;

    // dataLayer + gtag() have to exist before the library is requested, so the
    // queued 'js' / 'config' calls are replayed in order once it arrives.
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
      window.gtag = function () { window.dataLayer.push(arguments); };
    }
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });

    // P0.2 (2026-10-23): the events geoTrack queued while gtag was missing can
    // finally be sent.
    //
    // TIMING IS THE WHOLE POINT, and it took three attempts to get right.
    // Measured on the live site (no proxy, headless Edge):
    //   - flush immediately after injectScript()  -> queue empties, NOTHING sent
    //   - flush on the loader's load event        -> queue empties, NOTHING sent
    //   - flush AFTER gtag.js has initialised     -> sent
    // gtag.js only starts draining dataLayer once it has initialised; anything
    // pushed into the raw array before that is dropped on the floor. The
    // observable marker of "initialised" is window.google_tag_manager, which
    // appears right after the library's first /g/collect (measured: page_view
    // at +1244ms, google_tag_manager at +1289ms). A gtag('event', ...) issued
    // after that marker does reach /g/collect; the same call issued earlier
    // does not.
    //
    // consent.js is deferred, so this also covers the parse-time events of a
    // returning visitor (pricing_viewed, fixpack_viewed) — they fired before
    // gtag existed and used to be lost.
    var flushPending = function () {
      if (typeof window.__geoFlushPending === 'function') {
        try { window.__geoFlushPending(); } catch (e) { /* never break consent */ }
      }
    };
    var flushWhenGaReady = function () {
      // No setTimeout (test sandbox / exotic runtime): flush right away, which
      // is the old behaviour — better than never flushing.
      if (typeof setTimeout !== 'function') { flushPending(); return; }
      var tries = 0;
      var tick = function () {
        if (window.google_tag_manager) { flushPending(); return; }
        tries++;
        if (tries >= 60) { flushPending(); return; }  // 30s ceiling, then send anyway
        setTimeout(tick, 500);
      };
      setTimeout(tick, 500);
    };
    injectScript(GA_SCRIPT_ID, GA_SRC, null, flushWhenGaReady);
  }

  function loadAds() {
    if (adsLoaded) return;
    adsLoaded = true;

    // Reveal the slot before the loader runs, otherwise Adsterra finds an
    // empty/hidden container and renders nothing.
    var wrapper = document.getElementById(NATIVE_WRAPPER_ID);
    if (wrapper) wrapper.hidden = false;
    if (!document.getElementById(NATIVE_SLOT_ID)) {
      // Adsterra's invoke.js looks the slot up by id; recreate it if a page
      // ever drops the wrapper.
      var slot = document.createElement('div');
      slot.id = NATIVE_SLOT_ID;
      (wrapper || document.body).appendChild(slot);
    }

    injectScript(AD_NATIVE_SCRIPT_ID, AD_NATIVE_SRC, { 'data-cfasync': 'false' });
    injectScript(AD_SOCIAL_SCRIPT_ID, AD_SOCIAL_SRC);
  }

  function applyConsent(state) {
    if (!state) return;
    if (state.analytics) loadAnalytics();
    if (state.ads) loadAds();
  }

  function syncSwitches(state) {
    var analytics = document.getElementById('consent-analytics');
    var ads = document.getElementById('consent-ads');
    var base = state || { analytics: false, ads: false };
    if (analytics) analytics.checked = base.analytics === true;
    if (ads) ads.checked = base.ads === true;
  }

  function commit(analytics, ads) {
    var state = store(analytics, ads);
    markDecidedInDocument();
    applyConsent(state);
  }

  function onClick(id, handler) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  }

  function init() {
    var stored = readStored();

    if (stored) {
      markDecidedInDocument();
      applyConsent(stored);
    } else {
      // Undecided: banner on screen (it is already in the HTML), nothing loaded.
      setBannerVisible(true);
      syncSwitches(null);
    }

    onClick('consent-accept-all', function () { commit(true, true); });
    onClick('consent-essential', function () { commit(false, false); });
    onClick('consent-save', function () {
      var analytics = document.getElementById('consent-analytics');
      var ads = document.getElementById('consent-ads');
      commit(!!(analytics && analytics.checked), !!(ads && ads.checked));
    });

    // Footer entry: re-open the panel with the current choice already filled in.
    onClick('consent-open', function () {
      syncSwitches(readStored());
      setBannerVisible(true);
      var banner = document.getElementById('geoscore-consent-banner');
      if (banner) {
        var first = banner.querySelector('input, button');
        if (first) first.focus();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
