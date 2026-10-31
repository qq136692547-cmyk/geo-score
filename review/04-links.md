# GeoScore 全站诊断 · 04 内链架构

- 诊断对象：`D:/Codex/projects/geo-score/dist/`（Astro 5 构建产物，38 个 `.html`）
- 复算方式：`python review/_linkgraph.py` → 明细 `review/_linkgraph.json`（只读 dist，未改动任何页面）
- 口径：`/xxx/` 与 `/xxx/index.html` 归一；`<header>` / `<footer>` / `<nav>` / Cookie 同意横幅内的链接记为 **模板链接**，其余记为 **正文链接**；入链统计排除自链。
- 页面基数：38 个 HTML = **36 个可索引页**（与 `sitemap.xml` 的 36 条 `<loc>` 完全一致）+ `404.html` + `google549b561c38ba8bae.html`。

---

## 一、内链图概况

| 指标 | 数值 |
|---|---|
| 内部 `<a>` 边总数 | **931** |
| 其中模板链接（header/footer/consent） | **718（77.1%）** |
| 其中正文链接 | **213（22.9%）** |
| 正文链接密度 | 213 / 37 页 ≈ **5.8 条/页**（中位数 7 条） |
| 断链（指向不存在的页） | **0**（另有 `/sitemap.xml`、`/llms.txt` 各被链 37 次，非 HTML 目标，正常） |
| 模板链接占比最高的页面 | 全部 zh 页与法务页：正文 0–1 条，模板 20 条上下 |

**结论 1（事实）：全站 77% 的内链是同一套样板。** 931 条边里 718 条在每个页面重复出现——页脚固定 3 个工具 + 8 篇文章 + methodology + privacy/terms，导航固定 Home/Methodology/Pricing/中文。搜索引擎对全站重复的样板链接给出的权重极低，**真正参与主题权重分配的有效链接只有 213 条**。这个站点不是"内链太多"，而是"内链看起来很多、实际只有 213 条在起作用"。

**结论 2（事实）：全站在 2 跳内可达，但这是页脚伪造出来的扁平。** 用全部链接做 BFS：首页 0 跳、18 页 1 跳、17 页 2 跳，没有 3 跳以上的页。但把模板链接剔除、只走正文链接后，**从首页出发有 13 个页面完全不可达**（见第二节）。也就是说，站点的"浅"完全依赖页脚；内容层自身的连接只覆盖 24/37 页。

**结论 3（事实）：权重黑洞 6 个。** 正文出链为 0 的页面：`/methodology/`、`/privacy/`、`/terms/`、`/zh/methodology/`、`/zh/privacy/`、`/zh/terms/`。其中 `/methodology/` 收 52 条入链、0 条正文出链——**全站最大的权重汇集点同时是全站最大的断头路**。

---

## 二、孤岛页清单

### 2.1 严格意义"入链数 = 0"的页面：2 个，均非缺陷

| 页面 | 入链 | 判定 |
|---|---|---|
| `/404.html` | 0 | 非缺陷。错误页由服务器返回，本身不应被链；页面内已有 3 条正文链接（→ `/`、→ `/tools/llms-txt-checker/`、→ `/blog/what-is-geo/`），行为正确 |
| `/google549b561c38ba8bae.html` | 0 | 非缺陷。Google Search Console 域名验证文件，按设计不入链、不入 sitemap |

**因此"存在孤岛页"这一条在字面口径上不成立——站内没有真正的孤儿页。** 但下面两类结构性孤岛成立，且是本报告的主要问题。

### 2.2 正文孤岛：只有模板链接、正文入链 = 0（5 个）

| 页面 | 总入链 | 正文入链 | 唯一入口 |
|---|---|---|---|
| `/privacy/` | 50 | **0** | 页脚 Privacy + Cookie 横幅"Privacy Policy" |
| `/terms/` | 25 | **0** | 页脚 Terms |
| `/zh/blog/` | 20 | **0** | zh 页脚"中文博客" |
| `/zh/privacy/` | 20 | **0** | zh 页脚 + zh cookie 横幅 |
| `/zh/terms/` | 10 | **0** | zh 页脚 |

privacy/terms 属法务页，正文不入链可以接受。但 **`/zh/blog/` 是内容枢纽却 0 条正文入链**——`/zh/` 首页正文里推荐的是 1 篇具体文章（`/zh/blog/geoscore-update-multi-page-security/`），从不指向 `/zh/blog/` 索引本身，这直接导致中文博客索引没有下级页面的分发能力。

### 2.3 正文图不可达：13 个页面（从首页只走正文链接走不到）

`/privacy/`、`/terms/`、`/zh/`、`/zh/blog/`、`/zh/blog/geoscore-update-multi-page-security/`、`/zh/methodology/`、`/zh/pricing/`、`/zh/privacy/`、`/zh/report/demo/`、`/zh/terms/`、`/zh/tools/ai-readiness-score/`、`/zh/tools/llms-txt-checker/`、`/zh/tools/robots-txt-ai-checker/`

即**整个中文子树（11 页）在正文层与英文站完全断开**，唯一连接是英文页导航里那个"中文"锚（37 条模板链接，全站同一锚文本）和 `/zh/` 正文里 1 条指向 `/blog/` 的链接。中文 11 页（占全站 30% 页面）在内容层是挂在页脚上的一块飞地。

### 2.4 最脆弱页：正文入链 = 1（2 篇）

| 页面 | 唯一正文来源 |
|---|---|
| `/blog/geo-maturity-model-2026/` | `/blog/` 索引卡 |
| `/blog/geoscore-update-multi-page-security/` | `/blog/` 索引卡 |

这两篇只要从博客索引页掉出，就是真正的孤岛。次弱的是 `/blog/ai-crawler-robots-txt-templates/`、`/blog/geo-citation-optimization/`（正文入链 2）。

---

## 三、入链排行（排除自链）

