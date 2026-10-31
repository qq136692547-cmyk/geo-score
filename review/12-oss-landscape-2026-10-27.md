# GEO / LLMO / AEO 开源生态对标调研（2026-10-27）

分析师：oss-analyst
抓取时间：**2026-10-27 01:05 – 01:20 CST**（= 2026-10-26T17:05–17:20Z）
数据来源：**GitHub REST API 直查**（`api.github.com/repos/<owner>/<repo>`、`/search/repositories`）+ 官网定价页直抓
代理端口：探测后使用 **7897**（10809 / 10808 / 7890 / 10807 均返回 000 不通）
前置：已读 `D:/Codex/projects/geo-score/open-source-landscape-2026-10-08.md`（10-08 版，过期 19 天），
下表 Δ 列为与 10-08 快照的对比。**10-08 的数字未做任何复用，全部重新实查。**

> 铁律遵守说明：所有 star / fork / 推送时间均为本次直查快照；不确定项一律标 **未验证**；
> 抓不到的如实记为"抓取失败"，不编数字。

---

## 一、开源项目事实表 —— A. GEO / AI 可见度类（与我们直接同类）

| 项目 | star(10-27) | star(10-08) | Δ | fork | 最近推送 | License | 语言 | 形态 / 用途 |
|---|---:|---:|---:|---:|---|---|---|---|
| `AgriciDaniel/claude-seo` | **21912** | 未收录 | 新增 | 3015 | 2026-10-22 | **MIT** | Python | Claude Code SEO skill，26 sub-skills + 19 sub-agents |
| `Albert-Weasker/niubigeo` | **8747** | 未收录 | 新增 | 801 | 2026-10-23 | **Apache-2.0** | TypeScript | 开源 AI 品牌可见度报告；**官网明码标价卖服务** |
| `Ryze-AI-Adgent/open-seo-mcp-skills` | **7416** | 4528 | **+2888** | 382 | 2026-10-23 | MIT | Shell | SEO/GEO MCP server + skills |
| `irinabuht12-oss/marketing-skills` | 5832 | 未收录 | 新增 | 566 | 2026-10-23 | **无 License** ⚠️ | — | Claude 营销 skills 合集 |
| `onvoyage-ai/gtm-engineer-skills` | 1333 | 1319 | +14 | 57 | 2026-10-11 | MIT | HTML | AEO/GEO skill，16 项基础检查 |
| `Auriti-Labs/geo-optimizer-skill` | 1178 | 1013 | +165 | 132 | 2026-10-26 | MIT | Python | AEO/GEO 工具包（skill），官网 geoready.dev |
| `perplexityai/numbat` | 1146 | 未收录 | 新增 | 124 | 2026-10-25 | Apache-2.0 | Go | 端点上 AI agent 活动的可见性（非网页 GEO） |
| `amplifying-ai/awesome-generative-engine-optimization` | 532 | 517 | +15 | 224 | **2026-04-14** | **无 License** ⚠️ | — | awesome 清单，**已停更 6 个月** |
| `yaojingang/GEORank` | 517 | 490 | +27 | 116 | 2026-10-21 | Apache-2.0 | Python | GEO 排名与优化平台 |
| `elmohq/elmo` | 493 | 418 | +75 | 118 | 2026-10-26 | MIT | TypeScript | 自托管 AEO/GEO 平台；**Cloud $29/mo 起** |
| `ai-search-guru/getcito-…aio-aeo-or-geo-tool` | 492 | 447 | +45 | 98 | 2026-09-28 | **Other（自定义）** ⚠️ | TypeScript | 自称首个开源 AIO/AEO/GEO + 可见度追踪 |
| `danishashko/geo-aeo-tracker` | 308 | 284 | +24 | 74 | 2026-10-19 | MIT | TypeScript | local-first AI 可见度面板 |
| `yaojingang/GEOInflow` | 283 | 未收录 | 新增 | 49 | 2026-10-26 | MIT | TypeScript | 自托管 web + AI 爬虫分析（**仓创建于 2026-10-26，1 天前**） |
| `oneglanse/oneglanse` | 233 | 204 | +29 | 41 | 2026-10-04 | MIT | TypeScript | 自托管，5 引擎品牌提及/引用追踪 |
| `cxcscmu/AutoGEO` | 232 | 224 | +8 | 29 | 2026-06-14 | MIT | Python | **ICLR'26 论文实现**，学术基线 |
| `mverab/eGEOagents` | 207 | 未收录 | 新增 | 58 | 2026-10-26 | MIT | Python | GEO/AEO toolkit |
| `limelit-co/open` | 221 | 184 | +37 | 172 | 2026-10-22 | Apache-2.0 | Go | 自托管 AI 可见度追踪（AEO/GEO/LLMO） |
| `ansvisor/ansvisor` | 165 | 129 | +36 | 95 | 2026-10-26 | MIT | TypeScript | agentic AI 搜索执行平台 |
| `akii-technologies-ltd/akii-seo-ai-search-optimizer` | 77 | 76 | +1 | 6 | 2026-10-15 | MIT | Markdown | Claude Code 插件 |
| `RankSpotAI/awesome-geo-tools` | 46 | 79 | **−33** | 19 | 2026-09-06 | CC0-1.0 | Python | 清单（**star 下降，疑似仓库重建，未验证**） |
| ~~`usenotra/notra`~~ | — | 257 | — | — | — | AGPL-3.0 | TypeScript | **抓取失败：404，仓库已不可访问** |

### 结论 A：19 天内赛道发生了三件事

1. **头部位次洗牌**：10-08 的头部 `open-seo-mcp-skills`（4528★）还在，且**19 天涨了 2888★**（+64%），
   说明这个赛道的头部项目仍在**高速吸星**，不是存量市场。
2. **冒出两个 10-08 不存在的新头部**：`claude-seo` 21912★、`niubigeo` 8747★。
   后者**只建仓 54 天**（created 2026-09-03）就到 8747★ —— 这是本次调研最重要的单一发现，见第五节。
3. **"自托管免费 + 云付费"已经成为这个赛道的标准商业结构**：elmo、niubigeo、limelit、oneglanse 清一色如此。
   我们 $9/mo 的纯订阅是这个赛道里**唯一没有免费层的形态**。

