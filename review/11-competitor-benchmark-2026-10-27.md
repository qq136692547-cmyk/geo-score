# 11 · 商业竞品对标分析（GEO / AI 搜索可见度赛道）

> 分析日期：**2026-10-27**（抓取时间窗口 2026-10-26T17:05Z – 17:20Z，即 CST 2026-10-27 01:05–01:20）
> 分析师：competitor-analyst
> 方法：**全部为当日联网一手抓取**（官网定价页）。二手来源已逐条标注 `【二手】`。
> 代理端口：本次探测 7897 可用（返回 202）；10809/10808/7890/10807/2080/8889 全部 000。

---

## 0. TL;DR（结论先行）

0. 🚨 **【最高优先级】我们官网 FAQ 里点名的对标物 GeoReady，比我们写的强得多，而且我们引错了它的价格。** 我们写「GeoReady $9–89/月」，实测是 **Free $0 / Pro $19 / Agency $89**（founding price，之后 **$29 / $199**）——**$9 这个档位根本不存在**。更严重的是：GeoReady **Pro $19 就给每天 3 次真实 Perplexity 查询 + API + 10 域名**，而我们 Studio $29 的竞品对比、API 全部是 "Coming Soon"。它还有 **2100+ 站点的公开基准**（我们是 324）。**详见 §5.5，这是本报告最需要立刻处理的一条。**
1. **GeoScore 目前不在赛道核心品类里。** 全赛道 16 家里，只有 GeoScore 一家在「是否真实查询 AI 引擎」这一项上是 **无**。我们卖的是「站点信号审计」，竞品卖的是「AI 引擎真实回答 + 引用数据」。
2. **$9/mo 站得住，但它对标的是「免费」，不是「$29」。** Ahrefs 随付费计划免费送 5–20 条 AI prompt；Otterly、SearchScore、Rankscale 都有免费入口。$9 的真实战场是免费层往上一点点，而免费层由 Ahrefs 这种有 509M prompt 数据库的大厂把守。
3. **赛道在被大厂吞，但同时钱在疯狂涌入。** 一手证据：Adobe 10-Q 确认 **$1.87B 收购 Semrush（2026-04-28 完成）**；Sitecore 官方新闻稿确认 **收购 Scrunch（2026-06-03）**。同期 Profound 单家融资 **$334.5M**。中间层被挤压，头部与尾部同时受益。
4. **「免费审计 + 卖修复包」已被 SearchScore 完整验证**——它是唯一一家把这做成完整价格梯队的（免费审计 → £49/£99/£199/£499 追踪 → £950/£1,500 咨询 + £750/mo 长期服务）。**但我们贱卖了：范围调整后，同类交付我们收 $49，SearchScore 收 £950（≈$1,269），差约 3–4 倍**（19–26 倍是未做 scope 折算的粗算，已由 monetization-analyst 修正，见 §4 判断 3）。**更本质的问题不是「卖多少钱」，是「卖给谁」**——我们走 Fiverr，竞品走 discovery call。
5. **能不能做行业标杆：有条件能。** 路径不是拼功能、也不是拼数据资产（都拼不过），而是把「公开基准数据集 + 开源方法论」做成被行业引用的资产——这是唯一有同行验证过的独立站路径（Otterly，完全 bootstrapped，靠内容资产而非功能进入第一梯队）。

---

## 1. 一手价格事实表

> 币种说明：Peec 与 LLMrefs 本次抓取均显示 **USD**（团队 10-23 记录为 EUR），判断为按访问地区动态切币种，已在备注标注，未做跨币种涨跌断言。
> 汇率说明：**本报告不对 £49/£99/£199/£499 做 USD 折算**。GBP 计价项在折算表里单独标注，避免引入未核验的汇率。

