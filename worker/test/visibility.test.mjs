import assert from 'node:assert/strict';
import { runVisibilityCheck, getLatestVisibility } from '../visibility.js';

// ---- Fake fetch: homepage + LLM endpoint ----
const fetchCalls = [];
globalThis.fetch = async (url, opts) => {
  fetchCalls.push(String(url));
  if (String(url) === 'https://example.com') {
    return new Response(
      '<html><head><title>Example Corp - AI Tools</title><meta name="description" content="Example Corp makes AI visibility tools for publishers."></head><body><h1>Welcome</h1></body></html>',
      { status: 200 }
    );
  }
  if (String(url).startsWith('https://tokenrhythm.studio/')) {
    const body = JSON.parse(opts.body);
    const persona = body.messages[0].content;
    const engine = persona.includes('Perplexity') ? 'perplexity' : persona.includes('Claude') ? 'claude' : persona.includes('Gemini') ? 'gemini' : 'chatgpt';
    const mentioned = engine !== 'claude';
    const payload = {
      mentioned: mentioned,
      cited: mentioned,
      sentiment: mentioned ? 'positive' : 'neutral',
      snippet: 'Example Corp is a leading AI visibility tool.',
      reasoning: 'directly relevant to the query',
    };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }), { status: 200 });
  }
  throw new Error('unexpected fetch url: ' + url);
};

// ---- Fake D1 (captures inserts) ----
const inserts = [];
function makeDb() {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() { inserts.push({ sql, args }); return {}; },
            async all() { return { results: [] }; },
            async first() { return null; },
          };
        },
      };
    },
    async batch(stmts) { for (const s of stmts) await s.run(); },
  };
}

const site = { id: 's_1', user_id: 'u_1', email: 'a@b.com', host: 'example.com', url: 'https://example.com' };
const env = { TOKENRHYTHM_API_KEY: 'test-key', DB: makeDb() };

const result = await runVisibilityCheck(env, site);
assert.equal(result.ok, true, 'batch should succeed');
assert.equal(result.engines.length, 4, '4 engines');
assert.equal(result.summary.mentioned, 3, '3 engines mentioned (claude not)');
assert.equal(result.summary.cited, 3, '3 engines cited');
assert.equal(result.summary.failed, 0, 'no failures');
assert.equal(inserts.length, 4, 'one insert per engine');
assert.ok(inserts.every(i => i.sql.includes('ai_visibility')), 'all inserts target ai_visibility');
const times = new Set(inserts.map(i => i.args[14]));
assert.equal(times.size, 1, 'same batch checked_at');
assert.ok(fetchCalls.includes('https://example.com'), 'homepage fetched');
assert.equal(fetchCalls.filter(u => u.startsWith('https://tokenrhythm.studio/')).length, 4, '4 LLM calls');
console.log('runVisibilityCheck OK: engines=4, mentioned=3, inserts=' + inserts.length);

// ---- getLatestVisibility ----
const latestRows = [
  { engine: 'chatgpt', mentioned: 1, cited: 1, sentiment: 'positive', snippet: 'x', error: null, query: 'q' },
  { engine: 'gemini', mentioned: 0, cited: 0, sentiment: 'neutral', snippet: '', error: null, query: 'q' },
];
const env2 = {
  DB: {
    prepare(sql) {
      if (sql.includes('MAX(checked_at)')) {
        return { bind() { return { first: async () => ({ t: 111111 }) }; } };
      }
      return { bind() { return { all: async () => ({ results: latestRows }) }; } };
    },
  },
};
const latest = await getLatestVisibility(env2, { id: 'u_1' }, 'example.com');
assert.equal(latest.checked_at, 111111);
assert.equal(latest.engines.length, 2);
assert.equal(latest.engines[0].mentioned, true);
assert.equal(latest.engines[1].cited, false);
console.log('getLatestVisibility OK: engines=' + latest.engines.length + ', checked_at=' + latest.checked_at);

// ---- Fetch failure path ----
const env3 = { TOKENRHYTHM_API_KEY: 'test-key', DB: makeDb() };
globalThis.fetch = async (url) => { throw new Error('network down'); };
const failResult = await runVisibilityCheck(env3, site);
assert.equal(failResult.ok, false);
assert.ok(String(failResult.error).includes('network down'));
assert.equal(inserts.length, 8, 'fetch failure still records 4 error rows');
console.log('fetch failure path OK: error rows recorded');
console.log('ALL VISIBILITY TESTS PASSED');
