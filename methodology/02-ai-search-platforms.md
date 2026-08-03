# AI Search Platforms

Each AI search platform has different behavior, source preferences, and optimization requirements. This guide covers the major platforms as of mid-2026.

---

## Google AI Overviews & AI Mode

**Source:** Google Search Central, official documentation

### How It Works

- AI Overviews appear when Google determines they add value beyond traditional search results
- Uses **query fan-out** technology to decompose complex queries
- Cites 3-5 sources in each overview
- **AI Mode** (launched 2025) provides deeper AI-generated responses; surpassed **1B monthly active users** by mid-2026 (Google I/O 2026)
- AI Overviews now reach **2B+ users/month** across 200+ countries and 40+ languages (Google, Jul 2025)
- Appear on **48% of all search queries** (Stacc, Jul 2026) — note: Conductor's 2026 AEO/GEO Benchmarks reports a lower 25.11% AIO coverage rate; the two figures use different query samples and aren't directly comparable
- AI Mode and AI Overviews **cite the same URLs only ~13% of the time** — they use different retrieval mechanisms, so content optimized for one isn't automatically visible in the other (Ahrefs 2026)

### Optimization Tips

- **Maintain strong SEO fundamentals** — technical SEO, Core Web Vitals, structured data
- **Use FAQPage schema** — Google AI Overviews frequently cites FAQ content
- **Keep content up to date** — Google favors recent content for time-sensitive queries
- **Verify in Search Console** — monitor AI Overview performance
- **Definition-first structure** — start sections with clear definitions

---

## ChatGPT Search

**Source:** OpenAI documentation, industry analysis

### How It Works

- Prioritizes comprehensive, authoritative sources
- Evaluates source credibility through author attribution, citations, and domain authority
- Provides inline citations linking to source pages
- Reads full page content, not just snippets

### Optimization Tips

- **Author bylines with real names** — ChatGPT values author signal
- **Cited statistics with sources** — specific numbers with attribution
- **Structured content** — clear H2/H3 hierarchy helps extraction
- **Conversational writing** — matches ChatGPT's response style
- **External citations** — links to .edu, .gov, and authoritative sources
- **FAQ sections** — ChatGPT frequently extracts Q&A blocks

---

## Perplexity AI

**Source:** Perplexity documentation, observed behavior

### How It Works

- Highly transparent about sources — shows exactly what was cited
- Values source authority and freshness
- Supports "Pro" search with deeper reasoning
- Frequently uses academic and technical sources

### Optimization Tips

- **Cite authoritative sources** — Perplexity checks your citations
- **Include statistics and data** — Perplexity loves cite-worthy numbers
- **Publish original research** — unique data gets cited most
- **Keep content current** — Perplexity prefers recent information
- **Technical depth** — Perplexity serves a technical audience

---

## Google Gemini

**Source:** Google documentation

### How It Works

- Integrated with Google's Knowledge Graph
- Values local SEO signals (GMB listings)
- Uses structured data for fact extraction

### Optimization Tips

- **Optimize Google Business Profile** for local queries
- **YouTube content** — Gemini frequently cites video
- **Google-approved structured data** — Article, FAQPage, HowTo
- **Knowledge Panel** — ensure Wikipedia and authoritative sources link to your brand

---

## Claude (Anthropic)

**Source:** Anthropic documentation

### How It Works

- Claude can search the web when users enable the feature
- Values well-structured, authoritative content
- Evaluates source reliability through multiple signals

### Optimization Tips

- **ClaudeBot must be allowed** in robots.txt
- **Clear author attribution** — Person schema with real credentials
- **Self-contained answers** — Claude extracts facts, not narratives
- **Consistent branding** — helps Claude identify your site as a reliable source

---

## Chinese AI Search Platforms

| Platform | Model | Ecosystem | Key Optimization |
|----------|-------|-----------|------------------|
| **Baidu AI Search** | ERNIE | Baijiahao + Baidu Baike | Publish on Baijiahao, original content |
| **Doubao (ByteDance)** | Doubao LLM | Douyin + Toutiao | Video on Douyin + articles on Toutiao |
| **Tongyi Qianwen (Alibaba)** | Tongyi | Taobao/Tmall data | Structured e-commerce content |
| **Kimi (Moonshot)** | Long-context model | Long-form content | Deep research articles |
| **Tencent Yuanbao** | Hunyuan | WeChat + Video Account | WeChat Official Account posts |
| **WeChat Sogou** | WeChat Search | WeChat articles | WeChat Official Account is most important |
| **Zhihu** | — | Q&A community | High-frequency citation source for Baidu AI |
| **Xiaohongshu (RED)** | — | Image + text notes | Lifestyle/consumer queries |

### Chinese Platform Tips

- **Baidu**: Baijiahao accounts get priority in Baidu AI search
- **Kimi**: Long-form, research-depth content performs best
- **Zhihu**: Well-answered questions get cited across multiple Chinese AI platforms
- **Douyin**: Short video + article cross-posting for ByteDance ecosystem

---

## Platform-Specific Robots.txt Requirements

| Bot | Purpose | Recommended Action |
|-----|---------|-------------------|
| `OAI-SearchBot` | ChatGPT Search citation | Allow |
| `PerplexityBot` | Perplexity answer citation | Allow |
| `ClaudeBot` | Claude web citation | Allow |
| `Google-Extended` | Gemini AI Overviews | Allow |
| `GPTBot` | GPT training data | Disallow (optional) |
| `anthropic-ai` | Claude training data | Disallow (optional) |
| `CCBot` | Common Crawl | Disallow (optional) |

See [Robots.txt Template](../templates/robots-template.md) for a ready-to-use configuration.