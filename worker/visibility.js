/**
 * GeoScore AI Visibility Monitoring (v1.8)
 *
 * "AI recommendation simulation": for each monitored site we fetch the
 * homepage, extract title/description, build a realistic user query, and ask
 * an LLM to simulate how ChatGPT / Perplexity / Claude / Gemini would answer -
 * whether the site would be mentioned / cited, plus sentiment and a snippet.
 * Results are stored in D1 (ai_visibility), one row per engine per batch.
 *
 * Transparency: this is a simulation based on public site content, NOT a
 * measurement of real AI engine traffic. It estimates "would this site be
 * recommended?" and lets users track that estimate over time.
 */

const ENGINES = ['chatgpt', 'perplexity', 'claude', 'gemini'];

const LLM_URL = 'https://tokenrhythm.studio/v1/chat/completions';
const LLM_MODEL = 'deepseek-v4-flash-0731';
const LLM_TIMEOUT_MS = 25000;
const FETCH_TIMEOUT_MS = 15000;
const MAX_HTML_BYTES = 160000;
const SNIPPET_MAX = 500;
const REASONING_MAX = 400;

const ENGINE_PROMPTS = {
  chatgpt: 'You simulate how ChatGPT, OpenAI\'s AI assistant, answers a user question using its training knowledge and retrieval. ChatGPT cites sources with links only when they are clearly relevant and authoritative.',
  perplexity: 'You simulate how Perplexity AI, an answer engine with live web search, composes its answer. Perplexity frequently includes numbered source citations when search results are relevant.',
  claude: 'You simulate how Claude, Anthropic\'s AI assistant, answers a user question. Claude is conservative: it mentions or cites a website only when the content is directly relevant and trustworthy.',
  gemini: 'You simulate how Google Gemini, in an AI Overview, answers a user question using Google-indexed web sources. Gemini cites sources it deems authoritative for the query.',
};

function generateId(prefix) {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  return prefix + hex;
}

function parseLlmJson(content) {
  if (typeof content !== 'string' || !content.trim()) return null;
  let cleaned = content.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); } catch (e) {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch (e2) {}
  }
  return null;
}

function clampText(str, max) {
  return String(str || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch the homepage and extract title + meta description.
 */
async function fetchSiteProfile(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GeoScoreBot/1.0; +https://geoscore.help)' },
  });
  if (!res.ok) throw new Error('Fetch failed: HTTP ' + res.status);
  const text = await res.text();
  const html = text.slice(0, MAX_HTML_BYTES);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1] : '';
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const desc = descMatch ? descMatch[1] : '';
  const cleanTitle = stripHtml(title);
  const cleanDesc = stripHtml(desc);
  const bodySample = stripHtml(html).slice(0, 1200);
  const profile = {
    title: cleanTitle.slice(0, 160),
    description: cleanDesc.slice(0, 320),
    bodySample,
  };
  if (!profile.title && !profile.description && !profile.bodySample) {
    throw new Error('No readable content extracted from ' + url);
  }
  return profile;
}

/**
 * Build a realistic user query from the site's own content.
 */
function buildQuery(profile) {
  const base = profile.description || profile.title || '';
  const firstSentence = base.split(/[.!?。！？]/)[0].trim();
  if (firstSentence.length >= 8) return firstSentence.slice(0, 120);
  if (profile.title) return profile.title.slice(0, 120);
  return 'AI search visibility';
}

async function callLlm(system, user, env) {
  const body = JSON.stringify({
    model: LLM_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.1,
    max_tokens: 800,
    response_format: { type: 'json_object' },
  });
  let res = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.TOKENRHYTHM_API_KEY },
    body,
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  let text = await res.text();
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 1200));
    res = await fetch(LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.TOKENRHYTHM_API_KEY },
      body,
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });
    text = await res.text();
  }
  if (!res.ok) throw new Error('LLM HTTP ' + res.status + ': ' + text.slice(0, 160));
  return text;
}

async function askEngine(engine, profile, query, env) {
  const persona = ENGINE_PROMPTS[engine];
  const system = persona + ' Reply with JSON only, no markdown, exactly these keys: {"mentioned": boolean, "cited": boolean, "sentiment": "positive" | "neutral" | "negative", "snippet": string, "reasoning": string}. "mentioned" means the answer would mention the website or its brand by name. "cited" means the answer would include the website as a link or source. Be conservative: most random sites are not mentioned.';
  const user = 'User question: "' + query + '"\n\nWebsite homepage:\nTitle: ' + (profile.title || '(none)')
    + '\nDescription: ' + (profile.description || '(none)')
    + '\nSample content: ' + (profile.bodySample || '(none)');
  const text = await callLlm(system, user, env);
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('LLM invalid response'); }
  const msg = data.choices && data.choices[0] && data.choices[0].message;
  const content = (msg && msg.content) || '';
  let parsed = parseLlmJson(content);
  if (!parsed && msg && msg.reasoning_content) {
    parsed = parseLlmJson(msg.reasoning_content);
  }
  if (!parsed) throw new Error('LLM JSON parse failed: ' + JSON.stringify(String(content || (msg && msg.reasoning_content) || '').slice(0, 160)));
  const sentimentRaw = String(parsed.sentiment || 'neutral').toLowerCase();
  return {
    mentioned: parsed.mentioned === true || parsed.mentioned === 'true' || parsed.mentioned === 1,
    cited: parsed.cited === true || parsed.cited === 'true' || parsed.cited === 1,
    sentiment: ['positive', 'neutral', 'negative'].indexOf(sentimentRaw) >= 0 ? sentimentRaw : 'neutral',
    snippet: clampText(parsed.snippet, SNIPPET_MAX),
    reasoning: clampText(parsed.reasoning, REASONING_MAX),
    raw: content.slice(0, 2000),
  };
}

