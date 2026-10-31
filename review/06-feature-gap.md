# 06 · 功能差距审计（2026-10-23 现场抓取）

> 方法：逐个打开下列产品的官网 / 定价页 / 功能页，只记录页面上读到的东西。每个单元格后面的方括号是证据编号（URL 见文末）。**抓取日期：2026-10-23**。
> 未打开的页面明确标注「未打开」，不用记忆补。

**抓取结果说明**
- `scrunch.ai` 打不开（DNS/证书层失败，两次），Scrunch 实际域名是 `scrunch.com`，已抓到首页与定价页 — [SC1][SC2]
- `semrush.com/ai-toolkit/` 返回 404；`semrush.com/ai-seo/` 只返回导航壳无正文。**修正**：真路径是 `semrush.com/pricing/ai/`，我已在 2026-10-23 亲自补抓 — [SE3]；功能页为 [SE1]
- Rankscale 的价位不止首页三档，补抓定价页后发现第四档 Enterprise $780 与 Essentials $20 — [R2]

**修订记录（v2 + v3，据 pricing-analyst / team-lead 交叉复核，2026-10-23）**
1. Semrush 由「价格未验证」改为官方实读：$99/域名/月（年付）、25 条 prompt、4 个引擎 — [SE3]
2. Rankscale「无免费层/爬虫仅审计」两处修正：Essentials $20 仅年付且 credits 为 0；**有** Cloudflare 只读接入的 AI visits（真实爬虫访问）— [R2]
3. 「$9 价位空着」改为「$9 不空，空的是 $9 的持续监测」（详见第四节第 3 条）
4. Peec 的「月度 AI 回答数」加注：那是建模展开值，不是真实 API 调用数，**不能用来算单次响应成本**
5. **（v3）「中文引擎空白」是错的** —— 中文 GEO 已相当拥挤且全企业化（¥5,000/月起），正确表述是「英文厂商不覆盖中文引擎 + 中文厂商无低价自助层」（详见第四节第 4 条）
6. **（v3）「$9 无法覆盖追踪成本」是错的** —— elmo 公开数据：判定层 ≈ $0.00015–0.00035/次回答，零售 $0.016–0.082/次，差 45–550 倍 [E1]。$9 做真实追踪在成本上成立，$29 是价格锚不是成本地板（详见第四节第 3 条）
7. **（v4）「$29 = 两个产品同时撞到 → 单位成本地板」也是过度推论** —— 同价只证明市场共识，不能反推成本；已改为「被观察到的价格锚，不是被证明的成本地板」。这条由 pricing-analyst 用 elmo 成本数据反驳，我接受。

---

## 一、能力矩阵

图例：**有 / 部分 / 无** ＋ 证据编号。空白单元格＝该页面没写，不等于产品没有。