| # | 竞品 | 抓取 URL | 抓取时间(CST) | 档位 | 价格 | 计价单位 | 包含量 | 币种 | 备注 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Otterly.ai** | https://otterly.ai/pricing | 2026-10-27 01:05 | Lite | **$29** | /月 | 15 search prompts · 4 引擎（ChatGPT / Google AIO / Perplexity / MS Copilot）· Claude / AI Mode / Gemini 为加购 · 无限品牌与竞品 · 无限席位 · 1 workspace · 每日追踪 · 1,000 GEO URL 审计/月 · 每周 3 条建议 | USD | 与团队 10-23 记录 **一致**（$29/$189/$489） |
| 1 | Otterly.ai | 同上 | 同上 | Standard | **$189** | /月 | 100 prompts · 同上 4 引擎 · 无限 workspace · **API + MCP access** · 2,000 API 请求/月 · 2,000 MCP 请求/月 · 5,000 GEO URL 审计/月 · 200k Agent Analytics 事件/月 | USD | 加 100 prompts = **$99** |
| 1 | Otterly.ai | 同上 | 同上 | Premium | **$489** | /月 | 400 prompts · 5,000 API + 5,000 MCP 请求/月 · 10,000 GEO URL 审计/月 · 1M Agent Analytics 事件/月 | USD | |
| 1 | Otterly.ai | 同上 | 同上 | Enterprise | Custom | /月 | 从 1,000 prompts 起 · SSO · 季度 GEO 健康检查 · 专属 CSM | USD | |
| 1 | Otterly.ai（年付 tab） | 同上 | 同上 | Lite / Standard / Premium | **$25 / $160 / $422** | /月（年付，省 15%） | 同上 | USD | **新增发现**：年付档 10-23 未记录 |
| 2 | **Peec AI** | https://peec.ai/pricing | 2026-10-27 01:05 | Starter | **$95** | /月（Monthly tab） | 50 prompts · **选 3 个模型**（可选：ChatGPT / AI Mode / AI Overviews / Copilot / Gemini / Naver AI）· 无限用户 · 每日追踪 · **1 project** · 4,500 AI answers/月 · 无限竞品 | **USD** | ⚠️ 团队 10-23 记录为 **€85**；本次显示 **$95**。判断为**币种口径切换**，非确证涨价 |
| 2 | Peec AI | 同上 | 同上 | Pro | **$245** | /月 | 150 prompts · 3 模型 · **2 projects** · 13,500 answers/月 · 10 competitors · 20 sources · 750 agent credits | USD | 10-23 记录 €205 |
| 2 | Peec AI | 同上 | 同上 | Advanced | **$495** | /月 | 350 prompts · 3 模型 · **5 projects** · 31,500 answers/月 · 25 competitors · 多国家 · Looker Studio | USD | 10-23 记录 €425 |
| 2 | Peec AI | 同上 | 同上 | Enterprise | Custom | /年 | 全模型（最多 13 个 LLM）· 无限 projects · API · SSO · 自定义 prompt | USD/年 | |
| 2 | Peec AI 加购 | 同上 | 同上 | 加 1 个模型 | **$30 / $70 / $140** | /月（按档位） | 对应 Starter / Pro / Advanced | USD | 按年付，省 $60/$180/$300 |
| 3 | **LLMrefs** | https://llmrefs.com/pricing | 2026-10-27 01:05 | All in One | **$79** | /月（"Limited time only"） | **500 prompts** · 全部 11 个引擎不额外收费（ChatGPT / ChatGPT Search / AIO / AI Mode / Gemini / Perplexity / Claude / Grok / Copilot / Meta AI / DeepSeek）· 无限项目 · **无限域名** · 无限席位 · 50+ 国家 · 每周报告 · CSV 导出 + API · 7 天免费试用 | **USD** | ⚠️ 10-23 记录为 **€79**；本次为 **$79**。金额数字未变，**币种标识变了** |
| 4 | **Profound** | https://www.tryprofound.com/pricing | 2026-10-27 01:06 | Trial | **Free** | — | 50 prompts 每日跑 · 仅 7 天 · 3 引擎（ChatGPT / Gemini / Google AIO）· 1 语言 1 区域 · **History: None** · **Exports: None** · **API: None** | USD | ✅ **确认团队判断：自助付费档已撤** |
| 4 | Profound | 同上 | 同上 | Enterprise | **Custom** | 议价 | 自定义 prompt 量 · 最多 9 引擎（+Perplexity / AI Mode / Copilot / DeepSeek / Claude / Exa Search）· **History: All time** · CSV + JSON 导出 · API · SSO/SAML + SOC 2 · ChatGPT Shopping · Agent Analytics | USD | 新产品线 **AI Marketer**（credits 计费）、Profound Sheets、Context Manager |
| 5 | **SearchScore.io** | https://searchscore.io/pricing | 2026-10-27 01:06 | Free audit | **£0** | 一次性 | GEO + SEO + CRO 三科分数 · 300+ 信号 · 60 秒 · **官网明说：免费审计不查询 AI 引擎** · 留邮箱给修复清单 · 已审计 1,000,000+ 站点 | GBP | ⚠️ **与 GeoScore 架构完全一致**，见 §5 |
| 5 | SearchScore.io | 同上 | 同上 | Starter | **£49** | /月 | **10 个问题，每个问 2 次** · 6 引擎（ChatGPT / Claude / Gemini / DeepSeek / Grok / Perplexity）+ Google AIO & AI Mode · 每周扫描 · 最多 5 竞品 · Digest + 告警邮件 · ChatGPT/Claude connector · 14 天试用 | GBP | 年付送 2 个月 |
| 5 | SearchScore.io | 同上 | 同上 | Pro | **£99** | /月 | 25 问题 ×2 · 6 引擎 · 每周 · 10 竞品 · **Source Explorer** · 按需重扫（每小时） | GBP | |
| 5 | SearchScore.io | 同上 | 同上 | Scale | **£199** | /月 | 50 问题 ×2 · 15 竞品 · **接 Search Console + GA4** · **白标客户报告 + 只读链接** · 电话支持 · IAB "directional" 级 | GBP | |
| 5 | SearchScore.io | 同上 | 同上 | Enterprise | **£499** | /月 | 100 问题 ×**3** 次 · 20 竞品 · Watchlist + Rival Intelligence 含 · IAB "decision-grade" 级 · 1 工作日响应 | GBP | |
| 5 | SearchScore.io 加购 | 同上 | 同上 | Rival Intelligence | **£19** | /月 | 全档可加 | GBP | |
| 5 | SearchScore.io 咨询 | 同上 | 同上 | Visibility Foundations | **From £950** | 一次性 | llms.txt + AI 爬虫放行 · Organization/Service/FAQ/Person schema · **Quotable answer blocks** · 技术 SEO · 转化基础 · **含 3 个月 Tracker** · **30 天提分保证** · 15 工作日交付 | GBP | |
| 5 | SearchScore.io 咨询 | 同上 | 同上 | Visibility Blueprint | **From £1,500** | 一次性 | Foundations 全部 + 可信度信号 + 权威建设（Wikidata 等）+ 竞品拆解 + 90 天路线图 · 含 6 个月 Tracker · 30 天保证 | GBP | |
| 5 | SearchScore.io 咨询 | 同上 | 同上 | Growth Service | **From £750** | /月 | 持续优化 + 权威建设 + 叙事控制 + 竞品进攻 · 含 Tracker · 3 个月起 | GBP | |
| 6 | **AthenaHQ** | https://athenahq.ai/pricing | 2026-10-27 01:06 | Essential | **Free**（$25 credit） | — | 300 credits · 仅 Gemini · Prompt 与回答分析 · Athena AI agent | USD | |
| 6 | AthenaHQ | 同上 | 同上 | Starter | **$295** | /月（年付 17% off） | **3,600 credits/月** · **1 credit = 1 AI response** · **11 个模型**（ChatGPT / Perplexity / AIO / AI Mode / Gemini / Claude / Copilot / Grok / DeepSeek / Meta AI / Mistral）· **无限 Topics / Prompts / Competitors** · 无限席位 · 国家级别 · CSV 导出 · API 与额外 credits 为**付费加购** · 含 $300/月 credit 额度 | USD | ⚠️【二手】Scrunch 博客（2026）称 Self-serve $295/月、3,500 credits — 与官网 3,600 有出入，以官网为准 |
| 6 | AthenaHQ | 同上 | 同上 | Enterprise | Custom | — | Knowledge Base · Oracle 差异检测 · Athena Citation Engine (ACE) · SAML/OIDC SSO · 审计日志 · 多区域多语言 · Persona 定向 · BI 集成（Tableau/Power BI/Looker）· 白手套部署 | USD | |
| 7 | **Scrunch AI** | https://www.scrunchai.com/pricing | 2026-10-27 01:06 | Core | **$250** | /月 | **125 unique prompts** · **5,000 responses/月** · 5 站点审计/月 · **1 brand workspace** · **5 user licenses** · **4 个 LLM**（ChatGPT / Perplexity / Google AIO / Copilot）· 1 国家 1 语言 1 persona · 5 竞品 · 3 个 AI Search Trends 主题 · 7 天试用 | USD | ⚠️【二手】Scrunch 官方博客称另有 **Agency Core $500/月**；定价页未展示 |
| 7 | Scrunch AI | 同上 | 同上 | Enterprise | Custom | — | 自定义 prompt / responses · AXP（Agent Experience Platform）· **9 个 LLM**（+Claude / Gemini / Meta AI / AI Mode / Grok）· 无限国家/语言 · API + Looker Studio + MCP + CLI · SAML/OIDC SSO · 专属团队 | USD | ⚠️【二手】Scrunch 的 Query API 历史数据上限 90 天 |
| 8 | **Rankscale** | https://rankscale.ai/pricing | 2026-10-27 01:07 | Essentials | **$20**（年付 **$17**） | /月（**仅年付**） | 120 credits/月 · 最多 480 answers · **17+ 引擎** · 2 个 brand dashboard slots · 10 页面审计/月 · 无限 search terms · 全区域 · 调度频次「每小时到每月」 | USD | **官网明示：0.25 credits per engine per prompt** |
| 8 | Rankscale | 同上 | 同上 | Pro | **$99**（年付 $84） | /月 | 1,200 credits · 最多 4,800 answers · 10 dashboards · 50 页面审计 · 情感分析 · 自定义看板 | USD | |
| 8 | Rankscale | 同上 | 同上 | Pro+ | **$229**（年付 $195） | /月 | 3,000 credits · 12,000 answers · 25 dashboards · 100 审计 · **REST API** | USD | |
| 8 | Rankscale | 同上 | 同上 | Growth | **$385**（年付 $327） | /月 | 5,500 credits · 22,000 answers · 50 dashboards · 200 审计 · **白标看板链接** · 代理计划 | USD | |
| 8 | Rankscale | 同上 | 同上 | Enterprise | **$780**（年付 $663） | /月 | 12,000 credits · 48,000 answers · 100 dashboards · 优先支持 | USD | ⚠️【二手】API 默认历史 90 天 |
| 9 | **ZipTie** | https://ziptie.ai/pricing | 2026-10-27 01:07 | 自定义（无档位名） | **从 $25.65 起** | /月 | **$0.01 per prompt-engine check**（全 7 引擎时 $0.0087/check）· 7 引擎（ChatGPT / AIO / Perplexity / AI Mode / Copilot / Bing AIO / Gemini）· **席位 / 竞品 / 导出 / 客户报告 / 分享链接全部不计费** · 7 天试用（25 daily prompts，3 引擎，免卡） | USD | 预设档：Starter 从 $25.65 · Professional 从 $340.20 · Enterprise 从 $1,647.00 |
| 9 | ZipTie 加购 | 同上 | 同上 | UGC Impact Analysis | **+80%** | — | Reddit / YouTube 引用下钻 | USD | |
| 9 | ZipTie 加购 | 同上 | 同上 | Content Generation | **+$20** | /月 per context | 8 briefs + 4 成品/月 | USD | |
| 9 | ZipTie 加购 | 同上 | 同上 | API & MCP | **+$10** | /月 | REST + MCP at api.ziptie.ai | USD | |
| 9 | ZipTie 官方算例 | 同上 | 同上 | In-house brand | **$230.95/月**（年付 $184.76） | /月 | 50 daily + 300 weekly + 1,000 monthly prompts，**全 7 引擎** | USD | 官网明示算例 |
| 9 | ZipTie 官方算例 | 同上 | 同上 | Agency（10 客户） | **$130.72/月**（年付 $104.58） | /月 | 10 客户 × 50 weekly prompts，全 7 引擎 | USD | |
| 9 | ZipTie 官方算例 | 同上 | 同上 | Enterprise 长尾 | **$61.00/月**（年付 $48.80） | /月 | 1,000 monthly prompts，全 7 引擎 | USD | |
| 10 | **Ahrefs Brand Radar** | https://ahrefs.com/brand-radar | 2026-10-27 01:08 | Custom Prompts（随附） | **免费** | /月 | 随 Ahrefs Lite 及以上付费计划赠送：Lite **5 AI prompts / 150 checks**；Standard **10 / 300**；Advanced **20 / 600**；Enterprise **83+ / 2,500+** · 每日更新 | USD | ⚠️ **赛道最强免费层**。Claude 每次更新消耗 8 checks |
| 10 | Ahrefs Brand Radar | 同上 | 同上 | Custom Prompts（加购） | **From $50** | /月 | 按 check 计费；**$699/月 全模型** | USD | |
| 10 | Ahrefs Brand Radar | 同上 | 同上 | AI Visibility Index | **$199** | /月 | **83 prompts/天** · **+2,500 checks/月** · 超出 $0.020/check · 全平台（含 Claude）· 自定义刷新节奏 · **509M prompts 数据库，历史回溯至 2025，无域名上限** | USD | |
| 11 | **Semrush AI Visibility Toolkit** | https://www.semrush.com/kb/1493-ai-visibility-toolkit | 2026-10-27 01:08 | 加购（附加域名） | **$99** | **/月 /域名** | Brand Performance 每加一个域名 $99/月；每加 50 prompts $60/月 | USD | ⚠️**不是独立产品**：需先有 Semrush 付费计划（Pro 约 $139.95 / Guru 约 $249.95 / Business 约 $499.95）【二手：rankability】 |
| 11 | Semrush AIVT | 同上 | 同上 | 档位限制 | — | — | Starter：50 prompts / 500 关键词 / 5 网站；Pro+：100 prompts / 1,500 / 15；Advanced：200 prompts / 5,000 / 40 | USD | 【二手】Semrush 官方 content-hub 称「$99/月起，25 prompts 每日追踪」，与 KB 的 50 prompts 口径不一致，已并列 |
| 12 | **Bluefish AI** | https://www.bluefishai.com/ | 2026-10-27 01:08 | 无公开档位 | **Contact sales only** | — | 官网无定价页（/pricing 返回 404）· 定位 Fortune 500 · 10+ LLM 每日追踪 · 15+ 集成 · 产品服务混合（含代做） | — | **不可比**。页面上的 $13M 是「projected business value」营销数字，非价格 |
| 13 | **Goodie AI** | https://goodie.ai/ | 2026-10-27 01:09 | — | **域名挂牌出售 $150,000** | — | 页面标题为 *"goodie.ai for sale \| Spaceship.com"*，最低报价字段 $20,000 | USD | ⚠️ **抓取失败 + 重大信号**：原产品站已不存在，域名在二级市场出售。判定为**赛道退出** |
| 14 | **GeoReady** ⭐ | https://geoready.dev/pricing | 2026-10-27 01:35 | Free | **$0** | 永久 | 单 URL 审计 · **9 类 + 47 项 citability checks** · 5 次审计/天 · **每周 1 次 AI answer check（Perplexity，需注册）** · CLI（MIT，`geo-optimizer-skill`，有 `geo track` / `geo monitor`）· 免注册免卡 | USD | 🚨 **GeoScore 官网 FAQ 点名的对标物**，见 §5.5 |
| 14 | GeoReady | 同上 | 同上 | **Pro** | **$19**（founding price，**之后 $29**） | /月 | **10 域名周监控** · 无限审计 · **30 次审计历史** · 回归告警（分数降 ≥5 分）· PDF 导出 · **API access（Bearer token）** · **每天 3 次 automated AI answer checks（Perplexity）** | USD | |
| 14 | GeoReady | 同上 | 同上 | **Agency** | **$89**（founding，**之后 $199**） | /月 | **50 域名日监控** · **24 个月历史** · **竞品对比** · 团队 workspace（owner/editor/viewer）· 无限批量审计 · **AI answer snapshots（Perplexity 自动；ChatGPT/Google 手动粘贴）** · 引用质量评分 · 无品牌 PDF 导出（去 footer/badge）· 自定义 logo 白标 = **roadmap** | USD | |
| 14 | GeoReady | 同上 | 同上 | Enterprise | Custom | — | 无限域名 · 小时监控 · SLA · 本地部署 · Webhooks/Slack/CMS 集成 | USD | |
| 15 | **BotView** | https://botview.app/pricing | 2026-10-27 01:36 | Free | **$0** | — | 20 次爬虫扫描/月（每次 ≤3 页）· **0 次 AI answer check** · AI 爬虫检测 · 截图对比 | USD | |
| 15 | BotView | 同上 | 同上 | **Pro** | **$9** | /月 | **20 次 AI answer checks/月**（**通过 OpenAI API + web search 真实调用**，官网明说「not consumer ChatGPT sessions」）· 50 次扫描/月 · 每次 ≤50 页 · 1 个定时扫描 · PDF 导出 | USD | **Private saved answer evidence 保留 90 天** |
| 15 | BotView | 同上 | 同上 | Agency | **$39** | /月 | 100 次 AI answer checks（跨多业务共享）· 无限扫描 · 每次 ≤100 页 · 无限定时扫描 · **白标 PDF 导出** | USD | |
| 16 | **AEO Vision** | https://aeovision.com/pricing | 2026-10-27 01:36 | — | **域名挂牌出售 $2,888** | — | 页面标题 *"aeovision.com is for sale — Buy for $2,888 or make an offer \| GoDaddy"* | USD | 🚨 **产品已退出**，与 Goodie AI 同类信号 |
| **17** | **Elmo** 🚨 | https://www.elmohq.com/aeo-for/enterprise + GitHub README | 2026-10-27 01:48 | **Self-Hosted** | **$0** | 永久 | **无限 prompts · 全部引擎 · 完整源码** · Docker Compose + `@elmohq/cli` · 自持 PostgreSQL · 引用分析 · 竞品追踪 · 社区支持 | USD | 🔴 **本轮最重大发现**，见 §5.6 |
| 17 | Elmo Cloud | 同上 | 同上 | Starter | **$29** | /月 | 1 brand · 50 prompts · **仅 ChatGPT** · 每日 1 次 · 无 premium models · 无限席位 · API + MCP | USD | |
| 17 | Elmo Cloud | 同上 | 同上 | Basic | **$99** | /月 | 1 brand · 50 prompts · **任选 4 个平台** · **每日 4 次** · 无限席位 · API + MCP | USD | |
| 17 | Elmo Cloud | 同上 | 同上 | Pro | **$299** | /月 | 2 brands · 150 prompts · 任选 4 平台 · 每日 4 次 · 20 premium prompts | USD | |
| 17 | Elmo Cloud | 同上 | 同上 | Business | **$649** | /月 | 5 brands · 350 prompts · 任选 4 平台 · 每日 4 次 · 30 premium prompts | USD | 官网标注「Best for enterprises」|
| 17 | Elmo White-label | 同上 | 同上 | Custom | 议价 | — | Cloud 全部 + **自定义品牌 + 自定义域名 + SSO** | USD | |
| 17 | Elmo 成本参照 | GitHub README | 同上 | Jev 判定成本 | **$0.15–0.35 / 1,000 answers** | — | 约 $2–4/月（25 prompts × 3 平台）· 约 $11–26/月（100 prompts × 5）| USD | 🔵 **赛道唯一公开的一手判定成本**（不含引擎查询本身）|
| — | **GeoScore（我方）** | https://geoscore.help/pricing/ | 2026-10-27 01:12 | Free | **$0** | 永久 | 单 URL 审计 · 11 维度 85 项检查 · 修复文件生成器 · CLI & MCP Server · 免登录 | USD | MIT 开源 |
| — | GeoScore | 同上 | 同上 | **Pro** | **$9**（年付 **$79**，省 $29） | /月 | **5 域名** · 每周自动审计 · **30 天审计历史** · 回归告警 · PDF 导出 · **AI visibility estimate：LLM 模拟回答（ChatGPT/Perplexity/Claude/Gemini），官网明确标注「estimates, not live engine traffic」，30 次/月** · 7 天试用 | USD | |
| — | GeoScore | 同上 | 同上 | Studio | **$29** | /月（Coming Soon） | 每日审计 · **12 个月历史** · **竞品对比** · 15 域名 · **API** | USD | |
| — | GeoScore | 同上 | 同上 | Agency | **$59** | /月（Coming Soon） | 每小时审计 · 无限历史 · 团队 workspace · 50 域名 · **白标 PDF** | USD | |
| — | GeoScore Fix Pack | https://geoscore.help/fixpack/ | 2026-10-27 01:12 | 一次性 | **$49** | 一次性 | 按真实目录重建 llms.txt · robots.txt AI 爬虫规则 · 一个爆品的 Product schema · 部署后复审 · 48 小时人工交付 · **经 Fiverr Custom Offer** | USD | |

### 1.1 补充：monetization-analyst 提供的低价档数据核实结果

monetization-analyst 共享了一份低价档清单（来源为第三方聚合页，核对日期 2026-09-25 / 2026-07-03）。我对其中的三家做了官网一手复核：

| 工具 | 第三方清单口径 | **官网一手核实结果（2026-10-27）** | 判定 |
|---|---|---|---|
| **BotView Pro** | $9/mo | ✅ **$9/mo 属实** —— 且官网明说是 **20 次 OpenAI API 真实调用**（"not consumer ChatGPT sessions"） | ✅ 确认，**且比清单描述更强** |
| **AEO Vision Lite** | $9/mo | ❌ **域名在 GoDaddy 挂牌出售 $2,888，产品已不存在** | 🔴 **清单失效**，不可作为定价依据 |
| **GeoReady** | 清单中未出现 | 🆕 **Free $0 / Pro $19 / Agency $89**（founding price，之后 $29/$199）| ⚠️ **GeoScore 官网 FAQ 称其「$9–89/月」，实测最低付费档是 $19，我们低报了 $10 且漏了涨价后价格** |

**结论**：低价档确实存在且在售（BotView $9 是真实的），但第三方聚合页**有失效条目**（AEO Vision 已停运）。**本报告只采用官网一手数据。**

> ⚠️ **方法论提示**：monetization-analyst 的清单来源是 botview.app 的「affordable AEO/GEO tools」页、metehan.ai、brandaxis.ai —— 其中 botview.app 和 brandaxis.ai **本身是竞品的内容营销页**（用竞品清单做 SEO），引用时需降级为二手且注意偏向性。

### 与团队 10-23 记录的差异汇总（核心交付项）

| 竞品 | 10-23 记录 | 10-27 实测 | 判定 |
|---|---|---|---|
| Otterly | $29 / $189 / $489 | **$29 / $189 / $489**（另发现年付 **$25 / $160 / $422**） | ✅ 月付价未变；**年付档为新增信息** |
| Peec | €85 / €205 / €425 | **$95 / $245 / $495** | ⚠️ **币种口径变了**（EUR→USD 展示）。无法判定是涨价还是汇率+切币种，需按 EUR 再抓一次才能定论 |
| LLMrefs | €79/月（500 prompts） | **$79/月（500 prompts）** | ⚠️ 数字未变，**币种标识变了** |
| Profound | 已撤自助档 | ✅ **确认**：仅剩 Trial（免费/7 天/50 prompts/3 引擎，无历史无导出无 API）+ Enterprise 议价 | ✅ 判断正确 |
| SearchScore | £49/99/199/499 + 咨询 £750 起 | **£49/99/199/499 未变**；咨询现为 **Foundations £950 / Blueprint £1,500 / Growth £750/mo**（三条线，非单一 £750 起） | ✅ 订阅价未变；**咨询线比记录更完整，且门槛提高了** |
| Semrush AI Toolkit | Base $99/月/域名 | **$99/月/域名** ✅；但**需叠加底层 Semrush 计划 $139.95 起**，真实起步 **≈$238.95/月** | ⚠️ 记录漏了「必须叠加底层计划」这一关键 TCO 项 |
| **Goodie AI** | （清单内，无价格） | **域名 $150,000 挂牌出售，产品已停** | 🚨 **新增重大发现** |

