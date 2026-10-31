# 01 · 数据可信度审计（rate authority）

审计对象：GeoScore 的"审计结果本身是否可信"。
方法：读代码 + 用仓库里已有的真实语料（`data/*.csv`）复算 + 对线上 site 跑真实审计。
时间：2026-10-22。审计者：柯验真。

**先纠正一个前提**：仓库与站点里都不存在"14 维"。实际是 **11 个加权维度 + 2 个扣分项**（`src/lib/scoring.js:1-13`；`src/pages/methodology.astro:27-40` 共 13 行）。若对外改写成"14 维"，等于新增一条不可信的声明。现在对外的一致口径是"11 维 / 85+ 检查 / 20 爬虫"，而"85+"实际正好 85（逐项数过，见下文错误 4）。

---

## 【可信的部分】

### 1. 那条最致命的假数据，已经被自己拆掉了

`data/STUDY.md:1-20` 写着：原来 `auditing-1200-websites.astro` 声称"审计了 1,200 个站、82% 有严重问题、llms.txt 带来 3.4x 引用提升"，核查发现生产 D1 的 `audits` 表只有 **3 行、1 个 URL**，且最早一行的日期晚于文章声称的发布日期。他们把结论撤回、真跑了一遍研究。

这是全站最硬的信任资产 —— 不是因为数据好看，是因为**他们有胆量把"我们没有数据"写进公开仓库**。任何"数据可信"叙事都应该从这一条开始，而不是从分数开始。

### 2. 研究头部数字可 100% 复现（我逐项重算过）

用 `data/geo-audit-v2-final.csv` 复算，与 `src/pages/blog/auditing-1200-websites.astro:49-51,109,139-142` 完全一致：

| 指标 | 复算值 | 文章值 |
|---|---|---|
| 有效样本 | 324 | 324 |
| 中位数 | 41 | 41 |
| 均值 | 43.4 | — |
| 有 llms.txt | 78（24.1%） | 78（24.1%） |
| 有 robots.txt | 225（69.4%） | 225（69.4%） |
| 封≥1 个 AI 爬虫（分母=有 robots 的 225） | 8（3.6%） | 8（3.6%） |
| 封 GPTBot | 5（2.2%） | 5（2.2%） |

复现命令见文末 A1。**分母写清楚了、失败率写清楚了、连"没有 robots.txt 不算封禁"这个 25 倍的坑都主动解释了**（`blog:157,226`）。这是专业水准。

### 3. robots 解析是真按 RFC 9309 写的，不是正则拍脑袋

`src/lib/analyzers/robots.js:33-117`：分组解析、连续 UA 行合并、最具体路径优先、空 Disallow 视为放行、无文件默认放行。`:21-26` 还留了实测记录：旧逻辑把 343 个站里的 323 个（94.2%）误判为"全部封禁"，包括实际对 GPTBot 完全开放的 dev.to。

这段注释 + `data/compare-v1-v2.txt` 是同一个故事的两面，可交叉验证。

### 4. 同一 URL 重复跑，分是稳的（网络正常时）

```
run1 total=94 schema=14 eeat=7 brand=6 llms=12 disc=6 crawl=12
run2 total=94 schema=14 eeat=7 brand=6 llms=12 disc=6 crawl=12
run3 total=94 schema=14 eeat=7 brand=6 llms=12 disc=6 crawl=12
```
（https://geoscore.help，命令见 A2）

没有随机数、没有并发竞态、`computeScore` 是纯函数。可复现性这一项**成立**（但有前提，见错误 14）。

### 5. citationReadiness 的前三项权重，是全站唯一有论文出处的映射

`citations.js:11-13` 把 stats / quotes / ext-links 各给 2 分（维度内最高权重），恰好对应 GEO 论文（Aggarwal et al., KDD 2024）实测效果最强的三个策略：Statistics Addition、Quotation Addition、Cite Sources。

这是"阈值有出处"的唯一一处。可惜它被后面的 22 个凑数检查稀释了（见错误 13）。

### 6. 文章明确写了"相关不等于因果"

`blog:190-208` + `data/STUDY.md` 把 3.4x / 6.1x / 3.8x / "top3 修复带来 80% 提升"列进"本数据无法支持"清单，并说明"静态爬虫审计看不见引用"。

这一点比多数竞品的营销页诚实。**建议保留这段，不要为了转化率删掉。**

### 7. 定价数字是对的，且是机器可读的

顺手核了价格（设计专项移交的问题）：`pricing.astro:198-207` 有完整的 `Product` + `Offer` JSON-LD，`price: 0 / 9 / 79` 与页面显示一致；`"Save $29"` 也算得对（$9×12 = $108，减 $79 = $29）。

所以**不要动这三个数字**。要动的是 Pro 卡的视觉结构（设计侧 P2），属于展示问题，不是数据问题。

---

## 【存疑】（阈值无出处 / 无法验证 / 需要赌）

### 存疑 1：绝大多数阈值是拍脑袋的，而且互相打架

- 字数门槛三处三个数：`content.js:11` 标签写 "Content >= 800 words"，`content.js:31` 判 `>= 600`，`recommendations.js:101` 又说 "600-800 words"。
- `schema.js:37` 的 "5+ properties per schema" 把 `@context` 和 `@type` 也算进去 → 实际只要 3 个真实属性；且用的是**平均**而非最小，一个肥 block 能拉高全站。
- `content.js:55` / `citations.js:50` 的"3 个外链"、`citations.js:151` 的"150 词段落"、`llmstxt.js:26` 的"200 行"、`meta.js:21` 的"60-200 字符"，**没有一个能追到来源**。
- `methodology.astro:28-38` 每个维度都标了"Source"，但那些 Source 是 GitHub 仓库名，不是实验。表格给人的印象是"有出处"，实际是"有参考项目"。

其中 `citations.js:151` 的"稠密段落 ≥150 词"最值得怀疑：它把长段落当成加分项，并在 `recommendations.js:139` 直接要求用户"写一个 150+ 词的段落"。这对可读性是负面的，而且没有证据表明引文选择偏好长段落。**这是我在全部阈值里唯一认为"可能反向伤害用户"的一条。**

### 存疑 2：方法论页的百分比是假精确

