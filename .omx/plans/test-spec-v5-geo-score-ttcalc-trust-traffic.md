# Test Specification v5: GeoScore × TTCalc 可信度与需求测试闭环

- status: v5
- supersedes: `.omx/plans/test-spec-v4-geo-score-ttcalc-trust-traffic.md`
- planner: `.omx/plans/planner-v7-geo-score-ttcalc-trust-traffic.md`
- type: phase-1 demand test, no real charge
- purpose: single active executable acceptance artifact

## 0. Pre-deploy regression gates

These are blocking tests, not optional checks.

| ID | Target | Assertion |
|---|---|---|
| R-01 | GPTBot / anthropic-ai recommendation | Output must contain `Allow: /`; must not contain `Disallow: /` |
| R-02 | GeoScore cron summary | Without LLM key, summary includes `visibility: null` and cron tests assert it |
| R-03 | TTCalc privacy robots | `/privacy/` is not disallowed by robots |
| R-04 | GA config uniqueness | Every shipped page has exactly one `gtag('config', ...)` |
| R-05 | GA payload privacy | No email, email hash, phone, full name, raw JWT, or raw URL in GA payload |
| R-06 | Photo proxy guardrail | Global budget guardrail, kill switch, fail-closed behavior all active |

## 1. Event migration and legacy retirement

| ID | Target | Assertion |
|---|---|---|
| M-01 | `audit_completed` | Existing `url` is not sent; `url_domain` is hostname only, no path/query/credentials/port/fragment |
| M-02 | `audit_failed` | Raw exception text is not sent; `error_code` is one of allowed enum values |
| M-03 | Legacy export/fix events | `export_clicked` and `fix_file_downloaded` no longer emit; migrated events use canonical `tool_complete` params |
| M-04 | `audit_started` | Event exists and uses `url_domain`, not full URL |
| M-05 | Tool-use dedupe | A calculator emits `calculator_computed` only; a photo emits `photo_generate_completed` only; no duplicate generic `tool_complete` for the same action |
| M-06 | Parameter whitelist | Any non-registry event name or non-whitelisted param fails in test mode |
| M-07 | Error enum | `error_code` is one of `fetch_failed`, `timeout`, `parse_error`, `server_error`, `rate_limited`, `unknown` |
| M-08 | Canonical names | Only canonical event names from Planner v7 are emitted; no old aliases remain |

## 2. Privacy and GA behavior

| ID | Target | Assertion |
|---|---|---|
| P-01 | No direct identifiers | dataLayer/gtag payload contains no email, email hash, phone, full name, raw JWT |
| P-02 | No raw URL | No full URL with query string, path, credentials, or user input is sent |
| P-03 | Opaque identity | Only an already-existing non-PII `user_id` may be sent; no user_id may be derived from email |
| P-04 | One config per page | Every shipped page has exactly one `gtag('config', ...)` call |
| P-05 | GA bootstrap replacement | No page has both old inline bootstrap and shared analytics bootstrap |
| P-06 | No cross-site identity merge | No shared user mapping exists across sites; only UTM/source_type attribution exists |

## 3. Trust and public-claim scan

### 3.1 Required scope

#### GeoScore visible pages
- `src/pages/about.astro:105-113`
- `src/pages/privacy.astro:23-33`
- `src/pages/terms.astro:25`
- `src/pages/pricing.astro:11,149`
- `src/pages/index.astro:37,45,184,291`
- `src/pages/zh/index.astro:37,182`
- `src/pages/zh/about.astro:105`
- `src/pages/zh/privacy.astro:24,27`
- `src/pages/zh/terms.astro:25`
- `src/pages/zh/pricing.astro`

#### GeoScore AI-facing/global content
- `public/ai/faq.json:28,34`
- `public/ai/summary.json`
- `public/llms.txt`
- `public/.well-known/ai.txt`
- `src/layouts/Layout.astro`