---

## 2. 统一口径折算表

### 2.1 先说哪些不可比（不要硬凑）

| 不可比原因 | 涉及厂商 | 说明 |
|---|---|---|
| **计价单位根本不同** | Profound、Bluefish | 无公开自助档，仅议价。任何折算都是编的 |
| **按 response/credit 计费，不按 prompt 计费** | AthenaHQ、Rankscale | AthenaHQ「无限 prompts」——prompt 数是用户自己决定的，分母不存在；只能用 $/response 比 |
| **按 check 计费（prompt × 引擎 × 频次）** | ZipTie、Ahrefs | ZipTie 的「prompt」是**槽位**不是消耗量（每日 prompt 每 24h 重跑不额外计费），与 Otterly 的「15 prompts 上限」不是同一个东西 |
| **「问题」重复提问** | SearchScore | 每档「每个问题问 2 次」（Enterprise 3 次），10 questions ≠ 10 次查询 |
| **GeoScore 与全线** | GeoScore | **测量对象不同**：竞品测「AI 引擎真实回答」，GeoScore 测「站点信号 + LLM 模拟」。$9/5 域名与 $29/15 prompts 不是同一商品 |

### 2.2 口径 A：**每条 prompt 的月单价**（价格 ÷ 包含 prompt 数）

> 仅对「按 prompt 数封顶」的厂商可比。

| 竞品 / 档位 | 月价 | prompt 数 | **$/prompt/月** | 备注 |
|---|---|---|---|---|
| **LLMrefs** All in One | $79 | 500 | **$0.158** | 🏆 **全赛道最低，比第二名便宜 7.7 倍**。且无限域名 |
| ZipTie（In-house 官方算例） | $230.95 | 683 个槽位（50 daily+300 weekly+1000 monthly） | **$0.338** | 但这是**全 7 引擎**的价格 |
| ZipTie（Starter 默认配置） | $25.65 | 30 daily × 3 引擎 | $0.855 | |
| Otterly Premium | $489 | 400 | **$1.22** | |
| Otterly Premium（年付） | $422 | 400 | $1.06 | |
| Peec Advanced | $495 | 350 | **$1.41** | 5 projects |
| Peec Pro | $245 | 150 | **$1.63** | 2 projects |
| Otterly Standard（年付） | $160 | 100 | $1.60 | |
| Otterly Lite（年付） | $25 | 15 | $1.67 | |
| Peec Starter | $95 | 50 | **$1.90** | 1 project |
| Otterly Standard | $189 | 100 | **$1.89** | |
| Otterly Lite | $29 | 15 | **$1.93** | 💰 全赛道最贵的入门单价 |
| Scrunch Core | $250 | 125 | **$2.00** | 4 引擎，5,000 responses |
| SearchScore Pro | £99 | 25 questions（×2 次） | **£3.96**（≈£1.98/次查询） | 6 引擎 |
| SearchScore Scale | £199 | 50（×2） | **£3.98**（≈£1.99/次） | |
| SearchScore Starter | £49 | 10（×2） | **£4.90**（≈£2.45/次） | |
| SearchScore Enterprise | £499 | 100（×3） | **£4.99**（≈£1.66/次） | |
| Semrush AIVT | $99 | 25 prompts（【二手】口径） | **$3.96** | **且需叠加底层计划 $139.95 起 → 真实 $238.95 ÷ 25 = $9.56/prompt/月** |
| AthenaHQ Starter | $295 | 无限 | **不可比** | 见 2.3 |

**中位档**（取各家中间档的 $/prompt/月）：约 **$1.41 – $1.89**，取 **≈$1.6/prompt/月**。

### 2.3 口径 B：**每条 AI response / check 的单价**（价格 ÷ 月查询次数）

> 这是唯一能横跨「credit 制」与「prompt 制」的口径，也是**判断 $9 能不能覆盖真实查询成本**的关键。

| 竞品 / 档位 | 月价 | 月 AI answers | **$/answer** | 备注 |
|---|---|---|---|---|
| Rankscale Enterprise | $780 | 48,000 | **$0.0163** | 🏆 最低 |
| Rankscale Growth | $385 | 22,000 | $0.0175 | 含白标 |
| Rankscale Pro+ | $229 | 12,000 | $0.0191 | 含 REST API |
| Rankscale Pro | $99 | 4,800 | $0.0206 | |
| Ahrefs AI Visibility Index 超量 | — | — | **$0.020/check** | 边际价 |
| **ZipTie 标准价** | — | — | **$0.0100/check**（1 引擎）/ **$0.0087**（7 引擎） | 💡 **行业公开的最透明单价** |
| Peec Advanced | $495 | 31,500 | $0.0157 | |
| Peec Pro | $245 | 13,500 | $0.0181 | |
| Peec Starter | $95 | 4,500 | $0.0211 | |
| Scrunch Core | $250 | 5,000 | **$0.0500** | |
| **AthenaHQ Starter** | **$295** | **3,600**（1 credit = 1 response） | **$0.0819** | 💰 最贵；且 API 是付费加购 |
| Ahrefs AI Visibility Index（含库） | $199 | 2,500 | $0.0796 | 但含 509M prompt 库访问权 |
| SearchScore Starter | £49 | ≈520（10×6×2×4.33 周） | ≈£0.094 | |
| Otterly Lite | $29 | ≈1,800（15×4×30） | ≈$0.0161 | 反推值，官网未明示 |
| **GeoScore Pro** | **$9** | 30 次 **LLM 模拟**（非真实引擎查询） | **$0.30/模拟次** | ⚠️ **与上方任何一行都不可比** |

> **关键推论**：真实 AI 引擎查询的行业**公开标价**在 **$0.0087 – $0.08 / 次**（中位约 **$0.02/次**）。

### 2.3.1 ⚠️ 重要方法论更正（2026-10-27，由与 monetization-analyst 的交叉验证触发）

上表的 $0.0087–$0.08 **不是行业成本，是竞品的公开售价**（含毛利与基础设施摊销）。更关键的是，**AI 引擎查询存在两种成本模型完全不同的技术路线**，混为一谈会导致推导错误：

| 路线 | 谁在用 | 成本结构 | 单次成本特征 |
|---|---|---|---|
| **A. 真实 web 界面自动化** | **Otterly**（官网原话：*"Real web-interface monitoring. OtterlyAI queries the actual AI search interfaces the way a human user does, rather than hitting an API endpoint that returns different results. That's why it returns real citations and link positions"*）、Scrunch（【二手】"浏览器自动化与官方 API 混合"） | **不按 token 计费**。成本 = 服务器 + 代理 IP + 浏览器自动化的**固定基础设施摊销** | 规模化后**边际成本趋近于零**；规模化前固定成本高 |
| **B. LLM API + web search 调用** | BotView（明说 OpenAI API + web search）、**Otterly 的 Claude 加购**（【二手】bestaeotools 引 Otterly help center：*"Claude uses Haiku through the API with web search"*） | **按 token + search 调用计费** | 线性可变成本，但可**选便宜模型**压低（Haiku 而非 Opus） |

**这解释了 monetization-analyst 提出的「Otterly Lite 在 $29 给 1,800 次/月，按中位成本只负担得起约 412 次」的存疑差额：**
- ❌ **不是**「Otterly 战略性亏钱引流」
- ✅ **而是**：Otterly 走**路线 A（web 界面自动化）**，边际成本不遵循 API 单价模型；其可变成本主要是基础设施摊销，规模化后单次成本远低于 $0.02。

**修正后的表述（避免口径不一致被质疑）**：
- ✅ 可以说：「**API 路线**的真实查询成本量级在 $0.01–$0.08/次（以竞品公开标价为上限代理）」
- ❌ 不可以说：「Otterly $29 在亏钱」或「$9 绝对覆盖不了真实查询」
- ✅ 准确说法：**「$9 覆盖不了 API 路线的真实查询；web 界面自动化路线需先投入固定基础设施，在 83 会话/月的当前规模下不划算」**

### 2.3.2 反向佐证：bootstrapped 小团队能在这个赛道跑出健康单位经济

| 指标 | 数值 | 来源 |
|---|---|---|
| Otterly 融资状态 | **完全 bootstrapped，无外部资金** | 【二手】多源一致（searchengineworld / openlens / trylyra / bestaeotools / guptadeepak）|
| 团队规模 | **7 人** | 【二手】bestaeotools（2026-10-19 核对）|
| 营收 | **$770K（截至 2025-10）** | 【二手】bestaeotools |
| 人均产出 | **≈$110K/人**（推算）| 推算 |
| 用户数 | 2025 年底 1,000+ → 2026 初 ~20,000 → 官网现称 30,000+/40,000+ | ⚠️ **官网首页同时出现 30,000+ 与 40,000+ 两个数字，内容不一致，该数字可信度打折** |
| 开发者生态 | **28-tool MCP server + public REST API + 可下载 Claude Skill + Looker Studio connector（20+ 字段）** | 【二手】openlens（2026）；与我 §1 官网抓取一致（Standard 档起含 API + MCP）|

**对 §4 判断 4 的直接佐证**：7 人 bootstrapped 团队做到 $770K ARR，说明这个赛道**不靠融资也能活**，且 Otterly 正是靠**内容资产与开发者生态**（28-tool MCP、免费工具、研究博客）而非功能深度进入第一梯队的。

### 2.4 口径 C：**每月每个被监测域名**

| 竞品 / 档位 | 月价 | 域名/项目数 | **$/域名/月** | 备注 |
|---|---|---|---|---|
| **Otterly Lite** | $29 | **无限品牌与竞品**（1 workspace） | **趋近 $0**（受 workspace 约束） | 域名不是它的计费轴 |
| **LLMrefs** | $79 | **无限项目 / 无限域名** | **趋近 $0** | 全赛道最激进 |
| **ZipTie** | $130.72（代理算例） | **10 个客户** | **$13.07** | 全 7 引擎，含白标报告 |
| **Rankscale Essentials** | $20 | 2 dashboards | **$10.00** | |
| Rankscale Pro | $99 | 10 dashboards | $9.90 | |
| Rankscale Pro+ | $229 | 25 | $9.16 | |
| Rankscale Growth | $385 | 50 | $7.70 | 含白标 |
| Rankscale Enterprise | $780 | 100 | $7.80 | |
| **Peec Starter** | $95 | 1 project | **$95.00** | 💰 |
| Peec Pro | $245 | 2 projects | $122.50 | |
| Peec Advanced | $495 | 5 projects | $99.00 | |
| **Scrunch Core** | $250 | 1 brand workspace | **$250.00** | 💰💰 |
| **Semrush AIVT** | $99 + 底层 $139.95 = $238.95 | 1 域名 | **$238.95** | 💰💰💰 **加一个域名再加 $99** |
| **AthenaHQ Starter** | $295 | 未公开域名上限（无限 competitors） | **不可比** | |
| **Ahrefs AI Visibility Index** | $199 | **无域名上限** | 趋近 $0 | 大厂数据资产优势的直接体现 |
| **GeoScore Pro** | **$9** | **5 域名** | **$1.80** | ⚠️ 测量对象是站点信号，不是 AI 回答 |

---

## 3. 功能对比矩阵（10 维度 × 14 家）

**图例**：`有` = 官网定价/功能页明示 · `部` = 部分具备或需加购/Enterprise 档 · `无` = 官网未提及或明示不支持 · `?` = 抓取失败

| # | 维度 | Otterly | Peec | LLMrefs | Profound | SearchScore | AthenaHQ | Scrunch | Rankscale | ZipTie | Ahrefs BR | Semrush AIVT | Bluefish | **GeoScore** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **真实查询 AI 引擎（非模拟）** | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 部¹ | 有 | **无**² |
| 2 | 保存原始回答原文 + 时间戳 | 部 | 部 | 部 | **有** | 部 | 有 | 有 | 部 | 部 | **有** | 部 | 部 | **部**² |
| 3 | 引用来源分析（URL 级 + 频次） | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | **无** |
| 4 | 竞品对标（份额） | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | **无**³ |
| 5 | 趋势 / 历史曲线 | 有 | 有 | 部 | **有** | 有 | 部 | 有 | 有 | 部 | **有** | 有 | 有 | **部**⁴ |
| 6 | 提示词管理 / 批量导入 | 部 | **有** | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | **无**⁵ |
| 7 | 告警（份额下滑提醒） | 部 | 部 | 部 | 部 | **有** | 部 | **有** | **有** | 部 | 部 | 有 | 有 | **有**⁶ |
| 8 | API / 导出（CSV/PDF） | 有 | 有 | 有 | 有 | 部 | 有 | 有 | 有 | 有 | 有 | 有 | 有 | **部**⁷ |
| 9 | 白标报告 | 无 | 部 | 无 | 无 | **有** | 部 | 部 | **有** | **有** | 无 | 部 | 有 | **部**⁸ |
| 10 | 修复建议 / 代做服务 | 有 | 有 | 有 | 有 | **有**⁹ | 有 | 有 | 有 | 部 | 部 | 部 | **有**¹⁰ | **有**¹¹ |
| | **「有」计数** | **6** | **7** | **7** | **8** | **8** | **7** | **8** | **9** | **6** | **8** | **5** | **9** | **2** |

