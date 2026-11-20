/**
 * GeoScore Chrome Extension - Storage & Snapshot Diffing
 *
 * Provides chrome.storage.local persistence for audit history and settings,
 * along with pure diff computation between subsequent audits of the same URL.
 */

const HISTORY_KEY = 'geo_audit_history';
const SETTINGS_KEY = 'geo_settings';
const MAX_HISTORY_ITEMS = 50;

/**
 * Pure function: Computes the diff between two audit snapshots
 * Safe to run in any environment (Vitest, background worker, sidepanel).
 */
export function computeAuditDiff(prevSnapshot = null, currentResult = null) {
  const previousScore = prevSnapshot ? (prevSnapshot.total ?? prevSnapshot.score ?? 0) : 0;
  const currentScore = currentResult ? (currentResult.total ?? currentResult.score ?? 0) : 0;
  const delta = currentScore - previousScore;

  function collectChecks(source) {
    const checksMap = new Map();
    if (!source || !source.dimensions) return checksMap;
    for (const [dimKey, dim] of Object.entries(source.dimensions)) {
      if (!dim || !Array.isArray(dim.checks)) continue;
      for (const check of dim.checks) {
        if (check && check.id) {
          checksMap.set(`${dimKey}:${check.id}`, {
            id: check.id,
            label: check.label,
            passed: Boolean(check.passed),
            weight: check.weight || 1,
            dimKey,
          });
        }
      }
    }
    return checksMap;
  }

  const prevChecks = collectChecks(prevSnapshot);
  const currChecks = collectChecks(currentResult);

  const newlyPassedChecks = [];
  const regressedChecks = [];

  for (const [id, currCheck] of currChecks.entries()) {
    const prevCheck = prevChecks.get(id);
    if (prevCheck) {
      if (!prevCheck.passed && currCheck.passed) {
        newlyPassedChecks.push(currCheck);
      } else if (prevCheck.passed && !currCheck.passed) {
        regressedChecks.push(currCheck);
      }
    } else if (currCheck.passed && prevSnapshot) {
      // Check was newly added and passed
      newlyPassedChecks.push(currCheck);
    }
  }

  // Dimension-level deltas
  const dimensionDeltas = {};
  const prevDims = prevSnapshot?.dimensions || {};
  const currDims = currentResult?.dimensions || {};
  const allDimKeys = Array.from(new Set([...Object.keys(prevDims), ...Object.keys(currDims)]));

  for (const key of allDimKeys) {
    const prevScore = prevDims[key]?.score ?? 0;
    const currScore = currDims[key]?.score ?? 0;
    const prevMax = prevDims[key]?.maxScore ?? 0;
    const currMax = currDims[key]?.maxScore ?? 0;
    dimensionDeltas[key] = {
      dimKey: key,
      previousScore: prevScore,
      currentScore: currScore,
      previousMax: prevMax,
      currentMax: currMax,
      delta: currScore - prevScore,
    };
  }

  return {
    previousScore,
    currentScore,
    delta,
    newlyPassedChecks,
    regressedChecks,
    dimensionDeltas,
  };
}

function hasChromeStorage() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

export async function saveAuditSnapshot(snapshot) {
  if (!snapshot || !snapshot.url) return null;

  const item = {
    ...snapshot,
    timestamp: snapshot.timestamp || Date.now(),
  };

  if (!hasChromeStorage()) {
    return item;
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([HISTORY_KEY], (res) => {
      const history = Array.isArray(res[HISTORY_KEY]) ? res[HISTORY_KEY] : [];
      // Keep most recent first, capped at MAX_HISTORY_ITEMS
      const updated = [item, ...history.filter((h) => !(h.url === item.url && h.timestamp === item.timestamp))].slice(0, MAX_HISTORY_ITEMS);
      chrome.storage.local.set({ [HISTORY_KEY]: updated }, () => {
        resolve(item);
      });
    });
  });
}

export async function getAuditHistory(targetUrl = null) {
  if (!hasChromeStorage()) {
    return [];
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([HISTORY_KEY], (res) => {
      const history = Array.isArray(res[HISTORY_KEY]) ? res[HISTORY_KEY] : [];
      if (!targetUrl) {
        resolve(history);
      } else {
        const filtered = history.filter((h) => h.url === targetUrl);
        resolve(filtered);
      }
    });
  });
}

export async function clearAuditHistory() {
  if (!hasChromeStorage()) return true;

  return new Promise((resolve) => {
    chrome.storage.local.remove([HISTORY_KEY], () => {
      resolve(true);
    });
  });
}

const DEFAULT_SETTINGS = {
  autoBadge: false,
  langPref: 'auto',
};

export async function getSettings() {
  if (!hasChromeStorage()) {
    return { ...DEFAULT_SETTINGS };
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([SETTINGS_KEY], (res) => {
      resolve({ ...DEFAULT_SETTINGS, ...(res[SETTINGS_KEY] || {}) });
    });
  });
}

export async function saveSettings(newSettings = {}) {
  if (!hasChromeStorage()) {
    return { ...DEFAULT_SETTINGS, ...newSettings };
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([SETTINGS_KEY], (res) => {
      const merged = { ...DEFAULT_SETTINGS, ...(res[SETTINGS_KEY] || {}), ...newSettings };
      chrome.storage.local.set({ [SETTINGS_KEY]: merged }, () => {
        resolve(merged);
      });
    });
  });
}