| 产品 | 1 引擎覆盖 | 2 真调模型 | 3 提示词追踪 | 4 引用来源 | 5 竞品/SoV | 6 情感/叙事 | 7 爬虫访问 | 8 生成修复文件 | 9 涨分预估 | 10 API/MCP/集成 | 11 免费层 | 12 计费维度 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Profound** | 有 9 个：ChatGPT/Perplexity/AI Mode/Gemini/Copilot/DeepSeek/Claude/AIO/Exa [P1] | 有 每日按提示词跑 [P1] | 有 自定义＋每日，Trial 50 条 [P1] | 有 「what agents cite」＋引用衰减 [P2] | 有 Benchmarking [P2] | 有 Sentiment＋FactCheck [P2] | 有 Agent Analytics，接 Cloudflare/Akamai/Fastly/AWS/GA [P1][P2] | **部分** 改写页面并 stage 进 CMS、打开 AI 抓不到的页面；未见 llms.txt 生成 [P2] | 无 | 有 API（Enterprise）＋200+ 集成 [P1][P2] | 部分 免费 Trial 需注册，50 prompt×7 天、3 引擎、无历史无导出 [P1] | Enterprise 报价；按提示词量＋引擎数，席位不限 [P1] |
| **Otterly.AI** | 有 基础 4（ChatGPT/AIO/Perplexity/Copilot）＋Claude/AI Mode/Gemini 加购＝7 [O2] | 有 每日 tracking [O2] | 有 15 / 100 / 400 条，每日 [O2] | 有 Citation Source Tracking、Link Citations Analysis [O2] | 有 Share of Voice Metrics & KPIs [O2] | 有 Brand Sentiment [O2] | 部分 Crawlability Audit＋Agent Analytics（Standard 起 20 万事件/月）[O2] | **部分** 给「brief to fix」，未见可部署文件 [O1] | 无 | 有 API＋MCP（Standard 起）、Looker Studio [O2] | 部分 需注册；Lite 每周仅 3 条建议，含 1,000 次 URL 审计/月 [O2] | 按提示词数＋引擎加购（+$99/100 条）[O2] |
| **Peec AI** | 有 基础 6（ChatGPT/AI Mode/AIO/Copilot/Gemini/Naver AI），Enterprise 至 13 [PE2] | 有 「每条 prompt 每 24h 在每个模型跑一次」[PE1] | 有 50 / 150 / 350，每日 [PE2] | 有 Source analytics、Retrievals、Citation share、来源分类 [PE2] | 有 Visibility/Position/SoV [PE1] | 有 Sentiment＋Brand Perception（属性、异议、事实核查）[PE2] | 有 Crawlability audit 覆盖 40+ bot、AI referrals、接 Vercel/Cloudflare/AWS/CloudFront/Akamai/CSV-CLF [PE2] | **部分** Recommended actions＋Agent actions，输出动作而非文件 [PE2] | **有** 「Visibility lift predictor」[PE2] | 有 API＋MCP＋Looker Studio＋GA [PE2] | 无免费层，只有 free trial（需注册）[PE2] | 按 prompt×模型×频率的「月度 AI 回答数」＋项目数 [PE2]。**注**：页面的 4.5M/13.5M/31.5M 是建模展开值，不是「真跑了 450 万次」，**不可用来倒推单次响应成本** |
| **SearchScore** | 有 6：ChatGPT/Claude/Gemini/Perplexity/Grok/DeepSeek [S1] | 有 Tracker 每周跑 [S1] | 部分 10 条（Starter）→100 条（Enterprise）[S1] | 部分 有 AI Citability 与引用追踪，明细未展开 [S1] | 部分 首页提「和竞品比」，未见 SoV 面板 [S1] | 无（页面未见） | 有 爬虫许可审计（GPTBot/ClaudeBot/PerplexityBot）＋IndexNow [S1] | **部分** 「我们替你做」£950 一次性交付实施，只免费送 1 个 fix 作样例 [S1] | **有** 「每项修复的预估涨分＋工时估算」[S1] | 无（页面未见 API/MCP） | **有** 三个分数＋分类条免费、**不要邮箱**；详细 fix list 要邮箱 [S1] | 按扫描深度分 £49/£99/£199/£499，全部每周 [S1] |
| **AthenaHQ** | 有 11：ChatGPT/Perplexity/AIO/AI Mode/Gemini/Claude/Copilot/Grok/DeepSeek/Meta AI/Mistral [A1][A2] | 有 「1 credit = 1 次 AI 响应」[A2] | 有 Topics/Prompts 不限 [A2] | 有 Citation intelligence、ACE 引用引擎 [A2] | 有 不限竞品＋SoV [A2] | 有 实时情感＋press kit＋危机监测 [A1] | 部分 只做 robots 授权管理，未见日志级爬虫分析 [A2] | **有** 「smart robots.txt and llms.txt」动态管理＋on/off-page 动作＋内容优化 agent [A2] | 无 | 有 GA4/GSC/Shopify/Webflow/Framer＋API（加购）[A2] | 有 Essential 免费 300 credits（首页写含 5 个模型，定价页只标 gemini，页面自相矛盾）[A1][A2] | credit 制，$295/月＝3,600 credits；席位不限 [A2] |
| **Scrunch** | 有 Core 4（ChatGPT/Perplexity/AIO/Copilot），Enterprise 9（+Claude/Gemini/Meta AI/AI Mode/Grok）[SC1] | 有 5,000 responses/月 [SC1] | 有 125 条（Core）[SC1] | 有 Citations/Sources [SC1] | 部分 5 个竞品位；SoV 未在定价页明写 [SC1] | 有 Sentiment Analysis [SC1] | 有 AI Agent / Bot Traffic＋站点地图 25 页 [SC1] | **有** Page Optimizations 1 次/月＋Content Generation＋AXP 给 bot 派发优化版页面 [SC1][SC2] | 无 | 部分 MCP（Enterprise 定制）、Query API、CLI、Looker Studio（Enterprise）[SC1] | 部分 7 天试用，$250 起 [SC1] | 按 unique prompts＋responses 数 [SC1] |
| **Rankscale** | 有 17+（ChatGPT/Gemini/Perplexity/Claude/DeepSeek/Mistral/Grok/Copilot…）[R2] | 有 8 种频率，小时级到月级 [R2] | 有 搜索词不限，执行按 credit（**单次查询约 0.25 credit**）[R2] | 有 Citations analysis（含权威度）+ Sources box analysis [R2] | 有 Competitor benchmarking + Local/Shopping/Ad 分析 [R2] | 有 Sentiment analysis [R2] | **有** AI visits：接 Cloudflare 只读，看 live fetch / search crawl / training crawl / 404 [R2] | **部分** Page audits 含 crawlability + Scout 建议，仍标 beta [R1] | 无 | 有 MCP（全档）+ REST API（Pro+）+ Looker Studio + 无限席位 [R2] | 无（Essentials $20/$17 **仅年付**，对比表 credits 显示 0）[R2] | credit 制：$99/1,200 → $229/3,000 → $385/5,500 → $780/12,000，折算 4,800/12,000/22,000/48,000 次回答 [R2] |
| **Semrush AI Visibility** | 有 4：ChatGPT/Google AI/Gemini/Perplexity（不含 Claude、Copilot）[SE3] | 有 25 条 prompt 每日排名 [SE3] | 有 25 条自定义，日/周/月可调 [SE3] | 无（功能页未见引用明细）[SE1] | 有 Share of voice＋Competitor Research＋Prompt Research [SE1][SE3] | 有 Brand Performance（是否准确/正面）[SE1] | 部分 AI search health audit（技术审计，非日志）[SE1] | **部分** 给「prioritized checklist of fixes」[SE1] | 无（Enterprise 才有「Forecasting & ROI attribution」）[SE3] | 有 MCP＋API（Enterprise）＋报告自动化（Base/Pro Report 加购 $10/$20）[SE1][SE3] | 部分 7 天试用；另有免注册免费检查器（3 次/天，pricing-analyst 报，我未打开）[SE1] | **$99/月/域名（年付）**，25 prompt、1 域名、300 reports/天；加购：席位 $45 起、Lead Gen $90 [SE3] |
| **Ahrefs Brand Radar** | 有 6（AIO/AI Mode/ChatGPT/Perplexity/Gemini/Copilot）＋Custom Prompts 支持 Claude＝7 [AH1] | 有 已跑 4.95 亿 prompt 建索引，Custom 每日 [AH1] | 有 5/10/20 条随套餐，或 €47 起，每日 [AH1] | 有 Citations 指标＋AI Sources（YouTube/TikTok/Reddit）[AH1] | 有 AI Share of Voice＋估算曝光 [AH1] | 部分 页面只写 mentions/citations/SoV；情感在 Letaido 技能里 [AH1] | 有 Bot Analytics（免费 beta）＋AI traffic [AH1] | 无（页面未见）[AH1] | 无 | 部分 属 Ahrefs 平台 API；本页未见 MCP [AH1] | 有 免费 AI Visibility Checker＋Bot Analytics 免费 beta [AH1] | 按 check 计（1 prompt×1 平台×1 次＝1 check，Claude 一次烧 8）[AH1] |
| **elmo（开源）** | 有 9+：ChatGPT/AI Mode/AIO/Gemini/Perplexity/Copilot/Claude/Grok/Mistral [E1] | 有 爬真实消费端＋模型 API 兜底 [E1] | 有 不限条数，默认一天多次 [E1] | 有 引用按域名/类别/位置存库 [E1] | 有 SoV 排行榜 [E1] | 有 0-100 情感＋原文段落 [E1] | 无（README 自述不做）[E1] | 无 只有 opportunities 清单 [E1] | 无 | 有 REST API＋TS/Py SDK＋MCP [E1] | **有** MIT 自托管全功能免费；Cloud $29/月起 [E1] | 自托管免费；Cloud 订阅 |
| **OneGlanse（开源）** | 部分 5 个，走真实产品网页 UI [G1] | 有 浏览器自动化在真实界面跑 prompt [G1] | 有 自定义 prompts [G1] | 有 记录 citations 与来源域名 [G1] | 有 同答案里的竞品 [G1] | 有 dashboard 有 sentiment（由你接的模型打分，非引擎返回）[G1] | 无 | 无 只有 recommendations [G1] | 无 | 无（未见 API/MCP）[G1] | **有** MIT 自托管，无订阅费，自带 key [G1] | 免费（自付模型/代理成本） |
| **GeoScore（我们）** | **无** 只审计 20 个 AI 爬虫名单，不跑任何引擎 [GS1] | **无** 静态规则；Pro 的「AI 可见度」是**模拟**答案，官网自己标注「not real engine traffic」[GS2] | **无** 没有提示词概念 [GS2] | **无** | **无** 竞品对比排在 Studio，未上线 [GS2] | **无** | 部分 robots 允许/阻断审计＋20 爬虫名单，无日志、无真实抓取记录 [GS1] | **有** llms.txt＋robots.txt＋JSON-LD 三件套自动生成，免费层就给 [GS1][GS2] | **无** 只给优先级，不给涨分预估 [GS2] | 部分 免费 CLI＋MCP Server；Pro 无 API；无 GA/GSC/CDN 接入 [GS2] | **有** 免费、不要邮箱、不要登录、URL 不上传 [GS1][GS2] | 按域名数＋频率（1/5/15/50）[GS2] |