**脚注（证据）**
1. Semrush：【二手】rankability 指其「models brand presence with **simulated prompts** rather than live user sessions」；官网称数据每日更新。存疑，标「部」。
2. **GeoScore = 部**（🔬 **代码级证据，由 site-health-auditor 实测，2026-10-27**）：
   - 全仓 grep `api.openai|api.anthropic|perplexity.ai|generativelanguage|api.x.ai|groq` → **零代码调用**
   - `worker/visibility.js:19-20` 实际调 `tokenrhythm.studio/v1/chat/completions`，模型 **`deepseek-v4-flash-0731`**；第 30–35 行给 deepseek 套 **4 个人格 prompt** 让它**扮演** ChatGPT / Perplexity / Claude / Gemini
   - 文件头第 5–13 行自述 *"NOT a measurement of real AI engine traffic"*
   - ⚠️ **精确表述**：原始回答**确实入库**（`ai_visibility.raw`），但存的是 **deepseek 的模拟输出**，不是引擎真实回答。**既不能写「有」（内容是模拟的），也不宜写「无」（机制上确实有留存）**，故标「部」。
3. GeoScore：Studio 档（Coming Soon）才含 Competitor comparison。
4. GeoScore：Pro 30 天 / Studio 12 个月（Coming Soon）。竞品中 Profound Enterprise 为 All time；Ahrefs 回溯至 2025（AI Overviews 至 2024-08【二手】）；【二手】Peec 约 12 个月、Scrunch Query API 90 天、Rankscale API 90 天。
5. 🔬 **GeoScore = 无，且是结构性无**（代码级证据，site-health-auditor 实测）：query 是从目标站 **meta description 截第一句自动生成**（`visibility.js:104-110`），**用户完全不能输入 prompt**。
   → 这不是「没做 UI」，而是**产品模型里根本没有 prompt 这个输入维度**。修这个等于改产品定义，不是加功能。
6. GeoScore：Regression alerts（Pro 及以上）——**这是我们唯一领先全场的一项**，因为多数竞品官网未明示原生告警。
7. GeoScore：PDF 导出有（Pro）；API 在 Studio（Coming Soon）；CLI + MCP Server 有（但输出的是审计结果，不是 AI 可见度数据）。
8. GeoScore：白标 PDF 在 Agency（Coming Soon）。
9. SearchScore 是**唯一**把代做做成完整价格梯队并带 **30 天提分保证**的：£950 / £1,500 / £750/mo。
10. Bluefish：「Full Service: custom audits, strategy, and execution from a team built to accelerate results」。
11. GeoScore Fix Pack $49 一次性，48 小时人工交付。

### 各家追踪的 AI 引擎数量（口径：官网明示）

| 厂商 | 起步档引擎数 | 顶配引擎数 |
|---|---|---|
| Rankscale | 17+ | 17+ |
| Peec | 3（可选 6） | 13（Enterprise） |
| Profound | 3（Trial） | 9 |
| AthenaHQ | 11（Starter 全给） | 11+ 按需 |
| LLMrefs | **11（全档不分档）** | 11 |
| SearchScore | 6 + Google AIO/AI Mode | 同上 |
| ZipTie | 7（任选，同价） | 7 |
| Scrunch | 4 | 9 |
| Otterly | 4（其余为加购） | 4 + 3 加购 |
| **GeoScore** | **0（模拟 4 个）** | **0（模拟 4 个）** |

⚠️ **口径澄清（易错点，务必区分两类「引擎」）**：

| | **AI 爬虫（crawler）** | **答案引擎（answer engine）** |
|---|---|---|
| 是什么 | 抓取你网站的 bot | 生成回答、可能引用你的 AI 产品 |
| 举例 | GPTBot / ClaudeBot / PerplexityBot / Google-Extended / CCBot | ChatGPT / Perplexity / Claude / Gemini / Google AIO / AI Mode |
| **GeoScore** | **20 个**（`robots.js`，用于审计「你有没有放行爬虫」）| **0 个**（代码零调用，见脚注 2）|
| 上表统计的是 | ❌ 不是这个 | ✅ **是这个** |

**→ 对外沟通时绝不能拿「20 个 AI 爬虫」充作引擎覆盖数。** 06 号文档第 70 行已提示这两个概念不可混。竞品表里那一列全是答案引擎，我们填 0。

---

### 3.1 🔬 自家基线实测（代码级证据，由 site-health-auditor 于 2026-10-27 实跑提供）

本节数据来源为站点健康审计的**实跑与全仓代码核查**，可信度高于官网文案与二手评测，**已在上方功能矩阵中逐格并入**。

| 项 | 实测结果 | 对矩阵/结论的影响 |
|---|---|---|
| **AI 引擎调用** | 全仓 grep OpenAI / Anthropic / Perplexity / Gemini / xAI / Groq → **零代码调用**；实际调 `tokenrhythm.studio` 的 `deepseek-v4-flash-0731`，套 4 个人格 prompt 扮演 4 个引擎 | 维度 1 = **无**（确认）|
| **原始回答入库** | **确实入库**（`ai_visibility.raw`），但内容是 deepseek 模拟输出 | 维度 2 = **部**（非「有」亦非「无」）|
| **prompt 概念** | query 由 **meta description 截第一句自动生成**（`visibility.js:104-110`），用户完全不可输入 | 维度 6 = **无**，且是**结构性无**——改这个等于改产品定义 |
| **检查项总数** | 11 维度内 **85** 项 + 负面信号 **8** + 提示词注入 **6** = **99** 项 | 对标 SearchScore「300+ signals」、Rankscale「94+/200+」时应**用 99 这个口径**，不用 85 |
| **自审得分** | `node bin/geoscore.mjs https://geoscore.help --json` → **94 / Excellent**，产出 18 条建议 | 站上写「85+」准确 |
| **爬虫 vs 引擎** | `robots.js` 的 20 个是**爬虫**；**答案引擎覆盖 = 0** | 见上方口径澄清 |
| **中文内容现状** | 英文 **15** 篇博文 vs 中文 **1** 篇；38 个页面中 zh 仅 **12** 页 | 🔴 见下方「中文资产」修正 |
| 🔴 **中国大陆可达性** | 后端 `geoscore-payments.geo-score.workers.dev` **境内 DNS 已污染**（实测解析到 69.63.178.13 等错误 IP，直连 21s 超时，须走代理） | 🔴 **见下方结构性约束** |

#### 🔴 结构性约束：中文市场是一道不同的题（修正我此前的判断）

我原先在 §4 判断 4 中把「中文支持」列为 GeoScore 的三项差异化资产之一。**这条需要修正。**

site-health-auditor 实测指出一个**内在冲突**：

| | **GeoScore（境外独立站）** | **本土厂商（豆智 / 新榜 / 搜极星等）** |
|---|---|---|
| 要调的引擎 | ChatGPT / Perplexity / Gemini / Claude | **DeepSeek / 豆包 / 元宝 / 文心** |
| 境内可达性 | ❌ **引擎境内不可直连** | ✅ 境内可达 |
| 后端域名 | ❌ 境内 DNS 已污染 | ✅ 正常 |
| 覆盖的搜索生态 | 境外 AI 搜索 | 境内 AI 搜索 |

**→ 「做中文 GEO」和「真调 ChatGPT/Perplexity/Gemini/Claude」对境内用户是内在冲突的，这不是同一道题。**

**修正后的结论**：
- ❌ 不应把「中文」列为我们的资产——我们中文内容稀薄（1/15 博文、12/38 页面），且**即使做了中文，境内用户也用不了我们要调的引擎**。
- ✅ 准确的资产表述应改为：**「面向出海/境外站点的中文界面」**——服务对象是**需要进入境外 AI 搜索的中国出海企业**，而不是境内市场。这是一个窄得多、但真实存在且本土厂商不做的细分。
- ⚠️ **如果团队讨论中出现「做中文市场」，这个约束必须前置说明**：那需要的是一套独立的引擎接入（DeepSeek/豆包/元宝）+ 独立后端，**不是翻译现有产品**。

---

## 4. 四个判断（明确回答）

### 判断 1：赛道是在增长，还是在被大厂吞掉？

**答：两者同时发生，且是同一枚硬币的两面。头部在疯长，中间层在被吞。**

**增长证据（一手优先）**

| 公司 | 事件 | 金额 | 时间 | 证据强度 |
|---|---|---|---|---|
| Profound | **Series D** | **$180M**，累计 **$334.5M**，估值 **$1.8B** | 2026-09 | 【二手】guptadeepak GEO Compass / searchengineworld 一致 |
| Bluefish | Series B | $43M，累计 $68M | 2026-04 | 【二手】两处一致 |
| Peec AI | Series A | $21M，累计 $29M，ARR 约 $10M | 2025-11 | 【二手】 |
| Conductor | Growth equity | $150M | 2021-11（存量） | 【二手】 |
| geoSurge / BrandRank.AI / Petra Labs / Searchable | Seed 轮 | $12M / $3M / $5.2M / $14M | 2026-02 ~ 2026-07 | 【二手】 |
| Otterly | **完全 bootstrapped**，无外部融资 | — | — | 【二手】多家一致；但已获 Gartner Cool Vendor、20,000+ 用户 |

**被吞证据（一手）**

| 事件 | 金额 | 时间 | 证据强度 |
|---|---|---|---|
| **Adobe 收购 Semrush Holdings** | **$1.87B**（主要为现金） | **2026-04-28 完成** | 🟢 **一手**：Adobe 2026 Q3 Form 10-Q，NOTE 3. ACQUISITIONS 原文：*"On April 28, 2026, we completed the acquisition of Semrush Holdings, Inc. … for $1.87 billion"* |
| **Sitecore 收购 Scrunch** | 未披露（【二手】彭博称约 **$225M**，双方未证实） | **2026-06-03 宣布** | 🟢 一手（交易本身）：Sitecore 官方新闻稿；金额 🟡 二手 |
| **goodie.ai 域名挂牌出售** | $150,000 | 2026-10-27 仍在售 | 🟢 一手：Spaceship 域名市场页面 |

**结论性解读**

- 大厂买的不是「监测看板」，而是**内容交付端**。Adobe 10-Q 写明收购目的是 *"generative engine optimization and agentic search optimization"*；Sitecore 新闻稿写明要的是 Scrunch 的 **AXP（Agent Experience Platform）**——即「向 AI 爬虫投递机器可读版本，人类站点不变」。
- 这意味着：单纯的「我告诉你 AI 怎么看你」正在变成 DXP/CMS 的一个免费模块。**监测层的独立价值在被压缩，执行层/交付层的价值在被买走。**
- 钱极度集中：Profound 一家 $334.5M，超过 Peec($29M) + Scrunch($26M) + Bluefish 单轮($43M) + 5 家 2026 Seed 轮之和。
- **对独立站的含义**：不是「赛道完了」，而是「**赛道分层了**」——
  - 上层（Enterprise/被收购）：靠资本与渠道
  - 中层（Peec / Scrunch / AthenaHQ / Rankscale / ZipTie）：**最危险**，价格战已经开始（LLMrefs $79/500 prompts vs Peec $95/50 prompts，单位价差 12 倍）
  - 下层（免费 / 内容 / 开源）：**Otterly 证明了这条路能走通**

---

### 判断 2：$9/mo 这个价位在这个赛道站不站得住？

**答：站得住，但它对标的是「免费」，不是「$29」。一旦我们要做真实引擎查询，$9 立刻站不住。**

**竞品最低档的真实价格（USD，月付）**

| 排序 | 竞品 | 最低档月价 | 该档包含量 |
|---|---|---|---|
| 1 | Rankscale Essentials | **$20**（年付 $17） | 120 credits / 480 answers / 17+ 引擎 |
| 2 | ZipTie Starter | **$25.65** | 30 daily prompts × 3 引擎 |
| 3 | Otterly Lite | **$29**（年付 $25） | 15 prompts × 4 引擎 |
| 4 | Ahrefs Custom Prompts | **$50** | 但 **Lite 计划本身免费送 5 prompts** |
| 5 | LLMrefs | **$79** | **500 prompts × 11 引擎，无限域名** |
| 6 | Peec Starter | **$95** | 50 prompts × 3 模型，1 project |
| 7 | Semrush AIVT | **$99 + 底层 $139.95 = $238.95** | 25 prompts，1 域名 |
| 8 | Scrunch Core | **$250** | 125 prompts × 4 LLM |
| 9 | AthenaHQ Starter | **$295** | 3,600 credits / 11 模型 |
| — | **中位（最低档）** | **≈ $72/mo** | — |
| — | **中位（次低/主流档）** | **≈ $245/mo**（Otterly Standard $189 / Peec Pro $245 / Rankscale Pro+ $229 / ZipTie Pro $340.20 / SearchScore Pro £99 / Scrunch Agency $500） | — |

**$9 的三个致命事实**

1. **$9 买的东西和 $29 买的东西不是同一个。** $29（Otterly）买的是「真实查询 4 个 AI 引擎 1,800 次/月 + 引用数据 + 竞品份额」。$9 买的是「5 个域名的站点信号周审计 + 30 次 LLM 模拟」。

   > **📌 与 monetization-analyst 的口径对齐（重要）**
   > MA 提出「$9 是赛道地板价，BotView 和 AEO Vision 都在真实售卖，且 GeoScore $9 的包含量比 BotView $9 更宽」。
   > **前半句我同意，后半句我不同意，根因是「真实 vs 模拟」的口径分歧：**
   > | | **BotView Pro $9/mo** | **GeoScore Pro $9/mo** |
   > |---|---|---|
   > | AI 引擎查询 | **20 次/月，OpenAI API + web search 真实调用**（官网明示 "not consumer ChatGPT sessions"） | **30 次/月，LLM 模拟**（官网明示 "estimates, **not live engine traffic**"） |
   > | 爬虫扫描 | 50 次/月，每次 ≤50 页 | 5 域名，每周自动审计（扫描深度未公开） |
   > | 原始回答留存 | **90 天**（官网明示） | **无** |
   > | 白标 | 无（Agency $39 才有） | 无（Agency Coming Soon） |
   > | PDF | 有 | 有 |
   > | 开源 / 可编程 | 无 | **有**（MIT + CLI + MCP Server） |
   >
   > **判定**：BotView $9 在「AI 引擎查询真实性」这一赛道核心维度上**严格强于** GeoScore $9（真实 vs 模拟，且有 90 天原文留存）。GeoScore $9 仅在**开源可编程**上领先。
   > 因此「$9 包含量比 BotView 宽」这个说法**不成立**——它是把「模拟」和「真实」当成同一种商品比较了。
   >
   > **但 MA 的核心结论我完全同意**：$9 **定价本身不是问题**。我的结论是「$9 作为留存/认证层站得住，作为监测层站不住」——这和 MA 的「问题在流量和上面两档没开，不在价格」是**同一件事的两种表述**，不冲突。