`methodology.astro:28-38` 写 "12% / 12% / 14% / 10% …"。但权重实际是 12/12/14/10/12/8/8/8/6/4/4，**合计 98**（`scoring.js:1-14`）。`computeScore` 用 `TOTAL_WEIGHT`（98）归一化，所以 0-100 的结果是对的，但 12/98 = **12.2%**，不是 12%；14/98 = **14.3%**，不是 14%。合计 98% 的表格配"100-point scoring"读起来就是错的。

### 存疑 3：aiCrawlability 事实上是个常数量（12 分基本白送）

用同一份 CSV 数出来：**324 个站里 317 个（97.8%）拿满 12/12**，维度均值 11.87/12 = 99%。

实测反证：`https://example.com`（没有 robots.txt，没有任何内容）总分 **9/100**，但 aiCrawlability 拿 **12/12**。

```
https://example.com total=9 crawl=12 llms=0 disc=0 schema=0 content=0 cit=1
https://www.iana.org total=31 crawl=12 llms=0 disc=0 schema=0 content=6 cit=7
```

也就是说：**12% 的分数对绝大多数站点不携带任何信息**。一个"维度"如果 97.8% 的人满分，它测的不是差距，是"你有没有故意封爬虫"。这跟首页"robots 是低分首因"的叙事互相矛盾（见错误 1）。

### 存疑 4：爬虫 tier 把"训练爬虫"和"引用爬虫"混在一起，对 GEO 是倒挂

按厂商 2026 文档：
- 封 GPTBot = 只是不进训练集，**不影响**你在 ChatGPT 里被引用（`robots.js:130`，w3）
- 封 OAI-SearchBot = **不会出现在 ChatGPT 搜索答案里**（`robots.js:131`，w3）

两者同权重。更明显的是 Anthropic：ClaudeBot（训练）在 tier1 w3（`:132`），而 Claude-SearchBot（真正决定能不能被引用）被放到 tier2 w2（`:143`）。对"GEO 审计"这个定位，权重是反的。

### 存疑 5：20 个爬虫里有 3 个不是信号，还漏了 2026 的关键几个

- **`anthropic-ai`（`robots.js:133`，tier1 w3）是遗留 token。** Anthropic 2026 年只文档化 ClaudeBot / Claude-User / Claude-SearchBot；`anthropic-ai` 和 `Claude-Web` 仍在模板里流传，但"对这个名字写规则，拦不住厂商承认发送的任何东西"。给一个已死的 UA 3 分权重，并且 `recommendations.js:76` 让用户去加 `User-agent: anthropic-ai` —— 这是让人做无效功。
- **`Google-Extended`（`:135`，tier1 w3）不是爬虫。** Google 官方文档（2026-10-20 更新）明确：它没有独立 HTTP UA，只是 robots.txt 产品 token，且**"不影响站点在 Google 搜索中的收录，也不作为排名信号"**。标签写 "(Gemini/AI Overviews)" 是错的。
- **`PetalBot`（`:151`）是华为搜索爬虫，不是 AI 爬虫。**
- **`xAI-Bot`（`:148`）**：在两份 2026 年公开清单（BrandVector 31 个、QuanticData 326 域名实测）里都没出现，需向 xAI 文档核实。【赌注】
- **漏掉的（2026-10 现行）**：Claude-User（Anthropic 明确说它**遵守** robots.txt，属取回型，且是用户提问时真正来取你页面的那个）、OAI-AdsBot、Meta-ExternalFetcher、Meta-WebIndexer、Amzn-SearchBot、Amzn-User、MistralAI-{Training,Index,User}、Google-CloudVertexBot、ExaSearchBot、Diffbot 系。
- **CCBot 没有停用**。它是 2026 年"被点名封禁比例最高"的爬虫（约 14%），仍在跑。任务摘要里"CCBot 政策变化/已停用"的前提不成立，建议不要写进对外文案。

### 存疑 6：discoveryEndpoints 的 6 分，押在三个不存在的规范上

`discovery.js:7-19` 给 `.well-known/ai.txt`、`/ai/summary.json`、`/ai/faq.json` 各 2 分。这三个**不是任何引擎的既有规范**，我找不到任何厂商读它们的证据。

数据也印证了：324 个站里 **316 个（97.5%）是 0 分**，维度均值 0.07/6 = 1%。

结论：这 6 分是**结构性不可达分**。除非站点专门为通过这个工具而生造三个文件，否则永远拿不到。geoScore 自己的站有（`dist/ai/` 存在），所以它自己拿 6/6 —— 这是个闭环。

### 存疑 7：llms.txt 占 12%，但没有任何主流引擎公开消费它

2026-10 的实际状况（多来源一致）：OpenAI / Google / Anthropic / Perplexity 都没有公开承诺在检索或引用流程里读 llms.txt；Google 2026-01 明确表示不支持，Mueller 原话是"目前没有 AI 系统使用 llms.txt"。真正的消费者是 IDE agent（Cursor、Claude Code、Copilot）和 MCP/RAG 工具。

llms.txt 本身**成本极低、无害、值得有**，这一点我同意。问题在**定价和措辞**：
- 12% 权重，且 `scanner.js:102` 里 `aiGuidance: llmsResult` —— 这个维度 **1:1 就等于 llms.txt 分析器**，没有其他成分。所以是 llms.txt 独占 12 分。
- `llmstxt.js:7-9`：`exists` 单独 weight 4，`maxScore` 12 —— **"文件存在"占该维度 33%，不看内容**。
- `index.astro:234` 写 "helps ChatGPT, Claude, and Perplexity understand your content" —— 这是因果断言，无出处。
- 研究中"有 llms.txt 的站均值高 22 分"是**相关性**，且明显被"文档类站点更可能写 llms.txt"混杂。文章自己说了（`data/STUDY.md`），但首页没说。

**比"存在给 4 分"更糟的是：空文件拿 5 分。** 实测（命令 A6）：

```
空文件                  score 5/12   exists=true structure=false areas=false links=false length=true
只有一个 # 标题          score 5/12   exists=true structure=false areas=false links=false length=true
```

