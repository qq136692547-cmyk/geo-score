const HISTORY_KEY = 'geoscope_history';

// Raw timeline: one entry per audit run, newest first.
function getTimeline() {
  try {
    var data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
}

// Latest entry per URL, newest first. This is what the history list shows —
// five rows of the same site would be noise.
function getHistory() {
  var seen = {};
  var out = [];
  getTimeline().forEach(function (e) {
    if (!seen[e.url]) { seen[e.url] = true; out.push(e); }
  });
  return out;
}

function addToHistory(result) {
  var history = getTimeline();
  var entry = {
    id: Date.now().toString(36),
    url: result.url.replace(/https?:\/\//, "").replace(/\/$/, ""),
    score: result.score,
    level: result.level,
    timestamp: result.timestamp,
    dimensions: result.dimensions ? Object.fromEntries(
      Object.entries(result.dimensions).map(function(kv) { return [kv[0], kv[1].percentage || 0]; })
    ) : {}
  };
  // 2026-10-23: this used to splice out the previous entry for the same URL.
  // That made getUrlHistory(url) permanently length 1, so boot.js's
  // `urlHistory.length >= 2` guard (boot.js:435) could never be true and the
  // trend chart was dead code. Keep every run; deduplicate at display time.
  history.unshift(entry);
  if (history.length > 50) history = history.slice(0, 50);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (e) {}
  return entry;
}

// All runs for one URL, newest first. The trend chart reverses this.
function getUrlHistory(url) {
  var clean = url.replace(/https?:\/\//, "").replace(/\/$/, "");
  return getTimeline().filter(function(e) { return e.url === clean; });
}

function getComparisonData(urls) {
  var all = getHistory();
  return urls.map(function(u) {
    var clean = u.replace(/https?:\/\//, "").replace(/\/$/, "");
    return all.find(function(e) { return e.url === clean; }) || null;
  }).filter(Boolean);
}

function clearHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
}

export { getHistory, addToHistory, getUrlHistory, getComparisonData, clearHistory };