function visibilityInsert(env, site, engine, query, row, errMsg, now) {
  const id = generateId('v_');
  if (errMsg) {
    return env.DB.prepare(
      "INSERT INTO ai_visibility (id, user_id, email, site_id, host, url, engine, query, mentioned, cited, sentiment, snippet, raw, error, checked_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'neutral', '', '{}', ?, ?, ?)"
    ).bind(id, site.user_id, site.email, site.id, site.host, site.url, engine, query, errMsg, now, now);
  }
  return env.DB.prepare(
    "INSERT INTO ai_visibility (id, user_id, email, site_id, host, url, engine, query, mentioned, cited, sentiment, snippet, raw, error, checked_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)"
  ).bind(id, site.user_id, site.email, site.id, site.host, site.url, engine, query,
    row.mentioned ? 1 : 0, row.cited ? 1 : 0, row.sentiment, row.snippet, row.raw, now, now);
}

async function storeFetchErrorBatch(env, site, errMsg, now) {
  const stmts = ENGINES.map(engine => visibilityInsert(env, site, engine, '', null, errMsg, now));
  await env.DB.batch(stmts);
}

/**
 * Run one AI visibility check batch for a monitored site.
 * Returns { ok, host, url, query, checked_at, engines[], summary{} }.
 */
export async function runVisibilityCheck(env, site) {
  const now = Math.floor(Date.now() / 1000);
  let profile;
  try {
    profile = await fetchSiteProfile(site.url);
  } catch (err) {
    const errMsg = 'fetch: ' + String(err && err.message ? err.message : err).slice(0, 300);
    try { await storeFetchErrorBatch(env, site, errMsg, now); } catch (dbErr) {}
    return { ok: false, host: site.host, url: site.url, error: errMsg, checked_at: now };
  }
  const query = buildQuery(profile);
  const settled = await Promise.allSettled(ENGINES.map(engine => askEngine(engine, profile, query, env)));
  const engines = [];
  const stmts = [];
  for (let i = 0; i < ENGINES.length; i++) {
    const engine = ENGINES[i];
    const r = settled[i];
    if (r.status === 'fulfilled') {
      engines.push({ engine, mentioned: r.value.mentioned, cited: r.value.cited, sentiment: r.value.sentiment, snippet: r.value.snippet, error: null });
      stmts.push(visibilityInsert(env, site, engine, query, r.value, null, now));
    } else {
      const errMsg = String(r.reason && r.reason.message ? r.reason.message : r.reason).slice(0, 300);
      engines.push({ engine, mentioned: false, cited: false, sentiment: 'neutral', snippet: '', error: errMsg });
      stmts.push(visibilityInsert(env, site, engine, query, null, errMsg, now));
    }
  }
  try {
    await env.DB.batch(stmts);
  } catch (dbErr) {
    return { ok: false, host: site.host, url: site.url, error: 'db: ' + String(dbErr && dbErr.message ? dbErr.message : dbErr).slice(0, 200), checked_at: now, engines };
  }
  return {
    ok: true,
    host: site.host,
    url: site.url,
    query,
    checked_at: now,
    engines,
    summary: {
      mentioned: engines.filter(e => e.mentioned).length,
      cited: engines.filter(e => e.cited).length,
      checked: engines.filter(e => !e.error).length,
      failed: engines.filter(e => e.error).length,
    },
  };
}

/**
 * Latest visibility batch for one monitored site (per engine).
 */
export async function getLatestVisibility(env, user, host) {
  const latest = await env.DB.prepare(
    'SELECT MAX(checked_at) AS t FROM ai_visibility WHERE user_id=? AND host=?'
  ).bind(user.id, host).first();
  const checkedAt = latest && latest.t ? latest.t : null;
  let engines = [];
  if (checkedAt) {
    const rows = await env.DB.prepare(
      'SELECT engine, mentioned, cited, sentiment, snippet, error, query FROM ai_visibility WHERE user_id=? AND host=? AND checked_at=? ORDER BY engine'
    ).bind(user.id, host, checkedAt).all();
    engines = rows.results.map(r => ({
      engine: r.engine,
      mentioned: !!r.mentioned,
      cited: !!r.cited,
      sentiment: r.sentiment,
      snippet: r.snippet,
      error: r.error,
    }));
  }
  return { host, checked_at: checkedAt, engines };
}