2. **$9 物理上覆盖不了真实查询。** 见 §2.3：行业真实查询边际成本 **$0.0087–$0.08/次**（中位 $0.02）。按 Otterly Lite 口径（1,800 answers/月）= **$15.7–$144/月**。$9 连最便宜的 ZipTie 价格（1,800 × $0.0087 = $15.7）都覆盖不了。
3. **免费层由大厂把守，不是由小厂把守。** Ahrefs 随 Lite（$129/月）免费送 5 AI prompts / 150 checks；Profound 送 7 天全功能 Trial；Otterly 送 5 个免费 GEO 工具；SearchScore 送完整三科审计。**$9 的竞争对手是这些，不是 $29。**

**结论**
- ✅ **$9 作为「留存层/认证层」站得住**——它比免费多一点（历史、告警、PDF、多域名），定价合理，且 CLI/MCP/开源是竞品给不了的。
- ❌ **$9 作为「监测层」站不住**。Studio（$29）承诺了「每日审计 + 12 个月历史 + 竞品对比 + API」——如果「竞品对比」指的是 AI 回答份额对比，那 $29 也覆盖不了；如果只是站点分数对比，$29 是合理的。

### 4.2.1 ⭐ 修正：$9 的准确问题表述（与 monetization-analyst 交叉验证后定稿）

我最初的表述「**$9 物理上覆盖不了真实引擎查询**」**已被证伪，请勿再引用**。MA 用 BotView 数据算出的反驳成立：

| 单价假设 | BotView $9 的 20 次真实调用/月成本 | 占 GeoScore Pro $9 净收（$8.25）|
|---|---|---|
| $0.0087（ZipTie 公开价）| $0.17 | 2.1% |
| **$0.02（中位）** | **$0.40** | **4.8%** |
| $0.08（AthenaHQ 公开价）| $1.60 | 19.4% |

**✅ 准确表述（本报告的最终口径）**：
> **不是「$9 给不起真实查询」，而是「$9 给得起 20–40 次/月真实查询，但我们选择了给 30 次 LLM 模拟」。**
> **真正的问题不是成本，是产品决策：模拟 ≠ 真实。**

**🔴 更糟的定位事实（MA 发现，我核实后确认）**：
剔除已停运的 AEO Vision 后，**$9 档实际只剩 BotView 与 GeoScore 两家在售**；市场的入门集群是 **$19–29**（GeoReady $19 · BrandAxis $19 · Beamtrace/Rankscale $20 · Otterly/Promptmonitor/Wellows $29）。

**→ 我们既是最低价，又在赛道核心维度上最弱。这是「便宜且弱」，不是「便宜且够用」——最差的一种定位。**

### 4.2.2 ⚠️ 对 MA 提出的「提到 $19 + 20 次真实查询」方案的竞品校验

MA 建议提到 **$19/mo（founding，明示后 $29）+ 20 次真实查询**。方向正确（进入入门集群、能负担真实查询、Creem $50 提现门槛从 7 个月缩到 3 个月），**但我做了竞品校验后发现：这个配置仍然弱于同价位的 GeoReady Pro $19。**

| 维度 | **MA 方案：GeoScore $19** | **GeoReady Pro $19**（founding，一手）| 差距 |
|---|---|---|---|
| 域名 | 5 | **10** | 🔴 2× |
| **真实 AI 查询** | **20 次/月** | **3 次/天 ≈ 90 次/月** | 🔴 **4.5×** |
| API | 无（Studio Coming Soon）| **有（Bearer token）** | 🔴 |
| 历史 | 30 天 | 30 次审计 | ≈ 平 |
| 告警 / PDF | 有 / 有 | 有 / 有 | 平 |
| 开源可编程 | **MIT + CLI + MCP** | MIT + CLI（无 MCP）| ✅ 我们 |

**→ $19 + 20 次，只是从「便宜且弱」变成「同价且弱」，没有解决定位问题。**

**🎯 但成本上有更好的解法**：把真实查询给到**对标 GeoReady 的 90 次/月**：

| 真实查询量 | 成本（按中位 $0.02/次）| 占 $19 净收（$17.86）|
|---|---|---|
| 20 次/月 | $0.40 | 2.2% |
| **90 次/月（对齐 GeoReady Pro）** | **$1.80** | **10.1%** |
| 180 次/月（2× 对齐）| $3.60 | 20.2% |

**结论：给到 90 次/月，成本只占净收 10%，完全可承受，且能抹平与 GeoReady Pro 的最大一项差距。**
**建议 MA 把方案从「$19 + 20 次」上调为「$19 + 90 次」，并把域名从 5 提到 10**（域名是软件限制不是成本，无边际成本）。

**（执行节奏仍采纳 MA 的克制条件：n=1 时改价学不到东西，放到付费用户 ≥5 时执行；D4 先只把年付 $79 设为默认，不动月付标价。）**

### 4.2.3 免费层加真实查询：成本区间与预算帽撞点（MA 数据的补算）

MA 算出 GeoReady Free 的「每周 1 次真实 Perplexity」规模化成本，我补了区间与撞点：

| 规模 | 按 $0.0087 | **按 $0.02（中位）** | 按 $0.08 |
|---|---|---|---|
| 1 用户/月（4.33 次）| $0.038 | **$0.087** | $0.35 |
| 当前 83 会话全用满 | $3.1 | **$7.1** | $28.5 |
| 10,000 免费用户 | $377 | **$866** | **$3,464** |

⚠️ **MA 设的「全局 $50/月预算帽」会很快撞上，必须预设降级策略**：

| 单价假设 | $50/月预算帽能支撑的用户数 |
|---|---|
| $0.0087 | 1,323 |
| **$0.02（中位）** | **577** |
| $0.08 | **144** |

**→ 按最坏情况，144 个免费用户就会撞帽。需要提前定义撞帽后的行为**（排队 / 降为每 2 周 1 次 / 仅付费用户可用 / 提示升级），否则会出现「免费层功能时有时无」的体验问题，反而伤害转化。

**我完全同意 MA 的「强制登录」设计**——用近乎零成本同时解决「免费层说服力弱」与「试了不留痕（leads=0）」两个问题，这是本轮交叉验证中性价比最高的一个动作。

---

### 判断 3：「免费审计 + 卖修复包」这套，有没有人验证过能赚钱？

**答：有，且最强的验证者就是 SearchScore——它和 GeoScore 的架构几乎一模一样。但我们的变现点定错了位置，把最值钱的东西贱卖了。**

**✅ 正面证据**

| 案例 | 模式 | 结果 | 证据强度 |
|---|---|---|---|
| **SearchScore**（最直接可比） | 免费三科审计（GEO/SEO/CRO，300+ 信号，60 秒）→ £49/£99/£199/£499 Tracker → **£950 / £1,500 咨询 + £750/mo 长期服务** | 官网称已审计 **1,000,000+ 站点**；咨询带 **30 天提分保证**；FileSeal 案例：**零 AI 引用 → ChatGPT 品类第一，超过 DocuSign**，附可验证的 ChatGPT 分享链接 | 🟢 一手（官网定价页 + 案例页） |
| MapGroww（freelancer 案例） | 免费可嵌入 widget → 免费 Local Search Audit → 付费 retainer | 60 天 22 次扫描 → 8 次电话 → **4 个 retainer → $9.4K 新增 MRR**；lead-to-call 从 3% → 36% | 🟡 二手（厂商自述） |
| Khoi Pro（越南 agency） | 免费 2 小时站点审计 | **审计→付费转化 25%**，单项目 **$1,500–$3,000**，50 个客户里 8 个来自审计 | 🟡 二手（agency 自述） |
| Arvow（free tool lead magnet） | 免费 Chrome 扩展做 on-page 评分 → 底部推付费产品 | 303 用户（早期）；模式说明：*"Most business owners who read a complete set of instructions still won't do the work themselves"* | 🟡 二手 |

**⚠️ 反证与警示**

1. **贱卖（已做 scope 折算，口径由 monetization-analyst 修正）**：

   | | **GeoScore Fix Pack $49** | **SearchScore Foundations £950（≈$1,269，£1≈$1.334）** |
   |---|---|---|
   | llms.txt | 按真实目录重建 | AI crawler access + llms.txt |
   | robots.txt | AI 爬虫规则 | 同 |
   | **schema** | **单 SKU Product schema** | **站点级 Organization / Service / FAQ / Person 多类型** |
   | Quotable answer blocks | 无 | **有**（官网称「Fewer than 1 in 100 businesses publish these」）|
   | 技术 SEO | 无 | canonicals / sitemap / Core Web Vitals |
   | 转化基础 | 无 | 信任信号 / 首屏联系方式 / 获客 |
   | 复审 | 部署后复审 | — |
   | 附赠 | 无 | **3 个月 Tracker** |
   | 交付周期 | **48 小时** | **15 个工作日** |

   - ❌ 粗算「$49 vs £950 = 19–26 倍」**口径不一致**（范围不可比），已弃用。
   - ✅ **准确表述：范围调整后（站点级多类型 schema vs 单 SKU，差约 5–8 倍；15 工作日 vs 48 小时；含 3 个月 Tracker vs 无），剩余真正的定价折让约为 3–4 倍。**
   - ⚠️ 即使按 3–4 倍，$49 在扣除 Fiverr 约 20% 抽成后净 $36–38，仍是不可持续的单价。

2. **✅ 采纳 monetization-analyst 的更正：问题不在「卖多少钱」，在「卖给谁」。**
   他指出：**$49 卖的从来不是那三个文件，而是「按真实目录重建 + 对照线上 robots.txt/schema 人工核对 + 部署后复审」三项人工工作**（站方页面原话：「你付的是目录工作、核对工作和验证，不是三个聊天机器人都能起草的文件」）。
   **我原建议「DIY 包 $0–19，三个文件不该卖 $49」的后半句被推翻——$49 应该保留，问题在于渠道和买家。**

   同一份交付物，渠道决定收入：

   | 渠道 | 成交价 | 抽成 | 净收 | 倍数 |
   |---|---|---|---|---|
   | Fiverr Custom Offer（当前）| $49 | ~20% | **$36–38** | 1× |
   | 自有站点 Creem 结账 + discovery call（建议）| **$249** | ~4.4% | **$237** | **6.2×** |

3. **交付渠道削弱溢价**：Fiverr 的心智是「低价接单」，与「GEO 咨询顾问」定位冲突。SearchScore 走自家 `/book/?offer=foundations` 预约 discovery call。

4. **免费审计本身不稀缺**：Ahrefs 免费送 AI Visibility Checker；Otterly 送 5 个免费 GEO 工具；SearchScore 免费审计不查引擎（和我们一样）。**「免费审计」是入场券，不是护城河。**

5. 🔴 **「30 天提分保证」不能照抄（与 monetization-analyst 联署风险提示）**

   SearchScore 官网原文（一手）：
   > **"We guarantee your GEO, SEO and CRO scores all improve within 30 days, or we work for free until they do."**

   适用范围：仅 **Foundations 与 Blueprint** 两个一次性包；Growth Service 写的是 *"Keeps the guarantee if you arrived via Foundations or Blueprint"*。

   **关键观察：竞品自己已经把保证边界限定在「自家三个分数」上——它承诺的是「GEO/SEO/CRO scores」，不是「AI 引擎引用你」或「流量提升」。**

   **MA 指出的循环论证风险成立**：GeoScore 自己就是评分引擎的拥有者，部署的修复手段恰好就是它自家 11 维评分所测量的维度。「保证你的 GeoScore 分数会涨」本质上是自指的。
   **建议限定语（照抄竞品的边界结构）**：
   - ✅ 可以说：「保证 GeoScore 自家 11 维分数提升」
   - ❌ 不可以说：「保证 AI 引擎引用你」或「保证流量提升」
   - ✅ 必须加：「分数由 GeoScore 自家方法论计算，不代表任何第三方 AI 引擎的行为」
   - ⚠️ 否则与站方自己承认「97% llms.txt 零请求」的诚实立场直接打架，会反噬 §4 判断 4 依赖的「中立性」资产。

**结论（已修订）**
- ✅ **模式成立，赛道内已有完整验证（SearchScore）**。
- ⚠️ **问题不是「$49 太便宜」，是「$49 卖给了 Fiverr 比价买家」**——渠道决定单价，不是定价表决定单价。
- 🎯 **修订后的建议：加一层，不是涨一层**
  - **保留 $49**（进门产品，用来产出 before/after 案例）
  - **新增 $249 定制落地包，走 discovery call + 自有站点 Creem 结账**（净收 6.2 倍）
  - ❌ **不建议直接把 $49 提到 $299**：当前 0 线索、83 会话/月、无销售动线，$299 需要 discovery call + 信任 + 提案，14 天内必然 0 单，会误触发「路径不成立」的错误结论——真实原因只是价格跳太快。

---

### 判断 3.5：赛道还有一个被忽略的空白，恰好是我们的位置

【二手】openlens（2026）在对比 Otterly 与 AthenaHQ 时指出两者的共同缺陷：
> *"both tell you, in clean detail, **where you appear** in AI answers, and **neither reliably steps you through why a model skips you or what to change on your site to fix it**."*

