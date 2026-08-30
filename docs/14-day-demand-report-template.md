# 14-day demand report template: GeoScore × TTCalc

- Report ID: `geo-score-ttcalc-demand-2026-08-31`
- Window: 2026-08-31 00:00 UTC → 2026-09-13 23:59 UTC
- Status: `not-started` / `in-progress` / `complete`
- Owner:
- Last reviewed:

## 1. Data rules

- Use GA4 properties: GeoScore `G-98LLHZ0GDM`, TTCalc `G-GZBDCFNMTN`.
- Exclude owner, team, test, and automated traffic.
- If internal exclusion is unavailable, mark the affected metric `not-evaluable`.
- Do not infer missing events from pageviews or estimates.
- Count only canonical events and whitelisted parameters.

## 2. TTCalc demand gates

| Metric | Threshold | Actual | Evidence source | Status |
|---|---:|---:|---|---|
| Unique visitors | ≥200 |  | GA4 `user_pseudo_id` |  |
| Successful tool uses | ≥20 |  | `calculator_computed` + `photo_generate_completed` |  |
| Sign-in or cross-site sessions | ≥3 |  | distinct `ga_session_id` with `sign_in` or `cross_site_click` |  |

Definitions:

- `visitors` = distinct `user_pseudo_id`, excluding internal/test sessions.
- `tool uses` = successful specific completion events only; do not also count generic `tool_complete`.
- `sign-in or cross-site sessions` = distinct `ga_session_id` where either event occurred.

## 3. GeoScore demand gates

| Metric | Threshold | Actual | Evidence source | Status |
|---|---:|---:|---|---|
| Successful audits | ≥50 |  | distinct successful `audit_completed` |  |
| Sign-in or paid-intent sessions | ≥10 |  | distinct `ga_session_id` with `sign_in` or `paid_intent_click` |  |

Definitions:

- `successful audits` = count of successful `audit_completed` events, excluding internal/test sessions.
- `sign-in or paid-intent sessions` = distinct `ga_session_id` where either event occurred.

## 4. Source attribution

Resolve source precedence exactly once per session:

1. `cross_site`: strict `utm_source=ttcalc|geoscore` + `utm_medium=site`
2. `external`: qualifying external UTM or known external referrer
3. `search`: known search-engine referrer
4. `direct`: no referrer and no qualifying UTM
5. `other`: everything else

| Source | TTCalc sessions | GeoScore sessions |
|---|---:|---:|
| cross_site |  |  |
| external |  |  |
| search |  |  |
| direct |  |  |
| other |  |  |

Do not count the same session as `cross_site` and then again as `search` or `external`.

## 5. Event health

For each event, record whether it fired, whether parameters passed the whitelist, and whether DebugView showed one GA config on sampled pages.

| Event | Expected site | Fired? | Parameter check | Notes |
|---|---|---|---|---|
| `tool_start` | TTCalc |  |  |  |
| `calculator_computed` | TTCalc |  |  |  |
| `photo_generate_started` | TTCalc |  |  |  |
| `photo_generate_completed` | TTCalc |  |  |  |
| `sign_in` | Both |  |  |  |
| `cross_site_click` | Both |  |  |  |
| `content_view` | Both |  |  |  |
| `paid_intent_click` | GeoScore |  |  |  |
| `audit_started` | GeoScore |  |  |  |
| `audit_completed` | GeoScore |  |  |  |
| `audit_failed` | GeoScore |  |  |  |
| `language_switched` | Both |  |  |  |

## 6. Funnel bottlenecks

For each site, identify the largest drop-off using actual event data.

| Site | Entry stage | Next stage | Entry count | Next count | Conversion | Bottleneck |
|---|---|---|---:|---:|---:|---|
| TTCalc | visitor | tool use |  |  |  |  |
| TTCalc | tool use | sign-in/cross-site |  |  |  |  |
| GeoScore | visitor | audit |  |  |  |  |
| GeoScore | audit | sign-in/paid intent |  |  |  |  |

## 7. Failure semantics

If a threshold is not met, classify the cause as exactly one of:

- `insufficient-sample`: traffic or actions were too small for a reliable demand decision.
- `search-acquisition-failure`: sufficient content/exposure existed, but acquisition was too weak.
- `product-demand-failure`: sufficient traffic arrived, but users did not use or accept the product path.

Do not label the product direction failed merely because the sample was small.

## 8. Decision

| Question | Finding | Evidence | Recommended next action |
|---|---|---|---|
| Did either site meet its minimum thresholds? |  |  |  |
| Which site has the stronger demand signal? |  |  |  |
| Is the next phase priority TTCalc seller tools or GeoScore Pro expansion? |  |  |  |
| What is the single highest-impact fix for the next window? |  |  |  |

## 9. Checkpoints

| Date | Scope | Result | Action taken |
|---|---|---|---|
| 2026-09-03 | Day 4 data sanity check |  |  |
| 2026-09-06 | Day 7 midpoint review |  |  |
| 2026-09-10 | Day 10 bottleneck review |  |  |
| 2026-09-14 | Final window calculation |  |  |