| 入链 | 正文入链 | 独立来源 | 页面 |
|---:|---:|---:|---|
| 95 | 34 | 36 | `/` |
| 52 | **2** | 25 | `/methodology/` |
| 50 | **0** | 25 | `/privacy/` |
| 45 | 20 | 25 | `/tools/ai-readiness-score/` |
| 41 | 16 | 25 | `/blog/llms-txt-ultimate-guide/` |
| 41 | 16 | 25 | `/blog/what-is-geo/` |
| 41 | 16 | 25 | `/tools/llms-txt-checker/` |
| 40 | 4 | 36 | `/zh/` |
| 37 | 12 | 25 | `/blog/eeat-signals-ai-search/` |
| 37 | 12 | 25 | `/tools/robots-txt-ai-checker/` |
| 36 | 11 | 25 | `/blog/geo-vs-seo/` |
| 34 | 9 | 25 | `/blog/json-ld-structured-data-ai-search/` |
| 32 | 7 | 25 | `/blog/geo-tracking-ai-visibility/` |
| 31 | 6 | 25 | `/blog/why-doesnt-chatgpt-cite-my-website/` |
| 30 | 5 | 25 | `/blog/ai-search-engine-list/` |
| 27 | **2** | 25 | `/pricing/` |
| 25 | 0 | 25 | `/terms/` |
| 21 | 1 | 10 | `/zh/methodology/` |
| 21 | 1 | 10 | `/zh/tools/ai-readiness-score/` |
| 21 | 1 | 10 | `/zh/tools/llms-txt-checker/` |
| 21 | 1 | 10 | `/zh/tools/robots-txt-ai-checker/` |
| 20 | 0 | 10 | `/zh/blog/` |
| 20 | 0 | 10 | `/zh/privacy/` |
| 15 | 4 | 13 | `/blog/` |
| 12 | 2 | 10 | `/zh/blog/geoscore-update-multi-page-security/` |
| 11 | 1 | 10 | `/zh/pricing/` |
| 10 | 0 | 10 | `/zh/terms/` |
| 7 | 7 | 6 | `/blog/auditing-1200-websites/` |
| 4 | 4 | 3 | `/blog/geo-metrics-2026/` |
| 4 | 4 | 3 | `/blog/multimodal-geo-2026/` |
| 4 | 4 | 4 | `/report/demo/` |
| 4 | 4 | 4 | `/zh/report/demo/` |
| 2 | 2 | 2 | `/blog/ai-crawler-robots-txt-templates/` |
| 2 | 2 | 2 | `/blog/geo-citation-optimization/` |
| 1 | 1 | 1 | `/blog/geo-maturity-model-2026/` |
| 1 | 1 | 1 | `/blog/geoscore-update-multi-page-security/` |

### 核心三页体检（本次任务的三个重点）

**`/tools/ai-readiness-score/`：45 / 20 正文 / 25 来源 —— 健康。** 7 个正文来源：`/`、`/blog/geo-citation-optimization/`、`/blog/geo-maturity-model-2026/`、`/blog/geo-metrics-2026/`、`/blog/geo-tracking-ai-visibility/`、`/blog/json-ld-structured-data-ai-search/`、`/blog/why-doesnt-chatgpt-cite-my-website/`。问题不在入链，在出链：它只有 2 条正文出链（→ `/report/demo/`、→ `/tools/robots-txt-ai-checker/`），**不指向 `/methodology/`、不指向任何文章、不指向 `/pricing/`**。

**`/methodology/`：52 总入链，正文入链只有 2 —— 不达标。** 52 条里 50 条来自页脚那一行 "Methodology"（同一锚文本，每页重复），剩下 2 条正文来源是 `/` 和 `/blog/why-doesnt-chatgpt-cite-my-website/`。而且后者的锚文本写的是 **"GeoScore"**（`/blog/why-doesnt-chatgpt-cite-my-website/` → `/methodology/`），锚文本与落点主题不符。一个 11 维评分法的权威页，全站 15 篇文章只有 1 篇在正文里引用它——E-E-A-T 上说不通。

**`/pricing/`：27 总入链，正文入链 2，是核心三页里最差的。** 两条来源都在首页（"Upgrade to Pro"、"pricing page"）。**15 篇博客 0 条指向定价页**，3 个工具页 0 条指向定价页，`/methodology/` 0 条指向定价页。商业转化页只靠导航和页脚，等于站内没有任何一篇文章认为"该去付费"。

---

## 四、四类连接密度（只算正文链接）

| 源 \ 目标 | core（首页/methodology/pricing） | tool（3 工具 + report/demo） | blog | zh | legal |
|---|---:|---:|---:|---:|---:|
| **core** | 4 | 5 | 5 | 0 | 0 |
| **tool** | 2 | 4 | **0** | 0 | 0 |
| **blog** | 31 | 42 | 100 | 0 | 0 |
| **zh** | 0 | 0 | 2 | 15 | 0 |
| **legal** | 1 | 1 | 1 | 0 | 0 |

（legal 行 3 条全部来自 `/404.html`；zh 列的 0 表示：没有任何英文正文链接指向任何一个 zh 页面。）

**读法与判断：**