`length` 检查（`llmstxt.js:26`）判的是 `lines.length <= 200`，而空字符串 `''.split('\n').length === 1` —— 于是**一个 0 字节的 llms.txt 能通过 5 项里的 2 项，总分 +5**，其中一项还是"长度达标"。这是典型的"没做也能得分"，与 `aiCrawlability` 无 robots.txt 拿满分是同一个病。

**我的处置决定：走 (b)+(c)，不走 (a)。**

- (a) 把 12 分整体下调 → 连 78 个写对了的站一起降分，扰动面最大，而且不解决"exists 白送"。
- **(b) 把 `exists` 的 4 分改成 1 分，并把让出来的 3 分给内容项**，具体：`exists 1 / structure 4 / areas 3 / links 3 / length 1`（合计仍 12，满文件仍是 12 分）。**并且 `length` 只在 `structure` 通过时才计分**，否则空文件还是能白拿 1 分。
- (c) 方法论里明写"llms.txt 是低成本期权，不是已验证的排名因子"。

**成本已量化（命令 A7）**：用现有 324 站语料模拟 (b)
- 受影响 43/324 站，维度总分合计 −86 → **全站均值只变 −0.27，中位数仍是 41（不变）**
- 有 llms.txt 的 78 站维度均值 9.71 → 8.60（−1.11）→ 文章里 "60.3 vs 38.0" 会变成 **"59.2 vs 38.0"**
- 排序、分档、结论方向全部不变

所以 (b) 几乎是免费的：它只惩罚"放了个文件但没内容"的那 13 站（分数 4–5 的那批），不碰写对了的 35 站。

**但必须配一条版本纪律**：文章的 "60.3 / 22 点差距 / 24.1%" 是**绑定评分版本的数**。改动上线时要么重跑（`tools/run-audit.mjs` 还在，324 站可重跑），要么在文章顶部标"按 v1.8 评分口径（2026-10）"。**否则就是第三次"数字与代码不同步"。**

**关于引用 Ahrefs 那条（97% 的 llms.txt 零请求）**：可以引，且值得引 —— 但必须和 (b)(c) **同一批上线**。否则就是"一边说 97% 没用、一边给存在送 5 分"，把刀递给对方。这条我给关键词专项的回复里已经写明。

**补充一条更硬的证据（关键词专项找到的）**：Ahrefs 2026-05 研究称 **97% 的 llms.txt 文件零请求**。这条我建议引，但要意识到它会造成一个内部矛盾：如果我们在 llms-txt-checker 页面引用"97% 的 llms.txt 从没被请求过"，同时又给它 12% 权重、并对"文件存在"单给 4 分，用户会立刻问"那你为什么把它算进分数"。**两件事必须同时做**：一边引用这个数字建立可信度，一边在方法论里承认"这是一项低成本期权，不是已验证的排名因子"，并把它从 12% 降下来（或用"存在有分、但上限低"的定价）。只引不改 = 自证矛盾；不改也不引 = 继续押一个赌注。

### 存疑 8：所有"改完能涨多少"的说法，在零流量下都无法验证

当前 90 天 1,219 展示 / 2 点击 / 0 付费点击 / 收入 $0。任何"改完 AI 引用会涨 X%"的话都没有自家数据可证，只能标【赌注】。这类话现在至少有 2 处在对外页面（见错误 1、错误 15）。

### 存疑 9：同一个分数有两套配色阈值（口径不一致，但范围比传言的窄）

- 定标签：`scoring.js:42-45` → ≥86 Excellent / ≥68 Good / ≥36 Basic
- 定颜色：`auditHistory.js:14-16`、`auditHistory.js:109`、`sitesPanel.js:17-19`、`trendChart.js:35` → **≥80 绿 / ≥60 蓝 / ≥40 黄**

**我判定这构成"数据可信度"问题**，理由不是"审美不统一"，而是：用户在同一个报告页上会看到 **82 分同时是"绿"（=Excellent 的颜色）和"Good"（蓝徽章）**。`reportHeader.js:9` 把绿定义给 Excellent、蓝定义给 Good，于是 80–85 和 36–39 这两个区间里，颜色和文字标签说的是两个不同的等级。一个主打"分数可解释"的产品，最不该出现"同一个数字两种含义"。

但要给设计同学一个修正：**冲突面是 3 处（历史列表、站点列表、趋势图），不是 5 处**。`dimensionBreakdown.js:20` 和 `comparisonPanel.js:23` 用的是**维度百分比**（pct），维度用 80/60/40 分档是另一套合理口径，可以保留。

**处置已定（与设计侧对齐）**：总分侧 3 处改成 86/68/36；维度条跟随同一张表，但把裸 `%` 改成 **"完成度 82% · 12/12"** —— 因为 `dimensionBreakdown.js:31` 本来就把分数式分母渲染在每一行右侧，**口径已经可见**，所以这不算"用统一颜色掩盖分母不同"，A 与 B 的诉求可以同时满足。前提是标签必须带上"完成度"三个字，否则分母虽在、读者不知道分子分母各是什么。

### 存疑 10：空着的 "Excellent" 带不是阈值问题，是维度问题 —— 所以不要为了填满它而改阈值

三套阈值（36/68/86、40/70/86、40/60/80）里，只有 40/60/80 能让 Excellent 非空（2 站，0.6%）。看起来像是"UI 那套最合理"，其实不是。查那 2 个站：

```
adminlte.io   80分：crawl 12 llms 10 schema 9 meta 10 content 12 eeat 6 brand 6 cite 8 disc 0 agent 3 fresh 4
openwebui.com 80分：crawl 12 llms 12 schema 9 meta 10 content 12 eeat 5 brand 6 cite 8 disc 0 agent 3 fresh 2.5
```

两站 discovery 都是 **0/6**、schema 只有 **9/14**、agent 只有 **3/4**。把 80 定为"Excellent"，等于给两个"6 分的发现端点一分没拿"的站发优秀证书 —— **假阳性比空档更有害**，尤其是这个产品卖的就是"分数可信"。

真正的原因在维度可达性（全部 324 站统计）：

| 维度 | 达到该维 80% 上限的站点数 |
|---|---|
| aiCrawlability | 320 / 324（99%） |
| citationReadiness | 245 / 324（76%） |
| metaSocial | 151 / 324（47%） |
| contentQuality | 97 / 324（30%） |
| aiGuidance | 48 / 324（15%） |
| freshness | 37 / 324（11%） |
| brandEntity | 13 / 324（4%） |
| structuredData | **1 / 324（0.3%）** |
| eeat | **1 / 324（0.3%）** |
| discoveryEndpoints | **1 / 324（0.3%）** |
| agentFriendliness | **0 / 324（0%）** |