**这条独立观察与我的功能矩阵结论互相印证**：赛道主流产品全部集中在「**你在哪里出现**」（监测层），而「**为什么 AI 不引用你、该改什么**」（诊断/执行层）是普遍缺口。

**但必须诚实指出两个限制**：
1. **这个位置不是没人在做**——SearchScore（£950/£1,500 咨询 + 30 天保证）、Otterly（Recommendations + GEO audit + 16 类建议）、Peec（Recommended actions + Gap analysis）、Rankscale（Scout recommendations）**都在往执行层走**。区别在于它们把执行层做成**咨询/建议**，而不是**可自动化的诊断**。
2. **我们目前也没真正占住这个位置**——我们有 11 维度诊断，但缺「AI 引擎实际怎么看你」这一半证据链。**完整的诊断需要「站点信号」+「引擎回答」两侧数据，我们只有一侧。**

→ **准确的定位表述**：我们的机会不是「从零开辟诊断层」，而是**「用站点侧信号把别人只做咨询的执行层产品化」**。这仍是独立站能做的事，但需要承认 GeoReady 已经在做非常接近的事（§5.5）。

---

### 判断 4：个人独立站做到「行业标杆」的现实路径是什么？

**答：拼功能不可能，拼数据资产不可能，唯一有同行验证过的路径是「公开基准数据集 + 开源方法论」做成被引用资产。有条件能。**

**逐条排除**

| 路径 | 可行性 | 证据 |
|---|---|---|
| **拼功能** | ❌ 不可能 | 功能矩阵里头部玩家 Rankscale / Bluefish / Profound / Scrunch 各拿 8–9 个「有」。Profound 累计融资 $334.5M。个人站的功能迭代速度永远追不上。且功能正在被商品化：API/MCP/白标正在从 Enterprise 下放到 $99–$385 档（Rankscale Pro+ $229 含 REST API、Growth $385 含白标） |
| **拼数据资产** | ❌ 不可能 | **Ahrefs 509M prompts 预构建库，历史回溯至 2025（AI Overviews 至 2024-08）**；Semrush 317M+ prompts【二手】；Profound 二手称日处理 5M+ citations。**这些是用钱和年份堆出来的，不是写代码能追的** |
| **拼价格** | ❌ 危险 | LLMrefs $79/500 prompts（$0.158/prompt）已经把单位价格打到 Otterly 的 1/12。个人站没有补贴能力参与价格战 |
| **拼内容 / 开源生态** | ✅ **唯一可行** | **Otterly 是最强证明**：完全 bootstrapped、无外部融资（7 人团队做到 $770K ARR，见 §2.3.2），却进入所有主流对比榜单第一梯队（Gartner Cool Vendor、G2/OMR 获奖），靠的是 5 个免费 GEO 工具 + 每周 2–3 篇研究文章 + GEO 邮件课程 + **28-tool MCP server + 可下载 Claude Skill** + 从数百万数据点发布的原创研究。**它的护城河是内容资产与开发者生态，不是功能** |

**GeoScore 已经拥有、但被严重低估的三项资产**

1. **公开方法论 + MIT 开源 + CLI + MCP Server**——Otterly、Peec、Profound 全都没有 **MCP Server**。
   ⚠️ **2026-10-27 修正**：GeoReady **也有 MIT 开源 CLI**，所以「开源 CLI」不再独占。**MCP Server 才是唯一仍独占的一项**（已确认 GeoReady 无 MCP），且**官网首页完全没突出它**。
2. ~~**中文支持**——赛道内几乎无人在做~~ 🔴 **已撤回，见 §3.1**。
   实测显示：中文博文仅 1 篇（英文 15 篇）、38 页面中 zh 仅 12 页，**中文内容本身就很稀薄**；且**境内 DNS 已污染 + 我们要调的引擎境内不可直连**，中文市场是一道不同的题。
   ✅ **修正后的可用表述**：我们可做的是「**面向出海/境外站点的中文界面**」——服务需要进入境外 AI 搜索的中国出海企业，而非境内市场。这个细分更窄，但真实存在且本土厂商不做。
3. 🔥 **自有基准数据集（最被浪费的一项）**：官网首页埋着一段数据——
   > *"in our own audit of **324 sites**, only **3.6%** of those publishing a robots.txt block any AI crawler … AI guidance averaged **20%** of its maximum, structured data **12%**, discovery endpoints **1%**, and E-E-A-T **32%**"*

   **这是全赛道最可能被行业引用的一组数字，因为它回答了一个所有人都在问、但没人有数据回答的问题：「到底有多少网站真的在拦 AI 爬虫？」**
   但这段数据目前只存在于首页的一个段落里，没有独立页面、没有图表、没有方法论说明、没有样本构成说明、没有时间维度、无法引用、无法更新。

**「行业标杆」的现实定义（对独立站）**

不是「功能最全」或「用户最多」，而是：**当行业里有人讨论「AI 爬虫拦截率」「llms.txt 采用率」时，引用的是 GeoScore 的数字。**
这个目标不需要融资、不需要 509M prompt 库、不需要 20 人团队。**它需要的只是把一个已经跑出来的 324 站点数据集，做成一个可引用、可复现、可持续更新的公开基准。**

---

## 5. GeoScore 位置图

### 5.1 价格带 × 功能密度坐标

```
功能密度（10 维矩阵「有」的数量）
 10 |
  9 |                    [Rankscale $99-780]  [Bluefish 议价]
  8 |        [Peec $95-495]                   [Scrunch $250]  [Ahrefs $199]
    |        [Profound 议价]                  [SearchScore £49-499]
  7 |                    [AthenaHQ $295]
    |        [LLMrefs $79]
  6 |  [Otterly $29-489]          [ZipTie $25.65-1647]
    |
  5 |                                          [Semrush $238.95 真实起步]
    |
  4 |
    |
  3 |
    |
  2 |  ★ GeoScore $9 ────────────────────────────────────────────┐
    |                                                             │
  1 |                                                        ← 空白带 →
    |
  0 +----+-------+----------+-----------+----------+----------+----→ 月价（USD，log）
    $0  $9     $29-50     $79-99     $189-250   $295-499   $780+
        ↑        ↑          ↑           ↑          ↑
      免费层   入门层      SMB层      团队层     专业层
     (Ahrefs  (Otterly   (LLMrefs   (Peec Pro  (AthenaHQ
      送 5     ZipTie     Peec       Scrunch    Semrush
      prompts  Rankscale  Starter)   Core)      真实起步)
               Essentials)
```

**坐标判读**

- **GeoScore 当前位置**：功能密度 2，价格 $9 —— 位于整张图的**左下角孤岛**，且与主集群之间有一条**品类鸿沟**（测量对象不同）。
- **主集群**：功能密度 6–9，价格 $79–$499。这是「AI 搜索可见度监测」的真实战场。
- **我们不在主集群里**，也不在主集群的正下方——我们在它的**左侧**（不同品类）。

### 5.2 三个空白位（按可行性排序）

**🥇 空白位 A：「可引用的公开基准数据集」（可行性最高，成本最低）** ⚠️ **已于 2026-10-27 修正，见 §5.5.3**

- **位置**：不属于上图的任何一个象限——它是一个**内容/数据资产位**，不是产品位。
- ~~**证据**：没有任何一家竞品发布过「N 个站点的 AI 就绪度分布」这类可引用的行业基准~~
- 🔴 **修正**：**GeoReady 已经发布了 2100+ 站点基准**（平均 57.6、中位 60、58% 发布 llms.txt，as of 2026-10-25），且格式比我们规范（有日期、有样本偏差声明）。**这个位置不是真空。**
- ✅ **但机会仍在，且更精确**：GeoReady 的独立基准页 **https://geoready.dev/benchmark 返回 404**——它首页挂了 "See the live benchmark" 却点不进去，且无原始数据下载、无更新节奏、无引用格式。
- **成本**：我们**已经有 324 个站点的原始数据**。缺的是把它做成独立页面 + 方法论 + 可下载原始数据 + 季度更新 + 引用格式。
- **为什么这仍是标杆位**：这是唯一一个「个人站能赢过 $334.5M 融资公司」的位置——因为**基准数据的价值来自中立性和可复现性，来自开源方比来自厂商更可信**。**我们的切入点不是「抢先」，而是「做对」。**

**🥈 ~~空白位 B：「开源 CLI + MCP 的 GEO 工具链」~~** 🔴🔴 **2026-10-27 二次修正：此位已被 Elmo 完全占据且做得更彻底，本条作废**

- ~~「MCP Server 是我们唯一的结构性技术优势，GeoReady 没有」~~
- 🔴 **Elmo（elmohq/elmo，MIT）具备**：
  | | **GeoScore** | **GeoReady** | **Elmo** |
  |---|---|---|---|
  | 开源协议 | MIT（**仅 CLI**）| MIT（**仅 CLI**）| **MIT（全平台）** |
  | 自托管 | ❌ | ❌ | ✅ **Docker Compose，自持 PostgreSQL** |
  | 自托管价格 | — | — | **$0，无限 prompts，全部引擎** |
  | CLI | ✅ | ✅ | ✅ `@elmohq/cli` |
  | **MCP Server** | ✅ | ❌ | ✅ **且支持 Claude Code / Cursor / Codex / VS Code** |
  | REST API | Coming Soon | ✅（Pro $19）| ✅ **+ TypeScript/Python SDK** |
  | 指标可审计 | 部分 | 部分 | ✅ **评分代码公开，可重新推导任何指标** |
  | 数据归属 | 厂商托管 | 厂商托管 | ✅ **用户自有 PostgreSQL** |
  | 真实引擎查询 | ❌ **模拟** | ⚠️ 仅 Perplexity | ✅ **抓取真实消费级界面 + 直连 API with web search** |

- **→ 在「开源可编程」这条路上，Elmo 比我们和 GeoReady 都彻底得多。我们唯一剩下的相对优势只有中文界面与 11 维度检查项数量。**
- **本条空白位作废。** 任何基于「我们是唯一开源 GEO 工具」的叙事都必须停止。

**⚠️ 连带影响：赛道价格地板已被打穿至 $0**
Elmo 自托管 = **$0 + 无限 prompts + 全部引擎**。这意味着：
- 「我们 $9 处在价格带下方之外」这个说法还不够准确
- **准确说法：赛道价格带的下端是 $0（Elmo 自托管），不是一个正数。** 我们 $9 的竞争对手是一个免费、无限量、功能更全的开源替代品。

> **📌 三方独立印证**：本报告的 §4.2.1「$9 对标的是免费不是 $29」、MA 的「规模锁死」、oss-analyst 的「带最下端是 $0」——**三个独立信源从不同路径得出同一结论。** 这条现在是本报告证据强度最高的判断之一。

- **位置**：功能矩阵之外的一个维度——**可编程性**。
- **证据**：13 家竞品里，**只有 GeoScore 有 CLI + MCP Server**，且 MIT 开源。赛道的 MCP 化正在发生（Otterly 有 MCP access、Peec 有 MCP、Rankscale 有 MCP、ZipTie 有 MCP +$10/mo、Scrunch Enterprise 有 MCP），但**全部是「连我的 SaaS」模式，没有一家是「开源自托管」模式**。
- **机会**：在 AI agent 大量接入 MCP 的 2026 年，「能被 agent 直接调用的开源 GEO 审计器」是一个还没人占的位置。

**🥉 空白位 C：「$49–$99 的真实引擎查询 + 开源审计二合一」（有风险，需先算清成本）**

- **位置**：主集群的左下缺口。LLMrefs $79/500 prompts 已经占了最低价，但它**没有站点审计、没有开源、没有 MCP**。
- **风险**：真实查询的边际成本 $0.0087–$0.08/次。$49/月若给 500 prompts × 4 引擎 × 30 天 = 60,000 answers/月，按 $0.01 算就是 $600 成本。**必须严格限量**（例如 50 prompts × 4 引擎 × 每周 = 800 answers/月 ≈ $8–$64 成本）。
- **判断**：**可以做，但必须等 A 和 B 先跑出流量**。现在做等于拿 $9 的毛利去补贴 $29 的成本。

---

## 5.5 ⭐ 专题：GeoReady —— 我们官网自己点名的对标物，比我们想的强得多

GeoScore 定价页 FAQ 原文：*"GeoReady charges $9-89/month for similar monitoring features."*
**这句话有两个事实错误，且低估了对手。**

### 5.5.1 一手事实（https://geoready.dev/pricing，2026-10-27 01:35 CST）

| 档位 | 价格 | 域名 | 频次 | 历史 | AI 引擎查询 | 其他 |
|---|---|---|---|---|---|---|
| Free | **$0** | 单 URL | 按需 5 次/天 | — | **每周 1 次 Perplexity（需注册）** | 9 类 + 47 项 citability checks · CLI（MIT，`geo-optimizer-skill`，含 `geo track`/`geo monitor`）|
| **Pro** | **$19**（founding，之后 **$29**） | **10** | 周 | 30 次审计 | **每天 3 次 Perplexity 自动查询** | 回归告警（≥5 分）· PDF · **API（Bearer token）** |
| **Agency** | **$89**（founding，之后 **$199**） | **50** | 日 | **24 个月** | 每天 3 次 · **AI answer snapshots**（Perplexity 自动；ChatGPT/Google 手动粘贴） | **竞品对比** · 团队 workspace · 无限批量审计 · 去品牌 PDF · 引用质量评分 |
| Enterprise | Custom | 无限 | 小时 | — | — | SLA · 本地部署 · Webhooks/Slack/CMS |

**🔴 事实错误 1**：GeoScore FAQ 说「$9–89/月」，实测**最低付费档是 $19**（Free 是 $0，没有 $9 档）。**我们在自己的官网上低报了竞品价格 $10。**
**🔴 事实错误 2**：漏了 founding price 到期后的真实价格 **$29 / $199**。GeoReady 的正常价 **Agency $199** 比我们 Agency $59 高 3.4 倍。

