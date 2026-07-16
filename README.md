# GeoScore 🌐 — GEO Audit Tool for AI Search Visibility

**Check your website'\''s visibility to ChatGPT, Perplexity, Claude, Gemini, and Google AI Overviews.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Built with Astro](https://img.shields.io/badge/Built%20with-Astro-ff5a03?logo=astro)](https://astro.build)
[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-222?logo=githubpages)](https://pages.github.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## 🚀 Try It

**[👉 deng.zh.kg](https://deng.zh.kg)**

Enter any URL and get a comprehensive GEO readiness score across 12 dimensions.

## 📖 What is GeoScore?

GeoScore is a **free, open-source, web-based GEO (Generative Engine Optimization) audit tool** that:

1. **Scans** your website for AI-search signals (robots.txt, llms.txt, JSON-LD, meta tags, content quality, E-E-A-T, and more)
2. **Scores** 0–100 across 12 weighted dimensions
3. **Recommends** prioritized fixes to improve your AI search visibility
4. **Exports** reports as Markdown, JSON, or CSV

No installation required. Just enter a URL.

## 🧠 Scoring System

GeoScore synthesizes frameworks from the leading GEO/AEO open-source projects:

| Dimension | Weight | Source |
|-----------|--------|--------|
| AI Crawlability (Robots.txt) | 12% | geo-optimization-handbook, Auriti-Labs |
| AI Guidance (llms.txt) | 12% | geo-optimization-handbook, best-aeo-skill |
| Structured Data (Schema) | 14% | handbook, evolv3ai, Auriti-Labs |
| Meta & Social Tags | 10% | geo-optimization-handbook, piiiico |
| Content Quality | 12% | handbook, Auriti-Labs, geo-optimizer (Go) |
| E-E-A-T Signals | 8% | evolv3ai, best-aeo-skill |
| Brand & Entity | 8% | geo-optimization-handbook, best-aeo-skill |
| Citation Readiness | 8% | best-aeo-skill, geo-seo-claude |
| Discovery Endpoints | 6% | geo-optimization-handbook |
| Agent-Friendliness | 4% | ax-score, agentscore |
| Freshness & Maintenance | 4% | evolv3ai |
| Negative Signals | Deduction | handbook + UC Berkeley EMNLP 2024 |

**Score Levels:**
- **86–100** ⭐ Excellent — Fully GEO-optimized
- **68–85** ✅ Good — Minor gaps remain
- **36–67** ⚠️ Basic — Significant work needed
- **0–35** 🔴 Critical — Major overhaul required

## 🏗 Architecture

```
┌─────────────────────────────────────┐
│       GeoScore Web App (Astro)       │
├─────────────────────────────────────┤
│  ┌─────────┐ ┌──────────┐ ┌──────┐  │
│  │ Home    │ │ Audit    │ │About │  │
│  │ (URL)   │ │(Dashboard)│ │     │  │
│  └────┬────┘ └────┬─────┘ └──────┘  │
│       │           │                  │
│  ┌────▼───────────▼──────────────┐   │
│  │     Scoring Engine (JS)        │   │
│  │  12 analyzers → scoring.js    │   │
│  └──────────┬────────────────────┘   │
│             │                        │
│  ┌──────────▼────────────────────┐   │
│  │  Cloudflare Worker (CORS      │   │
│  │  proxy for blocked resources) │   │
│  └───────────────────────────────┘   │
└─────────────────────────────────────┘
```

## 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | [Astro](https://astro.build) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Charts | [Chart.js](https://www.chartjs.org) |
| CORS Proxy | [Cloudflare Workers](https://workers.cloudflare.com) |
| Storage | Browser localStorage |
| Deployment | GitHub Pages + Cloudflare Workers |
| Tests | [Vitest](https://vitest.dev) |

## 📦 Project Structure

```
geo-score/
├── src/
│   ├── pages/           # Astro pages (index, audit/[url], about)
│   ├── components/      # (planned: Astro components)
│   ├── lib/             # Core library
│   │   ├── analyzers/   # 12 dimension analyzers
│   │   ├── scanner.js   # Main orchestrator
│   │   ├── fetcher.js   # Resource fetching
│   │   ├── scoring.js   # Score computation
│   │   ├── recommendations.js
│   │   ├── history.js   # localStorage management
│   │   └── export.js    # Report export
│   ├── layouts/         # Page layouts
│   └── styles/          # Global CSS
├── worker/              # Cloudflare Worker
├── tests/               # Vitest test suite
└── public/              # Static assets
```

## 🚦 Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Development

```bash
# Clone
git clone https://github.com/qq136692547-cmyk/geo-score.git
cd geo-score

# Install
npm install

# Dev server
npm run dev

# Build for production
npm run build

# Preview build
npm run preview
```

### Running Tests

```bash
npm test
```

### Deploying the Worker

```bash
cd worker
npm install
npx wrangler deploy
```

## 🙏 Credits & Acknowledgments

GeoScore couldn'\''t exist without the incredible open-source GEO/AEO community:

### Scoring Frameworks
- **[qq136692547-cmyk/geo-optimization-handbook](https://github.com/qq136692547-cmyk/geo-optimization-handbook)** — Core 8-dimension scoring system and comprehensive GEO reference
- **[Auriti-Labs/geo-optimizer-skill](https://github.com/Auriti-Labs/geo-optimizer-skill)** — 8-dimension scoring, 47 strategies, 16 CLI commands (⭐594)
- **[zubair-trabzada/geo-seo-claude](https://github.com/zubair-trabzada/geo-seo-claude)** — GEO-first SEO skill with pdf reporting (⭐9011)
- **[metawhisp/best-aeo-skill](https://github.com/metawhisp/best-aeo-skill)** — 4-vector composite GEO score with 33 evidence collectors
- **[evolv3ai/aeo-audit](https://github.com/evolv3ai/aeo-audit)** — 14 ranking factor AEO scoring with weighted dimensions
- **[antlio/agentimization](https://github.com/antlio/agentimization)** — CLI GEO audit with radar visualization
- **[agentgram/ax-score](https://github.com/agentgram/ax-score)** — Lighthouse for AI Agents, 6-dimension agent-friendliness scoring
- **[carter-wzq/geo-audit-mcp](https://github.com/carter-wzq/geo-audit-mcp)** — 31-signal MCP GEO audit server

### Implementation References
- **[geo-team-red/geo-optimizer](https://github.com/geo-team-red/geo-optimizer)** — Pluggable GEO framework in Go (⭐202)
- **[cxcscmu/AutoGEO](https://github.com/cxcscmu/AutoGEO)** — ICLR 2026 automated GEO framework (⭐182)
- **[ai-search-guru/getcito](https://github.com/ai-search-guru/getcito-worlds-first-open-source-aio-aeo-or-geo-tool)** — AI search optimization SaaS (⭐141)
- **[isreadyai/isreadyai](https://github.com/isreadyai/isreadyai)** — AI visibility scoring CLI + web
- **[madeburo/GEO-AI-Woo](https://github.com/madeburo/GEO-AI-Woo)** — WordPress GEO plugin (⭐29)
- **[piiiico/aeo-audit](https://github.com/piiiico/aeo-audit)** — Schema.org and meta tag deep analysis
- **[josedasilva11/aeo-audit](https://github.com/josedasilva11/aeo-audit)** — Python CLI with readability scoring
- **[SeyitKaanGunes/ai-agent-search-optimization](https://github.com/SeyitKaanGunes/ai-agent-search-optimization)** — MCP server integration
- **[mykpono/ultimate-seo-geo](https://github.com/mykpono/ultimate-seo-geo)** — Audit→Plan→Execute workflow (⭐58)
- **[waqasbangash121/seo-geo-analyzer](https://github.com/waqasbangash121/seo-geo-analyzer)** — 24-factor SEO/GEO dashboard

### Research Foundation
- **Princeton KDD 2024** — [GEO: Generative Engine Optimization](https://arxiv.org/abs/2311.09735) (original paper)
- **CMU ICLR 2026** — [AutoGEO](https://arxiv.org/abs/2510.11438) (automated GEO framework)
- **UC Berkeley EMNLP 2024** — Negative signals in AI citation

## 📄 License

MIT

## 🤝 Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 🔮 Roadmap

- [ ] Batch audit via sitemap.xml
- [ ] Multi-site comparison
- [ ] Trend tracking (scheduled audits)
- [ ] AI-powered fix suggestions
- [ ] Deep SEO supplement (Core Web Vitals)
- [ ] WordPress plugin version
- [ ] MCP server for AI agent integration