> **读第 1 列前必读（v4）：「引擎数」在这行里是四种完全不同的东西，数字不能横着比。**
> ① **加价轴**：Otterly 基础只给 4 个，Claude / AI Mode / Gemini 要加购 [O2]；Peec 基础 3 个，加模型按档 €25/€55/€115 [PE2]
> ② **阶梯**：Geol.ai 按 4/6/8 阶梯（pricing-analyst 抓取，我未打开）
> ③ **不加价的赠品**：Rankscale 17+ 引擎全含、不做按引擎加价 [R2]
> ④ **卖点**：AthenaHQ 11 个当主打 [A1][A2]
> 所以「我们支持 X 个引擎」这句话在任何对比表里都没有意义，除非同时说清是哪种。我们对标时最容易犯的错，就是拿 Rankscale 的 17（赠品）去比 Otterly 的 4（加价轴起点）。

---

## 二、【他们有我们没有】按「买家愿不愿意为此付钱」排序

**1. 真的去跑引擎、按提示词每天跑一遍（这是全行业唯一的核心付费点）**
所有 10 个付费产品都在这上面收费，无一例外。Profound 按提示词×引擎×天卖 [P1]；Peec 明写「每条 prompt 每 24 小时在每个模型跑一次」[PE1]；AthenaHQ 的计量单位干脆就是「1 credit = 1 次 AI 响应」[A2]；Ahrefs 连 Claude 一次更新算 8 个 check 都标出来了 [AH1]。
我们的 Pro「AI 可见度估算」是模拟的，官网自己写着「simulated… not real engine traffic」[GS2]。**买家不付钱的理由最可能就是这一条**：一个不产生真实引擎响应的分数，在采购眼里是「问卷」不是「体检」。

