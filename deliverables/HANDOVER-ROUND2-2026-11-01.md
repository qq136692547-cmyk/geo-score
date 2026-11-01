# GeoScore 移交书 · 第二轮（致下一个智能体）

- **生成时间**：2026-11-01 17:00 GMT+8
- **交接方**：本轮执行者（W0 止血 + W1-5 诊断生成器 + 四轮复查）
- **接手方**：下一个智能体（零上下文）
- **性质**：冷启动交接。读完本文即可开工，不需要问任何前置问题。
- **上一份移交书**：`deliverables/HANDOVER-TO-INTL-AGENT-2026-11-01.md`（**仍然有效，但有三处已过期，见 §1.3**）

---

## 〇、30 秒速览

| 项 | 值 |
|---|---|
| 项目 | **GeoScore** —— 境外 GEO / AI 搜索可见度审计工具站（英文为主 + 中文镜像） |
| 生产地址 | **https://geoscore.help/**（在线，200） |
| 代码路径 | **`D:/Codex/projects/geo-score`**（⚠️ 不是任何 WorkBuddy 工作区，`D:/GeoScore/` 是空壳目录，别去那里） |
| 托管 | **Cloudflare Pages Direct Upload**（wrangler 直传 `dist`） |
| 当前提交 | `main = 1e8764f` |
| 最近部署 | Pages 项目 **`geoscore`**（2026-11-01 01:52）+ Worker `3ca7cb7d` |
| 测试 | **605/605 通过**（42 个测试文件，5.4 秒） |
| MRR | **$0**（用户已核 Creem 后台，无真实入账） |
| leads | **0** |
| 流量 | 83 会话/月 |
| 状态 | 站点在线、支付漏洞已封、**但有一个本次会话自己造出来的线上矛盾（§5 第 1 条），必须最先修** |

**一句话定位**：技术上已经干净，商业上仍是零。你的工作不是加功能，是**先修掉一句我们兑现不了的销售承诺**，然后**把 $49 卖给正确的人**。

---

## 一、这个项目在做什么

输入一个域名 → 跑 **11 个维度 / 99 个检查项**（85 加权 + 8 负面信号 + 6 提示词注入）→ 输出评分 + 修复清单 + 可下载文件。

### 变现结构（当前）

| 产品 | 价格 | 状态 |
|---|---|---|
| 免费审计 | $0 | 在线 |
| **Fix Pack（一次性）** | **$49** | **主线**，走 Fiverr 站外成交（账号 `chinesefood885`），**未发布** |
| Pro 订阅 | $9/mo | 在线，但**卖不动**（见 §1.1 第二条） |
| Studio / Agency | $29 / $59 | "Coming Soon"，未上线 |

### 1.1 三条战略结论（2026-10-27 定稿，不要重新论证）

**第一条 · 我们不在「AI 可见度监测」这个品类里**
真调答案引擎数 = **0**。`worker/visibility.js` 用 deepseek 套 4 个人格 prompt **扮演** ChatGPT/Perplexity/Claude/Gemini，文件头自认 *"NOT a measurement of real AI engine traffic"*。16 家竞品功能矩阵里头部有 8–9 项，我们 2 项。

**第二条 · 付费档能力 < 免费档能力（倒挂）**
自托管 CLI/MCP 用户可自换 LLM 端点；Pro 档 `worker/pro.js` **没有 API key 体系**。免费版比付费版更开放 ⇒ 订阅层逻辑上不成立。

**第三条 · 卡点在「没人来」，不在转化**
流量 83 会话/月；要 $500 MRR 需 11,200–14,000/月（差 135–170 倍）。GSC 90 天 1219 展示 / 2 点击 / 均排 69.1 ⇒ 不是文案问题，是**没有排名**。真问题是「试了不留痕」：`leads` 表 0 条。
⇒ **路径 B（done-for-you 服务先行）**：$500/月 = 11 单 $49，不需要流量。

### 1.2 2026-11-01 重大修正（覆盖上一份移交书）

- **MRR = $0，不是 $9。** 「会话→付费 0.40%（1/249）」**作废** → 真实 0/249。
- 「付费链路跑通过一次」**作废** → 跑通的只是 checkout 跳转。
- 存在过「不付钱也能开 Pro」的代码路径（`payments.js` L434/L461 的 `|| 'pro'` 兜底 + `now+30d`），**已修并部署**（`52697f9`）。

