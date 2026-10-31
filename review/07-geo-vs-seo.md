# GEO vs SEO：机制差异，与对我们 11 维的判决

**说明**：负责这一路的 agent 跑了 70 分钟没落盘，被中止。下面是主理人**自己打开一手来源**得到的结论，
每条带 URL 与日期（2026-10-23）。没打开的不写。

---

## A. Google 的官方立场（这是最硬的一份）

来源：Google Search Central《Optimizing your website for generative AI features on Google Search》
（developers.google.com/search/docs/fundamentals/ai-optimization-guide，页面标注 2026-07-10）

**原话三句：**

1. "SEO 的最佳实践继续适用，因为我们的生成式 AI 功能植根于核心搜索排名与质量系统。"
2. 被问到 AEO/GEO 时："From Google Search's perspective, optimizing for generative AI search is
   optimizing for the search experience, **and thus still SEO**."
3. 机制：**RAG（检索增强）+ query fan-out（查询扇出）**，两者都建立在核心排名系统上。

**它明确否定的：**
- 在 "mythbusting" 一节里说：**机器可读文件（machine-readable files like llms.txt）不是出现在生成式 AI 搜索里所必需的**。
- 不要为每一个 fan-out 查询单独造页面 —— 那属于 scaled content abuse（垃圾政策）。

**它明确正面说的：**
- 排在第一位的因素是"**创造有价值的、非商品化的内容**"，且"这比本指南里任何其他建议都更能影响你在生成式 AI 搜索里的存在"。

## B. llms.txt：被最大样本的证据否定

来源：Ahrefs《We Analyzed 137K Sites: 97% of llms.txt Files Never Get Read》，2026-06-15，
样本 **137,210 个域名**，方法为 Ahrefs Web Analytics + Bot Analytics 的**服务器日志**（不是问卷）。

| 指标 | 数值 |
|---|---|
| 发布 llms.txt 的域名 | **28%**（约 38,360 个，作者注明这是上限） |
| **2026 年 5 月收到零请求的文件** | **97%** |
| 有请求的文件里，来自 bot 的比例 | 96% |
| 其中来自**具名 AI 工具**的比例 | **19.5%** |
| 来自 GEO/AEO 工具与研究者的比例 | 12% |
| 对"不存在的 llms.txt"发起请求的 AI bot | **0** |

补充三条同源事实：
- Google 文档原话：维护 llms.txt "**will neither harm nor help** your site's visibility or rankings
  in Google Search, as Google Search ignores them."
- John Mueller 对 Lily Ray 的表态：llms.txt "not done for search"，是给 AI 编程工具解析开发文档的
  "temporary crutch"。
- Chrome Lighthouse 确实有 llms.txt 检查，但那是 **agentic browsing** 审计，与排名无关；
  文件 404 时该审计标为 Not Applicable。

## C. 学术侧：GEO 确实有效，但幅度与手法有边界

来源：Aggarwal et al.《GEO: Generative Engine Optimization》，KDD 2024（arXiv:2311.09735v3）

- 结论：通过内容改写，**可见度最多提升 40%**（在 GEO-bench 上，跨多个领域）
- 关键限定：**效果因领域而异**，需要领域特定的优化方法
- 也就是说：GEO 不是"另一个学科"，是"同一批内容规则，在不同引擎的检索+生成链路里重排权重"。
  它没有产生一套独立于 SEO 的新机制。

## D. 对我们 11 维的逐条判决

判据：**有没有一手证据表明"改这个能提高被 AI 引用的概率"**。

| 维度 | 权重 | 判决 | 依据 |
|---|---:|---|---|
| **aiGuidance（llms.txt）** | 12 | ❌ **应大幅降权或删除** | 97% 零请求；Google 明确忽略；0 个 bot 会去找不存在的文件 |
| **aiCrawlability（robots 是否放行）** | 12 | ⚠️ **无区分度** | 自家 324 站语料：98.9% 满分、仅 3.6% 阻断。它是"意图"不是"事实"（事实要看爬虫日志） |
| **structuredData（JSON-LD）** | 14 | ⚠️ **无一手证据** | 权重最高的一项，但没找到"schema 覆盖率↑ → 被引用率↑"的研究；且 FAQ/HowTo 富媒体已下线 |
| **metaSocial** | 10 | ⚠️ SEO 遗产 | 对传统排名有效，对 AI 引用无证据 |
| **contentQuality** | 12 | ✅ **有效** | Google 官方把它列为第一因素；GEO 论文的改写手法本质是内容质量 |
| **eeat** | 8 | ✅ **有效（但方法可疑）** | 官方框架明确适用；我们的判法是正则/`@`，实现不可信 |
| **brandEntity** | 8 | 🟡 **方向对，方法无据** | 品牌实体影响"是否被提及"是共识，但没有可复现的打分方法 |
| **citationReadiness** | 8 | 🟡 **相关性强、因果未证** | 外部引用与 AI 引用高度相关，但"加外链 → 被引用"未证实 |
| **discoveryEndpoints** | 6 | ❌ **无证据** | `/ai/summary.json`、`.well-known/ai.txt` 不是任何引擎的既有规范 |
| **agentFriendliness** | 4 | ❌ **错位** | 它衡量"agent 能不能用你的 API"，与"你被不被引用"是两件事 |
| **freshness** | 4 | 🟡 **弱证据** | 有间接证据（AI 偏好新内容），无强研究 |

**加权后的结论**：
- 12 + 6 + 4 = **22 分（占总权重 98 的 22%）押在没有证据或已被否定的维度上**
- 14 分（structuredData，权重最高）**没有一手证据支持**
- 真正站得住的只有 **contentQuality(12) + eeat(8) = 20 分**，加上两个"方向对但方法可疑"的 16 分

**一句话**：我们这套表是"SEO 检查清单 + 三个 GEO 时代的新名词"，
其中**唯一被大规模证据检验过的那一项（llms.txt），结论是负面的**。

## E. 这份判决的边界（必须说）

1. **Google ≠ 全部**。ChatGPT/Perplexity/Claude 不公开检索与排序机制，上面 B/C 的证据主要来自
   Google 与学术模拟环境。对"非 Google 引擎"，我们只能观测结果，无法验证机制。
2. **"无证据"不等于"无效"**。structuredData 可能是有效但没人做过对照实验；我不把它判成"错"，只判"不能拿来卖"。
3. **GEO 论文的效果是"内容改写"，不是"技术配置"**。它支持的是 contentQuality 那一维，
   不支持我们任何"配置类"维度。