1. **blog→blog 100 条、tool 42、core 31：内容层是健康的。** 15 篇文章之间 71 条有向边、仅 5 对双向，是"星形 + 单向推荐"而不是无脑互链，这个形态是对的，不需要动。
2. **tool→blog = 0，这是全站唯一一条完全断掉的方向。** 3 个工具页加起来的正文出链只有 5 条（3 条 → `/report/demo/`、1 条 → `/`、1 条 → `/tools/robots-txt-ai-checker/`），**没有一条指向任何一篇文章、也没有一条指向 `/methodology/` 或 `/pricing/`**。工具页恰恰是正文入链最集中的商业页（20/16/12），权重进去后只流向 `/report/demo/` 和首页。这是结构上最明显的一处漏水。
3. **core→blog 只有 5 条，且 4 条来自首页。** `/methodology/` 和 `/pricing/` 对 15 篇文章 0 出链——两个最该做"知识分发"的页面完全不参与内容网络。
4. **zh 与 en 双向都是 0（正文层）。** zh→en 只有 `/zh/` 正文里 1 条 → `/blog/`；en→zh 正文 0 条。中文 11 页的商业入口 `/zh/pricing/` 只有 1 条正文入链（来自 `/zh/` 的"升级 Pro"）。
5. **"只有页脚链接"的弱连接名单（正文入链占比 < 10%）：** `/methodology/`（2/52 = 3.8%）、`/pricing/`（2/27 = 7.4%）、`/privacy/`（0%）、`/terms/`（0%）、`/zh/methodology/`（1/21 = 4.8%）、`/zh/pricing/`（1/11 = 9.1%）、`/zh/blog/`（0%）、`/zh/privacy/`（0%）、`/zh/terms/`（0%）。**站点的"重要性排序"实际上是页脚排序，不是内容排序**——methodology 和 pricing 在链接层面被当作隐私政策同等对待。

---

## 五、锚文本质量

### 5.1 空话锚文本：0 条

213 条正文链接的锚文本**没有任何一条**是 "Learn more"、"Read more"、"Click here"、"here"、"→" 这类无信息文本。**"锚文本全是空话"这条假设不成立，这项是达标的。** 空锚只出现在模板层（0 条）和图标链接（0 条）。

有意义锚文本占比：**213/213 = 100%**（按"含实体词"口径）。但按"锚文本准确描述落点且不与其他 20 条重复"的更严口径，有缺陷的是 4 条 + 17 条冗余重复，见下。

### 5.2 真问题一：整卡包链接，锚文本以 URL 开头（3 条）

`/` 首页三张工具卡把整个 `<a>` 包住卡片（`src/pages/index.astro:241` 附近），导致锚文本变成：

```
"/tools/ai-readiness-score AI Readiness Score Get a 0-100 score across 11 dimensions…"
"/tools/llms-txt-checker llms.txt Checker Check if your site has the AI guidance…"
"/tools/robots-txt-ai-checker Robots.txt AI Checker Verify your robots.txt isn't blocking…"
```

3 条链接的锚文本都以路径开头、长达 80+ 字符。首页是唯一给这 3 个工具页做"关键词级"推荐的页面，结果关键词信号被路径和描述句稀释掉了。

### 5.3 真问题二：错锚 1 条

`/blog/why-doesnt-chatgpt-cite-my-website/` → `/methodology/`，锚文本 **"GeoScore"**。用品牌名指向方法论页，锚文本和落点主题（评分方法、11 个维度）毫无关系。这是全站唯一一条指向 `/methodology/` 的博客正文链接，唯一的一次机会用错了词。

### 5.4 真问题三：同页重复同锚，权重浪费（涉及 21 条边，其中 17 条冗余）

| 源页 → 目标 | 次数 | 冗余条数 | 同文本重复 |
|---|---:|---:|---|
| `/blog/geo-citation-optimization/` → `/tools/ai-readiness-score/` | **6** | 5 | "AI Readiness Score audit" 重复 4 次 |
| `/blog/geo-citation-optimization/` → `/tools/llms-txt-checker/` | **6** | 5 | "llms.txt checker" 重复 4 次 |
| `/blog/geo-maturity-model-2026/` → `/tools/ai-readiness-score/` | **5** | 4 | "AI Readiness Score audit" 重复 4 次 |
| `/blog/geo-metrics-2026/` → `/tools/ai-readiness-score/` | 4 | 3 | 3 种文本 |

同一页面对同一目标重复 4–6 次，第 2 条起不增加权重，只增加"过度优化"观感。这 17 条冗余里约 13 条可以换成第四节/第六节里缺的链接方向。

### 5.5 真问题四：首页锚文本分布倒挂

首页 34 条正文入链（来自 19 个页面）的锚文本构成：

| 类型 | 条数 | 举例 |
|---|---:|---|
| 行动号召（CTA） | 16 | "Start Free Audit →" ×3、"Start Free GEO Audit →" ×3、"Run Free Audit →" ×2、"Start Free"、"Run Full GEO Audit →" |
| 品牌词 | 11 | "GeoScore" ×5、"← Back to GeoScore" ×5、"geoscore.help" ×1 |
| 描述性/关键词 | **7** | "GEO audit" ×3、"free GEO audit tool"、"full audit report"、"Audit your site for free →"、"Back to Home" |

27/34 = **79%** 的首页入链锚文本是纯品牌或纯 CTA。首页本该靠内链锚文本承接 "GEO audit tool / AI visibility audit" 这一类词，实际收到的几乎全是导航词——**首页的品牌锚文本过剩、关键词锚文本不足**。

### 5.6 附带发现：落点语义与 URL 冲突

`/blog/auditing-1200-websites/` 的 URL 写 1200，而页面 `<title>`、`/blog/` 索引卡、以及 **6 条正文内链**（4 种文本："audit of 343 real sites" ×2、"343 websites" ×2、"\"I Audited 343 Websites\""、"audit of 343 real websites"）全部写 **343**。锚文本与标题内部一致，但与 URL 冲突——外部链接和锚文本里出现 1200 这个数字时会对不上落点。

---

## 六、补链清单

> 收益判定说明：本轮修的是"方向缺失"，不是"数量不足"。**"tool→blog 出链 = 0"、"methodology/pricing 正文出链 = 0"、"13 页正文图不可达"、"2 篇文章正文入链 = 1" 是可直接判定的事实。** 改动后排名/流量会怎样，在日均个位数流量下无法验证 —— **每一条的"预期收益"都属赌注**，下列按赌注大小排序，P0 是"结构上必须存在但现在缺失"的链接，P2 是优化项。

### P0-1 打通 tool→blog（新增 3 条，方向从 0 → 3）

