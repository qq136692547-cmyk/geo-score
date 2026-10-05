/**
 * setupResultViewed (src/scripts/boot.js) — consent-gating behavioural tests.
 *
 * Regression under test: `fire()` used to set `fired = true` *before* checking
 * whether the event could actually be delivered. gtag() only exists after the
 * visitor opts in (Layout.astro + consent.js), so a report rendered before
 * consent marked itself delivered, skipped the call, and then every later
 * attempt (IntersectionObserver, 3s fallback) returned early on `if (fired)`.
 * The event was lost for the rest of the session — which is how result_viewed
 * stayed near-zero in GA4 while audit_completed kept arriving.
 *
 * boot.js is an ES module full of imports and touches `document` at load time,
 * so it cannot be imported here (no jsdom in this repo). Following the pattern
 * already proven in tests/consent-gating.test.js, the shipping source is read
 * from disk, the setupResultViewed slice is extracted, and that slice is
 * executed for real in a minimal stub. What is asserted is the shipping code.
 *
 * Time is driven by a fake timer queue — nothing sleeps.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const BOOT_SRC = fs.readFileSync(
  fileURLToPath(new URL('../src/scripts/boot.js', import.meta.url)),
  'utf8'
);

// Slice from `var resultViewedTimer` up to the next top-level function, so the
// whole block (module-level timer slot + setupResultViewed) is captured whole.
const BLOCK_START = 'var resultViewedTimer = null;';
const BLOCK_END = 'function prefersReducedMotion()';
const blockStart = BOOT_SRC.indexOf(BLOCK_START);
const blockEnd = BOOT_SRC.indexOf(BLOCK_END);
if (blockStart < 0 || blockEnd < 0 || blockEnd < blockStart) {
  throw new Error('Could not slice setupResultViewed out of boot.js — did the source move?');
}
const BLOCK_SRC = BOOT_SRC.slice(blockStart, blockEnd);

/* --------------------------------------------------------------- test harness */

/**
 * Fake timer queue: setTimeout returns an id, and advancing the clock runs
 * whatever is due, in (dueAt, id) order, so chained retries behave like real
 * ones instead of all collapsing onto the same tick.
 */
function createClock() {
  let now = 0;
  let nextId = 1;
  let queue = [];
  return {
    setTimeout(fn, delay) {
      const id = nextId++;
      queue.push({ id, dueAt: now + (Number(delay) || 0), fn });
      return id;
    },
    clearTimeout(id) {
      queue = queue.filter((entry) => entry.id !== id);
    },
    /** Move the clock forward by `ms`, running everything that comes due. */
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const due = queue
          .filter((entry) => entry.dueAt <= target)
          .sort((a, b) => a.dueAt - b.dueAt || a.id - b.id);
        if (due.length === 0) break;
        const next = due[0];
        queue = queue.filter((entry) => entry.id !== next.id);
        now = next.dueAt;
        next.fn();
      }
      now = target;
    },
    pending() {
      return queue.length;
    }
  };
}

/**
 * Build an isolated environment and run the extracted block inside it.
 * @param {object} [options]
 * @param {boolean} [options.geoTrack] define window.geoTrack (it always exists
 *   in the shipping page — Layout.astro assigns it inline)
 * @param {boolean} [options.gtag]    define window.gtag (consent.js's marker)
 * @param {boolean} [options.observer] install a fake IntersectionObserver
 */