外加：**没有任何一个站做到 11 个维度全部 ≥80%**；"该站最低那个维度的完成度"中位数是 **0%**。`agentFriendliness` 历史上没有任何一站拿过满分（`agentFriendly.js:23` 要求 HTML 正文里出现 `X-RateLimit` 响应头字符串，结构上几乎不可能成立）。

结论：**先修维度，再定阈值。** 现在无论选哪套阈值，都是在给一个"天花板被 4 个坏维度压住"的量表调刻度。顺序应该是：修 discovery / agent / schema 三项 → 用"每个维度都 ≥80% 才算 Excellent"这类可陈述的原则反推阈值 → 发布新的分档并标明生效版本。在那之前，对外只应保留一套（代码里的 36/68/86），因为它是唯一任何代码路径真的会算出来的东西。

---

### 跨界注记：主工具页 619 展示 / 1 点击，与"审计可信度"无关，但有一处文案证据

关键词专项实测 `ai readiness score` 的 SERP 前 5 全是"企业 AI 成熟度"（人才/数据治理/战略/预算），不是"网页技术层能否被 LLM 引用"。我核对了一下：**这个错配在我们自己的页面文案里就能看出来**，不需要外部数据 ——

`tools/ai-readiness-score.astro:50` 的 FAQ 答案自述："GeoScore rates 0 to 100 across 11 dimensions… AI engines can reach, parse and attribute your content"。同一页第 88 行又说 "AI readiness evaluates your site across 11 dimensions…"。也就是说，访客带着"我们公司 ready 吗"进来，我们给的答案是"你的 JSON-LD 缺 Organization"。

对本次审计的结论**没有影响**：我没有把点击率当成权威度问题，也不建议为这个 619:1 去补作者/补外链。补一句反向提醒：如果按"权威度不足"去修这一页，会花掉预算却不改变 619:1 —— 该修的是标题与首屏的定义句（把"AI readiness"改成"AI 可引用性 / GEO 审计"这类无歧义的词），这属于关键词与文案的范围。

---

## 【明确的错误】（有硬证据，可复现）

### 错误 1：首页说 robots 是低分首因、能涨 20-30 分 —— 与自家研究相反

`index.astro:222`：
> "If your site scores below 60, the most common cause is robots.txt blocking AI crawlers by default. Adding GPTBot, ClaudeBot, PerplexityBot, and Google-Extended to the allow list, and shipping an llms.txt, typically raises the score by 20–30 points in a single deployment."

自家数据：225 个有 robots.txt 的站里只有 **8 个（3.6%）** 封任何 AI 爬虫；aiCrawlability 维度 **317/324 满分**。所以"低分首因是 robots 拦截"在自家语料上不成立，而"涨 20-30 分"在任何地方都没有记录支撑（v1→v2 那 +12 分是修 bug 修出来的，不是用户改站点改出来的）。

这句话同时否定了 `robots.js:21-26` 那段"我们修掉了 94.2% 误判"的工程结论。**必须删或改写。**

### 错误 2：等级阈值三处不一致，导致文章的核心数字是错的

- 代码：`scoring.js:42-45` → ≥86 Excellent / ≥68 Good / ≥36 Basic / <36 Critical
- 方法论页：`methodology.astro:55-58` → 86 / 68 / 36（与代码一致）
- 文章：`blog:91-94` → "Critical (0–39) 144 sites 44.4% / Basic (40–69) 152 / Good (70–85) 28"

用同一份 `data/geo-audit-v2-final.csv`，按代码阈值复算：

| 等级 | 代码阈值(36/68/86) | 文章口径(40/70/86) | UI 口径(40/60/80) |
|---|---|---|---|
| Critical | **107（33.0%）** | 144（44.4%） | 144（44.4%） |
| Basic | **184（56.8%）** | 152（46.9%） | 113（34.9%） |
| Good | **33（10.2%）** | 28（8.6%） | 65（20.1%） |
| Excellent | 0 | 0 | 2（0.6%） |

CSV 自带的 `level` 列就是 107/184/33 —— 说明文章的数字**不是从这份 CSV 取的**，是按另一套阈值算的。因此 `blog:9` 的 meta description "44% rate Critical" 也是错的，而这是全站最高价值文章在搜索结果里的门面。

**补一条更硬的 git 证据（比"手写文本"更能定性）**：分档边界是**和数字在同一次提交里一起被改动的**。

```
git show f83bed5 -- src/pages/blog/auditing-1200-websites.astro
-  <li>Critical (0–39) 219 sites — 63.8%</li>
-  <li>Basic (40–59)    118 sites — 34.4%</li>
-  <li>Good (60–79)       6 sites —  1.7%</li>
+  <li>Critical (0–39) 144 sites — 44.4%</li>
+  <li>Basic (40–69)    152 sites — 46.9%</li>
+  <li>Good (70–85)      28 sites —  8.6%</li>
+  <li>Excellent (86+)    0 sites —  0%</li>
```

旧版是 **40/60/80**（正好等于 UI 组件那套），新版把上两条边界改成 **60→70、80→86**。而 `f83bed5` 是同一次提交，同时改了：样本 343→324、中位数 29→41、四组计数。

也就是说 **尺子的刻度和被量的东西一起动**，动到刚好让新数字落进旧句式里。这比"边界早就存在"严重 —— 它证明的不是"疏忽"，是"为了保住已发表的百分比而调整分档"。`scoring.js` 的全部提交里只有 86/68/36，从未出现过 40/70。

**两个必须写进更正说明的口径前提**（否则别人复现会对不上）：

1. **必须按 `score` 列重算，不能拿 11 个维度列求和。** `data/geo-audit-v2-final.csv` 里 **301/324 行** 的 `score` ≠ 维度列之和（样例 `1.2345345.xyz`：score 20，维度和 25.5）—— 因为 `score` 已在 `scoring.js:33-39` 扣掉负向信号与提示注入，维度列是扣分前。用维度和重算会得到另一组（我算 **80/205/39**，与 107/184/33 差 27 个 Critical）。
2. **11 维权重合计 98，不是 100**（`scoring.js:1-13`，`data/compare-v1-v2.txt` 也写了 98），所以维度原始值不能直接当百分比读。

