/**
 * Read-only probe: how reliable is the one proxy that actually answers from
 * mainland China? Every other proxy in src/lib/fetcher.js times out here, so
 * geo-score-proxy.pages.dev is a single point of failure: when it fails rather
 * than succeeds, every resource costs a full proxy budget.
 *
 * Replays the same 9 URLs an audit asks for, N rounds, and reports the latency
 * distribution. Also reports what the audit would cost if the proxy were the
 * slowest thing on the critical path.
 *
 * Usage: node tools/p5-proxy-tail.mjs [target] [rounds]
 */
const target = (process.argv[2] || 'https://geoscore.help/').replace(/\/$/, '');
const rounds = Number(process.argv[3] || 3);

const origin = new URL(target).origin;
const PROXY = 'https://geo-score-proxy.pages.dev/api/proxy?url=';

const PATHS = [
  '/robots.txt',
  '/llms.txt',
  '/',
  '/.well-known/ai.txt',
  '/ai/summary.json',
  '/ai/faq.json',
  '/sitemap.xml',
  '/about',
];

const urls = PATHS.map((p) => origin + p);

async function viaProxy(url) {
  const t = Date.now();
  try {
    const res = await fetch(PROXY + encodeURIComponent(url), {
      signal: AbortSignal.timeout(20000),
    });
    const ms = Date.now() - t;
    return { url, ms, status: res.status, ok: res.ok };
  } catch (err) {
    return { url, ms: Date.now() - t, status: 0, ok: false, err: err.name };
  }
}

const all = [];
for (let r = 1; r <= rounds; r++) {
  const t = Date.now();
  const results = await Promise.all(urls.map(viaProxy));
  const wall = Date.now() - t;
  all.push(...results.map((x) => ({ ...x, wall })));
  const fails = results.filter((x) => !x.ok && x.status >= 400 && x.status < 500).length;
  const errs = results.filter((x) => x.status === 0).length;
  console.log(
    `round ${r}: batch wall ${String(wall).padStart(6)}ms | ` +
      results
        .map((x) => `${x.url.replace(origin, '').replace(/^\/$/, '/')}=${x.status}/${x.ms}ms`)
        .join('  ')
  );
  if (fails || errs) console.log(`         (${fails} client-error, ${errs} network-error)`);
}

const ok = all.filter((x) => x.ok).map((x) => x.ms).sort((a, b) => a - b);
const failed = all.filter((x) => !x.ok);
const pct = (p) => (ok.length ? ok[Math.min(ok.length - 1, Math.floor((ok.length * p) / 100))] : NaN);

console.log(`\n--- ${target} · ${rounds} rounds · ${all.length} proxy requests ---`);
console.log(`success ${ok.length}/${all.length}   network/other failures: ${failed.length}`);
console.log(`success latency ms: min ${ok[0]}  p50 ${pct(50)}  p95 ${pct(95)}  max ${ok[ok.length - 1]}`);
console.log(`slowest full batch: ${Math.max(...all.map((x) => x.wall))}ms`);
console.log(
  `\nA 9-request audit whose slowest resource is p95 would render in ~${pct(95)}ms of fetch time.\n` +
    `The observed 30,016ms run equals 2 x 15,000ms proxy budgets — i.e. two sequential\n` +
    `batches that each waited out every proxy, which is what the pre-0a14417\n` +
    `Promise.race -> allSettled fallback did whenever this proxy failed fast.`
);