### 1.3 上一份移交书的三处过期内容（以本文为准）

| 上一份写的 | 现在实际是 |
|---|---|
| 测试 389/389（35 文件） | **605/605（42 文件）** |
| `main = e0b11b0` | **`main = 1e8764f`** |
| 五笔欠账「一项未执行」 | **第 1/2/3/5 笔已完成**，只剩第 4 笔（Pro API key）推迟 |

---

## 二、本轮（2026-11-01）到底做了什么

### 2.1 W0 止血 —— 五项全部完成并部署

| 项 | 结果 | 提交/证据 |
|---|---|---|
| W0-1 D1 只读核查 | 订阅表仅 1 行且是**站主自己邮箱**；9 条事件全是自测痕迹；NULL 漏洞未触发 | 只读查询 |
| W0-2 secret 核查 | 生产**确实配了** `CREEM_WEBHOOK_SECRET_TEST`，已删除并复核 | `wrangler secret list` |
| W0-3 支付漏洞修复 | 收紧 plan 解析、删 `\|\| 'pro'` 与 `now+30d` 兜底；`pro.js` NULL 视为过期 | `52697f9`，两轮独立复查 |
| W0-4 部署 | Worker `3ca7cb7d` + Pages `geoscore`；线上验：privacy 新文案、pricing 无 `9-89`、未签名 webhook 401 | 线上实测 |
| W0-5 抓取链路收口 | 代理 **4 → 1**（删 allorigins×2 / codetabs，三个都已死）；隐私页重写；GA 脱敏 + Referrer-Policy | `src/lib/fetcher.js:20` |

### 2.2 W1-5 诊断生成器 —— 做了四轮复查，19 个缺陷

`tools/build-pack.mjs`（约 1,500 行）为**一个商品 URL** 生成 $49 交付物。文件头写着唯一规则：

> **Nothing is invented.** A price is emitted only if a price was found; a GTIN only if a GTIN was found.

四轮复查，每一轮都是「先复现，再修，再变异测试」：

| 轮次 | 提交 | 抓到什么（挑最重的） |
|---|---|---|
| 1 | `88faf59` | `normalizePrice` 无条件删逗号 → 欧陆 `"19,99"` 变 `1999.00`（100 倍），而这个数字会写进客户直接粘贴上线的文件。改为 `parsePrice`：只接受唯一读法，`"1,299"` 主动拒收 |
| 2 | `4eaeda2` | **追加式 robots.txt 补丁永远是空操作**。RFC 9309 合并同名 group + 最长匹配，`Allow: /`（1 字节）输给站主自己的 `Disallow: /products`（9 字节）。补丁后重新分析仍是 blocked，而 INSTALL.md 告诉客户「已撤销屏蔽」 |
| 3 | `0dae961` | 协议相对图片 `//cdn.shopify.com/…` 被 `^https?://` 滤掉 → 把**完整节点判成残缺**，然后建议客户用更差的节点替换（1 张图 vs 原页面 5 张）。greatjonesgoods 真实页面确实触发过 |
| 4 | `16a3883` / `1e8764f` | WooCommerce 只在 `<span class="woocommerce-Price-amount">&#36;18.99</bdi>` 里印价格，符号无 ISO 码；我们发 `AggregateOffer` 但**它不符合 merchant listing 资格**（Google 原文：merchant listings require an `Offer`） |

**这一轮最值钱的一条通用教训**（写下来给下一个智能体）：
> 测试全过 ≠ 对外文案正确。**必须拿真站点跑一遍**。一个 94 分的站被我们自己的工具写成「最该先修：About 链接」，这是把缺陷当卖点的反向版本。

### 2.3 一次测量推翻了我们自己的 offer

对 **3 家真实 Shopify 店**（greatjonesgoods / allbirds / ripplefoods）实跑 `build-pack.mjs`：

- Product 节点**完整**（13/16 家 DTC 实测必填全齐）
- AI 爬虫**已放行**（Shopify 默认 robots.txt 自带 `User-agent: GPTBot / Allow: /`）
- llms.txt **平台自带**（2026-05 起 `/llms.txt` 重定向到 `/agents.md`）