function createEnv(options = {}) {
  const clock = createClock();
  const geoTrackCalls = [];
  const observerInstances = [];

  const window = {};
  if (options.geoTrack !== false) {
    window.geoTrack = function (action, params) {
      geoTrackCalls.push({ action, params });
    };
  }
  if (options.gtag) window.gtag = function () {};

  const context = {
    window,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    scoreBucket(score) {
      if (score < 60) return 'low';
      if (score < 68) return 'mid';
      return 'high';
    },
    getGeoSource() {
      return 'direct';
    }
  };
  if (options.observer !== false) {
    context.IntersectionObserver = class {
      constructor(cb, opts) {
        this.cb = cb;
        this.opts = opts;
        this.observed = [];
        this.disconnected = 0;
        observerInstances.push(this);
      }
      observe(el) {
        this.observed.push(el);
      }
      disconnect() {
        this.disconnected++;
      }
      /** Simulate the header scrolling into view at >= 50% ratio. */
      trigger(ratio = 0.6) {
        this.cb([{ isIntersecting: true, intersectionRatio: ratio }]);
      }
    };
    context.window.IntersectionObserver = context.IntersectionObserver;
  }
  context.globalThis = context;
  context.document = { documentElement: {} };

  vm.createContext(context);
  vm.runInContext(BLOCK_SRC, context, { filename: 'src/scripts/boot.js' });

  const header = { id: 'score-header' };
  const root = {
    querySelector(sel) {
      return sel === '.stagger-section' ? header : null;
    }
  };
  context.setupResultViewed(root, { score: 72, level: 'Good' });

  return {
    context,
    clock,
    header,
    observer: observerInstances[0] || null,
    calls: geoTrackCalls,
    /** Simulate the visitor clicking "Accept all" mid-session. */
    grantConsent() {
      context.window.gtag = function () {};
    }
  };
}

const RESULT = { score: 72, level: 'Good' };
const RESULT_VIEWED = 'result_viewed';

/* --------------------------------------------------------------------- tests */

describe('setupResultViewed — consent already granted (no behaviour change)', () => {
  it('reports once on the very first fire attempt', () => {
    const env = createEnv({ gtag: true });
    // IntersectionObserver sees the header straight away.
    env.observer.trigger();
    expect(env.calls.map((c) => c.action)).toEqual([RESULT_VIEWED]);
  });

  it('carries score, score_bucket, level and source_type', () => {
    const env = createEnv({ gtag: true });
    env.observer.trigger();
    expect(env.calls[0].params).toEqual({
      score: 72,
      score_bucket: 'high',
      level: 'Good',
      source_type: 'direct'
    });
  });

  it('falls back to the 3s timer when the observer never fires', () => {
    const env = createEnv({ gtag: true });
    env.clock.advance(2999);
    expect(env.calls).toHaveLength(0);
    env.clock.advance(1);
    expect(env.calls.map((c) => c.action)).toEqual([RESULT_VIEWED]);
  });

  it('never double-reports, no matter how many observers fire afterwards', () => {
    const env = createEnv({ gtag: true });
    env.observer.trigger();
    env.observer.trigger();
    env.clock.advance(60000);
    expect(env.calls).toHaveLength(1);
  });

  it('disconnects the observer once the event has landed', () => {
    const env = createEnv({ gtag: true });
    env.observer.trigger();
    expect(env.observer.disconnected).toBe(1);
  });

  it('leaves no timer pending after a successful report', () => {
    const env = createEnv({ gtag: true });
    env.observer.trigger();
    expect(env.clock.pending()).toBe(0);
  });
});

describe('setupResultViewed — consent arrives after the report', () => {
  it('reports nothing at all while consent is withheld', () => {
    const env = createEnv({ gtag: false });
    // Well past the 30-attempt budget.
    env.clock.advance(120000);
    expect(env.calls).toEqual([]);
  });

  it('sends the event on a later retry once consent is granted', () => {
    const env = createEnv({ gtag: false });
    env.clock.advance(5000);
    expect(env.calls).toHaveLength(0);

    env.grantConsent();
    env.clock.advance(2000);

    expect(env.calls.map((c) => c.action)).toEqual([RESULT_VIEWED]);
    expect(env.calls[0].params).toEqual({
      score: 72,
      score_bucket: 'high',
      level: 'Good',
      source_type: 'direct'
    });
  });

  it('sends exactly once even though consent is granted before the first retry', () => {
    const env = createEnv({ gtag: false });
    env.grantConsent();
    env.clock.advance(60000);
    expect(env.calls).toHaveLength(1);
  });

  it('reports on a retry triggered by the observer too, not only the timer', () => {
    const env = createEnv({ gtag: false });
    env.grantConsent();
    env.observer.trigger();
    expect(env.calls.map((c) => c.action)).toEqual([RESULT_VIEWED]);
  });

  it('still reports when geoTrack itself is missing entirely', () => {
    const env = createEnv({ gtag: false, geoTrack: false });
    env.clock.advance(120000);
    expect(env.calls).toEqual([]);
  });
});

