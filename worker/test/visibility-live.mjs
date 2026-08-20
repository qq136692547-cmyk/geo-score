import { runVisibilityCheck } from '../visibility.js';

// Real LLM call with the real TokenRhythm key from the environment.
// The key is never printed or written to a file.
if (!process.env.TOKENRHYTHM_API_KEY) throw new Error('TOKENRHYTHM_API_KEY missing');

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

// Validate each INSERT has the right number of bind args (16 placeholders).
function placeholderCount(sql) {
  const m = sql.match(/\?/g);
  return m ? m.length : 0;
}

const site = { id: 's_vis_test', user_id: 'u_test_vis', email: 'qq136692547@gmail.com', host: 'example.com', url: 'https://example.com' };
const env = { TOKENRHYTHM_API_KEY: process.env.TOKENRHYTHM_API_KEY, DB: makeDb() };

const t0 = Date.now();
const result = await runVisibilityCheck(env, site);
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

for (const i of inserts) {
  const placeholders = placeholderCount(i.sql);
  if (placeholders !== i.args.length) {
    throw new Error('bind arity mismatch: sql=' + placeholders + ' args=' + i.args.length);
  }
}

console.log('LIVE LLM TEST');
console.log('elapsed_sec=' + elapsed);
console.log('ok=' + result.ok);
console.log('query=' + JSON.stringify(result.query));
console.log('checked_at=' + result.checked_at);
console.log('summary=' + JSON.stringify(result.summary));
for (const e of result.engines) {
  console.log('engine=' + e.engine + ' mentioned=' + e.mentioned + ' cited=' + e.cited + ' sentiment=' + e.sentiment + ' error=' + (e.error || 'none'));
}
console.log('inserts=' + inserts.length + ' all_validated=true');
