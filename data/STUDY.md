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
| has `llms.txt` | 78 (23.3%) |
| mean score with `llms.txt` | 50.5 |
| mean score without | 25.7 |
| `robots.txt` blocks ≥1 AI crawler | 114 (33.2%) |
| no `robots.txt` at all | 108 (31.5%) |

**`llms.txt` correlates with a +24.8 point score difference.** This is an
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

## ⚠️ One column in this data must not be published yet

`aiCrawlability` is scored by `src/lib/analyzers/robots.js`, which marks a bot as
passing **only if robots.txt contains an explicit `User-agent: <bot>` line with
`Allow: /`**.

A robots.txt that never mentions an AI bot is the normal case — the default is
allow, and only sites that want to block a bot list it. So "not mentioned" is
currently scored as "blocked".

Verified counter-example: **dev.to** has `User-agent: *` with partial `Disallow`
rules (`/search?q=*` and similar) and never mentions GPTBot. No rule blocks it.
The product scores it 0/12 with `gptbot passed=false`.

Consequence: **315 of 343 sites (94.0%) score 0/12 on that dimension.** That is not
a plausible measurement of the web, it is the checker being stricter than the
robots exclusion standard. The gap script is `tools/quantify-robots-gap.mjs`.

⇒ The `aiCrawlability` column is excluded from publishable findings until that
logic is decided. The `robotsBlocksAnyAi` figure in `study-report.txt` comes from
an independent parser (`tools/test-robots-parser.mjs`, 11 assertions with a
mutation guard) and is the sounder of the two, but it measures "explicitly blocks
at least one named AI crawler" — a stricter question than "is blocked".

## Reproducing

```bash
node tools/build-corpus.mjs --per-band 100 --max 1200 --out data/geo-corpus.csv
node tools/run-audit.mjs --in data/geo-corpus.csv --out data/geo-audit.csv --concurrency 5 --timeout 15000
node tools/test-robots-parser.mjs        # parser assertions + mutation guard
node tools/analyse-study.mjs             # writes study-report.txt
node tools/quantify-robots-gap.mjs       # the caveat above, quantified
```

The sampling rule is a hard-coded constant. Changing it invalidates comparison
with any previously published number.