---

## 二、开源项目事实表 —— B. 爬虫 / 审计类（可复用工具层）

| 项目 | star(10-27) | star(10-08) | fork | 最近推送 | License | 语言 |
|---|---:|---:|---:|---|---|---|
| `PhialsBasement/LibreCrawl` | 1076 | 1011 | 218 | 2026-09-29 | MIT | Python |
| `StJudeWasHere/seonaut` | 839 | 804 | 143 | 2026-10-08 | MIT | Go |
| `crawlseo/crawlseo` | 653 | 623 | 94 | 2026-10-26 | MIT | TypeScript |
| `beb7/gflare-tk` | 198 | 198 | 21 | **2023-07-07** | **GPL-3.0** ⚠️ | Python |
| `spronta/crawlie` | 115 | 112 | 16 | 2026-07-18 | **Other** ⚠️ | Rust |
| `lokoe-mehdi/scouter` | 77 | 73 | 9 | 2026-10-21 | MIT | PHP |
| `puneetindersingh/open-seo-crawler` | 72 | 58 | 23 | 2026-10-23 | MIT | Python |
| `adityaarsharma/sitewalk` | 44 | 42 | 7 | 2026-10-26 | MIT | Python |

---

## 三、开源项目事实表 —— C. llms.txt 生态

| 项目 | star | fork | 最近推送 | License | 说明 |
|---|---:|---:|---|---|---|
| `AnswerDotAI/llms-txt` | 2669 | 173 | 2026-09-24 | **Apache-2.0** | **官方规范仓**，homepage = llmstxt.org；**116 个 open issues** |
| `thedaviddias/llms-txt-hub` | 919 | 983 | 2026-10-26 | 未取 | llms.txt 目录站 |
| `firecrawl/llmstxt-generator` | 540 | 70 | **2025-06-17** | 未取 | **停更 16 个月，不要用** |
| `firecrawl/create-llmstxt-py` | 327 | 64 | **2025-06-02** | 未取 | **停更，不要用** |
| `nuxt-content/nuxt-llms` | 171 | 9 | 2026-10-26 | 未取 | Nuxt 官方生态插件，活跃 |
| `rachfop/docusaurus-plugin-llms` | 146 | 24 | 2026-10-03 | 未取 | Docusaurus 插件 |
| `pawamoy/mkdocs-llmstxt` | 132 | 15 | 2026-10-23 | 未取 | MkDocs 插件，活跃 |
| `apify/actor-llmstxt-generator` | 34 | 8 | 2026-09-28 | 未取 | Apify actor |

**判断**：llms.txt 生态**没有权威校验器**，规范仓本身 1 个月未推送、116 issues 未清 —— 规范停滞。
这对我们是**机会**：做一个 "llms.txt 生成 + 校验" 的工具页，市面上没有强竞品，且生成逻辑可直接从
`nuxt-llms` / `mkdocs-llmstxt` 这类活跃插件里抄思路。

---

## 四、开源项目事实表 —— D. 通用抓取层（补"真实查询证据"的关键）

抓取时间 2026-10-27 01:12 CST

| 项目 | star | fork | 最近推送 | License | 当前定价（官网直抓） |
|---|---:|---:|---|---|---|
| `firecrawl/firecrawl` | **195593** | 10321 | 2026-10-26 | **AGPL-3.0** ⚠️ | Free 1,000 credits/月；Hobby **$19/mo**（年付 $16）5,000；Standard **$99/mo**（年付 $83）100,000；Growth **$399/mo**（$333）500,000；Scale **$749/mo**（$599）1,000,000。官网同页出现 "$75M Series B" |
| `unclecode/crawl4ai` | **86309** | 8977 | 2026-10-26 | **Apache-2.0** ✅ | Cloud：Free **1,000 credits/月**、10 RPM、2 并发；Starter **$10/mo**（年付 $100）10,000 credits、120 RPM |
| `jina-ai/reader` | 12195 | 895 | **2026-05-22** | Apache-2.0 | Reader API **免费**；新 API key 赠 **10M tokens**；有 RPM/TPM 限速（免费 key 页面显示 5000 RPM / 7.9s 平均延迟档位） |
| `modelcontextprotocol/servers` | 91588 | 11869 | 2026-10-25 | Other | MCP 官方 servers 合集（生态参照） |

**License 结论（这是本节最重要的一行）**：
- **Crawl4AI = Apache-2.0**：可以自托管、可以改源码、可以**嵌入我们闭源产品**而不触发开源义务。✅
- **Firecrawl = AGPL-3.0**：调用其**托管 HTTP API 不构成衍生作品**（我们只是客户端，可以这么做）；
  但**严禁**把 Firecrawl 的源码复制、改造、或作为服务分发进我们的产品 —— 一旦我们"把改过的 Firecrawl
  代码跑在自己的服务器上对外提供服务"，AGPL 第 13 条会要求我们**公开我们整个产品的源码**。⚠️
  ⇒ 若要做闭源商业层，**抓取层必须选 Crawl4AI，或用 Firecrawl 的 API 做进程隔离，绝对不能 vendor 它的代码。**

---

## 五、GeoScore 自身开源侧体检

抓取时间 2026-10-27 01:15 CST · 仓库 `qq136692547-cmyk/geo-score`

| 指标 | 数值（10-27） | 数值（10-08） | 判读 |
|---|---:|---:|---|
| stars | **1** | 1 | **19 天 0 增长** |
| forks | **0** | 0 | 无人二次分发 |
| network_count | **0** | — | 无 fork 网络 |
| subscribers / watchers | **0** | — | 无人订阅关注 |
| open issues | **0** | — | 无人提问 |
| commits | **187** | — | 提交量不小（说明投入是真的） |
| 最近推送 | 2026-10-23T05:46:12Z | 2026-10-07 | 活跃 |
| 创建时间 | 2026-07-16 | 2026-07-16 | 已开源 **103 天** |
| License | MIT | MIT | 无传染性风险 |
| homepage | https://geoscore.help/ | — | — |
| repo size | 15,067 KB | — | — |

### 追加核查（本次新增，10-08 版没有的）