**另一处同源错误**：`blog:9` 的 description 写 "A reproducible study of **343** real websites … **44%** rate Critical"，但 44.4% 的分母是 **324**（144/324）。144/343 = **42.0%**。正文有注释解释 343 审计 / 324 存活，description 里没有 —— 同一句话里混了两个分母。

### 错误 3：文章里的"维度占满分比"用了旧分母

`blog:233`："Meta & Social sits at 73% of its maximum and Content Quality at 59% — … Structured Data at 13%, and E-E-A-T at 25%"。

当前代码的分母（maxScore）是 meta 10 / content 12 / schema 14 / eeat 8（`scoring.js:1-13` 对应各 analyzer 的 `maxScore`）。复算当前分母下：

| 维度 | 文章 | 按当前分母复算 |
|---|---|---|
| Meta & Social | 73% | **59%**（5.85/10） |
| Content Quality | 59% | **58%**（7.01/12） |
| Structured Data | 13% | **12%**（1.68/14） |
| E-E-A-T | 25% | **32%**（2.53/8） |

文章用的是旧版 maxScore（meta 8、eeat 10、schema 12），产品早改了。读者拿自己的审计结果去对这篇文章，会对不上。

### 错误 4：方法论表里 Structured Data 的检查数是错的，"85+" 其实是 85

`methodology.astro:30` 写 Structured Data 有 **8** 项检查；`schema.js:23-38` 实际只有 **5** 项（org / article / faq / howto / props）。

那张表的 Checks 列相加：20+5+8+5+6+5+4+25+3+4+3 = **88**，而全站实际检查数 = **85**（20+5+5+5+6+5+4+25+3+4+3）。所以 `index.astro:298`、`pricing.astro:62,148`、`demo.astro:26` 的 "85+" 精确值就是 85，"+" 是虚的。

### 错误 5：首页说会自动生成 Organization / Article / FAQ / HowTo 四种 schema —— 实际只生成 WebSite

`index.astro:219`：
> "a JSON-LD snippet for Organization, Article, FAQ, and HowTo schema"

`fixGenerator.js:142-158` 只构造 `{'@type': 'WebSite', name, url, description}`，有 og:image 时**嵌套**一个 `publisher.Organization`。没有 Article、没有 FAQPage、没有 HowTo。

### 错误 6：工具推荐的 JSON-LD，过不了工具自己的检查

- `schema.js:18` 要求顶层 `@type === 'Organization'`（或 `@graph` 里有）才算 3 分。
- `fixGenerator.js:150-156` 把 Organization 塞在 `publisher` 下面，顶层是 WebSite。

`extractJsonLd` 只展平 `@graph`，不递归 `publisher`。所以：**用户照着"官方修复文件"改完，`org` 这一项仍然是 false，白丢 3 分（占结构化数据的 21%）。** 这是自相矛盾，不是取舍。

### 错误 7：结构化数据的 36% 权重押在两个已经下线的富媒体类型上

`schema.js:29-33`：FAQPage 3 分 + HowTo 2 分 = 5/14。

事实：HowTo 富媒体结果 2023-09 全面下线；FAQPage 富媒体结果 **2026-05-07 全面下线**，文档 2026-06-15 移除。

这两个类型仍然是合法的 schema.org 词汇、不会被惩罚、对 Bing/AI 可能有用 —— 但这不等于它值得占结构化维度的 36%。在 2026 年的口径下，这 5 分更像是 2023 年的残留。

### 错误 8：修复文件生成的 robots.txt，可能把一个"故意全站禁止"的站解锁

`fixGenerator.js:78-79` 先无条件写：
```
User-agent: *
Allow: /
```
`:82-85` 再把原文件里**非 AI 爬虫**的规则原样拼在后面。如果原站是刻意 `User-agent: * / Disallow: /`（比如灰度站、付费墙预览、法务要求下线），解析器会把 `User-agent: *` 也当成"保留规则"追加，结果同一个 UA 组里同时出现 `Allow: /` 和 `Disallow: /`。

按 RFC 9309（也是 `robots.js:108-111` 自己实现的规则）：等长匹配时取**最宽松**，即 `Allow: /` 胜出 → **站点被解锁**。

讽刺的是 `blog:226` 刚刚提醒用户"不要加 `User-agent: * / Disallow: /`"，而工具在同一个产品里生成相反方向的风险。

### 错误 9：生成的 llms.txt 硬编码了几条不存在的路径

`fixGenerator.js:33-35` 无条件写 `/about`、`/contact`、`/privacy` 三条链接，不校验是否存在；`:29-30` 的 "Key Pages" 只有首页一条。

对没有 `/contact` 的站，产出的 llms.txt 自带死链 —— 而 llms.txt 的所有 2026 指南都强调"死链比没有更糟"。而且只有首页一条的 llms.txt，恰好违反它自己的用途（curated index）。

### 错误 10：修复文件是从前 500 字节的 HTML 片段里提数据的

`scanner.js:141`：`pageHtml: pageHtml ? pageHtml.slice(0, 500) : null`。
`fixGenerator.js:12,21,139` 从 `result.raw.pageHtml` 里抓 title / meta description / og:image。

og:image 和 description 经常落在前 500 字节之外 → 产物退化成占位符（`'Website at ' + domain`、没有 logo、`publisher` 缺失）。用户拿到的是"看起来像真的、其实是默认值"的 JSON-LD。

### 错误 11：明细里的百分比和"通过项"是两个分母，并排显示会打架

实测 geoscore.help：`citationReadiness: score 8/8 → 100%，checks 11/25`，报告页显示为 **"100% · 11/25"**（`dimensionBreakdown.js:21,31`）。

原因：`citations.js:193` 有 `score = Math.min(score, maxScore)` 上限，而 `:199` 的 `passed` 是 25 项原始计数。25 项里有 17 项对分数**没有任何影响**（只要前面凑够 8 分就封顶）。