| 从 | 到 | 锚文本 |
|---|---|---|
| `/tools/llms-txt-checker/` | `/blog/llms-txt-ultimate-guide/` | `how to write an llms.txt file` |
| `/tools/robots-txt-ai-checker/` | `/blog/ai-crawler-robots-txt-templates/` | `robots.txt rules for GPTBot and ClaudeBot` |
| `/tools/ai-readiness-score/` | `/blog/geo-maturity-model-2026/` | `GEO maturity model` |

收益（赌注）：这是全站唯一为 0 的聚类方向。3 个工具页合计正文入链 48 条（20+16+12），是站内权重最集中的正文节点；而它们合计只有 5 条正文出链——3 条给 `/report/demo/`、1 条给 `/`、1 条给 robots 检测器，**0 条给文章、0 条给 `/methodology/`**。补完后，两篇"正文入链 = 1/2"的文章（`geo-maturity-model-2026`、`ai-crawler-robots-txt-templates`）各获得一条来自高权页的链接，`llms-txt-ultimate-guide` 从 16 → 17。工具页同时获得"有解释性内容可读"的出向链接，对 E-E-A-T 也是加分项。

### P0-2 打通 tool→core，特别是 → `/methodology/`（新增 3 条）

| 从 | 到 | 锚文本 |
|---|---|---|
| `/tools/ai-readiness-score/` | `/methodology/` | `how the 11 dimensions are scored` |
| `/tools/llms-txt-checker/` | `/methodology/` | `scoring methodology` |
| `/tools/robots-txt-ai-checker/` | `/methodology/` | `how GeoScore scores robots.txt` |

收益（赌注）：`/methodology/` 正文入链 2 → 5，且来源从"首页 + 1 篇博客"变成"3 个商业工具页 + 首页 + 1 篇博客"。这是把"权威页"接进商业路径的最低成本做法——用户从工具页想知道分数怎么来的，这条链接本来就该存在。

### P0-3 把 `/methodology/` 从断头路改成枢纽（新增 4 条，正文出链 0 → 4）

| 从 | 到 | 锚文本 |
|---|---|---|
| `/methodology/` | `/tools/ai-readiness-score/` | `run the 11-dimension audit` |
| `/methodology/` | `/blog/eeat-signals-ai-search/` | `the E-E-A-T signals we weight` |
| `/methodology/` | `/blog/json-ld-structured-data-ai-search/` | `structured data we check` |
| `/methodology/` | `/pricing/` | `what Pro monitoring adds` |

收益（赌注）：`/methodology/` 现在收 52 条入链、出 0 条，是明确的权重断点。改成枢纽后，这 52 条中的一部分会经它二次分配——分给商业页（工具、定价）和两篇权威文章。**这是全站单点收益最高的一处改动**：一个页面从"只吃不吐"变成"吃 52 吐 4"。

### P0-4 博客 → 定价页（新增 5 条，pricing 正文来源 1 → 6）

| 从 | 到 | 锚文本 |
|---|---|---|
| `/blog/geo-tracking-ai-visibility/` | `/pricing/` | `Pro plan for continuous AI visibility monitoring` |
| `/blog/geo-metrics-2026/` | `/pricing/` | `what the Pro plan measures` |
| `/blog/geo-citation-optimization/` | `/pricing/` | `pricing for multi-page tracking` |
| `/blog/why-doesnt-chatgpt-cite-my-website/` | `/pricing/` | `see what Pro adds` |
| `/blog/geo-maturity-model-2026/` | `/pricing/` | `plans for each maturity stage` |

收益（赌注，但方向确定）：`/pricing/` 正文入链 2，且 15 篇文章零引用。这 5 条是有商业意图的自然落点（监控、度量、多页跟踪），不是硬塞 CTA。零流量下不会立刻带来转化，但定价页拿到的是主题相关的锚文本，而不是 "pricing page" 这种导航词。

### P0-5 工具页互相引用（工具矩阵，补 4 条）

现状互链矩阵——3 个工具页之间 6 个方向只存在 **1 个**：

| 源 \ 目标 | `/tools/ai-readiness-score/` | `/tools/llms-txt-checker/` | `/tools/robots-txt-ai-checker/` |
|---|---:|---:|---:|
| `/tools/ai-readiness-score/` | — | **0** | 1 |
| `/tools/llms-txt-checker/` | **0** | — | **0** |
| `/tools/robots-txt-ai-checker/` | **0** | **0** | — |

补法（每条工具页加一个"Related checks"小模块，用文字链不用卡片，锚文本保持独立可读）：

| 从 | 到 | 锚文本 |
|---|---|---|
| `/tools/robots-txt-ai-checker/` | `/tools/ai-readiness-score/` | `full 11-dimension AI readiness score` |
| `/tools/robots-txt-ai-checker/` | `/tools/llms-txt-checker/` | `llms.txt checker` |
| `/tools/llms-txt-checker/` | `/tools/ai-readiness-score/` | `full 11-dimension AI readiness score` |
| `/tools/ai-readiness-score/` | `/tools/llms-txt-checker/` | `llms.txt checker` |

收益（赌注，且方向明确）：`/tools/robots-txt-ai-checker/` 在 GSC 90 天内零展示，但它已有 12 条正文入链、8 个来源——**它不是入口不足，是需求/竞争力问题**，继续给它加链收益很低。这 4 条的价值在反方向：让一个"有点击但没有出路"的 robots 页把权重导给两个有展示的工具页，同时形成与竞品 geoptie 同构的工具矩阵（6 个工具页互相内链）。做完后工具页之间 6 个方向全覆盖，缺的 4 条补齐。

### P1-1 博客面包屑改指 hub（改 9 条，`/blog/` 正文入链 4 → 12+）

现状：9 篇文章页顶部写的是 "← Back to GeoScore" / "GeoScore" 指向 `/`（如 `/blog/eeat-signals-ai-search/`、`/blog/geo-citation-optimization/`、`/blog/geo-maturity-model-2026/`、`/blog/geo-metrics-2026/`、`/blog/geo-tracking-ai-visibility/`、`/blog/auditing-1200-websites/`、`/blog/llms-txt-ultimate-guide/`），只有 `/blog/json-ld-structured-data-ai-search/` 用了 "← All Articles" 指向 `/blog/`。