1. **npm 发布状态 —— 关键发现**
   - `https://registry.npmjs.org/geo-score` → **404**
   - `https://registry.npmjs.org/geoscore` → **404**
   - `https://api.npmjs.org/downloads/point/last-month/geo-score` → `{"error":"package geo-score not found"}`
   - ⇒ **我们的 npm 包从未发布**。`package.json` 里声明的 `bin`（`geoscore` CLI + `geoscore-mcp` MCP server）
     对外部用户**等于不存在**：别人想用只能 `git clone`。
   - ⇒ 换句话说：**我们开源了源码，但没有开源任何可用的分发通道。**

2. **外部引用核查**
   - 三份 GEO awesome 清单的 README 全文 grep `geoscore`：
     `luka2chat/awesome-geo` 0 命中、`DavidHuji/Awesome-GEO` 0 命中、`RankSpotAI/awesome-geo-tools` 0 命中。
   - Hacker News 全文检索（Algolia API）：**没有我们自己的条目**。

3. **开源出去的东西到底有多厚（本次新增，决定"开源会不会吃掉付费版"）**
   - `bin/geoscore-mcp.mjs` 实测只暴露 **2 个 tool**：`audit_url`、`generate_fixes`（后者生成 llms.txt / robots.txt / JSON-LD）。
   - `bin/geoscore.mjs` 仅 **73 字节**（薄封装）。
   - ⇒ 我们开源出去的 MCP 面只是一个"审计 + 生成修复文件"的薄层，**没有**监测、没有历史趋势、没有竞品对照。
     这对战略 B 是**好消息**：开源层与付费层的边界天然清晰，开源不会吃掉付费。
   - ⚠️ 但同时暴露一个倒挂（由 site-health-auditor 在 10 号报告中提出，此处从 OSS 侧确认）：
     **免费层（CLI/MCP）比 Pro 档更开放**——Pro 档 `pro.js` 无 API key 体系，
     而自托管 CLI/MCP 用户反而可以自己换 LLM 端点（`LLM_URL` + `env.TOKENRHYTHM_API_KEY`）。
     ⇒ 付费档比免费档能力少，这在商业上是**反直觉的结构性缺陷**，不是开源策略问题，但会让 B 的付费层卖不动。
   - ⚠️ 口径不一致：MCP tool 描述写 **"11 dimension breakdowns"**，而我们对外称 **14 维**。
     **未验证**哪个是当前的，建议 team-lead 确认后统一。

3b. **撞名风险（需 team-lead 确认）**
   - HN 上有一条 2026-04-04 的 story：`"GEOscore – Check if AI assistants can find and cite your website"`，
     指向 `https://geoscore-tawny.vercel.app`（2 points，1 comment）。
   - 该站实测在线：**法语站（🇫🇷 FR），自述 18 项检查，免费免注册，© 2026 GEOscore**。
   - 我们的仓库 2026-07-16 才创建、主域是 geoscore.help、我们对外称 14 维 ——
     判定为**第三方同名产品**，但同一名字在市场上已有先占者。**未验证**是否与我们有任何关联。

### ★ 明确回答"开源到目前为止有没有带来任何可测量的收益"

> **没有。可测量的收益为 0，且是可量化的 0，不是"很少"。**
>
> - 流量侧：0 fork、0 watcher、0 issue、0 引用、0 npm 下载（包都没发）
> - 增长侧：103 天，1 star，且最近 19 天 0 增长
> - 成本侧：源码已公开（MIT），任何人可以 clone 走自己部署一套，我们**承担了开源的全部成本，拿到了开源的全部风险，没拿到开源的任何收益**
>
> 但**不要过度解读**（与 10-08 版同样保留这个克制）：
> 我们从未做过任何开源推广动作（无 HN / Product Hunt / Reddit 投放记录，连 npm 都没发），
> 所以 1★ 证明的是"**这个形态没有自然增长**"，**不能**证明"这个产品没人要"。
> 对照 `niubigeo` 建仓 54 天 8747★，差距不全是产品力，有一大块是**分发动作**的差距。

### 五之二、对外信息一致性：三处失真并列（不要孤立看待）

三条由三位分析师在同期独立发现，**并列看才是问题**——单看任何一条都像笔误，三条同时出现说明
对外信息没有单一事实来源。

| # | 对外口径（失真） | 代码/实测事实 | 发现者 |
|---|---|---|---|
| 1 | 对外称 **14 维** | 代码事实为 **11 维**：13 个分析器合计 99 个检查项 = 11 个维度内 85 项 + 负面信号 8 项 + 提示词注入 6 项。MCP tool 描述亦写 "11 dimension breakdowns" | oss-analyst（本报告）+ site-health-auditor 实测 |
| 2 | 定价页 FAQ 写 GeoReady **$9-89** | 实际档位 **$0 / $19 / $89** | competitor-analyst |
| 3 | privacy 页写「**GitHub Pages** 托管」 | 实为 **Cloudflare Pages** | competitor-analyst |

⇒ **这不是三个 bug，是一个问题：对外文案与代码/事实之间没有校验环节。**
建议与 P0-2 合并处理（合计 0.5 人日），并建立"对外数字必须能指回代码或一手页面"的硬规则。

---

## 六、可复用清单（能直接集成什么、省多少工、License 风险）