**2. 引用来源分析：谁在替你说话，AI 到底引了哪些页面**
Profound 有 citation decay（哪些引用在衰减）[P2]；Peec 做到 domain/URL/子域级的 Retrievals 与 Citation share，还把来源分类成竞品/媒体/参考/UGC [PE2]；elmo 连引用位置都存 [E1]。这是「改哪里」的直接依据 —— 也是 Agency 愿意按月付钱的原因（能直接出客户报告）。
我们完全空白，只有站内 citationReadiness 8 分（自家页面有没有可引用的东西），与「外部谁引用了你」是两件事。

**3. 竞品对标 / Share of Voice**
Otterly 把 SoV Metrics & KPIs 做成套餐核心项 [O2]；AthenaHQ 不限竞品数 [A2]；Rankscale 自动识别竞品 [R1]；连 SearchScore 都在首页比 [S1]。
SoV 是 CMO 唯一能拿去开会的数字。我们把它排到 Studio（$29）且未上线 [GS2] —— 等于把最能卖钱的功能放在了卖不出去的档位。

**4. AI 爬虫访问的真实日志（证明 ROI）**
Profound 接 Cloudflare/Akamai/Fastly/AWS/GA 做 Agent Analytics [P1][P2]；Peec 支持 Vercel/Cloudflare/AWS/CloudFront/Akamai 与 CSV/CLF 上传 [PE2]；Ahrefs Bot Analytics 直接免费送（beta）[AH1]；连 $99 档的 Rankscale 都能用 Cloudflare 只读接入看 live fetch / search crawl / training crawl / 404 [R2] —— **说明这不是高端功能，是 $99 档的标配**。
更狠的说法（pricing-analyst 提的，我认同）：**我们卖的是「你应该能被读懂」（意图），它给的是「它真的来了没有」（事实）—— 这是能力差，不是价格差。** 而这条恰好是我们免费层讲得最响的卖点。
Arm 点在于：日志能证明「AI 真的来抓了、真的带流量了」。我们只有「robots.txt 允不允许」的静态判断 —— 这是意图，不是事实。而且注意我们首页自己写的数据：**324 个站里只有 3.6% 的 robots.txt 阻断了 AI 爬虫** [GS1]，等于我们最重的一个维度（aiCrawlability 12 分）对大多数人没有区分度。