#### GeoScore blog/demo pages
- `src/pages/blog/auditing-1200-websites.astro:221`
- `src/pages/blog/llms-txt-ultimate-guide.astro:270`
- `src/pages/report/demo.astro:169`

#### TTCalc
- `about/index.html:113-114`
- `ai/summary.json:4`
- `index.html:157,223`
- `privacy/index.html:15,44,48,56,57,61`
- `tools/index.html:53,55`
- `terms/index.html:49`
- `tools/tiktok-product-photo/index.html:7,126,133`
- `blog/tiktok-shop-fees-2026/index.html:158`
- `blog/tiktok-shop-seller-tools-2026/index.html:63,198`

### 3.2 Required assertions

| ID | Target | Assertion |
|---|---|---|
| T-01 | English public claims | No stale absolute claims remain |
| T-02 | Chinese public claims | No stale absolute claims remain |
| T-03 | AI-facing JSON | `faq.json` and `summary.json` no longer state “not stored on any server”, “no signup”, “no paywall”, or “no per-audit limit” without accurate qualification |
| T-04 | llms/AI policy | `llms.txt` and `.well-known/ai.txt` distinguish free browser audits from Pro cloud monitoring and use verifiable entity/support info |
| T-05 | Structured data | Organization/Person/WebSite/SoftwareApplication fields match visible page content |
| T-06 | TTCalc claims | About/Privacy/Terms/Tool pages accurately distinguish local calculators from backend image generation, Google login, AdSense, Worker persistence, and third-party services |
| T-07 | Photo page | Photo tool page states free quota/BYOK/sign-in/backend generation accurately |
| T-08 | Numeric claims | Any public statistic has source, time window, and sample definition, or is removed |
| T-09 | Free-tier accuracy | “Single browser audits are free” may remain; unqualified “GeoScore is free” must not remain |
| T-10 | No tracking claim | No page or AI-facing JSON says “no tracking” while GA is active |

## 4. Photo proxy guardrail tests

| ID | Target | Assertion |
|---|---|---|
| G-01 | Global budget guardrail | With `PHOTO_GLOBAL_DAILY_LIMIT`, requests are blocked after limit with 429 and clear message |
| G-02 | Kill switch | With `PHOTO_PROXY_DISABLED`, all `/generate` and `/edit` requests return 503 or disabled state; no quota write, no upstream call |
| G-03 | Missing KV | Missing `PHOTO_QUOTA` binding returns 503 and never falls back to generation |
| G-04 | KV error | KV read/write error returns 503 and never falls back to generation |
| G-05 | Both endpoints | Global guardrail applies to `/generate` and `/edit` |
| G-06 | Overshoot tolerance | Test documents expected overshoot under concurrent KV writes and confirms limit is below financial/provider ceiling |
| G-07 | No-guardrail fallback | If guardrails are absent, photo generator is not promoted and frontend copy says best-effort |

## 5. Deployment and rollback

| ID | Target | Assertion |
|---|---|---|
| D-01 | Deployment record | Each deployed batch records commit, build result, Worker version if applicable, rollback target, timestamp |
| D-02 | Artifact tracking | GeoScore build artifact name is recorded; TTCalc deployed Worker version is recorded |
| D-03 | Batch separation | Frontend and Worker changes are in separate deploy batches where practical |
| D-04 | Functional regression | Core audit, sign-in, calculators, image generation, language switching, and cross-site links pass before deploy |

## 6. Attribution and internal-traffic exclusion

| ID | Target | Assertion |
|---|---|---|
| A-01 | Canonical events | Canonical events appear where expected |
| A-02 | UTM rule | TTCalc -> GeoScore uses `utm_source=ttcalc&utm_medium=site&utm_campaign=geo-trust-funnel`; reverse uses `utm_source=geoscore` |
| A-03 | Source precedence | Attribution resolves in exact order: `cross_site`, `external`, `search`, `direct`, `other` |
| A-04 | No double attribution | A session counted as `cross_site` is not also counted under search or external |
| A-05 | Internal exclusion | Owner/team/test traffic is excluded by GA4 internal rule or `localStorage.geoInternal = true`; otherwise metric is marked `not-evaluable` |
| A-06 | UTM whitelist | Only `utm_source`, `utm_medium`, and `utm_campaign` are used for cross-site links |