| 优先级 | 用途 | 项目 | star / License | 能省什么工 | License 风险判定 |
|---|---|---|---|---|---|
| **1** | **真实抓取（补我们最大短板）** | `unclecode/crawl4ai` | 86309 / **Apache-2.0** | 真实渲染抓取 + Markdown 抽取，自研约 3–5 人周；云版 $10/mo 起直接可用 | ✅ **无风险**。可自托管、可改源码、可嵌入闭源产品 |
| 2 | 真实抓取（备选/更高层能力） | `firecrawl/firecrawl` | 195593 / **AGPL-3.0** | 同上，另有 search / extract 等高级端点 | ⚠️ **仅可当 API 客户端调用**；严禁 vendor / 改造源码，否则触发 AGPL §13 要求公开我方全部源码 |
| 3 | GSC + 爬虫 + CWV 合一面板 | `crawlseo/crawlseo` | 653 / MIT | 我们**已有 GSC service account 通道**，可直接照它的架构做"GSC 数据 + 自建爬虫"合并视图 | ✅ 无风险 |
| 4 | 自检我们自己的站 | `PhialsBasement/LibreCrawl` | 1076 / MIT | 桌面爬虫，**官方点名支持 Astro**，我们的站正是 Astro | ✅ 无风险 |
| 5 | llms.txt 生成器（做新工具页） | `nuxt-llms` / `mkdocs-llmstxt` / `docusaurus-plugin-llms` | 171 / 132 / 146，均活跃 | 生成逻辑可直接参照，做"llms.txt 生成 + 校验"页约 1 人周 | ✅ 无风险（均宽松协议，仍建议逐个复核） |
| 6 | 方法论背书 | `cxcscmu/AutoGEO`（ICLR'26） | 232 / MIT | 给方法论页提供学术引用 | ✅ 无风险（但仓库 2026-06-14 后未更新） |
| ✗ | 不要用 | `firecrawl/llmstxt-generator`、`firecrawl/create-llmstxt-py` | 540 / 327 | — | **停更 16 个月 / 17 个月** |
| ✗ | 不要用 | `beb7/gflare-tk`（GPL-3.0，2023 停更）、`spronta/crawlie`（License 不明） | 198 / 115 | — | **GPL-3.0 传染性；License 不明不可商用** |

**省工量级粗估**：真实抓取层（最大短板）自研 3–5 人周，用 Crawl4AI 集成约 **2–4 人日**，
省下的工约 **80%**；llms.txt 工具页从零设计约 1 人周，参照现成实现约 1–2 人日。

---

## 七、数据集线索（补"真实查询证据"）

1. **公开的 (prompt, engine, citation) 基准数据集：不存在。**
   本次用 GitHub 搜索 `ai search visibility benchmark` 等查询实查，返回结果全部是 ≤2 star 的个人仓：
   `tmolavi/answerpath-geo`（1★）、`jinyuanbao/deeplumen-ai-search-visibility-benchmarks`（0★）、
   `supersky0820/ai-visibility-benchmark`（0★）、`iamfarzad/ai-visibility`（0★）。
   ⇒ **这不是我们独有的短板，是全赛道级空白。**
2. **学术侧**：`cxcscmu/AutoGEO`（ICLR'26，MIT，232★）有方法论但**未附带可复用的可见度数据集**，且 2026-06-14 后未更新。
3. **llms.txt 侧**：只有目录站（`llms-txt-hub` 919★）和生成器，**没有"哪些站真被 AI 引用了"的事实数据**。
4. **唯一现成的"真实查询证据"供应链，是被人拿去卖钱的那个**：
   **NiubiGEO（8747★, Apache-2.0）官网明码标价 —— `¥5 / 人 / 问题` 的"真人 AI 测试"（可选 AI 平台 / 国家地区 / 语言 /
   重复次数 / 网页或 App，实时计价）**，以及 `¥99 / 份` 的 GEO 诊断报告（最多 3 问题 × 最多 3 模型，保留原始回答、来源、竞品对照）。
   官网原文把"开源技术"单列为一栏："自托管测试，保留原始证据"。
   ⇒ 这条既能**采购**（直接买真人采样数据），也能**照抄**（我们自己搭同样的真人众包层）。
5. **自建路径**：Crawl4AI（自托管免费 / 云 $10/mo 起）+ 各引擎 API 自行采样，成本可控且数据归自己；
   但"真实用户视角的引擎回答"仍需要真人客户端，自动化抓不到（这也是 niubigeo 敢卖 ¥5/人/问题的原因）。

---

## 八、MCP / Agent 友好度检测（重点方向核查结果）

- **没有找到成熟的"agent 友好性测评"开源工具**。
  搜索命中的 `AppGram/agentnotch`（220★）实为 macOS 菜单栏 App，与网页 agent 友好度无关；
  `perplexityai/numbat`（1146★）是"端点上 AI agent 活动的可见性"，是**端侧监控**，不是**网页对 agent 的友好度评分**。
- `modelcontextprotocol/servers`（91588★）只是 MCP server 合集，无评分能力。
- ⇒ **"网站对 AI agent 的友好度测评"在开源侧是空白区**。这块我们可以做，且与我们现有的静态检查器能力高度重合
  （我们已经在查 robots / llms.txt / schema，只差一个"agent 视角"的评分框架与证据）。

---

## 九、开源战略建议：**选 B —— 开源核心 + 闭源高价值层（数据 / 监测）**

### 为什么不是 A（继续现状式开源）

A 已经被数据证伪，而且证伪得很彻底：
- 103 天 1 star，最近 19 天 **0 增长**；0 fork / 0 watcher / 0 issue / 0 引用
- npm 包没发 → 我们连"可被使用的开源"都算不上，只是"可被 clone 的源码"
- 现状的 A 不是一种战略，是一种**疏忽**：承担了源码公开的全部成本，拿到了全部风险，收益为 0

### 为什么不是 C（放弃开源专注产品）

- 放弃开源**不解决我们的真实短板**。短板是"没有真实查询证据"（第七节：全赛道都没数据），
  这是**数据层问题**，闭源与否不改变这一点
- 境外独立站最缺的是**信任背书**，MIT + 可自托管正是唯一低成本的信任来源
- 我们会同时丢掉 MCP server 这个生态位 —— 而 MCP 恰是这个赛道头部项目（`open-seo-mcp-skills` 7416★、
  `modelcontextprotocol/servers` 91588★）的主战场

### 为什么是 B（最强的一条证据）

**赛道里跑得最快的两个项目，都在执行 B，而且写在了脸上：**

| 项目 | 开源侧 | 商业侧（官网直抓） |
|---|---|---|
| `niubigeo`（建仓 54 天，8747★, Apache-2.0） | 自托管测试，保留原始证据 | ¥99/份 GEO 诊断报告；¥5/人/问题 真人 AI 测试；网站发布按站点计价；自定义真人任务按预算 |
| `elmohq/elmo`（493★, MIT） | "free and open source to self-host, forever… no license fee and no per-seat" | Cloud **$29/mo 起**（另有 White-Label） |

⇒ "开源核心免费自托管 + 托管/数据/真人证据付费" 是这个赛道**已被验证的主流打法**，不是我们的发明。

### B 的落地（三条，按优先级）

