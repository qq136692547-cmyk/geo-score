const HISTORY_KEY = 'geoscope_history';

function getHistory() {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function addToHistory(result) {
  const history = getHistory();
  const entry = {
    id: Date.now().toString(36),
    url: result.url,
    score: result.score,
    level: result.level,
    timestamp: result.timestamp,
  };
  const existing = history.findIndex(e => e.url === result.url);
  if (existing >= 0) history.splice(existing, 1);
  history.unshift(entry);
  if (history.length > 20) history.pop();
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
  return entry;
}

function clearHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

export { getHistory, addToHistory, clearHistory };