**5. 引擎覆盖广度（尤其 Claude / Copilot / Grok / Meta AI / DeepSeek / AI Mode）**
Rankscale 17+ [R1]，AthenaHQ 11 [A1]，Profound 9 [P1]，Peec Enterprise 13 [PE2]。我们的「20 个 AI 爬虫名单」是**爬虫**不是**答案引擎** —— 这两个概念在客户脑子里经常被混为一谈，但在功能上完全不重叠。

**6. 提示词需求发现（Prompt Research / 提示词量级）**
Ahrefs 有 4.95 亿 prompt 索引并按 check 计费 [AH1]；Semrush 的 Prompt Research 是它对抗新玩家的主要武器 [SE1]；Otterly 甚至给 Query Fan Out 工具 [O2]。
这个决定「我该优化哪些问题」，是把审计变成持续订阅的入口。我们没有这个概念，用户输完网址就结束了。

---

## 三、【我们有他们没有】（认真找过的，只剩四条）

**1. 一次性同时产出三份可直接部署的文件，且免费、不登录**
`llms.txt`＋`robots.txt`＋`JSON-LD`（Organization/Article/FAQ/HowTo）[GS1][GS2]。
同行里最接近的是 **AthenaHQ**：「Dynamically manage AI crawler access with a smart robots.txt and llms.txt」[A2] —— 但它只覆盖两个文件，且要 $295/月；**SearchScore** 是人工替你实施（£950 一次性）[S1]；其余全部只给「建议/brief/checklist」。
这是真差异，但护城河很浅：AthenaHQ 补一个 JSON-LD 生成器就是一周的事。

**2. 免费层真的不要邮箱、不要登录、URL 不上传**
SearchScore 是唯一同级别的：三个分数＋分类条免费、「No email」[S1] —— 但它把「fix list＋涨分预估」锁在邮箱后面。我们连 fix list 和三份文件一起免费给 [GS2]。
这在获客上是优势，在转化上是**已知的短板**：我们没有任何「留邮箱/注册」的钩子，所以从免费到 Pro 没有任何中间台阶。（这和我们 90 天 2 次点击、付费 CTA 0 点击是同一件事的两面。）

**3. 提示词注入检测 + 负面信号扣分**
在我们打开的 11 个产品页面里，**没有一家**提到 prompt injection 检测或「负面信号」作为独立扣分维度 [P1-PE2, S1, A1-A2, SC1-SC2, R1, SE1, AH1, E1, G1]。
这是目前唯一一个「概念上领先」的点。但它现在被埋在第 11 个维度之后的扣分项里，首页没有一句话讲它 —— 如果它真是差异，应该是一个独立产品叙事（"AI 会被人为下毒，你的站被下毒了吗"），而不是一个 footnote。

**4. MIT 开源 + CLI + MCP 全免费 + 中文**
elmo 与 OneGlanse 也开源（MIT）、elmo 也有 MCP [E1][G1]，所以这条**不构成独占**；真正独占的只有「中文」这一项。GeoScore 首页明确支持中文，同行 11 个产品在我们抓到的页面上全部只有英文界面/英文市场。

---

## 四、【双方都没有】的空白区

