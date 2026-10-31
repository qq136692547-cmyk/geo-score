# GeoScore 关键词与需求诊断

> 作者：关宇霖（关键词与需求）｜2026-10-22
> 只诊断，不改代码。
> 数据源：GSC API（`tools/gsc-queries.mjs`，属性已核验 `https://geoscore.help/`），窗口 90 天 2026-07-24→2026-10-21 与 28 天 2026-09-24→2026-10-21。

## 口径声明（先读这一段，否则下面的数字会被误读）

1. **本文所有"展示量"= 我们被 Google 展示的次数，不是市场搜索量。** 本站展示基数极小（90 天 1,355），一个词有 136 展示不等于这个市场有 136 次月搜索。绝对搜索量在本次任务中无法获取（Trends API 400 / Ahrefs 需登录 / Keyword Planner 无 Ads 账号 / Similarweb 403），**本文不出现任何搜索量数字**。
2. 展示量只能用来判断两件事：**（a）这个词我们有资格被考虑；（b）我们目前离第 1 页有多远**。不能用来判断市场大小。
3. 均排是窗口平均值。一个词若只在某天排到第 5、其余时间在第 60，平均值仍会被拉高——所以「可赢词」筛选是**下界**。

---

## 一、现有词表分析

### 1.1 两个窗口放在一起看，会看到一个反直觉的事实

| 窗口 | 展示 | 点击 | CTR | 均排 |
|---|---|---|---|---|
| 90 天 | 1,355 | 2 | 0.15% | 67.3 |
| 28 天 | 313 | 0 | — | **47.7** |

28 天占 90 天展示的 23%（时间占比 31%），**展示在收缩，但均排从 67.3 改善到 47.7**。

这不是坏消息。它的含义是：**我们在更少、但更相关的词上排得更靠前了**——泛词带来的噪音展示在退潮，剩下的是有意图的词。改版后的方向是对的，问题只是"还没到能拿到点击的位置"（第 1 页门槛是前 10，我们最好的非品牌词在 26–50 区间）。

### 1.2 126 个词，按族聚类（90 天）