改为 `/blog/` + 文章标题的两级面包屑：`All articles → /blog/`，`← 上一篇` 保留。锚文本示例：`All GEO guides`。

收益（赌注）：`/blog/` hub 只有 4 条正文入链，却要向下分发 15 篇文章。hub 入链 4 → 12 后，15 篇文章通过 hub 获得的间接权重会同步上升；同时首页的 11 条品牌锚文本会减少 9 条，缓解第五节的"品牌锚文本过剩"。

### P1-2 高权文章救低权文章（新增 4 条，链接源已按词级数据二次修订，见 §8.2）

| 从（正文入链 / 展示 / 均排） | 到（当前正文入链） | 锚文本 |
|---|---|---|
| `/blog/eeat-signals-ai-search/`（12 / 30 / **22.4 最强**） | `/blog/geo-citation-optimization/`（2） | `how to get cited by AI engines` |
| `/blog/llms-txt-ultimate-guide/`（16 / 96 / 49.5） | `/blog/ai-crawler-robots-txt-templates/`（2） | `ready-made robots.txt rules for AI crawlers` |
| `/blog/json-ld-structured-data-ai-search/`（9 / 276 / 52.8） | `/blog/geo-metrics-2026/`（4，3 源全零展示） | `how to measure whether your structured data works` |
| `/blog/what-is-geo/`（16 / 130 / **83.8 最弱，已降级**） | `/blog/geo-maturity-model-2026/`（1） | `the GEO maturity model` |

配对逻辑：**两个最缺入口的页（geo-maturity 1 条、geo-citation 2 条）拿两个最强的源（eeat 22.4、llms-txt 49.5）**；`geo-metrics` 与 `json-ld` 主题最贴（都讲"怎么验证结构化数据生效"），**但强度只能给"中偏低"**：该页 276 展示里 62（22%）是德语词，英文侧真实权重小于数字（见 §8.2 第三条）。四对里只有 `eeat → geo-citation` 与 `llms-txt → ai-crawler` 是"强配对"，其余两对不要按同级引用。唯一妥协在 `geo-maturity`：它与 `what-is-geo` 主题连续（什么是 GEO → 成熟度模型）但源最弱，因为剩下能讲"成熟度"的页面只有它。**所以 P1-2 对 `geo-maturity` 的目标只是"入口从 1 提到 2"，不是"救活它"**——真正可能救它的是 P0-1 里 `/tools/ai-readiness-score/`（20 条正文入链）那条工具页出链。

修订说明：初版把 `/blog/geo-vs-seo/` 当作链接源，但它在 GSC 90 天内零展示——一个自身没有外部信号的页面没有权重可分，改用它只会形成"零展示页互链"的空转。第二版按展示量排序，把 `what-is-geo`（130 展示）排在第二；**词级数据回来后再修一次**：它 130 展示里 89 来自 `what is geo` 且均排 85.2，属于"有展示、无排名"，已降级为辅助源（判据见 §8.2）。同时把原定的 `/blog/geoscore-update-multi-page-security/`（正文入链 1）移出本组：它是产品更新日志，不是可排名的主题页，给它补链的边际收益低于给 4 个"零强源"页补链（见第八节表格）。

收益（赌注）：这 4 个目标页目前的正文来源里**没有任何一个来自有展示的页面**（全是 `/blog/` 索引 + 其他零展示文章）。这是它们"零展示"的结构性成因之一。`geo-citation-optimization` 正文出链 29 条（全站第一）却只收 2 条入链，是典型的"只给不收"。


### P1-3 减少无效重复（删 13 条）

`/blog/geo-citation-optimization/`：→ `/tools/ai-readiness-score/` 6 条减到 2 条、→ `/tools/llms-txt-checker/` 6 条减到 2 条；`/blog/geo-maturity-model-2026/`：→ `/tools/ai-readiness-score/` 5 条减到 2 条；`/blog/geo-metrics-2026/`：→ `/tools/ai-readiness-score/` 4 条减到 2 条。

收益（赌注）：同页同锚重复不叠加权重，删掉不损失，且腾出的版面正好放 P0-4 / P1-2 的新链接，避免单页出链过密（`geo-citation-optimization` 已有 29 条）。

### P1-4 `/blog/llms-txt-ultimate-guide/` 的出链重定向（改 2 条 + 新增 1 条，出链总数不变）

这一条比 P1-2 更值得先做，因为它是「改写已有链接的落点」，零新增版面。

现状：5 条正文出链，4 条指向 `/`（3 条锚文本是 "GeoScore"，1 条是 "Run free llms.txt audit →"），只有 1 条（"audit of 343 real sites"）指向其他文章。

| 处理 | 现有链接 | 改为 | 新锚文本 |
|---|---|---|---|
| 改落点（0 成本） | `Run free llms.txt audit →` → `/` | → `/tools/llms-txt-checker/` | `run a free llms.txt audit` |
| 改落点（0 成本） | `GeoScore` → `/`（正文中部那一条） | → `/tools/llms-txt-checker/` | `check your llms.txt against the spec` |
| 保留 | 顶部品牌锚 `GeoScore` → `/` | 不动 | — |
| 新增 1 条 | — | → `/blog/ai-crawler-robots-txt-templates/` | `robots.txt rules for AI crawlers`（与 P1-2 同一条边，不重复计） |

收益（赌注）：`/blog/llms-txt-ultimate-guide/` 是全站展示第 3 的页面（96 展示；若把 301 过来的旧 URL 一并计入，是 110 展示量级），它给 `/tools/llms-txt-checker/` 的正文链接目前是 **0**。也就是说：全站最懂 llms.txt 的文章，不指向站内的 llms.txt 检测器。这是本次补链里"投入产出比最高的一条"——不是新增内容，只是把一条已有的 CTA 从首页改指向工具页。做完后 `/tools/llms-txt-checker/` 的正文来源从 7 个变成 8 个，且新增的这一条来自全站展示第 3 的页面。