**1. 「改完能涨多少」的可验证因果，而不是预测值**
SearchScore 给「每项修复的预估涨分＋工时」[S1]，Peec 有「Visibility lift predictor」[PE2] —— 都还是**预测**。
**自我修正（v2）**：Semrush 的 Enterprise 报价页列了「Forecasting & ROI attribution」[SE3]，所以「完全没人做归因」这句不成立。收窄后的结论是：**没有一家在这些公开页面上说明它的归因方法**（无 holdout、无对照站、无同 prompt 同模型的前后对照设计），也没有一家提供「改前/改后」的原始响应级证据。谁先把方法公开，谁就能把价格从 $99 抬到 $999。

**2. 从「审计」到「上线」的完整闭环**
Profound 最接近（改写→stage 进 CMS→人工点发布）[P2]，Scrunch 的 AXP 更进一步（给 bot 派发优化版页面）[SC2]。但没有任何一家做到「审计发现→自动生成文件→自动部署到站→自动回抓验证→自动报告」，全链无人。

**3. 低价位（<$10）的深度审计 + **持续监测**组合**
$9 这一档**不空**——Geol.ai $9/月、BotView $9/月（20 次 AI answer check + 50 次扫描）都在卖，但都靠砍「监测」来降价：Geol.ai 的 FAQ 原话是 **Free 和 Starter 不含 AI monitoring**（此两条为 pricing-analyst 2026-10-23 抓取，我本人未打开这两家页面）。
真正空的是「$10–25，含 5–10 条提示词**真实追踪**」这一档：**有真实追踪的最低价是 $29，且有两个独立锚** —— Otterly Lite $29/15 条 [O2] 与 elmo Cloud $29（**不限席位、含 API**，自托管还全免费不限 prompt）[E1]。
**但别把这个 $29 读成「成本地板」—— 这是过度推论，我原来写错、已改。** 两个独立产品同价只说明市场共识（互相看价 + $29 这个 SaaS 心理价位），不能反推成本结构：成本 $0.0002/次、零售 $0.016–0.082/次，离 $29 差得远（见下段）。准确表述是：**$29 是一个被观察到的价格锚，不是被证明的成本地板。**

**那「成本上做不到 $9」呢？数据说做得到。** elmo README 公开了判定层的单位成本：「**$0.15–0.35 per 1,000 answers**，约 $2–4/月（25 prompts × 3 平台），或 $11–26（100 prompts × 5）」[E1]，即 **≈ $0.00015–0.00035/次回答**。而市场零售价是 **$0.016–0.082/次响应（中位 ~$0.02，pricing-analyst 已按统一分母重算）**，与判定成本**差 45–550 倍**。按这个数字，$9 含 25 条 × 3 引擎的真实追踪，判定成本只有 $2–4，毛利 2–4 倍。
（保留的例外，别当定论：$2–4 **只含判定，不含带 web search 的模型检索**、不含反爬与失败重试；检索成本没有公开数字，我们也没实测。准确说法是「判定便宜得惊人，检索成本未知」。）
**所以 $9 没人做真实追踪，是价格锚定问题，不是成本问题** —— 全行业都锚在 $29 起，谁先打破谁重写对比表。这对我们是**最便宜的一张牌**：技术门槛不高、成本不拦路、缺的只是一个敢定 $9 的人。

**附带一个结构性错位（比价格更严重）**：全行业的加价轴是**提问量 / 响应量**（prompt 数、credit 数、check 数）—— Profound 按提示词量 [P1]、Otterly 按提示词数且加 100 条 +$99 [O2]、Peec 按 prompts×模型×频率 [PE2]、AthenaHQ 按 1 credit = 1 次响应 [A2]、Rankscale 按 credit [R2]、Ahrefs 按 check [AH1]。**只有我们按「域名数」分层**（1/5/15/50）。而域名与席位在这行里基本不限量（Profound 席位不限、Otterly 团队不限、Rankscale 无限席位）[P1][O2][R2]，所以我们的 Studio $29 / Agency $59 在采购眼里不是「更便宜的同类」，而是**另一个品类**。
**同一个错位的商业后果（pricing-analyst 在 08 里的推论，我认同并转引）**：用域名计价，我们的收入上限由「客户有几个站」决定（典型 3–5 个），永远碰不到「客户想问多少个问题」这个真正会涨的变量 —— 于是 **NDR（净收入留存）结构性为 0**。**计价单位错了，品类就错了。**

