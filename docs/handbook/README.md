# GEO Optimization Handbook

> A comprehensive guide to **Generative Engine Optimization (GEO)** — optimizing content for AI search engines like ChatGPT Search, Perplexity, Google AI Overviews, Gemini, Claude, and more.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![GitHub Stars](https://img.shields.io/github/stars/qq136692547-cmyk/geo-optimization-handbook?style=social)](https://github.com/qq136692547-cmyk/geo-optimization-handbook)
[![Last Updated](https://img.shields.io/github/last-commit/qq136692547-cmyk/geo-optimization-handbook)](https://github.com/qq136692547-cmyk/geo-optimization-handbook/commits/main)
[![Awesome GEO](https://awesome.re/badge.svg)](https://github.com/amplifying-ai/awesome-generative-engine-optimization)
[![Website](https://img.shields.io/badge/🌐-geoscore.help-blue)](https://geoscore.help/)

> **⚡ Try it live — [GeoScore](https://geoscore.help)**: a free, open-source GEO audit tool built on this handbook. Enter any URL and get a 0–100 readiness score across 12 weighted dimensions, with prioritized fixes.

---

## 📖 What is GEO?

**Generative Engine Optimization (GEO)** is the practice of optimizing content so AI-powered search engines cite, summarize, or recommend your content in their responses.

Coined in the paper [*GEO: Generative Engine Optimization*](https://arxiv.org/abs/2311.09735) (KDD 2024), GEO addresses a fundamental shift: users increasingly get answers from AI-generated responses rather than blue links. Traditional SEO targets ranking in link lists; GEO targets **being cited as a source** in AI-generated answers.

---

## 🖼️ At a Glance

| GEO vs SEO | GEO Audit Framework | 47 Citation Strategies |
|:---:|:---:|:---:|
| ![GEO vs SEO](assets/images/geo-vs-seo.png) | ![GEO Audit Framework](assets/images/geo-audit-framework.png) | ![47 Citation Strategies](assets/images/47-citation-strategies.png) |

## 🎯 Why GEO Matters in 2026

| Stat | Source |
|------|--------|
| ChatGPT has **900M+ weekly active users** (1B+ monthly) with AI search built-in | OpenAI (Feb 2026) |
| Google AI Overviews now reaches **2B+ users/month** across 200+ countries | Google (Jul 2025) |
| Google AI Mode surpassed **1B monthly active users** within a year of launch | Google I/O 2026 |
| AI Overviews appear on **48% of all search queries**, reducing organic CTR by 34–61% | Stacc (Jul 2026) |
| Gemini app has **950M+ monthly active users** | Alphabet Q2 2026 earnings |
| **80% of URLs cited by AI engines** don't rank in Google's top 100 for the query | Ahrefs 2026 AEO Report |
| **28.3%** of ChatGPT's most-cited pages have **zero Google organic visibility** | Ahrefs |
| **up to 40% visibility improvement** possible with GEO strategies | KDD 2024 / ICLR 2026 |
| Correct JSON-LD schema boosts LLM extraction from **16% to 54%** | Semrush |
| AI search queries average **23 words** (vs 4 for traditional search) | Multiple studies |
| ChatGPT referral traffic converts at **15.9%** (vs Google's 1.76%) | Conductor 2026 Benchmarks |
| **97% of enterprise marketing leaders** report positive AEO impact; **94% plan to increase investment** | Conductor State of AEO 2026 |
| GEO can **rank your content in ChatGPT in 14 days** | OtterlyAI experiment |

## 📚 Contents

### Methodology

| # | Topic | Description |
|---|-------|-------------|
| 1 | [Core Concepts](./methodology/01-core-concepts.md) | What GEO is, how it differs from SEO, why it matters |
| 2 | [AI Search Platforms](./methodology/02-ai-search-platforms.md) | How ChatGPT, Perplexity, Google AIO, Gemini, Claude, and Chinese platforms work |
| 3 | [47 Citation Strategies](./methodology/03-citation-strategies.md) | Proven methods ranked by impact (from KDD 2024 + ICLR 2026 research) |
| 4 | [Structured Data](./methodology/04-structured-data.md) | FAQPage, HowTo, Article, Organization schemas for AI extraction |
| 5 | [Trust Stack](./methodology/05-trust-stack.md) | 5-layer trust scoring system for AI engine credibility |
| 6 | [Negative Signals](./methodology/06-negative-signals.md) | 8 signals that cause AI engines to deprioritize your content |
| 7 | [Academic Research](./methodology/07-academic-research.md) | Key papers: KDD 2024, ICLR 2026, NeurIPS 2025, EMNLP 2024 |

### Practical Guides

| # | Guide | Applies To |
|---|-------|------------|
| 1 | [Static Site GEO](./practical-guides/01-static-site-geo.md) | GitHub Pages, any static HTML site |
| 2 | [FAQPage & HowTo Schema](./practical-guides/02-faqpage-howto-schema.md) | Any content site, documentation |
| 3 | [Blogger GEO Implementation](./practical-guides/03-blogger-geo.md) | Blogger / Blogspot blogs |
| 4 | **[GEO for Small Businesses](./practical-guides/04-small-business-geo.md) 🆕** | Small business websites, local SEO + GEO |

### Checklists & Tools

| Resource | What It Does |
|----------|-------------|
| [Pre-Publish Checklist](./checklists/pre-publish-checklist.md) | 8-item self-check before publishing any content |
| [Audit Scoring](./checklists/audit-scoring.md) | 8-dimension scoring system (0-100) |
| [Robots.txt Template](./templates/robots-template.md) | Allow AI citation, block AI training |
| [Promotion Launch Checklist](./promotion-checklist.md) | Step-by-step launch plan for Reddit / Hacker News (account rules, post types, do/don't) |

## 🚀 Quick Start

### For Content Creators

```bash
# 1. Read the core concepts
cat methodology/01-core-concepts.md

# 2. Apply the top-5 citation strategies
cat methodology/03-citation-strategies.md

# 3. Add FAQPage schema to your content
cat practical-guides/02-faqpage-howto-schema.md

# 4. Run the pre-publish checklist
cat checklists/pre-publish-checklist.md
```

### For Site Owners

```bash
# 1. Deploy robots.txt that allows AI citation bots
cat templates/robots-template.md

# 2. Add structured data to key pages
cat practical-guides/02-faqpage-howto-schema.md

# 3. Apply static site GEO optimizations
cat practical-guides/01-static-site-geo.md
```

## 🏗️ Project Structure

```
geo-optimization-handbook/
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── methodology/
│   ├── 01-core-concepts.md
│   ├── 02-ai-search-platforms.md
│   ├── 03-citation-strategies.md
│   ├── 04-structured-data.md
│   ├── 05-trust-stack.md
│   ├── 06-negative-signals.md
│   └── 07-academic-research.md
├── practical-guides/
│   ├── 01-static-site-geo.md
│   ├── 02-faqpage-howto-schema.md
│   ├── 03-blogger-geo.md
│   └── 04-small-business-geo.md 🆕
├── assets/
│   └── images/
│       ├── geo-vs-seo.png
│       ├── geo-audit-framework.png
│       └── 47-citation-strategies.png
├── checklists/
│   ├── pre-publish-checklist.md
│   └── audit-scoring.md
└── templates/
    └── robots-template.md
```

## 📖 How to Use This Handbook

- **New to GEO?** Start with [Core Concepts](./methodology/01-core-concepts.md), then apply the [Pre-Publish Checklist](./checklists/pre-publish-checklist.md) to your existing content.
- **Already doing SEO?** Read [Citation Strategies](./methodology/03-citation-strategies.md) and [Structured Data](./methodology/04-structured-data.md) — these complement your existing SEO work.
- **Running static sites?** The [Static Site Guide](./practical-guides/01-static-site-geo.md) and [Blogger Guide](./practical-guides/03-blogger-geo.md) are for you.
- **Small business owner?** Start with the [Small Business GEO Guide](./practical-guides/04-small-business-geo.md) — no technical expertise required.

## What's New (August 2026)

- 📊 **Data refresh (Aug 2026)**: Gemini app 750M→**950M+ MAU** (Alphabet Q2 2026 earnings), added Ahrefs 2026 AEO finding (**80% of AI-cited URLs don't rank in Google top 100**), corrected AIO CTR impact to 34–61% (Stacc)
- 🏛️ **Google's official GEO guide**: [Optimizing for generative AI features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) — Google's first official documentation (June 2026)
- 🔬 **New research**: SIGIR 2026 — [What Gets Cited: Competitive GEO](https://arxiv.org/abs/2605.25517) — 252K trials across 6 LLMs; GEO now has a [Wikipedia page](https://en.wikipedia.org/wiki/Generative_engine_optimization)
- 📣 **Promotion plan**: [Promotion Launch Checklist](./promotion-checklist.md) + [Reddit/HN draft copy](./promotion-drafts.md) — platform-specific post types, titles, and do/don't (Reddit 90/10, HN Show HN)
- 🛠️ **Built with this handbook**: [GeoScore](https://geoscore.help/) — free GEO audit tool
- 🆕 **New guide**: [GEO for Small Businesses](./practical-guides/04-small-business-geo.md) — zero-click search survival guide for 2026
- 🔬 Added recent research: C-SEO Bench (NeurIPS 2025), IF-GEO, Multimodal GEO papers, Conductor 2026 AEO/GEO Benchmarks

## 🛠️ Built with This Handbook

| Project | Description |
|---------|-------------|
| [GeoScore](https://geoscore.help/) 🏠 **Official Site** | Free GEO audit tool — scores your site 0–100 across 12 dimensions, generates llms.txt, robots.txt, and JSON-LD fixes. Built from this handbook's methodology. |

## 🤝 Contributing

GEO is a rapidly evolving field. This handbook aims to stay current with the latest research and platform changes. Contributions welcome!

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📚 References

| Source | Type | Topic |
|--------|------|-------|
| [arXiv:2311.09735](https://arxiv.org/abs/2311.09735) | Academic Paper | GEO: Generative Engine Optimization (KDD 2024) |
| [arXiv:2510.11438](https://arxiv.org/abs/2510.11438) | Academic Paper | AutoGEO: Automatic GEO (ICLR 2026) |
| [arXiv:2601.13938](https://arxiv.org/abs/2601.13938) | Academic Paper | IF-GEO: Conflict-Aware Instruction Fusion (2026) |
| [C-SEO Bench (NeurIPS 2025)](https://arxiv.org/abs/2506.11097) | Academic Paper | Conversational SEO Benchmark |
| [Auriti-Labs GEO Optimizer](https://github.com/Auriti-Labs/geo-optimizer-skill) | Open Source | GEO audit framework (MIT) |
| [llmstxt.org](https://llmstxt.org) | Specification | llms.txt standard for AI crawlers |
| [Google Search Central — AI content & search](https://developers.google.com/search/docs/fundamentals/ai-content) | Documentation | AI content and search |
| [Google Search Central — Optimizing for generative AI features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) | Documentation | Google's official GEO/AEO guide (June 2026) |
| [SEMrush GEO Guide](https://www.semrush.com/blog/generative-engine-optimization/) | Industry Guide | Practical GEO strategies |
| [Conductor 2026 AEO/GEO Benchmarks](https://www.conductor.com/academy/aeo-geo-benchmarks-report/) | Industry Report | First large-scale AI visibility analysis across 10 industries |
| [Conductor State of AEO/GEO 2026](https://www.conductor.com/academy/state-of-aeo-geo-report/) | Industry Report | CMO investment trends: 97% positive impact, 94% increasing investment |
| [OtterlyAI GEO Experiment](https://otterly.ai/blog/from-zero-to-rank7-ai-search-in-14days/) | Case Study | #7 in ChatGPT in 14 days |
| [Wikipedia — Generative engine optimization](https://en.wikipedia.org/wiki/Generative_engine_optimization) | Reference | GEO article on Wikipedia (Jul 2026) |
| [SIGIR 2026 — What Gets Cited](https://arxiv.org/abs/2605.25517) | Academic Paper | Competitive GEO: 252K trials across 6 LLMs |

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

*Maintained by [L.D. Studio](https://github.com/qq136692547-cmyk) — helping content creators thrive in the AI search era.*
