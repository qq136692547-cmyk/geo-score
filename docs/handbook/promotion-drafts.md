# Reddit / Hacker News 推广文案（按平台规则精修版）

> 发布前提：这些账号需是你自己的、有正常活动历史的账号。
> Reddit 通用 90/10 规则：≤10% 你的活动是自我推广，其余 90% 应是真诚参与（评论、帮人、分享他人内容）。
> r/SEO 自推政策严格：工具投放 / 联盟链接 / 机构广告会被删，基础问题会被转到置顶周帖。

---

## r/SEO

**类型：** 普通帖（先确认账号有正常评论历史，不要新号直接发）

**标题:** An open-source GEO handbook — what I learned compiling 47 citation strategies

**正文:**

GEO (Generative Engine Optimization) is a new field that traditional SEO tools don't cover well. AI search engines like ChatGPT, Perplexity, and Google AI Overviews look for different signals than the blue links we're used to.

I've been compiling everything I learn into a free, MIT-licensed handbook. The part that surprised me most:

**28.3% of ChatGPT's most-cited pages have ZERO Google organic visibility** (Ahrefs). GEO is a genuinely separate channel from SEO — ranking nowhere on Google doesn't mean you can't get cited by AI search.

What's inside:
- 7 chapters on GEO methodology (core concepts → platform differences → citation strategies → trust stack)
- 4 practical guides (static sites, Blogger, FAQPage schema, small business GEO)
- Pre-publish checklist + 8-dimension audit scoring
- Robots.txt templates that allow AI citation but block training

Happy to take feedback or questions — GEO moves fast and I'd love help keeping it accurate.

https://github.com/qq136692547-cmyk/geo-optimization-handbook

---

## r/webdev

**类型：** 普通帖（强调"看到自己的内容被 ChatGPT 引用但 Google 零排名"这个开发者有共鸣的切入点）

**标题:** My static site was getting cited in ChatGPT but ranked nowhere on Google — here's what I learned

**正文:**

I noticed my content was getting cited in ChatGPT answers while ranking nowhere on Google. Turns out AI search engines select sources using different signals than traditional SEO, and there's a whole optimization practice (GEO) around being the source they cite.

I turned what I learned into a free, open-source handbook. It covers:
- How ChatGPT, Perplexity, and Google AI Overviews actually select sources
- 47 citation strategies ranked by impact (from KDD 2024 + ICLR 2026 research)
- FAQPage schema implementation (boosts LLM extraction from 16% to 54%)
- A trust-scoring system for AI-engine credibility
- Robots.txt that allows AI citation while blocking AI training

There's a dedicated guide for optimizing GitHub Pages / static sites for AI citation.

https://github.com/qq136692547-cmyk/geo-optimization-handbook

---

## r/smallbusiness

**类型：** 普通帖（弱化"免费指南"广告感，强调"不用技术 SEO 也能被 AI 搜到"）

**标题:** How to show up in ChatGPT & Google AI Overviews without technical SEO

**正文:**

In 2026 a growing share of searches never click through to any website — users get answers straight from ChatGPT, Perplexity, or Google AI Overviews. That doesn't mean a small business can't benefit. The trick is to BE the source the AI engine cites.

I put together a free, open-source guide aimed at small business owners. The 5-step plan is deliberately simple:

1. Answer real customer questions (not generic "about us" content)
2. Structure pages for AI extraction (H1 → H2 → FAQ → author attribution)
3. Add a few lines of JSON-LD (FAQPage schema)
4. Cite authoritative sources
5. Build a trust stack (author bios, reviews, credentials)

No technical SEO experience required.

https://github.com/qq136692547-cmyk/geo-optimization-handbook/blob/main/practical-guides/04-small-business-geo.md

---

## Hacker News

**入口：** 用 **Show HN**（这是发自己作品的正式入口，不是普通 submit）。标题不要带 gratuitous number / 感叹号 / 大写。

**标题:** Show HN: An open-source handbook for Generative Engine Optimization (GEO)

**正文:**

I've been working on an open-source handbook for Generative Engine Optimization (GEO) — the practice of optimizing content so AI search engines (ChatGPT, Perplexity, Google AI Overviews) cite it.

What got me into it: after reading the KDD 2024 GEO paper, I saw Ahrefs data showing 28.3% of ChatGPT's most-cited pages have zero Google organic visibility. GEO is a genuinely separate channel from SEO, and most existing resources are either pure SEO theory or one-off platform tips. This tries to bridge that gap:

- Methodology (7 chapters): core concepts → platform differences → citation strategies → trust stack → negative signals
- Practical guides: static sites, Blogger, schema markup, small businesses
- Checklists: pre-publish checklist + 8-dimension audit scoring
- Templates: robots.txt that allows AI citation crawlers

It includes recent 2025–2026 research (C-SEO Bench / NeurIPS 2025, IF-GEO, AutoGEO / ICLR 2026). MIT licensed, PRs welcome.

https://github.com/qq136692547-cmyk/geo-optimization-handbook

**注意（HN 铁律）：**
- 正文必须是你**本人手写**，不要用 AI 生成/AI 润色文本贴上去（HN 指南明确禁止 posted generated text）。
- 不要 solicit upvotes，不要回帖求赞。
- 首发后自己在评论区真诚回答技术质疑，别删帖重发。