⇒ **$49 三件套在典型 Shopify 店上只交付 1 个文件**，而且那 1 个还需要主题模板覆盖（受限 Liquid 上下文，读不到商品目录）。

**这不是 bug，是 offer 与 ICP 不匹配。** 用户已裁决：**换 ICP**。

### 2.4 新 ICP 的实测与它的洞

对 12 个真实商品页跑同一套分析：

| 平台 | 需要 `product.jsonld` | 说明 |
|---|---|---|
| WooCommerce | **3/3** | 核心 `class-wc-structured-data.php` 发 Product JSON-LD，但**没有 `brand`**；Yoast 免费版**完全不发** Product schema |
| Webflow | **3/3** | 完全无 Product 节点 |
| 自建 | **3/3** | 完全无 |
| Shopify | **0/3** | 平台已发 |
| B2B SaaS | 3/3 **不适用** | 定价页不是商品页，`looksLikeProductPage` 正确拒绝。SaaS 要的是 Organization / SoftwareApplication，是另一个产品 |

**但新 ICP 有自己的洞**：抽样的 6/6 页面**取不到价格**。原因逐条手工核过：
- WooCommerce 只印符号价格（`$18.99`），无 ISO 币种码
- IKEA 用合法的 `offers.priceSpecification[].price`（现已支持）
- Webflow 用 `<div class="price">$59.00</div>`，**同页还有别的商品** → **故意不抓**。一条错价写进客户上线文件，比留空严重得多
- `brodo.com` 是真 WooCommerce 店，JSON-LD 里只有 `WebSite` 和 `WebPage`，**零个 Product 节点**（SEO 插件接管了 schema 输出）

---

## 三、技术架构

| 层 | 实现 |
|---|---|
| 前端 | **Astro 5** + Tailwind 4 + Chart.js（运行时依赖仅 4 个） |
| 页面 | 38 路由 / 40 HTML（含 404 与中文镜像 `zh/`） |
| 审计引擎 | `src/lib/analyzers/` **13 个分析器** ⇒ 11 维 / 99 检查项 |
| 后端 | **独立 Cloudflare Worker**（不是 Pages Functions）：`worker/wrangler.toml` `name="geoscore-payments"` |
| 后端地址 | `https://geoscore-payments.geo-score.workers.dev`（`public/scripts/auth.js:7` 硬编码） |
| 数据库 | **Cloudflare D1** `geoscore-db`，10 张表 |
| 支付 | **Creem**（MoR），`/api/checkout` + `/webhook` |
| 代码规模 | ≈21,448 行 |

⚠️ **`geoscore.help/api/*` 全部 404** —— 前端调的是 `workers.dev` 那个独立 Worker。这是架构选择，不是故障。

---

## 四、部署方式

```bash
cd D:/Codex/projects/geo-score
npm test                                    # 必须 605/605
npm run build                               # 产出 40 个 HTML
npx wrangler pages deploy dist --project-name geoscore
```

### 🔴 四个致命误区

1. **项目名是 `geoscore`，不是 `geoscore-532`。** 后者只是 `*.pages.dev` 子域。写错会部署到一个新项目上，线上什么都不会变。
2. **生产不是 GitHub Pages。** `.github/workflows/deploy.yml` 推 `gh-pages` 镜像分支，停更于 2026-08-31。改它不会上线。
3. **`dist` 没有入库**（`.gitignore:7`）。任何人从 main 重新构建都会丢掉没合进 main 的功能 —— 修完必须 `git add` + 推送再部署。
4. **凭据**：需带 **Cloudflare Pages: Edit** 的 token，或 `wrangler login` 一次。`CF_API_TOKEN` 只有分析权限，**不能用于 Pages 部署**，别覆盖它。

---

## 五、🔴 欠账（按优先级，第 1 条必须最先修）