### P2-1 中文子树接入正文网（新增 6 条）

| 从 | 到 | 锚文本 |
|---|---|---|
| `/zh/` | `/zh/blog/` | `全部中文文章` |
| `/zh/methodology/` | `/methodology/` | `English methodology` |
| `/zh/pricing/` | `/pricing/` | `English pricing` |
| `/zh/tools/ai-readiness-score/` | `/zh/methodology/` | `评分方法` |
| `/zh/blog/geoscore-update-multi-page-security/` | `/zh/tools/ai-readiness-score/` | `免费 AI 就绪评分` |
| `/tools/ai-readiness-score/` | `/zh/tools/ai-readiness-score/` | `中文版评分工具` |

收益（赌注）：中文 11 页目前 0 条英文正文入链、zh→en 正文只有 1 条。这 6 条的作用是让 zh 子树不再只靠 header 里那个"中文/EN"锚连接。注意：中文只有 1 篇文章，内链网的密度上限很低，**这一项的性价比低于 P0/P1**——除非中文内容量先上去。

### P2-2 内链卫生（0 成本，非赌注）

1. **首页 3 张工具卡**：把 `<a>` 收窄到 `<h3>` 上，锚文本从 `"/tools/ai-readiness-score AI Readiness Score Get a 0-100…"` 改成 `AI Readiness Score`；路径前缀 `.font-mono` 块移出 `<a>`。影响 3 条边，是本次唯一"确定改善"的锚文本修正。
2. **错锚修正**：`/blog/why-doesnt-chatgpt-cite-my-website/` → `/methodology/` 的锚文本 `GeoScore` 改为 `GeoScore's scoring methodology`。
3. **数字统一**：`/blog/auditing-1200-websites/` 的 URL 写 1200，标题/索引卡/6 条锚文本全写 343。现状是锚文本自身一致、只与 URL 冲突，所以最低成本动作是**不动 URL、页面内数字统一为 343**；若认定 1200 才是对的，则需同时改标题 + 6 条锚文本 + 301，成本高且无收益，不建议。

---

## 七、一句话总结

站内没有真正的孤岛页（0 入链只有 404 和 Google 验证文件），真问题集中在三个方向性断裂——工具页 0 条指向博客、`/methodology/` 与 `/pricing/` 正文出链为 0、中文 11 页在正文层与英文站完全断开。详见第九节的完整表述。

---

## 八、附录：与 GSC 数据的交叉验证（对表后修订 3 处建议）

数据来源：`review/03-keywords.md`（GSC 90 天，属性已核验）。本节把"内链入口"和"有没有展示"对到一起，结论修正了关键词侧的一个判断。

### 8.1 "零展示 = 没有内链入口"只对一半

8 篇零展示文章 + 1 个零展示工具页，按"正文入链"与"**入链来源中有几个来自有展示的页面**"两列重排：

| 页面 | 正文入链 | 独立正文来源 | 其中来自有展示页 | 判定 |
|---|---:|---:|---:|---|
| `/blog/geo-maturity-model-2026/` | 1 | 1 | **0** | 真·入口不足（唯一来源是 `/blog/` 索引卡） |
| `/blog/geo-citation-optimization/` | 2 | 2 | **0** | 真·入口不足（来源为 `/blog/` + 零展示的 `geo-maturity`） |
| `/blog/ai-crawler-robots-txt-templates/` | 2 | 2 | **0** | 真·入口不足（来源为 `/blog/` + 零展示的 `ai-search-engine-list`） |
| `/blog/geo-metrics-2026/` | 4 | 3 | **0** | 真·入口不足（3 个来源全部零展示） |
| `/blog/ai-search-engine-list/` | 5 | 5 | 1（`what-is-geo`） | 入口够，问题在内容 |
| `/blog/why-doesnt-chatgpt-cite-my-website/` | 6 | 6 | 2（`eeat`、`json-ld`） | 入口够，问题在内容 |
| `/blog/auditing-1200-websites/` | 7 | 6 | 2（`eeat`、`llms-txt`） | 入口够，问题在内容 |
| `/blog/geo-vs-seo/` | 11 | 8 | 2（`eeat`、`what-is-geo`） | 入口够，问题在内容 |
| `/tools/robots-txt-ai-checker/` | 12 | 8 | 2（`what-is-geo`、`/tools/ai-readiness-score/`） | 入口够，问题在内容 |

**修正：8 篇零展示文章里只有 4 篇（geo-maturity、geo-citation、ai-crawler、geo-metrics）是"没有内链入口"，另外 4 篇有 5–11 条入链、其中 1–2 条来自有展示的页面。** 把这 8 篇一律说成"双重孤立"会导致补链动作打偏——后 4 篇再补链也不会从 0 展示变成有排名，它们的问题是标题/意图/内容竞争力。同理 `/tools/robots-txt-ai-checker/` 有 12 条入链、8 个来源，**它不是入口不足**，P0-5 里那些链接的价值在"把它的权重导出去"，而不是"把权重导进来"。

顺带把一个容易误判的项写清楚：`/blog/how-to-write-llms-txt/` 的 301 走向正确（→ `/blog/llms-txt-ultimate-guide/`，状态码 301，源码已无此文件），GSC 把新旧 URL 分开统计（旧 14 展示 / 均排 65.4，新 96 展示 / 均排 49.5），**这不是内链缺陷，不需要处理**；但读数据时不能把它当作两个页面，否则会误判 `/blog/llms-txt-ultimate-guide/` 的真实权重。

### 8.2 有展示的只有 4 个页面，而这 4 个页面在浪费自己的出链预算