同理 `aiCrawlability` 显示 "100% · 20/20" 看着没问题，但 `citations` 的 "100% · 11/25" 会让用户怀疑工具算错了 —— 而工具其实没说谎，只是没解释。

### 错误 12：几处检查项的标签和它实际测的东西不是一回事

用构造 HTML 实测（命令 A3）：

| 检查项 | 标签承诺 | 实际判定 | 实测结果 |
|---|---|---|---|
| `content.js:36` stats | "Statistics cited with sources" | 文本里出现 `\d+\.\d+` 之类的数字 | 一句 "The version is 1.8" → **通过** |
| `brand.js:26` contact | "Contact information available" | 出现 `@` | "Contact @here" → **通过** |
| `agentFriendly.js:15` api | "API endpoints documented" | 出现 `rest` 这个词 | "the rest is fine" → **通过** |
| `negativeSignals.js:46` broken-links | "Broken or empty links" | 数 `href="#"` | 4 个页内锚点 → **扣 2 分** |
| `eeat.js:41` https | "HTTPS enabled" | 有无 HSTS/CSP 响应头 | 没有安全头 → 判"HTTPS 未启用"（其实站点是 HTTPS） |

最后一条尤其要改标签：审计本来就只走 https，测的是**安全响应头**，不是 HTTPS。用户会看到"HTTPS 未启用"去查证书，白忙。

### 错误 13：citationReadiness 的 25 项里 17 项是摆设

`citations.js:8-36` 定义了 25 项，总权重 28，但 `maxScore = 8` 且封顶。前 5 项（ext-links 2 + stats 2 + quotes 2 + research 1 + edu-gov 1）就能拿满 8 分。

后果：**新增的 20 项（blockquote、passage-density、connective-words、nuance-signals、accessibility-aria…）对最终分数贡献恒为 0**，只在明细里增加视觉长度。这也是为什么 "25 项检查" 听起来很专业但分数区间只有 8 分宽。

### 错误 14：审计不完整时，报告不告诉你（静默降级）

`scanner.js:78-96`：`/about` 与内容页抓取失败时返回 null，`combinedHtml` 变短，`schema / eeat / brand` 三个维度直接少分。`scanner.js:127-143` 返回的对象（实测 keys：`url,timestamp,score,level,summary,dimensions,negativeSignals,promptInjection,seoSupplement,recommendations,raw`）**没有任何"本次不完整 / 降级 / 超时"字段**。

`CONTENT_PAGE_BUDGET_MS = 3000`（`scanner.js:29`）是硬预算，慢站必然超时。

量级参考：研究里 457 个站有 **114 个（24.9%）"empty"失败**，`blog:72` 说 133 个（29.1%）不可达。也就是说约三成站点的分数不可比；而这 3000ms 预算还会让**同一站点在不同时段拿到不同分**（网络快→拿到 /about→13 分；网络慢→丢 /about→8 分），可复现性只在网络健康时成立。

### 错误 15：无出处的统计数字写在首页

`index.astro:209`："more than 40% of search sessions on Google now end without a click" —— 无引用、无时间窗、无口径。这类句子出现在一个主打"数据可信"的产品首页上，是自伤。

### 错误 16：promptInjection 会把 Tailwind 的 `hidden` 类当成作弊，扣 3 分

`promptInjection.js:78` 把 `class` 含 `hidden` / `sr-only` / `visually-hidden` 且文本 >100 字符的元素判为"隐藏文本"，severity high。而 Tailwind 的响应式断点普遍写 `hidden md:block`。

实测（命令 A4）：一个含 `hidden md:block` 的 div，完美站点从 100 掉到 **97**，并生成建议"Remove hidden text"。

叠加两个问题：
1. 扣分尺度有两套：`promptInjection.js:138` 是 4 级 3/2/1/0.5，`scoring.js:36` 是 4/3/2/1。同一个 flag 两个价，且 `promptInjection` 自己算出的 0-6 分**从未被使用**（没有进 dimensions，`scanner.js:100-112`）。
2. geoscore.help 自己就是 Tailwind 站 —— 这条建议等于让用户删掉响应式布局。

---

## 【必须修的三个】

### 必须修 1：停止把 18 分押在"没有区分度 / 没有消费方"的信号上

范围：`aiCrawlability`(12) + `discoveryEndpoints`(6)，并同步处理 `aiGuidance`(12) 的措辞。

依据：
- aiCrawlability 对 97.8% 的站点满分（317/324），example.com 也能拿 12/12 → 它测的是"有没有故意封爬虫"，不是 AI 可爬性。而且这 12 分里 6/39 权重（`anthropic-ai` 3 + `Google-Extended` 3）是已死 token 和不影响搜索的 token。
- discoveryEndpoints 97.5% 的站点 0 分（316/324），三个文件无厂商规范支撑 → 6 分结构性不可达。
- llms.txt 12% 无主流引擎公开消费，`index.astro:234` 的因果断言无出处。

**其中 llms.txt 部分的处置已经定案**（可单独上线，不必等其他两项）：

1. `llmstxt.js` 权重改为 `exists 1 / structure 4 / areas 3 / links 3 / length 1`（合计仍 12，写对的满文件仍是 12 分）。
2. `length` 改为**仅当 `structure` 通过时才计分**，否则空文件仍白拿 1 分（实测空文件现在拿 5/12，见存疑 7）。
3. `methodology.astro` 增加一句："llms.txt 是低成本期权，不是已验证的排名因子；本项测的是文件结构完备度，不是被引用概率。"
4. 同一批上线时，文章的 "60.3 vs 38.0 / 24.1%" 要么重跑（`tools/run-audit.mjs`），要么标注"按 v1.8 评分口径"。
5. 才允许在 llms-txt-checker 页引用 Ahrefs "97% 零请求"那条证据。

成本：全站均值 −0.27 分、中位数不变、只影响 43/324 站（复算 A7）。这是本次审计里**性价比最高的一处修改**。

**具体动作（其余部分，建议）**：把"没有文件"从"满分"改成显式状态（例如 `no-file` 不给满分、也不判 blocking），删掉 `anthropic-ai`/`Google-Extended`/`PetalBot` 三项，补 Claude-User 等检索型爬虫，训练/检索分开计权；discovery 三项降权或并入 sitemap 这类真有消费方的信号；删掉 `index.astro:222` 整段。