### 5.5.2 正面硬碰硬对比

| 维度 | **GeoScore** | **GeoReady** | 谁赢 |
|---|---|---|---|
| 免费审计 | 11 维度 85 检查，免登录 | 9 类 47 项 citability checks，免注册，**每周 1 次真实 Perplexity 查询** | **GeoReady**（免费层就给真实查询）|
| 开源 | MIT + CLI + **MCP Server** | MIT + CLI（**无 MCP**） | **GeoScore** ✅ |
| 中文支持 | 有 | 无 | **GeoScore** ✅ |
| 入门档价格 | **$9**（5 域名） | $19（10 域名） | **GeoScore** ✅ |
| **每域名月单价** | **$1.80** | **$1.90** | GeoScore（微弱）|
| 高端档每域名 | $59 ÷ 50 = **$1.18**（**Coming Soon**） | $89 ÷ 50 = **$1.78**（**已上线**） | ⚠️ **口径不可比**（我们未上线）|
| **真实 AI 引擎查询** | **无（全档模拟）** | **Pro $19 起，3 次/天 Perplexity** | **GeoReady** 🔴 |
| **竞品对比** | Studio $29（**Coming Soon**） | Agency $89 **已上线** | **GeoReady** 🔴 |
| **API** | Studio $29（**Coming Soon**） | **Pro $19 已上线** | **GeoReady** 🔴 |
| 白标 | Agency $59（**Coming Soon**） | 去品牌 PDF **已上线**；自定义 logo = roadmap | **GeoReady** 🔴 |
| 历史 | 30 天（Pro）/ 12 月（Studio, Soon） | 30 次审计 / **24 个月（Agency）** | **GeoReady** 🔴 |
| 检查项数量 | **85 项 / 11 维度** | 47 项 citability / 9 类 | **GeoScore** ✅ |
| AI 爬虫覆盖 | **20 个** | **27 个** | **GeoReady** |
| prompt injection 检测 | **有** | 有 | 平 |
| 方法论背书 | 自有 11 维度 | **Princeton KDD 2024（arXiv:2311.09735）+ AutoGEO（arXiv:2510.11438）** | **GeoReady**（学术背书更强）|

**结论**：GeoReady 在 **6 个维度上领先，其中 4 个是「它已上线、我们 Coming Soon」**。它只有 3 项落后我们（开源 MCP、中文、检查项数量/入门价）。

### 5.5.3 🚨 最重要的发现：它已经占了「公开基准数据集」这个位置，但没做好

GeoReady 首页发布了自己的基准（一手抓取）：
> *"We measured the sites scored through GeoReady, and our data shows the average scores **57.6 out of 100**, with a median of **60**. Only **58%** publish an llms.txt file. … **GeoReady benchmark, 2100+ audited sites, as of 25 October 2026**. Latest audit per domain, aggregates only. The sample is self-selected, so read it as a baseline among sites that chose to measure. **See the live benchmark.**"*

**对比我们的数据**：GeoScore 是 **324 站点**（AI guidance 均值 20%、structured data 12%、discovery endpoints 1%、E-E-A-T 32%、3.6% robots.txt 拦 AI 爬虫）。

| | **GeoScore** | **GeoReady** |
|---|---|---|
| 样本量 | **324** | **2100+（6.5 倍）** |
| 发布形式 | 首页一段文字 | 首页卡片 + 独立基准页链接 |
| 标注日期 | **无** | **有**（as of 25 October 2026）|
| 样本偏差声明 | **无** | **有**（"self-selected… read it as a baseline among sites that chose to measure"）|
| 可引用性 | 低 | 中 |
| 独立页面 | **无** | 有，**但 https://geoready.dev/benchmark 返回 404** 🔴 |

**这修正了我 §5.2 的判断**：「公开基准数据集」**不是无人占领的空白位**——GeoReady 已经占了，且做得比我们规范（有日期、有偏差声明、样本大 6.5 倍）。
**但它自己把这件事做砸了：基准页链接是 404。** 首页挂了 "See the live benchmark" 却点不进去。

**修正后的机会定义**（比原判断更精确）：
- ❌ 原判断：「全赛道无人做公开基准，我们做就能占」
- ✅ 修正判断：**「有人做了但没做成」**。GeoReady 证明了需求真实，同时暴露了执行缺口（链接 404、无原始数据下载、无更新节奏、无引用格式）。**我们的机会不在「抢先」，而在「做对」——可下载原始数据 + 季度更新节奏 + 明确引用格式 + 样本构成披露。**

### 5.5.4 另一个信号：GeoReady 有 Rankscale 对比页

GeoReady 首页写了 *"Comparing paid trackers? The RankScale alternative page sets one of them next to GeoReady, with sources."*

**这说明 GeoReady 已经在做竞品对比页 SEO**——和 Otterly 的打法一样。**我们目前没有任何竞品对比页。**

---

## 5.6 🚨 专题：Elmo —— 本轮最重大发现，它摧毁了「开源独占位」

> 由 oss-analyst 在查开源生态时发现，我做了官网 + GitHub README 一手核实（2026-10-27 01:48 CST）。

### 5.6.1 Elmo 是什么

**MIT 开源、可自托管的 AI 可见度追踪平台**（GitHub: `elmohq/elmo`，TypeScript + PostgreSQL + Docker Compose）。

官网定位原话：
> *"It's a **free alternative to tools like Profound, Peec, and Otterly**. You can run it on your own infrastructure, own your data, and audit exactly how every metric is calculated."*

### 5.6.2 一手事实

| 档位 | 价格 | 包含量 |
|---|---|---|
| **Self-Hosted** | **$0** | **无限 prompts · 全部引擎 · 完整源码** · 引用分析 · 竞品追踪 |
| Cloud Starter | **$29/mo** | 1 brand · 50 prompts · **仅 ChatGPT** · 每日 1 次 |
| Cloud Basic | **$99/mo** | 1 brand · 50 prompts · **任选 4 平台** · **每日 4 次** |
| Cloud Pro | **$299/mo** | 2 brands · 150 prompts · 任选 4 平台 · 每日 4 次 · 20 premium prompts |
| Cloud Business | **$649/mo** | 5 brands · 350 prompts · 任选 4 平台 · 每日 4 次 · 30 premium prompts |
| White-label | Custom | Cloud 全部 + 自定义品牌 + 自定义域名 + SSO |

**每档均含：无限席位 + API + MCP access。**

**技术能力（全部一手）**：
- **真实引擎查询**：*"Consumer products like ChatGPT and Google AI Mode are **scraped from the real interface your customers see, not approximated through an API**."* —— 抓取真实消费级界面 + 直连模型 API with web search
- **引擎覆盖 12 个**：ChatGPT / Claude / Gemini / Perplexity / AI Overviews / AI Mode / Copilot / Grok / DeepSeek / Mistral / Qwen / OpenRouter
- **存原始引擎输出**：*"Everything is stored in PostgreSQL, **including the raw engine output**, so any metric can be re-derived and audited later."*
- **CLI + REST API + TypeScript/Python SDK + MCP server**（支持 Claude Code / Cursor / Codex / VS Code）
- **指标可审计**：评分代码公开
- **数据归属用户**：自持 PostgreSQL，无厂商锁定

### 5.6.3 🔴 三重冲击

**冲击 1：「开源可编程」不再是我们的位置**
见 §5.2 空白位 B（已作废）。Elmo 在开源这条路上比我们彻底：我们只开源了 CLI，它开源了整个平台；我们 SaaS 托管数据，它让用户自持 PostgreSQL；我们 MCP 只是"有"，它的 MCP 明确支持四大 AI 编码工具。

**冲击 2：赛道价格地板打穿至 $0**
Elmo 自托管 = **$0 + 无限 prompts + 全部引擎**。我们 $9 的对手不是 $29，是 **$0**。

**冲击 3：内容资产打法已是标配，不是差异化**
Elmo 维护 **100+ AEO/GEO 工具目录 + 竞品对比表**；GeoReady 有 "RankScale alternative" 页；Otterly 靠 SEO 内容成为 bootstrapped 头部。
→ **三个独立玩家都在用「目录/对比页 + 研究内容」这一招。我此前把「公开基准数据集」当作无人占领的空白位，严重高估了它的稀缺性。**

### 5.6.4 🔵 但它也给了我们一条宝贵的公开成本数据

GitHub README 原文：
> *"Jev costs very roughly **$0.15–0.35 per 1,000 answers**: about **$2–4 a month for 25 prompts on 3 platforms**, or **$11–26 for 100 prompts on 5**."*

**这是全赛道唯一公开的一手成本数据**（$0.00015–$0.00035/answer）。

⚠️ **但必须注意口径**：这是**「判定/打分」（Jev judges mentions and sentiment）的成本，不含引擎查询/检索本身**。
→ **正好印证 site-health-auditor 的提醒**：06 号文档的 $0.00015–0.00035 只含判定，不含带 web search 的检索。**引用这组数字时必须带这个限定，否则会严重低估真实查询成本。**

### 5.6.5 ⚠️ 一处官网不一致（影响可信度）

| 来源 | Cloud 档位状态 |
|---|---|
| elmohq.com/aeo-for/enterprise | **已上线**，完整列出 Starter $29 / Basic $99 / Pro $299 / Business $649 |
| elmohq.com（myviralbucket 引用版本）| **"Coming Soon"**，仅列 Self-Hosted 与 White-label |

→ 判断：Cloud 是**近期刚上线**，官网存在版本不一致。**引用档位价格时以 `/aeo-for/enterprise` 页为准，并标注抓取日期。**

### 5.6.6 对 GeoScore 的净影响

| 我们原以为的资产 | Elmo 出现后 |
|---|---|
| MIT 开源 | ⚠️ 已有两家（GeoReady、Elmo），且 Elmo 更彻底 |
| CLI | ⚠️ 三家都有 |
| **MCP Server** | ❌ **Elmo 也有，且支持面更广** |
| 中文界面 | ✅ **仍然独占**（Elmo/GeoReady 均无）|
| 11 维度 99 项检查 | ✅ 仍领先（Elmo 侧重引擎侧，不做站点信号审计）|
| 站点侧审计（非引擎侧）| ✅ **Elmo 不做这个**（它只做引擎可见度，不做站点信号/llms.txt/schema 审计）|

**→ 唯一的净好消息**：Elmo 与 GeoScore **不在同一个细分**——它做的是**引擎侧可见度追踪**，我们做的是**站点侧就绪度审计**。它不检查 llms.txt、schema、robots.txt。
**这再次印证 §4 判断 3.5 的定位表述：我们的位置是「站点侧诊断」，不是「引擎侧监测」。但必须承认，这条路上已经有 GeoReady 在跑，而我们连引擎侧的一半数据都没有。**

---

## 6. 「能不能做行业标杆」的证据化结论

### 结论：**有条件能。**

**不能的部分（有证据）**
- ❌ 在「AI 搜索可见度监测」这个品类里做标杆：**不能**。功能密度差 4–7 项（我们 2 项 vs Rankscale/Bluefish 9 项），数据资产差 3 个数量级（我们 0 vs Ahrefs 509M prompts），资金差无限大（我们 $0 vs Profound $334.5M）。
- ❌ 在「价格」上做标杆：**不能**。LLMrefs 已经把单位价打到 $0.158/prompt，且它有 500 prompts × 11 引擎 × 无限域名的规模。

**能的部分（有证据）**
- ✅ 在「**站点侧 AI 就绪度的公开基准**」上做标杆：**能**。因为全赛道无人在做，而我们**已经拥有原始数据（324 站点）**。这个位置的价值不来自资金，来自**中立性 + 可复现性 + 开源**，这三点恰恰是独立站相对厂商的结构性优势。
- ✅ 在「**开源可编程 GEO 工具链**」上做标杆：**能**。13 家竞品无一家有开源 CLI + MCP Server。

**条件（三条，缺一不可）**

1. **停止把「AI 可见度」当作核心叙事，改为把「站点侧 AI 就绪度基准」当作核心叙事。**
   现在官网把「LLM 模拟的 AI visibility estimate」放在 Pro 档卖点里，并自己标注「not live engine traffic」——这是在拿自己的短处对标别人的长处。改成：「我们不猜 AI 怎么看你，我们量你的站点有没有被 AI 读懂的资格，并告诉你行业平均是多少。」

2. **把 324 站点数据集做成独立、可引用、可复现、可持续更新的公开基准页面。**
   需要：样本构成（行业/规模/地域分布）+ 方法论 + 11 个维度的分布图表 + 季度更新 + **可下载原始数据** + **明确的引用格式** + **标注统计日期与样本偏差**。
   ⚠️ **修正**：这个位置**不是空白**——GeoReady 已经用 **2100+ 站点**占了，且格式比我们规范（有日期、有偏差声明）。**但它的独立基准页是 404**（§5.5.3）。
   **所以我们的目标不是「抢先发布」，而是「做对它没做完的部分」**：可下载原始数据 + 更新节奏 + 引用格式 + 页面不挂。**这仍是唯一一个个人站能赢过融资公司的位置，因为基准的价值来自中立性与可复现性。**

3. **把变现点从「$49 一次性修复包」上移到「$199–$499 的 done-for-you + 认证」。**
   竞品 SearchScore 用 £950–£1,500 + 30 天保证验证了这条价格带能成交。我们现在的 $49 是在用人工交付补贴一个本该自动化的产物。

**验证指标（建议 90 天）**
- 公开基准页是否被第三方（博客/新闻/竞品内容）引用 ≥ 3 次
- GitHub star / MCP Server 调用量是否进入 GEO 品类可见前 5
- done-for-you 包客单价是否从 $49 提升到 ≥ $199，且月成交 ≥ 5 单

---

## 7. 数据源清单与抓取失败记录

### 7.1 一手抓取成功（官网定价/产品页，🟢）