**4. 中文 / 非英语引擎：不是空白市场，是「英文厂商不覆盖」+「中文厂商全企业化」**
**v3 修正**：我原来写「中文引擎空白」是错的，team-lead 2026-10-23 做了独立核查，中文 GEO 监测已经相当拥挤（以下为行业媒体与二手源，**各家官网我未打开**，见文末「需补抓」）：
- 豆智 DZOS：覆盖 DeepSeek/豆包/Kimi/元宝/文心/通义等 20+ 平台，**¥5,000/月起**（**二手口径，未在官网核实**），有免费试用
- 新榜智汇 Geowise：豆包/元宝/DeepSeek/Kimi/千问/百度 AI 六大平台，宣称服务 500+ 家企业，自建「万级无污染监测节点」
- 搜极星 SouGEO：12+ 模型（国内六家 + ChatGPT/Claude/Gemini），20+ 监测指标
- 另有 ImpetaAI、森辰 GEO、凡科极鸥、百分点 Generforce、模力指数 在售
（来源：cet.com.cn、blog.sougeo.com、gitcode.csdn.net、jixiao361.com，均为 team-lead 2026-10-23 检索所得，非厂商官网）

所以**准确的说法是**：11 个英文产品里只有 Peec 列了 Naver AI（韩国）[PE2]，其余全部是 ChatGPT/Gemini/Perplexity/Copilot/Claude/Grok 这一套 —— 这是**英文厂商不覆盖中文引擎**，不是中文无人做。
真正的形态差异在价格结构：中文玩家**入门价 ≈ ¥5,000/月（约 $700），是我们的 78 倍**，且清一色销售驱动、企业合同、无自助层。
**战略含义因此从「蓝海无人」改为**：中文市场有真实需求，但被全部高价企业化；**低价自助 + 双语 + 技术审计层**是缺口 —— 缺口在价格带和形态，不在市场存在与否。

---

## 五、【一句话结论】

**差距是「方向」，不是「深度」。**

85 个检查项、11 个加权维度这套东西，论审计颗粒度我们不输任何一家 —— SearchScore 是 300+ signals，Rankscale 是 94+/200+ factors [S1][R1]，量级同档。但他们的产品是「体检 + 长期监护 + 代做手术」，我们的产品是「一次性开药方」：他们从「真实引擎响应」这一层证据往上建（提示词→引用→SoV→ROI→$99-$295/月），我们从「静态规则判断」往下建（分数→清单→三份文件→$9/月）。

**这一层证据缺位，导致整条价值链都搭不起来**：分数不可信→不敢追踪→没有 ROI 故事→客单价上不去→免费层再厚也换不到付费。所以不是把 85 项加到 200 项能解决的事；是要不要承认「我们必须真的去问一次模型」这件事。

（旁证：我们首页自己公布 324 站抽样里只有 3.6% 阻断 AI 爬虫、aiGuidance 平均只有满分的 20%、discovery 只有 1% [GS1] —— 这说明我们**知道**区分度在哪，但产品形态把这个洞察浪费在了「分数」上，而没有变成「真实答案里的位置」。）

**pricing-analyst 独立复核后给了一个更锋利的版本，我认同并采用**：在这个所有人都在卖「真实引擎响应」的品类里，我们卖的是一个不产生真实响应的估算，却用了「AI 可见度」这个名字。**$9 站不住的根因不是便宜，是不可比** —— 买家拿我们的 66 分去和 Profound 的 visibility% 并列时，两个数不在同一个坐标系里，于是连「贵不贵」都无法讨论。

---

## 证据 URL 清单（全部于 2026-10-23 打开）