## 7. Performance tests

| ID | Target | Assertion |
|---|---|---|
| F-01 | Baseline | Mobile and desktop Lighthouse each run at least 3 times; median LCP, CLS, TBT recorded |
| F-02 | Optimization | Same device/cache/network profile used before/after |
| F-03 | Acceptance | LCP improves at least 25% or reaches 3.0s or lower; CLS does not worsen |
| F-04 | Functionality | Core TTCalc features still pass after optimization |

## 8. E2E tests

| ID | Scenario | Expected |
|---|---|---|
| E-01 | GeoScore audit | URL input -> audit starts -> result renders -> canonical audit events emitted |
| E-02 | GeoScore sign-in | Sign-in completes; event includes method and state, not identity |
| E-03 | TTCalc homepage | Desktop 1440×900 and mobile 390×844 render without horizontal overflow; EN/ZH round-trip works |
| E-04 | TTCalc calculators | Fee/profit/ROAS calculator returns result and emits `calculator_computed` |
| E-05 | TTCalc photo generator | Anonymous and signed-in flows work or show explicit quota/error |
| E-06 | Cross-site funnel | Click opens target with expected UTM and emits `cross_site_click` |
| E-07 | 14-day report | Report separates `insufficient-sample`, `search-acquisition-failure`, and `product-demand-failure` |
| E-08 | Claim audit | No stale absolute public claim remains in visible, AI-facing, llms, or AI-policy content |

## 9. Observability tests

| ID | Target | Assertion |
|---|---|---|
| O-01 | GA DebugView | Both sites show canonical events with allowed params and no duplicate config |
| O-02 | Cross-site attribution | `cross_site_click` and matching UTM survive target page load |
| O-03 | Search Console | TTCalc high-impression pages have recorded exposure; privacy is not blocked by robots |
| O-04 | Performance tracking | Lighthouse mobile and desktop metrics are saved before/after optimization |
| O-05 | Threshold measurement | The 14-day report maps each threshold to exact event/param definitions |
| O-06 | Source classification | Every key event can be classified as `search`, `external`, `cross_site`, `direct`, or `other` |

## 10. Explicit threshold-to-event mapping

### TTCalc minimum

- ≥200 real unique visitors, excluding owner/team/test sessions
- ≥20 successful tool uses, counted from `calculator_computed` or `photo_generate_completed`
- ≥3 distinct sessions with `sign_in` or `cross_site_click`

### GeoScore minimum

- ≥50 real audits, counted from `audit_completed`
- ≥10 distinct sessions with `sign_in` or `paid_intent_click`

### Failure semantics

If thresholds are not met, the report must state:
- actual sample size,
- required sample size,
- maximum bottleneck,
- whether it is `insufficient-sample`, `search-acquisition-failure`, or `product-demand-failure`,
- recommended next window or next fix.

Do not label the direction failed merely because the sample was small.

## 11. Test tooling

Use existing tooling only:
- vitest / Node built-in test,
- Playwright,
- Lighthouse,
- GA DebugView,
- Search Console,
- static grep checks.

No new dependency is required.

## 12. SEO acceptance

Every shipped SEO batch must pass Planner v7 §8:

- robots must not block `/privacy/`.
- sitemap contains only indexable URLs and every URL returns HTTP 200.
- each page has one self-referencing absolute canonical, one unique H1, one unique title, and one unique meta description.
- no canonical mismatch, redirect chain, duplicate canonical, or conflicting language alternate tags.
- structured data matches visible page content.
- `lastmod` is accurate and not speculative.