describe('setupResultViewed — retry budget is bounded', () => {
  it('gives up and disconnects the observer once the budget is spent', () => {
    const env = createEnv({ gtag: false });
    env.clock.advance(120000);
    expect(env.observer.disconnected).toBe(1);
  });

  it('leaves no timer pending after giving up', () => {
    const env = createEnv({ gtag: false });
    env.clock.advance(120000);
    expect(env.clock.pending()).toBe(0);
  });

  it('a consent click after the budget is spent does not resurrect the event', () => {
    const env = createEnv({ gtag: false });
    env.clock.advance(120000);
    env.grantConsent();
    env.clock.advance(60000);
    expect(env.calls).toEqual([]);
  });

  it('keeps retrying for roughly 30s, not forever', () => {
    const env = createEnv({ gtag: false });
    // 1st attempt is the 3s fallback, then ~30 x 1s retries.
    env.clock.advance(29000);
    expect(env.calls).toHaveLength(0);
    expect(env.observer.disconnected).toBe(0);
    env.clock.advance(10000);
    expect(env.observer.disconnected).toBe(1);
  });
});

describe('setupResultViewed — re-entrancy and edge cases', () => {
  it('is a no-op when the report has no .stagger-section header', () => {
    const env = createEnv({ gtag: true });
    env.clock.advance(3000);           // the env's own report lands first
    const before = env.calls.length;
    expect(before).toBe(1);
    // A header-less re-render must not arm anything, supersede the live
    // report, or emit an extra event.
    env.context.setupResultViewed({ querySelector: () => null }, RESULT);
    env.clock.advance(60000);
    expect(env.calls).toHaveLength(before);
    expect(env.clock.pending()).toBe(0);
  });

  it('cancels the previous report timer when a new audit re-renders', () => {
    const env = createEnv({ gtag: false });
    env.clock.advance(1000);           // first audit is mid-retry
    const pendingBefore = env.clock.pending();
    expect(pendingBefore).toBe(1);

    // A second audit starts: the new setup must take over the shared timer slot.
    env.context.setupResultViewed(
      { querySelector: () => env.header },
      { score: 40, level: 'Basic' }
    );

    env.grantConsent();
    env.clock.advance(60000);

    // Exactly one event, and it is the *second* report's — the stale retry chain
    // must not fire alongside it.
    expect(env.calls).toHaveLength(1);
    expect(env.calls[0].params.score).toBe(40);
  });

  it('cancels the stale retry chain even after the first 3s fallback already fired', () => {
    // Regression: the shared timer slot used to keep the id of the *first* armed
    // timer. Once that timer fired, the slot held a dead id, so a second audit's
    // clearTimeout() was a no-op and the first audit's retry chain kept running:
    // "audit → withhold consent → audit again → accept" reported twice, the first
    // event carrying the previous report's score.
    const env = createEnv({ gtag: false });
    env.clock.advance(5000);           // 3s fallback fired, retries now chained
    expect(env.clock.pending()).toBe(1);

    env.context.setupResultViewed(
      { querySelector: () => env.header },
      { score: 40, level: 'Basic' }
    );

    env.grantConsent();
    env.clock.advance(60000);

    expect(env.calls).toHaveLength(1);
    expect(env.calls[0].params.score).toBe(40);
  });

  it('keeps a superseded chain inert even if its observer fires afterwards', () => {
    const env = createEnv({ gtag: false });
    const staleObserver = env.observer;
    env.clock.advance(5000);

    env.context.setupResultViewed(
      { querySelector: () => env.header },
      { score: 40, level: 'Basic' }
    );

    env.grantConsent();
    staleObserver.trigger();           // the old header scrolls into view late
    env.clock.advance(60000);

    expect(env.calls).toHaveLength(1);
    expect(env.calls[0].params.score).toBe(40);
  });

  it('leaves no timer behind when a new audit supersedes a pending one', () => {
    const env = createEnv({ gtag: false });
    env.clock.advance(5000);
    env.context.setupResultViewed(
      { querySelector: () => env.header },
      { score: 40, level: 'Basic' }
    );
    // Only the new report's own fallback is outstanding.
    expect(env.clock.pending()).toBe(1);
  });

  it('still fires when IntersectionObserver is unavailable', () => {
    const env = createEnv({ gtag: true, observer: false });
    expect(env.observer).toBe(null);
    env.clock.advance(3000);
    expect(env.calls.map((c) => c.action)).toEqual([RESULT_VIEWED]);
  });
});
