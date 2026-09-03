# Pre-Publish GEO Checklist

> Run this checklist before publishing any content to ensure it's optimized for AI search engine citation.

---

## Content Quality

- [ ] **Direct answer in first 100 words** — Does the first paragraph directly answer the core question?
- [ ] **Definition-first structure** — Does each H2/H3 section start with a clear definition?
- [ ] **Headings match content** — Does H1 promise what the content delivers? (Avoids negative signal #8)
- [ ] **Word count ≥ 1500** — Sufficient depth for AI extraction (negative signal #3: thin content)
- [ ] **Self-contained sections** — Each section readable independently (RAG chunk readiness)

## Citations & Authority

- [ ] **3+ external citations** — Links to .edu, .gov, or recognized industry sources
- [ ] **Concrete statistics** — Numbers, percentages, dates with sources
- [ ] **Expert quotation** — `"Quote" — Name, Title, Org, Year` format (if applicable)
- [ ] **Author byline** — Real name or brand name on every page (negative signal #6)
- [ ] **Author credentials** — Brief bio or relevant qualifications

## Structured Data

- [ ] **FAQPage schema** — 3+ Q&A pairs matching visible content
- [ ] **Visible FAQ section** — `<details><summary>` HTML matching the schema
- [ ] **Article schema** — With headline, author, datePublished, dateModified
- [ ] **Organization schema** — On every page (or site-wide)
- [ ] **Schema matches visible text** — No Q&A in schema that isn't answered on the page

## Technical SEO

- [ ] **Meta description** — 120–160 characters with primary keyword
- [ ] **Open Graph tags** — og:title, og:description, og:image
- [ ] **Twitter card tags** — twitter:card, twitter:title, twitter:description
- [ ] **Canonical URL** — Set correctly
- [ ] **Internal links** — 2–3 links to related pages on your site

## AI-Specific

- [ ] **AI citation bots allowed** — OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended all Allow
- [ ] **llms.txt deployed** — At `/llms.txt` with H1 → blockquote → H2 sections
- [ ] **AI discovery endpoints** — `.well-known/ai.txt` or `/ai/summary.json` (recommended)
- [ ] **No AI training bots allowed** — GPTBot, anthropic-ai, CCBot all Disallow (optional)

## Negative Signals Check

- [ ] **CTA density** — ≤ 5 CTAs or < 1% CTA words (negative signal #1)
- [ ] **No keyword stuffing** — Single keyword density ≤ 2.5% (negative signal #5)
- [ ] **No broken links** — All internal and external links valid (negative signal #4)
- [ ] **No boilerplate excess** — Content-to-template ratio is high (negative signal #7)
- [ ] **Content matches heading** — H1 doesn't promise depth that content doesn't deliver

## Quick Score

| Score | Status | Action |
|-------|--------|--------|
| 25/25 ✅ | All checks passed | Ready to publish |
| 20–24 ⚠️ | Minor issues | Fix before publishing |
| 15–19 🔴 | Significant issues | Rewrite sections before publishing |
| < 15 ❌ | Major rework needed | Do not publish in current state |

---

*See [Audit Scoring](./audit-scoring.md) for a full 100-point technical audit.*