1. **分层**
   - 开源保留（MIT 不变）：14 维静态审计引擎、CLI、MCP server
   - 闭源 / 付费：① 真实查询采样与证据存证 ② 历史趋势与监测 ③ 竞品对照面板
   - 这三层恰好是 elmo（$29/mo Cloud）和 niubigeo（¥99 报告 / ¥5 真人测试）在卖的东西
2. **先把分发通道补上，否则 B 不成立**（成本约 0.5 人日，但价值最大）
   - 发布 npm 包 `geo-score`，让 `geoscore` / `geoscore-mcp` 两个 bin 真正可用
   - README 照 elmo 的话术改成双轨："self-host free forever / hosted from $X"
3. **License 红线**
   - 闭源部分**只能**用 Apache-2.0 / MIT 依赖 ⇒ 抓取层选 **Crawl4AI（Apache-2.0）**
   - **Firecrawl（AGPL-3.0）只能当 HTTP API 客户端调用**，不得 vendor / 改造源码进我们的产品，
     否则 AGPL §13 会要求公开我方全部源码
   - `spronta/crawlie`（License = Other）、`amplifying-ai/awesome-…`（无 License）、
     `irinabuht12-oss/marketing-skills`（无 License）**一律不得引入代码**，只能当参考资料

### B 的成本侧补充（与 site-health-auditor 交叉验证后修正）

site-health-auditor 提供了 elmo 的判定层单位成本 **$0.15–0.35 / 1,000 answers**。
我已回到 elmo README 原文核实，**该数字属实，但口径比看上去窄**，引用时必须带限定：

- 原文（README 第 123 行）：这个价格属于 **Jev**——只做「提及判定 + 情感判定」的那一层，
  "about $2–4 a month for 25 prompts on 3 platforms, or $11–26 for 100 prompts on 5"。
- **不含**：① 抓取真实消费界面所需的 scraper/代理成本 ② 带 web search 的模型检索成本 ③ 反爬与失败重试。
- README 第 123 行同时要求"You'll need API keys for **at least one AI provider or scraper**"——
  ⇒ **检索侧成本 elmo 自己也没公开**，我们也没有实测值。

**结论**：做"自托管 vs Cloud"对比时，**不能只用 $0.15–0.35/1k 去乘**。正确做法是把它当作**成本下限**，
真实开销未知（标 **未验证**）。这也意味着：我们若自建真调引擎，**最大的不确定成本是检索与反爬，不是判定**。

elmo README 同时确认的两个事实（可作为我们做 B 的直接参照）：
- 引擎覆盖：ChatGPT、Google AI Mode、Google AI Overviews、Gemini、Perplexity、Copilot、Claude、Grok、Mistral 等
- 自托管档（MIT，Docker Compose）为 **"unlimited prompts, every supported engine and provider — Free"**；
  Cloud 从 **$29/mo** 起 ⇒ 又一次印证：**开源免费层给到"无限"，付费卖的是托管与省心，不是能力**。

---

## 十、「自建 vs 集成」成本估算（真调引擎 + 证据存证）

> 本节为 team-lead 派发的 P0 追加任务。抓取时间同上（2026-10-27 01:30–01:50 CST）。
> **方法论提醒（延续上一轮的更正）**：两条技术路线必须分开估，不能混为一个数。

### 10.0 先说结论

| | 路线 A：真实 web 界面自动化 | 路线 B：LLM API + web search |
|---|---|---|
| 前置固定投入 | **16–25 人日** | **7–12 人日** |
| 单用户月边际成本（600 samples） | **≈ $0.9**（计算）+ 引擎订阅/代理固定 $80–280/月 | **≈ $4.8–7.8**（中位 $6.0） |
| 边际成本形态 | 趋零，**可摊** | **线性，永不摊掉** |
| 持续维护 | **0.5–1 人日/月**（引擎 UI 会变） | 0.2 人日/月 |
| 证据强度 | **真实消费界面 = 硬证据** | 真实检索，**但不是那个引擎的排序逻辑** |
| 盈亏平衡规模 | **需 ≈ 72–150 个持续付费用户**才划算 | 任意规模都成立 |

⇒ **以我们目前的量级，只能选路线 B。** 路线 A 的"边际成本趋零"是在 72+ 付费用户之后才兑现的优势，
在那之前它只是多花 4–18 人日换来的坏账。
⇒ 但路线 B **不产出真实引擎证据**。真正的硬证据层应按 niubigeo 已验证的模式走**真人采样**
（¥5/人/问题），那是服务不是软件，正好落在战略 B 的付费层里。

### 10.1 工作量模型（假设值，非实测）

- 1 **sample** = 1 prompt × 1 引擎 × 1 次
- Pro 档默认：**5 prompts × 4 引擎 × 1 次/天 × 30 天 = 600 samples/用户/月**
- 敏感性分析另给 200 / 2,000 两档

### 10.2 路线 B：LLM API + web search —— 边际成本（全部为实测价）

| 项 | 单价 | 来源（2026-10-27 直抓） |
|---|---|---|
| Perplexity `web_search`（standard） | **$0.0025/次** = $2.50/1k | docs.perplexity.ai/guides/pricing |
| Perplexity `web_search`（Fast） | $0.001/次 = $1.00/1k | 同上 |
| Perplexity Search API | $5.00/1k requests（Fast $1.00/1k） | 同上 |
| **Perplexity 官方示例单请求总成本** | **$0.0059**（input $0.001 + output $0.0024 + web_search $0.0025） | 同上，文档内 worked example |
| OpenAI web search（全模型） | **$10.00/1k calls** + search content tokens 按模型价 | platform.openai.com/docs/pricing |
| OpenAI web search preview（非推理模型） | $25.00/1k calls | 同上 |

**Per-sample 估算**

| 走法 | $/sample | 依据 |
|---|---:|---|
| 全走 Perplexity | 0.0059 | 官方 worked example |
| 走 OpenAI | 0.011–0.013 | $0.010 工具费 + 检索 token（无固定值，估 $0.001–0.003） |
| **4 引擎混合** | **0.008–0.013，中位 0.010** | 上两者加权；Claude/Gemini 的 web search 工具费**未取得**，按 OpenAI 同档估 |

