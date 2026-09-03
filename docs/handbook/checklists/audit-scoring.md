# GEO Audit Scoring (0–100)

> 8-dimension scoring system for AI search engine visibility. Based on the Auriti-Labs GEO Optimizer framework.

---

## Scoring Overview

**Maximum Score:** 100 points
**Score Bands:**

| Score | Rating | Meaning |
|-------|--------|---------|
| 86–100 | 🟢 Excellent | AI search ready, minimal improvements needed |
| 68–85  | 🟡 Good | Strong foundation, some gaps to address |
| 36–67  | 🟠 Foundation | Basic setup done, significant work remains |
| 0–35   | 🔴 Critical | Major gaps, AI citation unlikely |

---

## Dimension 1: Robots.txt (18 points)

| Check | Points | How to Pass |
|-------|--------|-------------|
| OAI-SearchBot allowed | 4 | `Allow: /` for ChatGPT Search |
| PerplexityBot allowed | 4 | `Allow: /` for Perplexity |
| ClaudeBot allowed | 3 | `Allow: /` for Claude |
| Google-Extended allowed | 3 | `Allow: /` for Gemini AIO |
| Training bots blocked | 2 | `Disallow: /` for GPTBot, anthropic-ai, CCBot |
| All bots covered | 2 | 27 AI bots across 3 tiers (training/search/user) |

## Dimension 2: llms.txt (18 points)

| Check | Points | How to Pass |
|-------|--------|-------------|
| File exists at `/llms.txt` | 5 | Deployed in site root |
| H1 + blockquote structure | 3 | Site name + one-sentence description |
| H2 sections with links | 4 | Categorized links to key pages |
| Section depth (3+ areas) | 3 | At least 3 H2 sections |
| llms-full.txt (optional) | 2 | Extended documentation available |
| Under 200 lines | 1 | Abides by spec limit |

## Dimension 3: Schema JSON-LD (16 points)

| Check | Points | How to Pass |
|-------|--------|-------------|
| Organization schema | 3 | Present with name, url, logo |
| FAQPage schema | 4 | 3+ Q&A pairs on content pages |
| Article schema | 3 | headline, author, datePublished |
| Schema richness (5+ attributes) | 3 | Each schema has 5+ populated fields |
| Schema matches visible content | 3 | No orphan Q&A in schema only |

## Dimension 4: Meta Tags (14 points)

| Check | Points | How to Pass |
|-------|--------|-------------|
| Title tag | 3 | Unique, 50–60 chars, keyword-inclusive |
| Meta description | 3 | 120–160 chars, descriptive, includes keyword |
| Canonical URL | 2 | Present and correct |
| Open Graph tags | 3 | og:title, og:description, og:image |
| Twitter card tags | 3 | twitter:card, twitter:title, twitter:description |

## Dimension 5: Content (12 points)

| Check | Points | How to Pass |
|-------|--------|-------------|
| H1 present | 2 | Clear, descriptive, matches content |
| Word count ≥ 1500 | 2 | Sufficient depth for AI extraction |
| Statistics present | 2 | Specific numbers with attribution |
| External citations | 2 | 3+ links to authoritative sources |
| Heading hierarchy | 2 | H1 → H2 → H3, no skipping |
| Lists / tables | 2 | Structured formats used |

## Dimension 6: Brand & Entity (10 points)

| Check | Points | How to Pass |
|-------|--------|-------------|
| Brand name consistent | 2 | Same name across all pages |
| Knowledge Graph link | 2 | Wikipedia or Wikidata entry |
| About page | 2 | Team, location, or mission info |
| Contact information | 2 | Email, form, or address |
| sameAs links | 2 | Social profiles in Organization schema |

## Dimension 7: Signals (6 points)

| Check | Points | How to Pass |
|-------|--------|-------------|
| html lang attribute | 1.5 | `<html lang="en">` or appropriate |
| RSS/Atom feed | 1.5 | Feed available at `/feed.xml` or similar |
| Content freshness | 1.5 | Last updated date within 90 days |
| Sitemap.xml | 1.5 | Complete, current, submitted to Search Console |

## Dimension 8: AI Discovery (6 points)

| Check | Points | How to Pass |
|-------|--------|-------------|
| `.well-known/ai.txt` | 2 | Points to key site resources |
| `/ai/summary.json` | 2 | JSON summary of site offerings |
| `/ai/faq.json` | 2 | JSON array of common Q&A |

---

## Quick Audit Command

```bash
# Check robots.txt
curl -s https://yoursite.com/robots.txt | grep -E 'Allow|Disallow'

# Check llms.txt
curl -s https://yoursite.com/llms.txt | head -5

# Check schema presence
curl -s https://yoursite.com | grep -o 'schema.org/[A-Za-z]*' | sort -u

# Check OG tags
curl -s https://yoursite.com | grep -oE 'og:(title|description|image)' | sort -u

# Check content length
curl -s https://yoursite.com | wc -w
```

---

## Automated Scoring

For a full automated audit, use the [Auriti-Labs GEO Optimizer](https://github.com/Auriti-Labs/geo-optimizer-skill):

```bash
pip install geo-optimizer-skill
geo audit --url https://yoursite.com
```

---

*See [Pre-Publish Checklist](./pre-publish-checklist.md) for a lighter 25-item self-check before publishing.*