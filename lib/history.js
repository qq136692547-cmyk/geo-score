const HISTORY_KEY = 'geoscope_history';

function getHistory() {
  try {
    var data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
}

function addToHistory(result) {
  var history = getHistory();
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
  var existing = history.findIndex(function(e) { return e.url === entry.url; });
  if (existing >= 0) history.splice(existing, 1);
  history.unshift(entry);
  if (history.length > 50) history = history.slice(0, 50);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (e) {}
  return entry;
}

function getUrlHistory(url) {
  var clean = url.replace(/https?:\/\//, "").replace(/\/$/, "");
  return getHistory().filter(function(e) { return e.url === clean; });
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