> ⚠️ **未验证**：Anthropic / Google 的 web search 工具费本次没有抓，用的是 OpenAI 同档假设。
> 若实际更高，路线 B 的边际成本会等比上移，**只会让结论更偏向"我们现在别选 A"**，不改变方向。

**月度边际成本（线性）**：200 samples → $2.0｜600 → **$6.0**｜2,000 → $20.0

### 10.3 路线 A：真实 web 界面自动化 —— 边际成本（实测价）

| 项 | 价 | 来源（2026-10-27 直抓） |
|---|---|---|
| **Cloudflare Browser Rendering**（我们已在 CF 上） | Free **10 浏览器小时/月**，超出 **$0.09/小时**；**10 浏览器**（月均），超出 **$2.00/浏览器** | developers.cloudflare.com/browser-rendering/platform/pricing |
| Browserbase（第三方参照） | Free 1 hr；Developer **$20/mo**（100 hrs，超出 $0.12/hr；含 1GB 代理，超出 $12/GB）；Startup **$99/mo**（500 hrs，$0.10/hr；5GB 代理，超出 $10/GB） | browserbase.com/pricing |

**单次 sample 浏览器时长假设 = 60s**（加载界面 + 输入 prompt + 等完整回答 + 提取 citations）。
⚠️ **假设值，未实测**；若实际 180s 则下方计算成本 ×3（结论方向不变，见 10.5 敏感性）。

- 60s = 0.0167 browser-hour × $0.09 = **$0.0015/sample**
- 600 samples = 10 浏览器小时 → **$0.90/用户/月**（且首 10 小时免费 ⇒ 第 1 个用户完全在免费额度内）
- 2,000 samples → 33.3 hrs → 超出 23.3 hrs × $0.09 = **$2.10**

**但路线 A 有路线 B 没有的固定成本（这是关键，别漏）**
- **引擎账号**：真实消费界面要登录态，4 个引擎付费订阅 ≈ 4 × $20/mo = **$80/mo**（假设值；免费档限速严重，生产不可用）
- **住宅代理**（反爬/风控/封号）：Browserbase 报价 **$10–12/GB**；若走 Cloudflare 出口 IP 是否会被引擎风控 —— **未验证**
- **持续维护 0.5–1 人日/月**：引擎 UI 一变脚本就失效，这是路线 A 最大的隐性成本

### 10.4 固定投入（人日）

**路线 A（真实 web 界面自动化）— 合计 16–25 人日**
- 单引擎界面适配（登录 / 输入 / 等待 / 提取 citations / 失败重试）：2–3 人日 × 4 引擎 = **8–12**
- 反爬与稳定性（验证码、风控、会话保活、代理轮换）：**3–5**
- 证据存证层（截图 + 原文 + 时间戳 + 哈希 + 可回放）：**3–5**
- 调度与配额：**2–3**

**路线 B（LLM API + web search）— 合计 7–12 人日**
- 4 个 provider 适配：**3–5**
- citations 解析（多数 API 直接返回结构化 citations）：**1–2**
- 证据存证层：**2–3**（比 A 简单，API 已返回结构化数据）
- 调度与配额：**1–2**

### 10.5 盈亏平衡规模

**换算假设**：1 人日 = **$400**（境外自由职业者中位；若为我们自己投入按机会成本计）。
⚠️ **这是假设值不是实测值**，若按 $200/人日 计，下方门槛减半。

- 额外前置固定投入 = (16~25) − (7~12) = **4~18 人日，取中位 11 人日 = $4,400**
- 边际节省/用户·月（600 samples）= $6.00 − $0.90 = **$5.10**
- 月度额外固定成本差 =（维护 0.5 人日 $200 + 引擎订阅 $80）−（B 的维护 0.2 人日 $80）= **$200/月**

| 门槛 | 计算 | 结果 |
|---|---|---|
| **运营成本交叉点** | N × $5.10 ≥ $200 | **N ≥ 39 个付费用户** |
| **12 个月回本** | N × 12 × $5.10 ≥ $4,400 | **N ≥ 72 个持续付费用户** |
| **6 个月回本** | N × 6 × $5.10 ≥ $4,400 | **N ≥ 144 个付费用户** |
| 敏感性：若单次 180s | 边际节省降至 $3.30/用户·月 | 12 个月回本需 **N ≥ 111** |

⇒ **盈亏平衡规模 ≈ 72–150 个持续付费用户。**

⚠️ **我们当前实际付费用户数：未验证，我没有数据。** 请 monetization-analyst 或 team-lead 提供。
以已知旁证看（GitHub 1 star、流量比竞品低 135–170 倍），**距离 72 个付费用户有数量级差距**。
⇒ 结论：**路线 A 现在做是坏账。**

### 10.6 一个容易被漏掉的点：路线 B 相对"现状"仍是巨大升级

现状 `worker/visibility.js:19-35` 是 **deepseek + 4 个人格 prompt 扮演 4 个引擎，零检索**（代码注释自认：
"this is a simulation … NOT a measurement of real AI engine traffic"）。

| 层级 | 检索真实性 | 成本 |
|---|---|---|
| 现状 | **零**（纯模拟） | 极低 |
| **路线 B** | **真实检索**（真 web search），但非目标引擎排序逻辑 | $6/用户·月 |
| 路线 A | 真实消费界面 | $0.9 + 高固定 |
| 真人采样（niubigeo 模式） | 真实用户真实界面 | ¥5/人/问题，转售 |

⇒ **路线 B 是"从零检索到真检索"的最小可行升级，是三档里唯一既不改变我们成本结构、又能把
"simulation"这顶帽子摘掉的选项。**

### 10.7 ⚠️ 服务对象限定（S1 约束，必须带上）

| 能力 | 境内用户 | 境外用户 / 境外中文用户 |
|---|---|---|
| 静态审计（现状 11 维） | ✅ 可用（本地 CLI/MCP 可跑；云端 workers.dev 已 DNS 污染需绕行） | ✅ 可用 |
| **路线 A / B 真调引擎** | ❌ **结构性做不到**：ChatGPT/Perplexity/Gemini/Claude 境内不可直连，且承载后端 `workers.dev` 境内 DNS 已污染（实测解析到 `69.63.178.13` 等错误 IP，直连 21s 超时） | ✅ 可用 |
| Crawl4AI 抓取（见 10.8） | ✅ 可用 | ✅ 可用 |