| 编号 | URL | 说明 |
|---|---|---|
| [P1] | https://www.tryprofound.com/pricing | Profound 定价与套餐功能矩阵（Trial / Enterprise，9 引擎清单） |
| [P2] | https://www.tryprofound.com | Profound 首页（AI Marketer、Agent Analytics、Benchmarking、FactCheck、Sentiment、Shopping、200+ 集成） |
| [O1] | https://otterly.ai | Otterly 首页（引擎清单、Content Audit、GEO Optimization、crawlability 审计） |
| [O2] | https://otterly.ai/pricing/ | Otterly 定价（$29/$189/$489/Enterprise，API+MCP、Agent Analytics、GEO URL 审计额度） |
| [PE1] | https://peec.ai | Peec 首页（Visibility/Position/Sentiment、来源建议、MCP 上线公告） |
| [PE2] | https://peec.ai/pricing | Peec 定价与完整功能表（€85/€205/€425/Enterprise、40+ bot 审计、AI referrals、CDN 日志、Visibility lift predictor、Shopping SKU） |
| [S1] | https://searchscore.io | SearchScore 首页（300+ signals、三分数、免邮箱免费、涨分预估、6 引擎每周、£49–£499、£950 实施服务） |
| [A1] | https://athenahq.ai | AthenaHQ 首页（11+ LLM、内容优化 agent、press kit、情感） |
| [A2] | https://athenahq.ai/pricing | AthenaHQ 定价（免费 300 credits、Starter $295/3,600 credits、smart robots.txt+llms.txt、GA4/GSC、API 加购） |
| [SC1] | https://scrunch.com/pricing | Scrunch 定价（Core $250/125 prompts/4 LLM、Enterprise 9 LLM、AXP、Content Generation、MCP 定制） |
| [SC2] | https://scrunch.com/ | Scrunch 首页（AXP 定义：observe / optimize / deliver to agents） |
| [R1] | https://rankscale.ai | Rankscale 首页（17+ 引擎、Page Audits 200+ factors、$99/$229/$385、REST API、MCP） |
| [R2] | https://rankscale.ai/pricing | Rankscale 定价页（Pro $99/1,200 credits、Pro+ $229/3,000、Growth $385/5,500、Enterprise $780/12,000、Essentials $20/$17 仅年付、单次查询≈0.25 credit、Cloudflare AI visits、Local/Shopping/Ad、MCP、无限席位） |
| [SE1] | https://www.semrush.com/features/ai-visibility/ | Semrush AI visibility 功能页（Visibility Overview、Brand Performance、Competitor Research、Prompt Tracking、AI search health audit） |
| [SE3] | https://www.semrush.com/pricing/ai/ | Semrush AI Visibility 官方定价（Base $99/域名/月年付、25 prompts、300 reports/天、4 引擎、加购 $45/$90/$10/$20、Enterprise 含 ROI 归因） |
| [AH1] | https://ahrefs.com/brand-radar | Ahrefs Brand Radar（4.95 亿 prompt、6 平台+Claude、check 计费、Bot Analytics 免费 beta、免费 AI Visibility Checker） |
| [E1] | https://github.com/elmohq/elmo | elmo README（MIT、可见性/SoV/情感/引用/fan-out/opportunities、REST API+SDK+MCP、Cloud $29 起） |
| [G1] | https://github.com/oneglanse/oneglanse | OneGlanse README（MIT、5 引擎真实 UI 跑批、sentiment 由接入模型打分） |
| [GS1] | https://geoscore.help | GeoScore 首页（11 维度/85 检查/20 爬虫/三份文件/CLI+MCP、324 站抽样数据） |
| [GS2] | https://geoscore.help/pricing/ | GeoScore 定价（Free 含 fix 文件生成+CLI+MCP、Pro $9 含"模拟"AI 可见度、Studio/Agency 未上线） |

**未打开 / 失败记录**
- `https://scrunch.ai`、`https://scrunch.ai/pricing` — 抓取失败（fetch failed），改用 scrunch.com [SC1][SC2]
- `https://www.semrush.com/ai-toolkit/` — 404；`https://www.semrush.com/ai-seo/` — 只返回导航，无正文。已用 `pricing/ai/` 与 `features/ai-visibility/` 补齐 [SE3][SE1]
- `https://otterly.ai/features/geo-optimization/` — 404
- Geol.ai、BotView、AEO GEO AI — **我未打开**，其价格与功能引自 pricing-analyst 2026-10-23 的抓取，文中已标注

**需补抓（v3 追加，按价值排序）**
1. **中文竞品是否提供免费审计 / 开放 API / 自助注册** —— 豆智 DZOS、新榜智汇 Geowise、搜极星 SouGEO 三家我只有行业媒体口径，没有官网口径。**如果它们的免费审计与 API 都锁在企业合同里（¥5,000/月起），那「低价自助 + 双语 + 技术审计」才是真缺口；如果它们已经有免注册免费审计，那这条缺口也要收窄。** 这一条决定第四节第 4 条的结论强度，建议优先抓。
2. 中文竞品是否按「提问量」还是「席位/项目」计费 —— 若也按提问量，则「按域名分档」这个错位在中英文市场同时成立。
3. Profound 的 Agent Analytics 详情页 —— 确认它是「日志级真实抓取」还是「CDN 侧的 bot 特征推断」，这决定我们补这块的难度。