替代方案（成本更低、同样能救可信度）：保留打分，但在报告里对这三个维度加一行"该维度 97% 的站点满分，区分度低"的说明。这比假装它们是强有力的检查要好。

### 必须修 2：修复文件先做到"不伤站"

三件事，按风险排序：
1. **robots.txt 解锁风险**（`fixGenerator.js:78-85`）：如果原文件里有 `Disallow: /`，任何生成的 `Allow: /` 都是危险动作。最小改法是：检测到站点级 `Disallow: /` 时**不生成** robots.txt，改为提示人工处理。
2. **JSON-LD 过不了自家检查**（`fixGenerator.js:142-158` vs `schema.js:18`）：要么把 Organization 提到顶层（或放进 `@graph`），要么放宽 `schema.js` 的判定。二者必须对齐，否则"照做不加分"会直接击穿产品承诺。
3. **硬编码死链 + 500 字节截断**（`fixGenerator.js:33-35,12,21,139` + `scanner.js:141`）：`/about` `/contact` `/privacy` 不校验就别写；`raw.pageHtml` 的截断长度要够 title/meta/og:image 提取，或者干脆把这三个字段在扫描阶段就结构化存下来。

这三条都是"用户照做之后站点变差 / 分数不变"的路径，比分数不准更伤信任。

### 必须修 3：把已经发出去的对外数字统一并复算

1. **分档边界以代码为准**：`blog:88-94` 的 `0–39 / 40–69 / 70–85` 是手写展示文本（git 可证），改成 `scoring.js:42-45` 的 36/68/86，四组计数改为 **107 / 184 / 33 / 0**；`blog:9` 的 meta description "44% rate Critical" → "33%"。
2. `blog:233` 的四个百分比按当前分母重算（**59% / 58% / 12% / 32%**），并在文中注明"按 v1.8 分母"。
3. `methodology.astro:30` 的 8 → 5（`schema.js` 只有 5 项检查）。
4. `index.astro:219` 删掉 "Article, FAQ, and HowTo"，或让 `generateJsonLd` 真的生成（但注意错误 7：FAQ/HowTo 的富媒体结果已下线，生成它们的主要价值是语义标注，不是 SERP 特性 —— 文案不能暗示后者）。
5. `index.astro:222` 整段删除；`index.astro:209` 的 40% 要么加来源要么删。

**不要**为了让文章的数字继续成立而把 `scoring.js` 改成 40/70（见存疑 10）。改代码去迁就已发表数字，是这份审计里唯一一个会**主动制造**新不可信的做法。

复算命令在文末，任何人可以一分钟内复核。**"可被复核"本身就是这个产品最该卖的东西。**

---

## 附：复现命令

**A1 · 复算文章头部数字与等级分布**（必须用 `score` 列，不能用维度列求和 —— 见错误 2）
```bash
cd D:/Codex/projects/geo-score && node -e "
const fs=require('fs');
const rows=fs.readFileSync('data/geo-audit-v2-final.csv','utf8').trim().split(/\r?\n/).slice(1).map(l=>{const c=l.split(',');return {ok:+c[1],score:+c[2],level:c[3],ai:+c[4],llms:+c[15],anyAi:+c[16],gpt:+c[17],rob:+c[18]};});
const ok=rows.filter(r=>r.ok===1), s=ok.map(r=>r.score).sort((a,b)=>a-b);
console.log('n',ok.length,'median',s[Math.floor(s.length/2)],'mean',(s.reduce((a,b)=>a+b)/ok.length).toFixed(1));
const band=t=>{const o={};ok.forEach(r=>{const L=r.score>=86?'Excellent':r.score>=t[0]?'Good':r.score>=t[1]?'Basic':'Critical';o[L]=(o[L]||0)+1});return o};
console.log('code 36/68/86 :',JSON.stringify(band([68,36])));
console.log('blog 40/70/86 :',JSON.stringify(band([70,40])));
console.log('full-marks aiCrawlability:',ok.filter(r=>r.ai===12).length+'/'+ok.length);
"
```

**A2 · 同一 URL 跑三次看稳定性**
```bash
cd D:/Codex/projects/geo-score && for i in 1 2 3; do node bin/geoscore.mjs https://geoscore.help --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);console.log('run','total='+r.score)})"; done
```

**A3 · 验证标签与判定不一致**
```bash
cd D:/Codex/projects/geo-score && node --input-type=module -e "
import { analyzeContent } from './src/lib/analyzers/content.js';
import { analyzeBrand } from './src/lib/analyzers/brand.js';
import { analyzeAgentFriendly } from './src/lib/analyzers/agentFriendly.js';
const h='<html><body><h1>Hello world title</h1><p>The version is 1.8 and the rest is fine.</p><p>Contact @here</p></body></html>';
console.log('stats passed (期望 false):', analyzeContent(h).checks.find(c=>c.id==='stats').passed);
console.log('contact passed (期望 false):', analyzeBrand(h,null).checks.find(c=>c.id==='contact').passed);
console.log('api passed (期望 false):', analyzeAgentFriendly(h,null,null,null).checks.find(c=>c.id==='api-endpoints').passed);
"
```

**A4 · Tailwind hidden 触发 -3**
```bash
cd D:/Codex/projects/geo-score && node --input-type=module -e "
import { analyzePromptInjection } from './src/lib/analyzers/promptInjection.js';
import { computeScore } from './src/lib/scoring.js';
const h='<div class=\"hidden md:block\">'+'Real content hidden only on mobile. '.repeat(5)+'</div>';
const pi=analyzePromptInjection(h);
const d={aiCrawlability:{score:12,maxScore:12},aiGuidance:{score:12,maxScore:12},structuredData:{score:14,maxScore:14},metaSocial:{score:10,maxScore:10},contentQuality:{score:12,maxScore:12},eeat:{score:8,maxScore:8},brandEntity:{score:8,maxScore:8},citationReadiness:{score:8,maxScore:8},discoveryEndpoints:{score:6,maxScore:6},agentFriendliness:{score:4,maxScore:4},freshness:{score:4,maxScore:4}};
console.log('flags',pi.flags.map(f=>f.id+':'+f.severity),'total',computeScore(d,{deductions:[]},pi).total,'(满分为100)');
"
```