| 页面 | GSC 展示 | 均排 | 正文出链 | 其中指向 `/` | 作为链接源的角色 |
|---|---:|---:|---:|---:|---|
| `/blog/eeat-signals-ai-search/` | 30 | **22.4** | 9 | 2 | **主源**（排名最好，词最具体） |
| `/blog/llms-txt-ultimate-guide/` | 96 | 49.5 | 5 | **4** | **主源** |
| `/blog/json-ld-structured-data-ai-search/` | 276 | 52.8 | 7 | 2 | **主源**（量最大，但见下方打折说明） |
| `/blog/what-is-geo/` | 130 | **83.8** | 9 | 3 | **降级为辅助源**（有展示、几乎无排名） |

`/blog/llms-txt-ultimate-guide/` 是最刺眼的一个：**全站展示第 3 的页面，5 条正文出链里 4 条指向首页（3 条锚文本就是 "GeoScore"）**，等于把 80% 的出链预算交给了品牌导航，一篇相关文章都没推荐。它不是没有权重可分，是分错了地方。已单列为 **P1-4**：把 2 条已有链接的落点改掉（1 条 CTA 从 `/` 改为 `/tools/llms-txt-checker/`，1 条品牌锚改为工具页），再新增 1 条指向 `ai-crawler-robots-txt-templates`，出链总数不变，方向全变。

**选源判据（本节最该记住的一条）：展示量不是选源标准，"主题词 × 均排靠前"才是。** 展示量只证明"这个 URL 被搜索引擎考虑过"，不证明它有权重可分。据此有三道校验，4 个页面全部通过前两道、但名次差别很大：

1. **词必须是主题词，不能是品牌词。** `/about/` 是反例（56 展示全部来自 `geo score`/`geoscore`/`what is geo score`）；本节 4 页用 GSC 页面×词交叉核过，**4/4 的头 5 个词全是主题词，0 个品牌词**。
2. **均排必须靠前，否则"高展示"是假信号。** `/blog/what-is-geo/` 130 展示里 89 来自 `what is geo`，均排 **85.2**（第 9 页）；`geo meaning` 96.8、`what does geo mean` 89.2——**有展示、几乎无排名**。对比 `/blog/eeat-signals-ai-search/`：只有 30 展示，均排 **22.4**（第 3 页），吃的是 `e-e-a-t signals that ai models prioritise` 这类具体问句。**能传权重的不是展示多的页，是排得靠前的页。** 所以 P1-2 里 `what-is-geo` 从"第二主源"降级为辅助源，`eeat` 升为主源。
3. **展示要集中，不能是"很多词各露一次"。** `/blog/llms-txt-ultimate-guide/` 96 展示散在 27 个词里，最大词只有 16 展示；`json-ld` 页 276 展示里 **62（22%）来自德语词 `json ld für ai search`**。前者说明它的展示不稳定，后者说明它的"量最大"有近四分之一是德语需求——若将来做德语版，这 62 展示会**转移**而不是净增，英文侧的真实量只有约 170。两条都不改变选源结论，但都要在预期上打折。

补充口径：`/blog/llms-txt-ultimate-guide/` 的真实展示量应按 **110** 计（新 URL 96 + 旧 URL `how-to-write-llms-txt` 经 301 过来的 14），GSC 目前把两者分开统计。若把 GSC 页面维度里那个无尾斜杠变体 `/blog/llms-txt-ultimate-guide`（5 展示）也算进来，同一页面的展示量级是 **115**——三个 URL 指向同一个页面，读数据时不能当三页看。本报告表格里沿用 GSC 的 96，只为与 `review/03-keywords.md` 对得上，不表示它只值 96。

关于无尾斜杠：2026-10-22 实测 `/blog/llms-txt-ultimate-guide`、`/pricing`、`/methodology`、`/blog`、`/zh` 全部返回 **308 → 带斜杠版**（`astro.config.mjs` 没配 `trailingSlash`，是 Cloudflare Pages 在边缘补的），**不存在重复 URL 持续分流的技术债**，GSC 里的无斜杠条目是 308 生效前的历史数据。这条已排除，不必再查 canonical。

`/blog/json-ld-structured-data-ai-search/` 展示 276（全站第一）却只有 7 条正文出链：2 条给首页、1 条给 `/blog/` 索引、3 条给文章、1 条给 `/tools/ai-readiness-score/`；**0 条给 `/methodology/`、0 条给 `/pricing/`、0 条给另外两个工具页**。它是站内最有资格做分发源的页面，却是全站最保守的分发者——按它的展示量，至少应该再放出 3 条主题链接（→ `/methodology/`、→ `/tools/llms-txt-checker/`、→ `/blog/geo-metrics-2026/`，最后一条已在 P1-2 中列出，两处不重复计）。

### 8.3 建议的执行顺序（按"证据强度"而不是按"链接数量"）

1. **先做零成本项：P1-4（改 2 条已有链接的落点）+ P2-2（锚文本卫生）**。这两项不动版面、不新增内容，只改 `href` 和锚文本，是全清单里唯一"改完就是改善、不需要流量验证"的部分。特别是 P1-4 那条 `Run free llms.txt audit →` 从 `/` 改指 `/tools/llms-txt-checker/`，一条属性改动就补上"展示第 3 的页面不指向自家检测器"这个洞。同批可带上 §8.4 的两行 `_redirects`（`/about`、`/zh/about` 硬 404 → 301），同属 A 档。
2. **再做 P0-3 + P0-4**（`/methodology/` 改枢纽、博客→`/pricing/`）：这两项不依赖任何 GSC 数据，是纯结构缺陷，改完不会错。
3. **再做 P0-1、P0-2、P0-5**：工具页方向缺失 + 工具矩阵，方向明确但收益是赌注。
4. **P1-2 只对 4 个"零强源"页做**（geo-maturity、geo-citation、ai-crawler、geo-metrics），并且**只能用 §8.2 的 4 个有展示页做源，按"主题词 + 均排"排序取用**（eeat 22.4 > llms-txt 49.5 > json-ld 52.8 > what-is-geo 83.8，最后一页只作辅助）。不要给另外 4 篇零展示文章补链——它们的病因不在内链，补了也验证不出来。与 P0-1 合计，这 4 个页共补 6 条：geo-maturity 2 条（工具页 + what-is-geo）、ai-crawler 2 条（robots 工具页 + llms-txt 指南）、geo-metrics 1 条（json-ld）、geo-citation 1 条（eeat）。
5. **P2-1 中文子树最后做**：中文 11 页没有一页出现在关键词侧给出的"有展示"清单里，投入内链的边际收益最低。