| # | 欠账 | 证据 | 成本 |
|---|---|---|---|
| **1** | **线上 fixpack 页仍在卖 `robots.txt` 文件，而工具已决定永不生成 robots.txt** | 英文页 **13 处**（`src/pages/fixpack.astro:4, 5, 13, 18, 23, 72, 81, 100, 125, 156, 160, 164, 188`）+ 中文页 **11 处**（`src/pages/zh/fixpack.astro:12, 17, 22, 66, 72, 88, 110, 139, 143, 147, 171`）。而 `tools/build-pack.mjs` 只有 `buildRobotsGuidance()`，只引用原文说「删哪几行」。**这是本次会话自己造出来的矛盾：修好了交付物，忘了修销售页** | **1–2 小时，改 2 个文件** |
| **2** | **12 站 ICP 实测没有落成 CSV** | §2.4 的结论只存在于会话与记忆里，`data/` 没有对应文件。违反项目自己的「证据必须可复现」原则（凡对外声称的样本量，仓库必须有 CSV + 生成脚本） | 半天：`tools/icp-probe.mjs` + `data/icp-probe.csv` |
| **3** | **Pro 档无 API key 体系（倒挂未修）** | `worker/pro.js`。触发条件：付费用户 ≥5 | 1–2 人日 |
| **4** | **GA4 埋点不自洽**：`audit_completed` 22 > `audit_started` 21 | 逻辑不可能 | 半天 |

### 第 1 条为什么排第一

它是**唯一一条会让第一单变成纠纷的**。客户读页面看到「robots.txt AI-crawler rules」付钱，交付时收到的是「你的 robots.txt 我建议删这两行」。这不是交付质量问题，是**承诺与交付物不符**。

**只有一条修法**：改页面，不是改工具。因为工具那边的结论是 RFC 9309 决定的 —— 追加式补丁永远是空操作，能生效的写法只有更长的 `Allow:`，而那正是红线禁止的（不得重新放行站主主动屏蔽的爬虫）。

### 已清掉的欠账（不用再查）

- ~~`review/` 与 `scripts/` 未入 git~~ → `review/` 20 个文件、`scripts/` 4 个、`docs/` 25 个已入库
- ~~抓取链路把客户 URL 明文发给第三方公共 CORS 代理~~ → 代理 4→1，只剩自建 `geo-score-proxy`，隐私页已重写
- ~~定价页 FAQ 报错竞品价格（`GeoReady charges $9-89/month`）~~ → 已改为不点名对比，线上 grep 不到
- ~~检查项口径三种写法并存~~ → 统一为 **99（85 加权 + 8 负面 + 6 注入）**

⚠️ **`deliverables/FIVERR-GIG-PACK.md:339` 那条「343 vs 324 两个数据集并存，差 13 倍」已经不需要处理**，别再照着改。实测：`src/pages/fixpack.astro:83` 现在写的是 **324**，与 Fiverr 口径一致；`343` 只出现在博客里，而博客第 79 行**自己解释了差异** —— 第一轮 343 站，修掉 robots.txt 规则后同一批 457 个候选重跑回来 324 个，全站评分一律用第二轮，第一轮的数字只作为「修复前」保留在 Finding 4。这是诚实的双轮披露，不是口径混乱。**这是旧文档留下的假欠账，本条作废。**

---

## 六、绝对不要做的事（红线）

1. ❌ **不要宣称我们有「真实 AI 引擎监测」。** 是 deepseek 扮演，代码里写死。`simulated` / `not live engine traffic` 标注必须保留。
2. ❌ **不要 vendor Firecrawl 源码**（AGPL-3.0）。闭源抓取层只能 `crawl4ai`（Apache-2.0）。
3. ❌ **不要做「真调引擎 via web 自动化」**（需 72 个持续付费用户才回本，当前 0）。
4. ❌ **不要生成 `robots.txt` 文件。** RFC 9309 合并同名 group + 最长匹配 ⇒ 追加式补丁永远输给站主自己的 `Disallow:`；唯一能生效的写法是更长的 `Allow:`，而那等于**重新放行站主主动屏蔽的爬虫**，属于越权。只给「删哪几行」的诊断。
5. ❌ **不要写「修复后分数」。** 我们没有可部署的客户店，`--fix` 只能由客户自己部署，产生不出真实 after 分数。写推算值 = 此前被清掉的「虚构竞品价格」同类错误。
6. ❌ **不要为了凑数抓同页别的商品的价格。** 一条错价写进客户上线文件，比留空严重得多。
7. ❌ **不要把 `dist/` 提交进仓库。**
8. ❌ **不要在未获用户批准的情况下部署或删文件。**