⇒ **真调引擎的服务对象只有境外用户，不要给出"做了大家都能用"的隐含结论。**
⇒ 注意区分：Crawl4AI 抓的是**客户自己的目标站**，不是 AI 引擎 ⇒ **不受 S1 约束**，境内也能用。

---

## 十一、Crawl4AI 集成路径与成本

### 11.1 License 合规确认 —— 通过 ✅

已拉取 LICENSE 全文（`raw.githubusercontent.com/unclecode/crawl4ai/main/LICENSE`，9,998 字节）核对：
- 为 **Apache License 2.0 逐字原文**
- grep `commercial|enterprise|restrict|non-compete|additional` 命中项**全部是 Apache-2.0 标准条款**
  （§3 专利授权、§4 归属声明、§8 责任限制、§9 附加担保），**无任何自定义限制、无非商用条款、无"不得用于竞品"条款**

⇒ **确认：Apache-2.0 允许我们闭源商用，无 copyleft 传染。**
唯一义务：若我们**分发**其衍生作品需保留版权/专利/商标声明（§4）；
而我们只是调用/链接、不分发 Crawl4AI 本体 ⇒ 义务更少。**可放心用于闭源付费层。**
（对照：Firecrawl 为 AGPL-3.0，**排除**，只能当 HTTP API 客户端。）

### 11.2 ⚠️ 关键前提：技术栈冲突（决定集成形态）

- **Crawl4AI = Python**，需要真实浏览器（Playwright/Chromium）
- 我们的栈 = Astro 静态站 + **Cloudflare Workers（JS）** + Node CLI/MCP
- ⇒ **Cloudflare Workers 无法运行 Python/浏览器**

| 路径 | 能否自托管 Crawl4AI（免费） | 能否用 |
|---|---|---|
| **CLI / MCP**（`src/lib/node-scanner.js` → `node-fetcher.js`） | ✅ 能（本地起服务，Node 侧调用） | ✅ |
| **托管产品**（`worker/*`，Cloudflare Workers） | ❌ 不能 | 只能调 **Crawl4AI Cloud HTTP API** |

⇒ **自托管的"免费"只在开源侧（CLI/MCP）成立；托管产品侧必须走 Crawl4AI Cloud（$10/mo 起）。**

### 11.3 具体集成点（不是替换整个 fetcher）

抓取编排在 `src/lib/node-scanner.js:28-59`（Node/CLI）与 `src/lib/scanner.js`（浏览器），共 9 个资源：

| 资源 | 行 | 是否需 JS 渲染 | Crawl4AI 增益 |
|---|---|---|---|
| 首页 HTML（+ 响应头） | :31 `fetchPageWithHeaders` | ✅ **需要** | ✅ 有 |
| /about | :48 | ✅ **需要** | ✅ 有 |
| 内容页（`/about` 或抽取页） | :56 | ✅ **需要** | ✅ 有 |
| robots.txt | :29 | ❌ 静态文本 | ✗ 无 |
| llms.txt | :30 | ❌ 静态文本 | ✗ 无 |
| sitemap.xml | :54 | ❌ 静态 XML | ✗ 无 |
| `.well-known/ai.txt` | :51 | ❌ 静态文本 | ✗ 无 |
| `/ai/summary.json` | :52 | ❌ JSON | ✗ 无 |
| `/ai/faq.json` | :53 | ❌ JSON | ✗ 无 |

⇒ **9 个里只有 3 个是 HTML。正确做法是"新增一条 JS 渲染路径"只服务这 3 个，保留现有静态路径服务其余 6 个。**
替换整个 fetcher 会把 6 个静态资源的成本和延迟一起抬上去，是净损失。

### 11.4 现有 fetcher 抽象能否复用 —— 与 team-lead 的假设不同，需更正

- ⚠️ **`public/scripts/` 里没有 fetcher**：该目录实测只有 `auth.js`、`consent.js` 两个文件。
  抓取抽象实际在 `src/lib/fetcher.js`（浏览器，138 行）与 `src/lib/node-fetcher.js`（Node，97 行）。
- ⚠️ 这二者是**平行重复实现，且代理列表已经不一致**：
  - `node-fetcher.js:6-11` 用 allorigins.win ×2 + codetabs + **corsproxy.io**
  - `fetcher.js:6-23` 用自建 `geo-score-proxy.pages.dev` 打头，并注释说明 **corsproxy.io 已失效**
    （返回 401 要求 API key）
- ⇒ 集成 Crawl4AI 需要**新增第三个实现**，或把渲染做成可选后端注入；不能直接插进现有抽象。

### 11.5 顺带发现：现有抓取层的两个隐患（建议一并处理）

1. **出口 IP 是随机公共代理** ⇒ 目标站常封 ⇒ 审计失败率不可控（且无从观测）。
2. **隐私/合规：我们把客户的 URL 明文发给第三方代理**（`proxy.url + encodeURIComponent(url)`）。
   对境外客户站做审计时，等于把"谁在审计什么"泄漏给了 allorigins / codetabs 这类第三方。
   ⇒ 自托管 Crawl4AI 能同时解决这两个（自有出口、URL 不外泄），**这层价值不小于 JS 渲染本身**。

### 11.6 成本

| 项 | 成本 |
|---|---|
| 许可费 | **$0**（Apache-2.0） |
| Crawl4AI Cloud（托管产品路径） | Free 1,000 credits/月、10 RPM、2 并发；Starter **$10/mo**（年付 $100）10,000 credits、120 RPM |
| 自托管（CLI/MCP 路径） | $0 许可；需一台能跑 Chromium 的机器（1–2 vCPU / 2GB 起） |
| 集成人工 | **2–4 人日**（3 个 HTML 的渲染路径 + 失败降级回退） |
| 对比自研 JS 渲染抓取 | 15–25 人日 ⇒ **省约 80%**（与上一轮估算一致，现已定位到具体集成点） |

---

## 十二、建议的 P0 修法顺序

排序原则：**先修"商业模式是否成立"，再修"能力"**。倒挂不修，做任何能力都只会让免费档更值钱。