| 竞品 | URL | HTTP | 抓取时间(CST) | 方式 |
|---|---|---|---|---|
| Otterly.ai | https://otterly.ai/pricing | 200 | 2026-10-27 01:05 | WebFetch（含月付/年付两个 tab） |
| Peec AI | https://peec.ai/pricing | 200 | 2026-10-27 01:05 | WebFetch（含完整 feature comparison 表） |
| LLMrefs | https://llmrefs.com/pricing | 200 | 2026-10-27 01:05 | WebFetch |
| Profound | https://www.tryprofound.com/pricing | 200 | 2026-10-27 01:06 | WebFetch |
| SearchScore.io | https://searchscore.io/pricing | 200 | 2026-10-27 01:06 | WebFetch（含咨询三条线） |
| AthenaHQ | https://athenahq.ai/pricing | 200 | 2026-10-27 01:06 | WebFetch |
| Scrunch AI | https://www.scrunchai.com/pricing | 200 | 2026-10-27 01:06 | WebFetch |
| Rankscale | https://rankscale.ai/pricing | 200 | 2026-10-27 01:07 | WebFetch |
| ZipTie | https://ziptie.ai/pricing | 200 | 2026-10-27 01:07 | WebFetch（含交互式价格计算器输出） |
| Ahrefs Brand Radar | https://ahrefs.com/brand-radar | 200 | 2026-10-27 01:08 | WebFetch |
| Semrush AI Visibility Toolkit | https://www.semrush.com/kb/1493-ai-visibility-toolkit | 200 | 2026-10-27 01:08 | WebSearch → 官方 KB |
| Bluefish AI | https://www.bluefishai.com/ | 200 | 2026-10-27 01:08 | WebFetch（无定价页，/pricing = 404） |
| Goodie AI | https://goodie.ai/ | 200 | 2026-10-27 01:09 | curl + WebFetch |
| **Adobe 10-Q（Semrush 收购金额）** | https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/adbe-10q-q326-final.pdf | 200 | 2026-10-27 01:09 | WebSearch → SEC 原始文件 |
| **Sitecore 新闻稿（Scrunch 收购）** | https://www.sitecore.com/.../2026/06/sitecore-acquires-scrunch... | 200 | 2026-10-27 01:09 | WebSearch → 官方新闻稿 |
| **GeoScore（我方）** | https://geoscore.help/ 、/pricing/ | 200 | 2026-10-27 01:12 | WebFetch |
| **GeoReady** ⭐ | https://geoready.dev/pricing | 200 | 2026-10-27 01:35 | WebFetch（含完整 feature comparison 表与 FAQ）|
| **GeoReady 首页（基准数据）** | https://geoready.dev/ | 200 | 2026-10-27 01:35 | WebSearch → 官网首页 |
| **BotView** | https://botview.app/pricing | 200 | 2026-10-27 01:36 | WebFetch |
| **AEO Vision** | https://aeovision.com/pricing | 200（GoDaddy 出售页）| 2026-10-27 01:36 | WebFetch |

### 7.2 抓取失败 / 受限记录（🔴，未猜测任何数字）

| 目标 | 失败原因 | 处理 |
|---|---|---|
| **Goodie AI 定价页** | https://www.goodie.ai/pricing 与 /pricing/ 均返回 **HTTP 000**（代理超时/被拦）；首页 200 但内容为 **Spaceship 域名出售页**（标题 *"goodie.ai for sale"*，$150,000，最低报价字段 $20,000） | **如实记录为「产品已退出，域名挂牌出售」**，未猜测任何历史价格 |
| **Bluefish AI 定价** | https://www.bluefishai.com/pricing 与 https://bluefishai.com/pricing 均 **HTTP 404**；首页无价格（`$13M` 为营销数字「projected business value」，`$446%` 为 ROI 宣传） | 记为 **不可比 / Contact sales only** |
| **Semrush AI Toolkit 官方定价页** | https://www.semrush.com/ai-toolkit/ 返回 **HTTP 404**（页面已下线或改路径） | 改用官方 KB 文档；底层计划价格（$139.95/$249.95/$499.95）标为【二手】 |
| **Peec AI 原始 HTML** | curl 直取返回 200 但**内容为 JS 渲染，HTML 内无价格**（grep 无结果） | 改用 WebFetch（渲染后）获取；**币种差异无法用 curl 复验** |
| **Peec AI / LLMrefs 的 EUR 版本** | 无法通过代理切换地理出口验证 EUR 报价 | ⚠️ **遗留问题**：无法判定 €85→$95 是涨价还是切币种，需欧洲出口 IP 复核 |
| **GeoReady 基准页** | https://geoready.dev/benchmark 返回 **HTTP 404**（首页有 "See the live benchmark" 链接但目标页不存在） | 首页基准数据（2100+ 站点 / 平均 57.6 / 中位 60 / 58% llms.txt）为**二手于其官网首页自述**；**独立基准页无法核实** |
| **AEO Vision 定价** | 域名在 GoDaddy 挂牌出售 $2,888，产品站不存在 | 🔴 如实记为**产品已退出**；monetization-analyst 提供的「AEO Vision Lite $9/mo」来自 2026-07-03 第三方聚合页，**已失效，不采用** |

### 7.3 【二手】来源清单（已全部在正文标注）

| 来源 | 用途 | 可信度评估 |
|---|---|---|
| Adobe 2026 Q3 Form 10-Q（SEC） | Semrush 收购金额 $1.87B | 🟢 **一手**（SEC 备案） |
| Sitecore 官方新闻稿 2026-06-03 | Scrunch 收购事实 | 🟢 **一手**（交易）；金额 🟡 二手（彭博，双方未证实） |
| guptadeepak.com/geo-compass/investors | 各厂商融资总额 | 🟡 二手（编者自述「compiled from public reporting」，且自述 Otterly 融资无法从一手核实） |
| searchengineworld.com | Profound Series D、Peec 融资、Scrunch→Sitecore | 🟡 二手 |
| ayzeo.com/comparisons | Profound/Peec/Bluefish 融资核对；Peec「€70/mo billed annually」 | 🟡 二手 ⚠️ **与官网 $95/mo 冲突**，已在正文以官网为准 |
| scrunch.com/blog（竞品自述） | Peec $105.25/$235.34、AthenaHQ 3,500 credits、Scrunch Agency Core $500 | 🟡 二手，**且是竞争对手撰写的对比文，存在偏向** |
| rankability.com | Semrush AIVT 底层计划价格、模拟 prompt 质疑 | 🟡 二手 |
| surferstack.com | 各家历史数据保留期（Profound all time / Scrunch API 90 天 / Rankscale API 90 天 / Ahrefs 回溯 2024-08） | 🟡 二手，且与 metehan.ai（Peec 12 个月）和 analytics-agent.app（Peec Starter 30 天）**互相冲突** → **历史保留期口径不可靠，未在功能矩阵中给确定值** |
| metehan.ai / analytics-agent.app | 历史保留期 | 🟡 二手，三者互相冲突，已标注 |
| mapgroww.com / khoipro.com / arvow.com | 免费审计转化案例 | 🟡 二手，**全部为厂商/agency 自述，无第三方审计** |
| **otterly.ai/blog（官方博客）** | **路线 A 的关键证据**：*"Real web-interface monitoring. OtterlyAI queries the actual AI search interfaces the way a human user does, rather than hitting an API endpoint"* | 🟢 **一手**（官网自述），直接推翻「所有真实查询都按 API token 计费」的假设 |
| bestaeotools.com（2026-10-19 核对） | **Otterly 的 Claude 加购走 "Haiku via API with web search"**；bootstrapped / 7 人 / $770K ARR | 🟡 二手，但声明引自 Otterly help center；ARR 与团队数无法从一手核实 |
| openlens.com | Otterly 28-tool MCP + public API + Claude Skill + Looker connector；**「监测层普遍缺诊断层」的观察** | 🟡 二手；「缺诊断层」为**观察性结论**，但与我功能矩阵独立印证 |
| trylyra.ai | Otterly bootstrapped 与定价结构（与官网一致，$29/$189/$489） | 🟡 二手；定价部分与我 §1 一手抓取**一致**，可交叉验证 |
| **searchscore.io/pricing（30 天保证原文）** | *"We guarantee your GEO, SEO and CRO scores all improve within 30 days, or we work for free until they do."* | 🟢 **一手**（官网原文引用）|

### 7.4 证据强度自评

| 板块 | 强度 | 说明 |
|---|---|---|
| §1 一手价格事实表 | 🟢 **强** | 11/13 家直接抓到官网定价页；2 家（Bluefish/Goodie）如实记录为不可比/退出 |
| §2 统一口径折算 | 🟢 强 / 🟡 部分推导 | 价格与包含量为一手；「$/answer」中 Otterly 与 SearchScore 两行为**按官网口径反推**（已标注），非官网明示 |
| §3 功能矩阵 | 🟡 **中** | 「有」= 官网明示，可信；「部」含一定主观判断（官网未明示但存在相关功能）；**建议后续对 6 家核心竞品做注册实测复核** |
| §4 判断 1（赛道） | 🟢 **强** | 两起并购均为一手信源（SEC 10-Q / 官方新闻稿）；融资数据为二手但多源一致 |
| §4 判断 2（$9） | 🟢 **强** | 完全建立在 §1 一手价格之上，无外部依赖 |
| §4 判断 3（免费审计+修复包） | 🟡 **中** | SearchScore 为一手（官网定价页），**但其 1,000,000+ 审计站点数与 FileSeal 案例为厂商自述**；其余案例均为二手自述 |
| §4 判断 4（标杆路径） | 🟡 **中** | Otterly 的 bootstrapped 成功为二手多源一致；「公开基准数据集无人做」为**本次调研的观察性结论**（未穷尽搜索），需在 ROADMAP 中验证 |

### 7.5 遗留待办（需下一轮补）

1. **Peec / LLMrefs 的 EUR 报价复核** —— 需欧洲出口代理，确认 €85→$95 是涨价还是切币种。
2. **历史数据保留期** —— 三家二手来源互相冲突，需注册试用或直接询问销售确认 Otterly / Peec / LLMrefs / SearchScore 的真实保留期。
3. **Semrush AIVT 官方定价页** —— /ai-toolkit/ 已 404，需找新路径确认 $99/domain 与 25 vs 50 prompts 的口径。
4. **SearchScore 的 1,000,000+ 站点与 FileSeal 案例** —— 案例附了 ChatGPT 分享链接，可点击验证（本次未验证）。
5. **Ahrefs 免费层实测** —— Lite $129/月送 5 AI prompts，需确认是否需要年付、是否有其他限制。
6. 🔴 **【新增·P0·已提级为合规风险，与 monetization-analyst 联署】修 GeoScore 官网 FAQ 的事实错误** —— 定价页 FAQ 称 *"GeoReady charges $9-89/month"*，实测为 **Free $0 / Pro $19 / Agency $89**（founding price，之后 $29 / $199）。**$9 这个档位不存在**，且漏了涨价后价格。
   - **为什么提级为合规风险**：在自家定价页**点名**竞品并陈述其具体价格，属于**比较广告**性质，多数辖区要求事实陈述真实可核实。而且我们是**往「对手更便宜」的方向写错**——这既让自己显得更贵，又是可被举证的不实陈述。
   - **联署建议（competitor-analyst + monetization-analyst）**：**不要只修正数字，应改为不点名的能力对比**。在自家页面点名竞品并给出其价格本就不必要，且会持续产生维护义务（对手一改价我们就失真）。若坚持保留点名，须标注价格核对日期与来源 URL。
7. 🔴 **【新增·P0】GeoReady 的 AI 引擎查询能力需实测** —— 官网称 Pro $19 起每天 3 次 Perplexity 自动查询、Agency 有 AI answer snapshots。如果属实，**GeoReady 在功能矩阵维度 1（真实查询）上是「有」，我们仍是「无」**。需要注册验证其查询真实性（是真实 API 调用还是模拟）。
8. **【新增】GeoReady 基准页 404 的持续性** —— 建议隔周复查，若长期未修，是我们抢占该位置的时间窗口。
9. **【新增】我们缺竞品对比页** —— GeoReady 已有 "RankScale alternative" 页，Otterly 靠 SEO 内容成为 bootstrapped 头部。我们目前**没有任何竞品对比页**。
10. ⚠️ **【新增·方法论】不要把「竞品公开售价」当「行业成本」用** —— §2.3 的 $0.0087–$0.08 是**售价**不是成本，且**web 界面自动化（Otterly）与 API 调用（BotView）是两种成本模型**。任何成本推导必须先分清路线（详见 §2.3.1）。
11. **【新增】Otterly 的 ARR/团队数需一手核实** —— 「7 人 / $770K ARR」仅见于 bestaeotools 一家二手；其官网首页同时出现「30,000+」与「40,000+」两个用户数，**内容不一致，官方数字可信度打折**。
12. **【新增】验证「监测层普遍缺诊断层」这一判断** —— 目前只有 openlens 一家二手观察。若成立，这是我们最值得占的位置；需再找 2–3 个独立信源交叉验证。
13. 🔴 **【新增·重要】「中文市场」是一个需要前置澄清的陷阱** —— 境内 DNS 污染 + 我们要调的引擎境内不可直连，意味着「做中文市场」= 换一整套引擎接入（DeepSeek/豆包/元宝）+ 独立后端，**不是翻译现有产品**。任何涉及中文市场的讨论都应先过这条约束（详见 §3.1）。
14. **【新增】检查项口径统一为 99 项**（85 维度内 + 8 负面信号 + 6 提示词注入），对外对标 SearchScore「300+ signals」时用此口径，不用 85。
15. **【新增】「20 个 AI 爬虫」不得用于对外描述引擎覆盖** —— 爬虫 ≠ 答案引擎。我们答案引擎覆盖为 **0**。若对外文案曾混用，需一并修正。

---

*报告结束 · 所有价格均带抓取 URL 与时间戳 · 二手来源已逐条标注 · 抓取失败已如实记录未猜测*