---

## 七、关键文件索引

### 本轮新增/改动的核心资产

| 文件 | 内容 |
|---|---|
| `tools/build-pack.mjs` | **$49 交付物生成器**（约 1,500 行）。文件头是唯一规则：不发明任何事实 |
| `tests/tools/buildPack.test.js` | **114 条测试**，每一条都是一个真实假话的回归 |
| `tools/diagnose.mjs` | URL → 可粘贴诊断段（Fiverr Buyer Request 用，≤1 分钟/条） |
| `deliverables/FIVERR-GIG-PACK.md` | gig 全套文案（描述 1192/1200 字符、5 条 Buyer Request 模板、发布前 4 项人工确认） |
| `assets/gig/01-cover.png` `03-deliverables.png` | gig 图，从 HTML 渲染（文字不会花） |
| `data/dtc-schema-check.csv` `data/dtc-llms-check.csv` | 25 家 DTC 实测，可复现 |

### 战略与审核（上一轮的核心资产，仍然有效）

| 文件 | 内容 |
|---|---|
| `deliverables/WORKPLAN-2026-11-01.md` | **锚点。每次开工先读第〇节**（北极星 + 三条结论 + 不做清单 + 判据 + 进度表 + 变更记录） |
| `review/14-VERDICT-2026-10-27.md` | 最终判定 + 14 天行动 + 量化判据 |
| `review/11-competitor-benchmark-2026-10-27.md` | 16 家竞品一手核价 + 功能矩阵 |
| `review/13-monetization-2026-10-27.md` | 漏斗定位 + 单位经济 + 变现路径 |

---

## 八、接手后的动作顺序

| 序 | 动作 | 完成标志 |
|---|---|---|
| **1** | 读 `deliverables/WORKPLAN-2026-11-01.md` 第〇节 + 本文 §5 | 能复述北极星与第 1 条欠账 |
| **2** | `npm test` 确认 **605/605** | 数字对得上 |
| **3** | **修第 1 条欠账**：把 `fixpack.astro` 与 `zh/fixpack.astro` 里的「robots.txt AI-crawler rules」改成「robots.txt 诊断 + 要删的行」 | 线上 grep 不到「rules that welcome GPTBot」 |
| **4** | 补 `tools/icp-probe.mjs` + `data/icp-probe.csv`，把 §2.4 变成可复现 | 有 CSV，有脚本，数字对得上 |
| **5** | **问用户定价**（$49 保持 / 降到 $29 走量 / 捆绑完整报告） | 用户答复 |
| **6** | 按 `FIVERR-GIG-PACK.md` 发布 gig（**必须用户本人操作**） | gig 可被搜到、可下单 |
| **7** | GA4 埋点修复 | 事件数自洽 |

> **定价只阻塞 gig 文案，不阻塞第 3 步。** 页面修复（第 3 步）与价格无关 —— 页内虽然出现 6 处 `$49`，但把「robots.txt 文件」改成「robots.txt 诊断」这个改动不涉及任何价格。真正依赖价格的是标题、描述、套餐、FAQ 那一整套 gig 文案。**先把页面改对，再定价格，别反过来。**

---

## 九、用户侧才能做的事（智能体做不到，不要假装能做）

- 登录 Fiverr `chinesefood885` 发布 gig、回复 Buyer Requests
- 完成 Fiverr 身份验证 + 绑 Payoneer/PayPal（钱要能落袋才算数）
- 在 Fiverr 后台走一遍 Custom Offer 流程（站点承诺 $129 扩展包，靠这个兑现）
- 定价决策
- 批准部署

---

## 十、一句话总结

> **这个站技术上已经干净了：支付漏洞封了、抓取链路收口了、$49 交付物不再写任何它读不到的事实。
> 但它现在有一句兑现不了的销售承诺挂在线上（卖 robots.txt 文件，工具却不生成），
> 而且它想卖的对象（Shopify 店）根本不需要它卖的东西 —— 实测 3/3 无缺口。
> 所以未来一周的重点是：**修掉那句承诺 → 把 ICP 换成 WooCommerce/Webflow/自建 → 卖出去第一单。**
> 不是加功能，不是优化网站。**