| 序 | 动作 | 人日 | 为什么是这个位置 |
|---|---|---:|---|
| **P0-1** | **修倒挂**：给 Pro 档 API key 体系，并把付费层价值主张从"软件功能"改成"托管 + 数据 + 证据存证" | 1–2 | 这是战略 B 能否成立的**唯一前提**。付费档能力 < 免费档能力，则任何付费层都卖不动 |
| **P0-2** | **修 3 处对外口径失真**：14 维→**11 维**、GeoReady $9-89→**$0/$19/$89**、GitHub Pages→**Cloudflare Pages** | 0.5 | 三处同时失真 = 信任问题，不是笔误；成本极低但优先级高 |
| **P0-3** | **发布 npm 包 `geo-score`** | 0.5 | 否则开源不可被使用，战略 B 的"开源核心"那一半是假的 |
| **P1** | 路线 B 真调引擎（LLM API + web search） | 7–12 | **不要现在做**。倒挂修好前做它，只会让免费档更值钱 |
| **P2** | Crawl4AI 集成（3 个 HTML 的渲染路径） | 2–4 | 能力提升，但不影响商业模式；且顺带修 11.5 的两个隐患 |
| **不做** | 路线 A（真实 web 界面自动化） | 16–25 | 需 72–150 个付费用户才回本，我们差数量级 |
| **不做** | 引入 Firecrawl 源码 | — | AGPL-3.0，只能当 HTTP API 客户端 |

> P0-1 到 P0-3 合计 **2–3 人日**，是本轮所有结论里**投入产出比最高**的一段。

---

## 十三、数据源与抓取失败记录

**数据源**
- 代理探测：`curl -x http://127.0.0.1:<port> https://api.github.com/` → **7897 返回 200**；
  10809 / 10808 / 7890 / 10807 均返回 **000**（不通）。本次全程使用 7897。
- 仓库事实：`https://api.github.com/repos/<owner>/<repo>`，未认证，字段直取
  `stargazers_count` / `forks_count` / `open_issues_count` / `pushed_at` / `created_at` / `license.key` / `archived`
- 发现新项目：`https://api.github.com/search/repositories?q=…&sort=stars&order=desc`
- topic 计数（同日直查）：`answer-engine-optimization` **456**、`generative-engine-optimization` **1173**、
  `llm-visibility` **31**、`llmstxt` **99**（对比 10-08：AEO 429 / geo-optimization 36 / ai-visibility-tracking 27）
- 定价：官网 HTML 直抓（firecrawl.dev/pricing、crawl4ai.com、jina.ai/reader、niubigeo.ai/pricing、elmohq.com/pricing）
- npm：`registry.npmjs.org` + `api.npmjs.org/downloads/point/*`
- 外部引用：HN Algolia API `https://hn.algolia.com/api/v1/search?query=geoscore&tags=story`；
  三份 awesome 清单 raw README 全文 grep

**抓取失败 / 未验证记录**

| 项 | 结果 | 说明 |
|---|---|---|
| `usenotra/notra` | **抓取失败（404）** | 10-08 时为 257★ / AGPL-3.0，本次 `api.github.com/repos/usenotra/notra` 返回 404，仓库已不存在或改名/转私。**原因未验证，star 数不填** |
| `amplifying-ai/awesome-generative-engine-optimization` README | **抓取失败（404）** | raw 链接 `main` 分支 404，改用其余 3 份 awesome 清单替代 |
| 部分项目的精确 License | 未取 | `llms-txt-hub`、`nuxt-llms`、`mkdocs-llmstxt`、`docusaurus-plugin-llms`、`llmstxt-generator` 的 license 未在本次逐个确认（API 返回体本次未打印该字段的均已跳过）。**引入代码前必须逐个复核** |
| GeoScore 仓库 traffic / 克隆数 | **拿不到** | GitHub traffic API 需认证，未认证无法获取 |
| `niubigeo` 的增长曲线 | 未验证 | 只有两个点：created 2026-09-03 与本次 8747★，无中间采样 |
| `RankSpotAI/awesome-geo-tools` star 79 → 46 | 未验证 | star 下降反常，疑似仓库重建，本次未追查 |
| HN 上 `geoscore-tawny.vercel.app` 与我们是否同作者 | 未验证 | HN 条目 2026-04-04，我们仓库 2026-07-16 才创建，本站为法语站 18 项检查。判定为第三方同名产品，**请 team-lead 确认** |
| GitHub API 配额 | 注意 | 未认证 60 次/小时，本次约用 45 次（含 6 次 search）。**如需追加抓取，请间隔或先告知** |
| Anthropic / Google 的 web search 工具费 | **未取得** | 路线 B 的四引擎混合单价按 OpenAI 同档（$10/1k）假设。若实际更高，路线 B 边际成本等比上移，**只会让结论更偏向"别选路线 A"**，方向不变 |
| 路线 A 单次 sample 浏览器时长 = 60s | **假设值，未实测** | 已做敏感性：若实际 180s，12 个月回本门槛从 72 升至 111 用户 |
| 1 人日 = $400 | **假设值，非实测** | 若按 $200/人日，所有盈亏平衡门槛减半（36–75 用户），**结论方向不变** |
| 路线 A 的引擎订阅费 4 × $20/月 | **假设值** | 未核实各引擎当前订阅价 |
| Cloudflare 出口 IP 是否会被引擎风控 | **未验证** | 若会，路线 A 需额外住宅代理（$10–12/GB，参照 Browserbase 报价） |
| 我们当前实际付费用户数 | **未验证，我没有数据** | 盈亏平衡结论（72–150 用户）**必须与此数对比才有意义**，请 monetization-analyst / team-lead 提供 |
| `public/scripts/` 里的 fetcher 抽象 | **不存在** | 已更正：该目录实测只有 `auth.js`、`consent.js`；抓取抽象在 `src/lib/fetcher.js` 与 `src/lib/node-fetcher.js`，且二者代理列表已不一致 |

**口径提醒**：star 数波动大（头部项目 19 天内 +2888），本文所有数字均为
**2026-10-27 01:05–01:20 CST** 的快照，引用请带时间戳。star ≠ 质量 ≠ 可运行，本次未 clone 任何仓库验证可运行性。
