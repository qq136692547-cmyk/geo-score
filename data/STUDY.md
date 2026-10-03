# GeoScore AI-visibility study — data provenance

Generated 2026-10-04. Read this before citing anything in this directory.

## Why this directory exists

`src/pages/blog/auditing-1200-websites.astro` claimed "I audited 1,200 websites"
with specific findings (82% had a critical issue, 3.4x citation lift for llms.txt,
6.1x for FAQ schema). Investigation found no traceable source:

- production D1 `audits` table held **3 rows, 1 distinct URL** (`aikanpan.top`)
- the earliest row (2026-08-23) **post-dates the post's stated publish date (2026-07-21)**
- `src/lib/cli.js` accepts exactly one URL, so no bulk run had happened either

So the claim was retired and the study was actually run. Files here are the
real output.

## Method

**Sampling rule** (reproducible, defined in `tools/build-corpus.mjs`):

- Source: GitHub Search API, repositories, sorted by stars descending
- Stratified across **12 fixed star bands** (`stars:>=50000` … `stars:50..79`),
  top 100 repos per band = 1,200 candidates
- Kept only repos with a non-empty `homepage` (a site is required)
- Deduped by registrable host, so one company counts once
- Hosting placeholders (`*.github.io`, `*.vercel.app`, `*.pages.dev`, …) excluded

Result: 1,200 candidates → **457 unique sites** (`geo-corpus.csv`).

**Audit** (`tools/run-audit.mjs`): imports the product's own analyzer
(`src/lib/node-scanner.js`) in-process, so the numbers are the numbers the
product produces. No separate scoring path.

- concurrency 5, timeout 15s
- failed sites retried once at 30s → recovered 8
- **final: 343 scored, 114 unreachable (24.9%)** (`geo-audit-merged.csv`)

Failures are dominated by `timeout` plus sites that refuse programmatic requests
(`Could not fetch … may be blocking requests`). Both are recorded in the `error`
column, not silently dropped.

## Findings (all computed by `tools/analyse-study.mjs`, output in `study-report.txt`)

| Metric | Value |
|---|---|
| n (scored) | 343 |
| median score | 29 / 100 |
| mean | 31.4 |
| max | 75 |
| Critical (<40) | 219 (63.8%) |
| Basic | 118 (34.4%) |
| Good | 6 (1.7%) |
| has `llms.txt` | 84 (24.5%) |
| mean score with `llms.txt` | 48.7 (median 53.5) |
| mean score without | 25.8 (median 26) |
| `robots.txt` blocks ≥1 AI crawler | 7 of the 231 that publish one (3.0%) |
| no `robots.txt` at all | 106 (31.5%) |

**`llms.txt` correlates with a +22.9 point mean difference (median gap 27.5).** This is an
association in a convenience sample, not a causal effect: sites that publish an
`llms.txt` may differ in many other ways. Do not describe it as a lift.

## Claims that CANNOT be supported by this data

The retired post also asserted:

- "3.4x citation lift for sites with a valid llms.txt"
- "FAQ schema 6.1x more likely to be cited for question queries"
- "HowTo schema 3.8x more likely to be cited for step-by-step queries"
- "the top 3 fixes deliver ~80% of the score improvement"

All four are claims about whether an AI engine **cited** a site. A static crawler
audit cannot observe citation. Measuring them needs a multi-engine citation crawl
or the LLM simulation in `worker/visibility.js`, which is itself an estimate, not
a measurement. **They are not restated and must not be revived without new data.**

## ✅ The `aiCrawlability` defect — found, fixed, and re-measured

`aiCrawlability` used to be scored by a rule that marked a bot as passing **only
if robots.txt contained an explicit `User-agent: <bot>` line with `Allow: /`**.

That inverts RFC 9309. A robots.txt which never mentions an AI bot is the normal
case — the default is allow, and only a site that wants to restrict a bot lists
it. "Not mentioned" was being scored as "blocked".

Verified counter-example: **dev.to** has `User-agent: *` with partial `Disallow`
rules (`/og/`, `/login`, …) and never mentions GPTBot. No rule blocks it. The
product scored it 0/12 with `gptbot passed=false`.