**A5 · v1→v2 分数漂移全部来自 aiCrawlability**
```bash
cd D:/Codex/projects/geo-score && node -e "
const fs=require('fs');
function load(p){const L=fs.readFileSync(p,'utf8').trim().split(/\r?\n/);const h=L[0].split(',');return L.slice(1).map(l=>{const c=l.split(',');const o={};h.forEach((k,i)=>o[k]=c[i]);return o;});}
const v1=load('data/geo-audit-merged.csv').filter(r=>+r.ok===1);
const v2=load('data/geo-audit-v2.csv').filter(r=>+r.ok===1);
const m2=new Map(v2.map(r=>[r.host,r]));
const common=v1.filter(r=>m2.has(r.host));
const dims=['aiCrawlability','aiGuidance','structuredData','metaSocial','contentQuality','eeat','brandEntity','citationReadiness','discoveryEndpoints','agentFriendliness','freshness'];
const avg=(arr,k)=>arr.reduce((s,r)=>s+(+r[k]||0),0)/arr.length;
dims.forEach(d=>{const a=avg(common,d),b=avg(common.map(r=>m2.get(r.host)),d);if(Math.abs(b-a)>0.05)console.log(d.padEnd(19),'v1',a.toFixed(2),'-> v2',b.toFixed(2));});
const med=a=>{const s=a.map(x=>+x).sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
console.log('median v1',med(common.map(r=>r.score)),'v2',med(common.map(r=>m2.get(r.host).score)));
"
```
输出（已实测）：只有 `aiCrawlability 0.33 -> 11.90`，中位数 `29 -> 41`。其余 10 个维度逐字节相同 —— 说明那 +12 分全部来自一次 bug 修复，不是站点变化。

**A6 · 空 llms.txt 拿 5 分（证明"存在即得分"）**
```bash
cd D:/Codex/projects/geo-score && node --input-type=module -e "
import { analyzeLlmstxt } from './src/lib/analyzers/llmstxt.js';
for (const [k,v] of Object.entries({'空文件':'','只有H1':'# Site\n\nhello','仅相对链接':'# S\n\n> sum\n\n## A\n\n[b](/b): x\n\n## C\n\n[d](/d): y','完美':'# S\n\n> sum\n\n## A\n\n[b](https://x.com/b): x\n\n## C\n\n[d](https://x.com/d): y'})) {
  const r=analyzeLlmstxt(v); console.log(k.padEnd(8), r.score+'/'+r.maxScore, r.checks.map(c=>c.id+'='+c.passed).join(' '));
}"
```
输出：空文件 **5/12**（`exists=true`、`length=true`）；只有 H1 也是 5/12；**全用相对链接的"完美结构"只有 10/12**（`links=false`）；只要有一条绝对 URL 就是 12/12。

**A7 · 量化 llms.txt 权重重分配的语料影响**
```bash
cd D:/Codex/projects/geo-score && node -e "
const fs=require('fs');
const L=fs.readFileSync('data/geo-audit-v2-final.csv','utf8').trim().split(/\r?\n/);const h=L[0].split(',');
const rows=L.slice(1).map(l=>{const c=l.split(',');const o={};h.forEach((k,i)=>o[k]=c[i]);return o;}).filter(r=>+r.ok===1);
const map={0:0,4:1,5:2,6:4,7:5,8:6,9:8,10:9,11:9,12:12};
let d=0,t=0; rows.forEach(r=>{const o=+r.aiGuidance,n=map[o];d+=n-o;if(n!==o)t++;});
console.log('受影响',t+'/'+rows.length,'总分均值变化',(d/rows.length).toFixed(2));
const wf=rows.filter(r=>+r.hasLlmsTxt===1);
console.log('有 llms.txt 维度均值',(wf.reduce((s,r)=>s+ +r.aiGuidance,0)/wf.length).toFixed(2),'->',((wf.reduce((s,r)=>s+ +r.aiGuidance,0)+wf.reduce((s,r)=>s+(map[+r.aiGuidance]- +r.aiGuidance),0))/wf.length).toFixed(2));
const m=rows.map(r=>+r.score+(map[+r.aiGuidance]- +r.aiGuidance)).sort((a,b)=>a-b);
console.log('新中位数',m[Math.floor(m.length/2)]);
"
```
输出：受影响 43/324、均值 −0.27、中位数不变（41）、有文件站 9.71 → 8.60。

**A8 · 证明 CSV 的 `score` 列 ≠ 维度列之和（所以复算必须声明用哪列）**
```bash
cd D:/Codex/projects/geo-score && node -e "
const fs=require('fs');
const L=fs.readFileSync('data/geo-audit-v2-final.csv','utf8').trim().split(/\r?\n/);const h=L[0].split(',');
const rows=L.slice(1).map(l=>{const c=l.split(',');const o={};h.forEach((k,i)=>o[k]=c[i]);return o;}).filter(r=>+r.ok===1);
const dims=['aiCrawlability','aiGuidance','structuredData','metaSocial','contentQuality','eeat','brandEntity','citationReadiness','discoveryEndpoints','agentFriendliness','freshness'];
let bad=0; rows.forEach(r=>{const s=dims.reduce((a,d)=>a+ +r[d],0); if(Math.abs(s- +r.score)>0.01) bad++;});
console.log('score != sum(dims):', bad+'/'+rows.length);
const band=v=>{const o={};v.forEach(x=>{const L=x>=86?'Excellent':x>=68?'Good':x>=36?'Basic':'Critical';o[L]=(o[L]||0)+1});return JSON.stringify(o)};
console.log('用 score 列:', band(rows.map(r=>+r.score)));
console.log('用维度求和:', band(rows.map(r=>dims.reduce((a,d)=>a+ +r[d],0))));
"
```
输出：**301/324 行不一致**；用 `score` 列 → 107/184/33；用维度求和 → 80/205/39。**差 27 个 Critical。**

---

## 一句话

**这个产品的可信度不靠"14 维"或"85+ 检查"，而靠 `data/STUDY.md` 那种"我们撤回了没有证据的说法"的勇气；但同一份诚实没有传导到首页和文章数字上 —— 现在有 3 类硬错误（阈值三套、分母过时、修复文件自相矛盾）在直接抵消它。**