| 词族 | 代表词（展示/均排） | 族展示合计 | 均排区间 | 判定 |
|---|---|---|---|---|
| **AI readiness score** | ai readiness score 136/84.3 · what is an ai readiness score for a website 64/72.0 · website ai readiness 58/72.2 · ai search readiness 52/88.4 · how to check website ai-readiness? 32/83.3 · ai search readiness checker 15/93.5 · ai readiness checker 12/81.1 · citation readiness 10/69.6 | **≈378**（占窗口 28%） | 69–95 | **意图错配，见 §3.1** |
| **what is geo / geo 泛词** | what is geo 80/85.3 · geo score 58/79.8 · geo google 15/75.7 · what does geo mean 5/89.2 · geo meaning 6/96.8 | ≈190 | 72–97 | 同形词污染（地理／GEICO／卫星），打不动 |
| **json-ld** | json ld für ai search **62/50.3（德语）** · json-ld 26/79.3 · json ld 16/80.7 · json-ld schema for ai 13/69.6 · json-ld для ai **3/26.3（俄语）** | ≈130 | 26–84 | **唯一有量且排名不太差的族，见 §4.3** |
| **llms.txt** | llms.txt 16/86.3 · **llms.txt checker 14/69.0** · llms txt 4/84.8 · llms txt format 4/87.5 · llms full txt 3/81.7 · llms.txt specification 2025 6/91.0 · llms.txt validator 2/52.0 | ≈65 | 52–94 | 意图明确（找工具），我们排名太差 |
| **searchscore（竞品词）** | searchscore ai 57/81.2 | 57 | 81.2 | 蹭不到，见 §2.5 |
| **geoscore（品牌）** | geoscore 24/**19.0** | 24 | 19.0 | **唯一稳定的可赢词** |
| **自然语言完整问句** | how do i score a page for ai readiness **before i publish it?** 1/**6.0** · structured data for ai search 5/**6.2** · structured data json 3/**9.3** · llms.txt best practices 2026 1/**2.0** · how to link brand entities using json-ld 2/**6.0** · what are the main signals that make an ai model trust and reference a site 1/**8.0** · llms-txt example 1/**11.0** | ≈15 | **2–11** | **排名最好，但每条只有 1–5 展示** |

### 1.3 页面维度：45% 的展示押在一个打不动的词上

| 页面 | 展示（90天） | 占窗口 | 均排 |
|---|---|---|---|
| `/tools/ai-readiness-score/` | **619** | **45.7%** | 78.6 |
| `/tools/ai-readiness-score`（无尾斜杠变体） | 9 | 0.7% | 72.1 |
| `/blog/json-ld-structured-data-ai-search/` | 276 | 20.4% | 52.8 |
| `/blog/what-is-geo/` | 130 | 9.6% | 83.8 |
| `/`（首页） | 102 | 7.5% | 60.3 |
| `/blog/llms-txt-ultimate-guide/`（+无斜杠 5） | 96 | 7.1% | 49.5 |
| `/about/`（+无斜杠 4） | 60 | 4.4% | 38.3 |
| `/tools/llms-txt-checker/` | 36 | 2.7% | 63.6 |
| `/blog/eeat-signals-ai-search/` | 30 | 2.2% | **22.4** |
| `/blog/how-to-write-llms-txt/`（**旧 URL，源码中已不存在**） | 14 | 1.0% | 65.4 |
| `/blog/geo-tracking-ai-visibility/` | 3 | 0.2% | 36.7 |
| `/blog/multimodal-geo-2026/` | 4 | 0.3% | 6.8 |
| `/zh/` | 2 | 0.1% | 2.0 |

> **⚠️ 这张表有一行已经失效：`/about/`（56 展示 / 均排 38.3）现已被 301 到 `/methodology/`。**
> 线上核实（2026-10-22）：`/about/` → 301 → `/methodology/`；而 `/methodology/` 在 GSC 页面维度**零展示**。`_redirects` 里确有这条规则（`/about/ /methodology/ 301`），是刻意合并，但 `decision-2026-10-22.md` 里没有记录理由。
>
> **但我查了它具体吃什么词之后，结论要往回收——这次合并大概率是对的：**
>
> | 查询词 | 落在 `/about/` | 落在 `/` | 判读 |
> |---|---|---|---|
> | `geo score` | 22 展示 / 均排 68.3 | 40 展示 / 均排 87.0 | 主归属在首页 |
> | `geoscore` | 6 展示 / 均排 36.3 | 19 展示 / 均排 15.7 | 主归属在首页，且首页排得好得多 |
> | `what is geo score` | 2 展示 / 均排 72.0 | — | — |
>
> `/about/` 全部展示来自这 3 个词（合计 30，其余 26 为低于聚合阈值的零散词）。**这 3 个词全是「geo score 是什么 / 这个分数怎么来的」，methodology 比 about 更对口**——about 讲"我们是谁"，methodology 讲"分数怎么算"。我初判"意图不同、301 会归零"是错的，数据不支持。
> 真正要盯的只有一个：`geoscore` 在 about 页有 6 展示 / 均排 36.3（全站该词第二落点）。但它主归属是首页（19 展示 / 均排 15.7），about 只是次要落点，损失有限。
> **结论（第三次修正后的最终版）：这次合并是对的，不必撤回，也不需要"观察 methodology 能否接住"。**
> 我先后判错两次：先判"意图不同、会归零"（错在没查词），再判"接得住但要观察"（错在没查落地页）。实际证据链完整：
> - `src/pages/methodology.astro:130` 有 `<div id="about">`，标题 **"About & Contact"**，写明「GeoScore is built and maintained by **anan**, a GEO researcher」+ Author + 源码地址 + 贡献方式——**这就是 About 区块，不是纯打分文档**
> - `src/layouts/Layout.astro:24` 全站 `<link rel="author" href="https://geoscore.help/methodology" />`——**站点早就把 methodology 当作者页在用**，Person schema 的 url 与 Organization 的 sameAs 也都指向它
> - `/zh/about/` 有配套 301，中英对称
> 所以 about → methodology 是有意的**实体页合并**，且落地内容早就存在。`decision-2026-10-22.md` 没记，只是没写文档，不等于没做决策。
> **量级校准（避免为这个数字排期）**：56 展示/90 天 ≈ 0.6 次/天，均排 38.3 = 第 4 页；可转移份额接近 0（`geoscore` 主落点本就在首页、`geo score` 两边都在第 7–8 页）。**修复价值不在流量，在"不留 404"和实体页链路自洽。**
>
> **唯一仍成立的缺口（属性级，可立即修）**：`/about` 与 `/zh/about` **硬 404**——规则只写了带斜杠版，`/about/` 目录不存在后 Cloudflare 不再补 308。修法：`public/_redirects` 补两行 `/about  /methodology/  301` 与 `/zh/about  /zh/methodology/  301`。
> 另有一条**体验级**（不是 SEO 级，片段不参与排名信号）：`/about/` → `/methodology/` 会把人丢到页面顶部的打分正文，而不是那个 About 区块。改成 `/methodology/#about` 更顺，但**不要为它单独排期**。

**15 篇文章里有 8 篇正文 + 1 篇 changelog 在 90 天内零展示**：`ai-crawler-robots-txt-templates` / `ai-search-engine-list` / `auditing-1200-websites` / `geo-citation-optimization` / `geo-maturity-model-2026` / `geo-metrics-2026` / `geo-vs-seo` / `why-doesnt-chatgpt-cite-my-website` / `geoscore-update-multi-page-security`，外加 `/tools/robots-txt-ai-checker/` 也是零展示。

同时核实过：`/sitemap.xml` 返回 200、含 36 个 URL，上述页面**全部在 sitemap 里，也都返回 200**。所以这不是索引缺失，是**内容在这些词的 SERP 里没有竞争力**（排到 100 名以外就不计入展示）。

**这 8 篇不能当成同一个病因处理**（此处修正初稿的过度归因，数据由 link-strategist 补充核对）：按「正文入链数 / 入链来源里有几个来自有展示的页面」再切一刀，会分成两类完全不同的问题：

| 类别 | 文章 | 入链情况 | 该做什么 |
|---|---|---|---|
| **真·双重孤立**（无排名 + 无强源入口） | `geo-maturity-model-2026`<br>`geo-citation-optimization`<br>`ai-crawler-robots-txt-templates`<br>`geo-metrics-2026` | 1–3 条，来源全是 `/blog/` 索引卡或零展示页 | **补链有效**，这是唯一应该投入外链/内链工作的 4 篇 |
| **入口已够，病因在内容与标题** | `geo-vs-seo`（11 条/8 源）<br>`auditing-1200-websites`（7 条/6 源）<br>`why-doesnt-chatgpt-cite-my-website`（6 条/6 源）<br>`ai-search-engine-list`（5 条/5 源） | 均有 eeat / what-is-geo / json-ld 等有展示页指向 | **补链收益接近 0**，必须走 §4 主题 1 的内容改造 |

`/tools/robots-txt-ai-checker/` 尤其要更正：它有 **12 条正文入链、8 个来源**（含 what-is-geo 和 ai-readiness），**不是入口不足**。继续给它加链不会有任何效果，它的问题是需求匹配和标题，跟上面右栏 4 篇同类。

**这条修正的直接后果**：8 篇里只有 4 篇值得投内链工作，另外 4 篇要投内容改造。如果按初稿"8 篇都去补链"，会把力气花在一半无效的地方。

### 1.4 「可赢词」口径下只剩 4 条

90 天内 均排 ≤30 且 展示 ≥3 的词只有：`geoscore`(24/19.0)、`structured data for ai search`(5/6.2)、`structured data json`(3/9.3)、`json-ld для ai`(3/26.3)。合计 23 展示 = 窗口的 7.3%。

**126 个词里 93% 在第 30 名以外。** 改标题、改 meta 在这个体量下收益接近零——这不是文案问题。

---

## 二、竞品占位图

四个词分别代表了四种完全不同的 SERP 生态，**不能用同一套办法打**。

### 2.1 "ai readiness score" —— 词已经被另一个行业占了

前 5 名（2026-10-22 实查）：

| # | 域名 | 形态 | 它卖什么 |
|---|---|---|---|
| 1 | lsbuk.co.uk | 博客（12 点组织自评） | 商学院课程 |
| 2 | complyjet.com | 博客（28 题打分卡 + PDF 下载） | 合规 SaaS |
| 3 | intuz.com | 博客（五维企业记分卡） | AI 咨询/交付 |
| 4 | ecosmob.net | 博客（0–5 分加权模型） | 定制 AI 开发 |
| 5 | aidolsgroup.com | 博客（五维评估） | AI 咨询 |

**五个全是"企业组织是否具备 AI 能力"（人才、数据治理、战略、预算），没有一个是"网页技术层面能否被 LLM 引用"。**

这是本次最重要的单条发现：**我们 45.7% 的展示（619 次）来自一个我们既不匹配、也永远打不进去的词。** 用户搜 "ai readiness score" 想的是"我们公司 ready 吗"，进来看到"你的 JSON-LD 缺 Organization 标记"会立刻跳出。这解释了 619 展示 / 1 点击的极端比例——不是标题不够吸引，是**人和货对不上**。

连带受影响的是我们主工具页的整个定位。`/tools/ai-readiness-score/` 这个 URL 和 H1 都在打这个词族。

### 2.2 "geo audit tool" —— 一个站垄断 + 一个工具箱

| # | 域名 | 形态 | 结构 |
|---|---|---|---|
| 1 | geoaud.it | SaaS 产品页 | 落地页 |
| 2 | geoaud.it（http） | 同上 | 落地页 |
| 3 | geoaud.it/docs/getting-started | 文档站 | docs 子页 |
| 4 | geoptie.com | 免费工具矩阵 | 6 个独立工具页（GEO Audit / Content Checker / Keyword Finder / Rank Tracker / Cannibalization Checker / Backlink Finder） |
| 5 | geoaud.it/docs | 文档索引 | docs |

**geoaud.it 占了 5 席里的 4 席**，靠的是"产品落地页 + 一个塞了 20+ 篇专题 docs 的文档站"双轨。它没有靠单页取胜，靠的是**页面数量 × 主题密度**：robots.txt / LLMs.txt / structured data / E-A-T / 30 天路线图，每篇一个独立 docs URL。

geoptie.com 走的是另一条：**免费工具矩阵**。6 个免费工具，每个独立页，互相内链。这跟我们的思路一致，但我们是 3 个、它是 6 个，且它的付费墙在后面（$41/mo 起）。

对我们的含义：**工具页要做成矩阵，单点工具页在这个 SERP 里没有位置。**

### 2.3 "llms.txt checker" —— 官方定义 + 一堆单人小工具

| # | 域名 | 形态 | 特点 |
|---|---|---|---|
| 1 | llmstxt.org | **标准制定者** | 规范原文，永远第 1 |
| 2 | llmstxt.org/domains.html | 规范延伸 | 分行业示例 |
| 3 | llmstxthub.com | 免费工具（无需注册） | 9 项检查 / 100 分制 / 纯前端 |
| 4 | ansezz.com/tools/llms-txt-generator | **个人站** | 生成器 + 校验器，纯浏览器 |
| 5 | aeoradar.com/llms-txt-validator | 免费工具 | 校验项逐条列出 + 常见错误表 |

**这是本次最"可撬动"的一个 SERP**：第 3–5 名是两个个人站和一个新站，没有大厂护城河。它们的共同做法不是"做个工具"，而是**把校验规则逐条写在页面上**——aeoradar 把 "What the validator checks" 列了 12 条，再配一张"常见错误 → 长什么样 → 怎么修"的表格；ansezz 把"v2 改了什么"整段写出来。

我们已有 `/tools/llms-txt-checker/`，36 展示 / 均排 63.6，`llms.txt checker` 这个词 14 展示 / 均排 69.0。**页面存在、词存在、排名差**——差的是页面正文的厚度和证据密度。

另有一条必须引用的事实（aeoradar 页面上有，我们不能装作不知道）：**Ahrefs 2026-05 的研究称 97% 的 llms.txt 文件零请求**。我们页面上没有这条。竞品敢引用反方证据，我们只讲"应该做 llms.txt"，可信度是输的。
**⚠️ 但这条不能单独引**——我们的打分器给 llms.txt 独占 12 分权重，且**空文件就能拿 5 分**（`exists` 4 + `length` 1），引了会和自己的评分逻辑正面冲突。必须先改打分再引，详见 §4 主题 2 的第 ③ 项。

### 2.4 "how to get cited by chatgpt" —— 全是代理公司长文 + 底部免费查分

| # | 域名 | 形态 | 结构特征 |
|---|---|---|---|
| 1 | edgeshiftagency.com | 代理公司博客 | **12 步 playbook** + 时间线预期 |
| 2 | enterno.io | 工具商博客 | 短答案前置 + Article/FAQPage JSON-LD 代码示例 |
| 3 | citerankscore.com | 工具商博客 | 博客 + "View as AI Crawler" 工具 + 免费 Visibility Score |
| 4 | mediaplusdigital.com.my | 代理公司博客 | **8 步 playbook**，主打"branded mentions > backlinks" |
| 5 | aeoagent.ai | 工具商 | 5 步 + 12 项免费扫描 |

**5/5 全是"N 步操作文 + 页尾免费查分 CTA"。没有一篇科普文、没有一篇纯理论。** 每篇都做了同一件事：把"怎么做"拆成可勾选的步骤，最后用一个免费工具把读者转成用户。

这直接印证了 §3 的需求判断。

### 2.5 顺带发现：竞品词 `searchscore ai` 有 57 展示，我们排 81.2

有两个同名的不同产品在抢这个词：**searchscore.io**（英国，Ronnie Huss，250+ signals / 8 大类 / 免费无需注册，自称自评 98/100）和 **searchscore.ai**（DareAISearch 旗下，主打品牌在 AI 回答里的可见度）。

`searchscore.io` 的形态跟我们**几乎完全同构**：免费 AI Visibility Score、多信号打分、无需注册、有独立 guides 栏目做深度内容。它是我们最像的对手，不是 geoaud.it。

57 展示排 81.2 说明：**用户在搜竞品时我们被 Google 考虑过，但排不进去。** 这个量不该去硬抢（同名品牌词权重在对方），只作为竞品监控指标。

---

## 三、需求形态判断

### 3.1 结论：需求是**任务型**，不是教育型。我们的供给结构是教育型为主。

**证据链一：我们排名最好的词，全是带场景的完整问句。**

均排 2–11 的 7 条词里，5 条是这种形态：

- `how do i score a page for ai readiness **before i publish it**?` → 6.0
- `what are the main signals that make an ai model **trust and reference** a site?` → 8.0
- `llms.txt **best practices 2026**` → 2.0
- `how to **link brand entities** using json-ld` → 6.0
- `structured data **json**` → 9.3

这些词的特征：**用户已经知道要做什么，只是在找"具体怎么做"和"做到什么标准"。** 没有人问 "GEO 是什么" 排到前 10。

**证据链二：教育型泛词全部深水区，且被同形词污染。**

`what is geo` 80 展示 / 均排 85.3；`what does geo mean` 5/89.2；`geo meaning` 6/96.8。这些词的 SERP 里混着地理（geography）、GEICO、GEO 卫星、GEO 集团——**这是一个永远打不动的词**，不是"我们内容不够好"。

**证据链三：竞品 SERP 形态印证（§2.1–2.4）。**

四个词里，能进前 10 的内容有 **13 篇是"怎么做"，0 篇是"是什么"**。唯一带教育性质的 llmstxt.org 之所以第 1，是因为它是**规范制定者**（我们不可能复制这个位置）。

### 3.2 现有页面覆盖了哪一类：一半对，一半错，而且对的那些没被搜到

把 15 篇文章 + 3 个工具页按"教育型 / 任务型"分（changelog 不计）：

| 类型 | 页面 | GSC 表现 |
|---|---|---|
| **教育型（5 篇）** | what-is-geo、geo-vs-seo、geo-metrics-2026、geo-maturity-model-2026、multimodal-geo-2026 | what-is-geo 130 展示/83.8；geo-vs-seo、geo-metrics、geo-maturity-model **全部 0 展示**；multimodal 4/6.8 |
| **任务型（8 篇+3 工具）** | why-doesnt-chatgpt-cite-my-website、geo-citation-optimization、llms-txt-ultimate-guide、json-ld-structured-data-ai-search、eeat-signals-ai-search、ai-crawler-robots-txt-templates、ai-search-engine-list、auditing-1200-websites；/tools/llms-txt-checker、/tools/ai-readiness-score、/tools/robots-txt-ai-checker | json-ld 276/52.8、llms-txt-guide 96/49.5、eeat 30/22.4、llms-checker 36/63.6；**why-doesnt-chatgpt-cite、geo-citation-optimization、ai-crawler-robots-txt-templates、ai-search-engine-list、auditing-1200 全部 0 展示**；robots-txt-checker 0 展示 |

**读法：**

1. 教育型 5 篇里有 3 篇 0 展示，唯一有量的是 `what is geo`——但那 130 展示换不来点击（均排 83.8）。**教育型是沉没成本区。**
2. 任务型里表现最好的（json-ld 276 展示、llms-txt 96 展示、eeat 30 展示/22.4）**恰好是"主题够窄、能被具体问题命中"的三篇**。
3. 任务型里最对症的两篇——`why-doesnt-chatgpt-cite-my-website` 和 `geo-citation-optimization`——**零展示，但病因不同**（此处按 link-strategist 的入链数据修正）：前者有 6 条入链/6 个来源（含 eeat、json-ld 两个有展示页），**入口不缺**，问题是标题形态；后者只有 2 条入链且来源含零展示页，**是真·双重孤立**，内容再好也没人爬得到。两篇都要改造，但前者只需改标题+合并，后者还得先解决入口。前者标题其实写得不算差（`Why Doesn't ChatGPT Cite My Website? 7 Reasons (And How to Fix Them)`），问题是**标题形态跟查询词形态不匹配**：用户搜的是 `how to get cited by chatgpt`（操作型），我们给的是 `why doesn't chatgpt cite my website`（诊断型反问句）。§2.4 里 5 个竞品用的全是 `How to Get Cited by...`。

**所以本站的真实瓶颈不是"缺内容"，是三件事叠加：**
- 打错了一个大词（ai readiness score，378 展示的 28%）
- 写对了主题但用错了标题形态（citation 两篇）
- 内容厚度不够，支撑不了 20–50 名往 10 名爬（llms.txt checker）

### 3.3 一个必须说清的否定结论：中文站现在不该投

`/zh/` 90 天只有 2 展示 1 点击。GSC 126 个词里**没有任何一条中文查询**。中文站有 3 个工具页 + 首页 + 方法论 + 定价，但零需求信号。

这不是"中文不重要"，是**在没有信号的地方加产能，等于把资源投进黑洞**。建议：维持现状不扩，等中文有 ≥20 展示再评估。（同样逻辑适用于 `json-ld для ai` 俄语词——有信号但只有 3 展示，见 §4.3 的 tier 2。）

---

## 四、最值得做的 3 个主题

排序依据：**（1）当前离第 1 页最近；（2）SERP 可撬动性；（3）现有资产可复用度。** 不看"市场大小"——那个数据我们拿不到。

### 主题 1｜"get cited by ChatGPT" 词族 —— **改标题 + 合并成 hub**（最高优先）

| 项 | 内容 |
|---|---|
| **目标词族** | `how to get cited by chatgpt`、`why doesn't chatgpt cite my website`、`get cited by perplexity`、`chatgpt not citing my site`、`ai citation` / `citation readiness`（现 10 展示/69.6） |
| **现有页面能否承接** | **能，但要用错位的方式承接**。`blog/why-doesnt-chatgpt-cite-my-website` 和 `blog/geo-citation-optimization` 两篇都在（均返回 200、均在 sitemap），合计 0 展示。内容资产在，标题形态错。 |
| **新建还是扩写** | **改造 + 合并，不新建**。理由：这两篇主题高度重叠（都在讲"为什么没被引用"），分散成两篇各自都太薄，合成一篇 hub 才有厚度。 |
| **具体动作** | ① 把 `why-doesnt-chatgpt-cite-my-website` 的 title/H1 改成操作型：`How to Get Cited by ChatGPT (2026): 11-Point Checklist + Free Audit`——**必须含 "How to Get Cited by ChatGPT" 这个完整词组**，因为竞品 5/5 都在标题里放了它。② 把 `geo-citation-optimization` 的内容并入作为 "citation signals" 章节，原 URL 301。③ 正文补 §2.4 竞品都有而我们没有的三块：**逐项检查清单（可勾选）**、**时间线预期（周 1–2 技术、周 3–6 内容、周 4–8 首次引用）**、**每条修复对应到我们自己的工具检查项**。④ 页尾挂 `/tools/ai-readiness-score/` 的 CTA。 |
| **为什么排第一** | 两条独立证据指向同一结论：我这边看 SERP，5/5 是代理公司长文、**没有工具商占住"清单 + 免费工具"这个组合位**；link-strategist 那边看内链，这一页已有 6 条正文入链、6 个来源（含 eeat 和 json-ld 两个有展示页）——**入口不缺，缺的正是标题形态**。加上资产已存在、改造成本最低，且这词族与我们的工具是天然上下游（"怎么被引用" → "先测一下你是否可被引用"），三重理由叠加。 |
| **风险** | 均排会从"无排名"开始爬，短期不会有展示。这是补课，不是捡漏。 |

### 主题 2｜"llms.txt checker / validator" 词族 —— **扩写工具页**（性价比最高）

| 项 | 内容 |
|---|---|
| **目标词族** | `llms.txt checker`（14/69.0）、`llms.txt validator`（2/52.0）、`llms txt checker`、`llms txt validator`（2/94.5）、`llms.txt`（16/86.3）、`how to validate llms.txt`、`llms.txt file format`（4/87.5） |
| **现有页面能否承接** | **能，页面已就位**。`/tools/llms-txt-checker/` 36 展示/均排 63.6，`/blog/llms-txt-ultimate-guide/` 110 展示级/均排 49.5（新 URL 96 + 旧 URL 301 过来的 14，两个 URL 不能当两页算）。两个页面一工具一长文，结构是对的。 |
| **新建还是扩写** | **纯扩写，不新建**。这是全站"页面已有 + 词已有 + 排名只差 40 位"的唯一组合。 |
| **具体动作** | **⓿ 前置条件 —— 已被 link-strategist 的 P1-4 覆盖，本条无需我再主张**。核实到的不是"要不要加链接"，而是**链接写错了**：`/blog/llms-txt-ultimate-guide/` 的 CTA 锚文本写着 `Run free llms.txt audit →`，HTML 却是 `href="/"`（指向首页）。文案说"审计"，落点却是首页——这是属性级错误，一条 `href` 改动即可修，**不需要任何流量假设**。P1-4 的落点清单：`Run free llms.txt audit →` 改指 `/tools/llms-txt-checker/`（锚文本 `run a free llms.txt audit`）、正文中部那条 `GeoScore` 改指工具页（锚文本 `check your llms.txt against the spec`）、顶部品牌锚保留、另新增 1 条指向 `/blog/ai-crawler-robots-txt-templates/`。<br>**闭环要求（有先后，不能并行）**：P1-4 是"指南 → 检测器"，P0-1 是反向的"检测器 → 指南"。**两条必须都做，而且必须先 P1-4、后 P0-1。** 理由不是我的扩写时序，是链接图当前的状态：`/tools/llms-txt-checker/` 有 16 条正文入链 / 7 个来源，属于"有入链但不出链"；`/blog/llms-txt-ultimate-guide/` 是"有出链但 4/5 全给首页"。先补 P0-1 的话，新加的出链权重会顺着指南那 4 条还没修的 `/` 链接流回首页——等于给一个源还没接上的页面加出链。**先堵漏，再补链。**<br>① 工具页正文列出**我们引擎实际判的 5 项**——**不要照抄竞品的 13 项清单**（我初稿就是这么写的，直接抄了 §2.3 aeoradar 的 13 条，但 `llmstxt.js` 只判 5 项。照抄会造成"页面说 13、引擎判 5"，用户拿 13 条对照报告立刻发现对不上——这个矛盾比 Ahrefs 那条更致命，而我自己先犯了）。5 项的真实语义如下，写页面时要连带写出"坑"：<br>**1. `exists`** — 引擎判定：拉到任意 200 文本就算存在。坑：**软 404（返回 200 的 HTML 错误页）也会被算作"有 llms.txt"**——"检测到文件"≠"文件合法"。<br>**2. `structure`（改后 4 分）** — 判定：文件**第一个字符**起必须是 `# `，且文中要有 `> ` 引用块；H1 与 blockquote 是**同一条检查**。坑：前面有空行 / BOM / HTML 注释就失败。<br>**3. `areas`（改后 3 分）** — 判定：≥2 行以 `## ` 开头。坑：**`###` 不算**（实测只有 10/12）。<br>**4. `links`（改后 3 分）** — 判定：至少 1 条绝对 http(s) URL 的 markdown 链接。坑：全用相对链接（`/about`）会失败（实测 10/12）；只要 1 条绝对 URL 就过。<br>**5. `length`（改后 1 分）** — 判定：总行数 ≤200。坑：**空文件也算通过**（`''.split('\n').length === 1`）——这是待修的 bug，**页面里不要把"≤200 行"说成优点**。<br>如果确实想列 v2 规范的全部建议，**必须写明"我们校验其中 5 项，其余为规范建议"**，否则就是页面与引擎不同步。<br>② 加"常见错误 → 长什么样 → 怎么修"三列表格。<br>③ **反方证据的引用有前置条件——不能单独引**：`scoring.js:3` `aiGuidance: 12`，`scanner.js:102` 让这个维度 **1:1 等于 llmsResult**（llms.txt 独占总分 12 分）；`llmstxt.js` 里 `exists` 给 4 分。**更要紧的是实测算出来是 5 分不是 4 分**：空文件 `score 5/12`——因为 `length` 判 `lines.length <= 200`，而 `''.split('\n').length === 1`，**一个 0 字节文件通过 5 项里的 2 项，其中一项还是"长度达标"**。所以在页面引「97% 的 llms.txt 零请求」，用户下一屏就会问：**"那你为什么给它 12 分，还让空文件白拿 5 分？"**<br>**已定方案 (b)+(c)**：权重改为 `exists 1 / structure 4 / areas 3 / links 3 / length 1`（合计仍 12，写对的满文件仍是 12 分，不动顶部）；**补丁：`length` 只在 `structure` 通过时才计分**，否则空文件在新方案下还能白拿 1 分。方法论加一句"llms.txt 是低成本期权，不是已验证的排名因子；本项测文件结构完备度，不是被引用概率"。<br>**成本已量化（324 站语料模拟）**：受影响 43 站，全站总分均值 **−0.27 分**，中位数 41→41 不变，有 llms.txt 的 78 站维度均值 9.71→8.60（−1.11）。**处置成本低到可以立刻改。**<br>**⚠️ 但有一条纪律**：审计文章里的 "60.3 vs 38.0 / 22 点 / 24.1%" 是**绑定评分版本的数**，改动上线时必须二选一——重跑（`tools/run-audit.mjs`）或明确标注"按 v1.8 评分口径（2026-10）"。否则就是第三次"数字与代码不同步"。按新方案，那两个数会变成 **"59.2 vs 38.0"（差距 22.3 → 21.2）**，排序与结论方向不变。<br>④ 补 v2 变更（2026-08-10：任意路径 / `page.md` 也合法 / `rel="alternate"`，见 §2.3 ansezz 页）——**v2 是 8 月的事，我们页面若还写 v1 就是硬伤**。 |
| **为什么排第二** | ①SERP 第 3–5 名是两个个人站 + 一个新站，无大厂护城河；②我们的排名 63.6 已在中游，靠页面厚度能往上推；③不需要新写文章，只需把引擎里已有的规则暴露到页面。（前三项都是**有前提的主张**——前提是"页面厚度能推动排名"，需要 4–8 周验证。）<br>**④ 但本主题里有一部分是零前提的**：⓿ 的 P1-4 属"改完即改善、不需要流量验证"，性质是修正 `href` 写错。所以本主题要分两段看——**⓿ 可以立刻做且必赚；①–④ 是赌注，做完要等验证**。不要因为 ⓿ 是免费的就顺带认为整条主题都免费，这是本主题最容易被误读的地方。<br>**判据（可直接复用，不看出处）：新增链接一律算赌注；只有 href / 锚文本 / 状态码层面的写错，才是零前提修正。**<br>**且"源页有没有排名"不能作为赌注的反证**——本案 4 个源里 3 个有排名（eeat 22.4 / llms-txt 49.5 / json-ld 52.8），补链依然是赌注，因为赌的是「链接能传递 → 传递能推动排名」这条链，不是「源页有没有权重」。防止有人拿"我从 eeat 出链所以确定性高"来抬价。 |
| **跨专项依赖** | 第 ③ 项（引 Ahrefs 97%）**不能由本专项单独完成**，但**方案已经定了**，不再等待决策：rate-authority-auditor 已选 (b)+(c)，权重改为 `exists 1 / structure 4 / areas 3 / links 3 / length 1`，并补 `length` 需 `structure` 通过的补丁。现在只等落地。**① 和 ③ 必须与打分器改动同批上线**——① 的 5 项语义直接来自 `llmstxt.js`，如果先写页面后改引擎，页面会立刻与引擎脱节。**②④ 完全独立，可立即做。** |
| **风险** | 顶上有 llmstxt.org 两席（规范原文）永远在，第 1 页目标应定在 4–7 名，不是第 1。 |

### 主题 3｜德语 `json ld für ai search` —— **新建 de/ 版本**（唯一无人竞争，但**不是增量机会**）

| 项 | 内容 |
|---|---|
| **目标词族** | `json ld für ai search`（**62 展示 / 均排 50.3**）、`json-ld schema für ai`、`strukturierte daten für ki`；旁证：国家维度 `deu` 19 展示 / 均排 47.3 |
| **现有页面能否承接** | **已经在承接了——这才是关键**。`json ld für ai search` 的 62 展示**全部落在 `/blog/json-ld-structured-data-ai-search/`**（英文页，占该页 276 展示的 22%，均排 50.3）。所以不是"没有页面接住"，是"英文页在接德语词，接得还行"。改造基础极好，但**做德语版的动作性质是"换页承接"，不是"从零接住"**。 |
| **新建还是扩写** | **新建 `de/` 版本**（只做这一篇 + 一个工具页，不翻全站）。 |
| **具体动作** | ① 新建 `/de/blog/json-ld-fuer-ai-search/`，基于英文版**结构**重写而非机翻（德语 SERP 里目前没有一篇专门讲 "JSON-LD für AI Search" 的完整文，已有命中都是零散内容）。② H1 用 `JSON-LD für AI Search: Der vollständige Leitfaden 2026`。③ 加 `hreflang`（de / en / x-default），`/de/` 加进 sitemap。④ 只做这一篇 + `/de/tools/ai-readiness-score/`。 |
| **为什么排第三** | 全站唯一"有量（62 展示，单语种第一）+ 排名不太差（50.3，远好于 ai readiness score 的 84.3）+ 竞品空位"三者叠加的组合。 |
| **⚠️ 三个必须打折的理由** | **① 增量论证已失效——只剩"更对口"论证（最关键）。** 这 62 展示已全部落在英文页，做德语版是**把这批展示搬家**，总展示量可能几乎不变。所以**这次投入的证据基础不是"德语市场有需求增量"，而是"同样的展示落在德语页上排名可能更好"**。⚠️ 推论：**任何人都不能拿 json-ld 页的 62 展示当作"德语的增量证据"**——它是最坏的反例（德语词本来就在吃英文页）。真正能证明德语需求增量的，是那种"德语词出现在原本没有对应德语页的页面"的情形，我们目前**没有这类证据**。<br>**② 量级很小**：62 展示只占 1,355 的 4.6%，`deu` 国家只有 19 展示、与 62 不匹配（部分德语查询地理归属不在德国），可能来自极少数用户重复搜索。<br>**③ 验收口径只认一个指标**：德语版上线 60 天后 `json ld für ai search` 均排是否**优于 50.3**（英文页现状）。优于 = 继续；不优于 = 停掉，不扩其他语种。**定这条是因为：如果德文版只做到 55，那是净亏——多维护一个语种，排名反而更差。** |

### 明确不建议做的（写下来是为了防止下次又提议）

| 事项 | 理由 |
|---|---|
| **继续优化 `/tools/ai-readiness-score/` 去打 `ai readiness score`** | 619 展示 / 均排 78.6 / 0 点击，且 SERP 5/5 是企业 AI 转型咨询（§2.1）。这是词选错了，不是页面做得不好。**该考虑的是给这个页面换一个目标词族（如 `website ai readiness` 58/72.2 → 更贴 `check ai readiness of a website`），而不是继续加内容。** |
| 打 `what is geo` / `geo meaning` / `geo score` | 均排 79–97，同形词污染严重（地理/GEICO/卫星）。教育型沉没区（§3.2）。 |
| 抢 `searchscore ai` 竞品词 | 57 展示排 81.2，同名品牌权重在对方手里，抢不动（§2.5）。只做监控。 |
| 扩充中文站 | 90 天 2 展示、0 条中文查询（§3.3）。无信号不加产能。 |
| 一次性做德语/俄语多语种 | 见主题 3 的 ⚠️：先单篇验证，不铺开。 |
| 全站改 title / meta 想整体提排名 | 126 词里 93% 在第 30 名以外（§1.4）。在这个位置，文案改动的边际收益接近零。 |

---

## 五、给其他成员的 3 条接口信息

1. **给 link-strategist（已双向核对，含一处对我初稿的修正）**：
   - `/blog/how-to-write-llms-txt/` 在 90 天内仍有 14 展示 / 均排 65.4，源码里已无此文件。**已核实：301 正确指向 `/blog/llms-txt-ultimate-guide/`，重定向本身没坏**。不是漏洞，不用处理；读数据时别把新旧 URL 当两个页面，否则会低估 `llms-txt-ultimate-guide` 的真实权重（它的实际表现是 96+14=110 展示级别，不是 96）。
   - **零展示页的病因已按他的入链数据拆分**（见 §1.3 表格）：只有 4 篇是真·双重孤立值得补链，另 4 篇 + `robots-txt-ai-checker` 入口已够、必须走内容改造。我初稿把它们笼统写成"7 篇都没入口"，归因过宽，已修正。
   - **他反过来提供了一个对我这侧有用的发现，并且已经落地成可执行项**：4 个有展示页的出链预算花得很糟——`llms-txt-ultimate-guide`（110 展示，含旧 URL 301 过来的 14）的 5 条正文出链里 4 条指向首页；`json-ld-structured-data-ai-search`（276 展示，全站第一）只有 7 条出链，0 条给 `/methodology/`、0 条给 `/pricing/`、0 条给另外两个工具页。**这直接改写了 §4 主题 2 的执行顺序**：我们计划扩写 `/tools/llms-txt-checker/`，但全站展示最高的 llms.txt 文章没有一条链接指向它。他已把修复单列为 **P1-4**（性质是"改已有链接的落点"，零新增版面），并确认覆盖——**主题 2 的前置条件因此已解除，可直接做正文扩写**。
   - **P1-4 的性质值得单独记一笔**：那条 CTA 的锚文本是 `Run free llms.txt audit →`，`href` 却是 `/`。文案说"审计"、落点首页——**这是属性写错，不是内链策略问题**，不需要任何流量假设就能判定该修。团队里这一类"改完即改善、不依赖流量验证"的项应优先做，它们不占用验证预算。
   - **⚠️ 这条原则的反面界限必须一起记住**：**"改完即改善"只适用于属性和文本错误（href 写错、锚文本与落点不符、301 缺失），不适用于"补一条看起来很合理的链接"。** 新增链接（P0-1～P0-5 那类）全部是**有前提的主张**——前提是"站内权重传递对排名有效"。它们不能因为"也很便宜"就被归进第一梯队。判断标准是**证据强度**（要不要假设），不是**成本高低**（麻不麻烦）。
   - **⚠️ 第二条我自己的教训：引外部反方证据前，必须先查自家产品逻辑是否与该证据冲突，并且要知道改口的成本**。我最初建议"补上 Ahrefs 97% 零请求就能拿诚实分"，但没查打分器——实际 llms.txt 独占 12 分，而且**空文件能拿 5 分**（`exists` 4 + `length` 1，因为 `''.split('\n').length === 1`）。**引了等于自证矛盾。** 通用规则：**任何"引用不利证据来建立可信度"的动作，都要先问两句——"我们自己的产品/打分/定价是否正在做相反的事"和"改口要花多少钱"**。<br>**第二问同样重要**：发现矛盾就改产品也可能很贵。这次能量化出 −0.27 分才敢建议改；如果成本是重算全站、打乱所有历史分数，正确动作就不是"立刻改"，而是"**先标注口径、下个版本再改**"。**诚实不是立刻改，是立刻说清楚，并给出改的时间表。** 这条适用于 llms.txt（本主题）、E-E-A-T（`eeat.js` 用 `/about|privacy|terms/` 正则判信任页，比同业粗）、以及未来所有"承认局限"类文案。
   - **⚠️ 第三条教训：展示量不能当"权重"用，也不能当"新增"用。** 本轮三次踩到同一块石头：
     - **品牌落点**：`/about/` 56 展示看着多，但全部来自 `geo score` 系三个词，是品牌落点不是内容落点，不能当链接源
     - **泛词页**：`/blog/what-is-geo/` 130 展示看着多，但均排 83.8、吃的是 `what is geo`/`geo meaning` 这类打不动的泛词——**它自己都没有排名，能传给别人的权重是可疑的**。对比 `/blog/eeat-signals-ai-search/` 只有 30 展示但均排 22.4。**选源判据应是「主题词 × 均排靠前」，不是展示量。**
     - **转移不是净增**：`json ld für ai search` 的 62 展示已全部落在英文 json-ld 页，做德文版是把这 62 展示**搬家**，总量可能不变。任何"新建语种/新建页面"的建议都要先问一句"这些展示现在落在哪、搬过去会不会只是换个地方"。
   - **闭环提醒**：P1-4（指南 → 检测器）必须和 P0-1（检测器 → 指南）一起做，只做单向权重流是断的，主题 2 扩写的正文依旧拿不到指南的传递。**且有先后：先 P1-4 堵漏，再 P0-1 补链**——否则新加的出链权重会顺着指南那 4 条还没修的 `/` 链接流回首页。
2. **给 rate-authority-auditor**：`/tools/ai-readiness-score/` 的 619 展示 0 点击**不是权威度问题，是意图错配**（§2.1 的 SERP 全是企业 AI 咨询）。如果按"权威度不足"去补作者/引用，会补错方向。真正需要权威度的是 `/tools/llms-txt-checker/`（均排 63.6，SERP 上是个人站，靠证据密度能赢）。
   - **一条可回收的资产**：`/tools/ai-readiness-score/` 的 FAQ 自述——"rates 0 to 100 across 11 dimensions… AI engines can reach, parse and attribute your content"——**是全站最清楚的一句定位话**。如果主题 1 之后要把 AI readiness 词族让出去，这句话别跟着页面一起废弃，可以搬到 `/tools/llms-txt-checker/` 或新 hub 页当定义句。
   - **但搬的时候必须改一处**："11 dimensions" 在新页面上没有上下文，读者不知道是哪 11 个。要换成具体承诺（如"检查 5 项"）。**不要原样搬。**
3. **给 design-system-architect**：竞品 `geoaud.it` 用"落地页 + 20+ 篇 docs 子页"占住 `geo audit tool` 的 4/5 席（§2.2），`geoptie.com` 用 6 个免费工具页做矩阵。**工具页需要支持"矩阵化"的信息架构**（工具之间互相引用、每个工具有独立的规则说明区），不能再按"单页讲故事"的模板做。补充一个现状：我们 3 个工具页之间 6 个互链方向**只存在 1 个**（ai-readiness → robots），矩阵在地基上就是断的。

---

*本文所有展示量、均排均来自 GSC API 实测（属性 `https://geoscore.help/` 已核验）。搜索量为不可得数据，全文未做任何估算。SERP 结果抓取于 2026-10-22。*