Consequence before the fix: **323 of 343 sites (94.2%) scored 0/12** on a
dimension carrying 12 of 98 total weight. Not a plausible measurement of the web.

### What the fix does

`src/lib/analyzers/robots.js` now parses robots.txt into groups and applies
RFC 9309 directly:

1. consecutive `User-agent` lines form one rule block;
2. groups naming the bot are **merged**, and the `*` group is ignored entirely
   when any specific group exists;
3. within the applicable group, the **longest** matching pattern wins, ties going
   to the least restrictive rule;
4. an empty `Disallow:` states no restriction;
5. no robots.txt, or a file that never mentions the bot, means **allowed**.

The concrete question answered is "can this crawler fetch the site root `/`?" —
so `Disallow: /admin` restricts part of a site without blocking it.

### Re-measured over the same corpus

`tools/recount-robots.mjs` re-fetches `/robots.txt` for the 343 previously-scored
hosts and scores all 20 crawlers under both rules. 337 returned a usable file;
6 timed out (`github.com`, `hackage.haskell.org`, `ollama.com`,
`awesome-selfhosted.net`, `awesome-go.com`, `opentelemetry.io`) and are excluded
rather than counted as permissive.

| | old rule | new rule |
|---|---|---|
| sites blocking ≥1 AI crawler | 228 (67.7%) | **7 (2.1%)** |
| median `aiCrawlability` | 0 / 12 | **12 / 12** |
| sites at 0 / 12 | 225 | **2** |
| sites at 12 / 12 | 109 | **331** |

Denominator note: 106 of the 337 (31.5%) publish no robots.txt at all. They are
**allowed** by the default and are not counted as blocked. An earlier draft of this
file reported "114 (33.2%) block ≥1 AI crawler" — that number came from a helper
that scored an empty robots.txt as blocked, which is the same defect in a second
place. The correct figure is **7 of the 231 sites that publish a robots.txt
(3.0%)**, or 2.1% of all scored sites.

The 7 sites, all verified by reading their actual robots.txt:

| site | crawlers blocked | what the file says |
|---|---|---|
| weibo.com | 20/20 | a named group of ~12 AI UAs with `Disallow: /`, plus `User-agent: * / Disallow: /` |
| kcores.com | 20/20 | `User-agent: * / Disallow: /` |
| catppuccin.com | 5/20 | `User-agent: * / Allow: /`, then GPTBot, ChatGPT-User, Google-Extended, CCBot, PerplexityBot each `Disallow: /` |
| hellogithub.com | 1/20 | `User-agent: GPTBot / Disallow: /` |
| rustdesk.com | 1/20 | `User-agent: CCBot / Disallow: /` |
| unity.com | 1/20 | `User-Agent: Bytespider / Disallow: /` |
| maxon.net | 1/20 | single named `Disallow: /` |

Six of the 343 changed verdict. All six were checked against the source file and
the new answer is correct in every case; the four that lost points really do ban
those crawlers by name.

⇒ `aiCrawlability` is publishable again, with the caveat that it is near-useless
as a discriminator on typical sites: 331 of 337 score a perfect 12/12. That is the
correct outcome, not a broken metric — a site that says nothing about AI crawlers
should not be penalised for it.

`tools/quantify-robots-gap.mjs` and `tools/test-robots-parser.mjs` quantified the
gap before the fix and are kept as the record of it. `tests/analyzers/robots.test.js`
now carries 23 assertions covering the RFC rules, including the merge, the
wildcard precedence, the longest-match tie-break and the permissive default.

## Reproducing

```bash
node tools/build-corpus.mjs --per-band 100 --max 1200 --out data/geo-corpus.csv
node tools/run-audit.mjs --in data/geo-corpus.csv --out data/geo-audit.csv --concurrency 5 --timeout 15000
node tools/test-robots-parser.mjs        # parser assertions + mutation guard
node tools/analyse-study.mjs             # writes study-report.txt
node tools/recount-robots.mjs           # old-rule vs new-rule robots verdicts
node tools/quantify-robots-gap.mjs       # the original defect, quantified
```

The sampling rule is a hard-coded constant. Changing it invalidates comparison
with any previously published number.