### 8.4 重定向边界：`/about` 的两种形态，以及 301 落点压在了一个断头路上

内链图里没有 `/about`（站内 0 条链接指向它、不在 sitemap），但它是外链和 GSC 里的生效 URL，所以属于"链接层"必须交代的一笔。2026-10-22 实测：

| URL | 实测 | 说明 |
|---|---|---|
| `/about` | **404** | `public/_redirects` 里只有 `/about/`（带斜杠）一条规则；`/about/` 目录已不存在，Cloudflare 不会再补 308，于是裸路径硬 404 |
| `/about/` | **301** → `/methodology/` | 规则存在，方向正确 |
| `/zh/about` | **404** | 与 `/about` 同一个坑 |
| `/zh/about/` | **301** → `/zh/methodology/` | 规则存在 |

**判断 1：这次合并不是随手加的，是有意的实体页合并，且落地是完整的。** 三条证据：① `/src/pages/methodology.astro:130` 有一个 `id="about"` 的 "About & Contact" 区块，写明作者 anan、联系方式、源码地址、贡献方式；② 全站 `<link rel="author">`、Person schema 的 `url`、Organization `sameAs` 都指向 `/methodology`（`src/layouts/Layout.astro:24/116/146`）；③ `_redirects` 里 `/zh/about/` 有配套规则。也就是说站点已经把 `/methodology/` 当成"作者 + 实体"页在用，`/about/` 并进去是自洽的，不是清理页面时顺手加的。

**补充词级证据（2026-10-22，来自 `review/03-keywords.md`）**：`/about/` 的 56 展示只由 3 个词贡献——`geo score` 22 展示 / 均排 68.3（同词首页 40 展示 / 均排 87.0）、`geoscore` 6 展示 / 均排 36.3（同词首页 19 展示 / **均排 15.7**）、`what is geo score` 2 展示 / 均排 72.0。三个词全是"geo score 是什么/怎么算"，**methodology 比 about 更对口**；且其中 `geoscore` 的主落点本来就是首页（均排 15.7 vs about 36.3）。所以这次 301 的**损失上限接近 0**：它既不是"把 56 展示让给零展示页"，也不是意图错配，而是一次方向正确的合并。这也解释了为什么 `/methodology/` 在 GSC 里零展示——那批词本来就轮不到它接，301 只是让次优落点归位。

**判断 2：真正的缺口比"意图不匹配"小得多，是两条属性级问题。** ① `/about` 与 `/zh/about` 缺一条规则 → 硬 404（补 `_redirects` 两行即可，A 档零前提）；② 301 丢掉了 `#about` 片段，`/about/` → `/methodology/` 会把用户丢到页面顶部（方法论正文），而不是那个 About 区块。改成 `/about/ /methodology/#about 301` 体验上更顺，SEO 上无差别。

**判断 3（这条对内链有直接影响）：`/methodology/` 是断头路，而 301 又往它身上加了一条入口。** `/methodology/` 的全站状态是 **52 条正文入链、0 条正文出链**（见第三节）——这是结构事实，不依赖任何流量假设。现在它还是 `/about/` 的 301 落点。**所有进入 methodology 的权重都停在那里，不再往下走。**

需要说清楚这条论证的强度：**P0-3 成立的依据是"0 出链 + 被三处 JSON-LD 指定为实体页"，不是"301 带了 56 展示过来"。** 那 56 展示经词级校验后，可转移的份额接近 0（见上），所以不要用"301 损失"给 P0-3 加码——那是虚的。真实情况反而更简单：methodology 早就是实体页，早就是断头路，301 只是让"它是落点"这件事更明确。

**量级校准（防止过度投入）**：`/about/` 的 56 展示是 90 天累计 ≈ 0.6 次/天，均排 38.3 意味着在第 4 页；`/about` 的 4 展示 / 均排 8.3 更可能是极少数长尾词的历史记录。**所以这两行的修复价值不在流量，而在"不留 404"和"实体页链路自洽"。** 不要为这个数字单独排期，随 P2-2 的内链卫生一起改即可。

### 8.5 结论上的一个限定

本节把"哪些页缺入口"从 8 篇收敛到 4 篇，但这不改变第一节的核心判断：**931 条边里 718 条是样板、tool→blog 为 0、`/methodology/` 与 `/pricing/` 只进不出——这三条是结构事实，与流量无关。** 唯一需要软化表述的是"补链能让零展示页有排名"这一层：**只能对 4 篇说"值得一试（赌注）"，对另外 4 篇和 robots 工具页不能说。**

---

## 九、修订后的完整结论

站内**没有真正的孤岛页**（0 入链只有 404 和 Google 验证文件，均属正常），真正的问题是三个方向性断裂：**工具页 0 条指向博客、`/methodology/` 与 `/pricing/` 正文出链为 0（只吃不吐）、中文 11 页在正文层与英文站完全断开**——全站 931 条内链里 718 条是页脚样板，有效的 213 条中有 100 条（47%）集中在 blog→blog，而最能带动商业页的 tool→blog 方向是 0 条。叠加 GSC 后可以再补一句：**8 篇零展示文章里只有 4 篇是内链入口不足，另 4 篇的病因在内容；而全站只有 4 个页面有展示，其中一个（`/blog/llms-txt-ultimate-guide/`）把 4/5 的出链预算给了首页。**
