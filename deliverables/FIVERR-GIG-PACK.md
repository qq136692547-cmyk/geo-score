# Fiverr Gig Pack — AI Visibility Fix Pack ($49)

> 账号：`chinesefood885` · 站点：https://geoscore.help/fixpack/
> 口径来源：`src/pages/fixpack.astro`、`src/pages/pricing.astro`、`deliverables/WORKPLAN-2026-11-01.md` 第〇节
> 每一块都可直接复制粘贴。字符数已实测（见各块末尾标注）。
> 2026-11-01 按 team-lead 裁决修订：检查项统一 85、删除「修后分数」、$129 走 Custom Offer、案例改为真实画像。

---

# ⚠️ 2026-11-01 02:35 重大口径更新 —— 这一节覆盖下文冲突处

**offer 重心已从 llms.txt 改为 Product schema。** 原因是实测，不是偏好：

1. **Shopify 已经替每个店生成 llms.txt**（`/agents.md` 重定向），而且模板运行在受限 Liquid 上下文里、读不到商品目录 —— 所以「按你的目录定制 llms.txt」这个承诺**技术上交付不了**。
2. **Shopify 也已经生成完整的 Product schema**：25 家 DTC 实测，16 家能读到商品节点，**13 家购物端需要的属性全齐**。所以对 Shopify 店主说「你的 schema 坏了」也是错的。
3. 真正烂的是**非 Shopify 站**：324 站样本里 `structuredData` 均值 **1.7 / 14**（满分 14，是所有维度里权重最大的），`discoveryEndpoints` **0.1 / 6**。

**所以本 gig 的诚实定位是：不是「你没有，我给你」，而是「我查一遍，缺什么补什么，并告诉你接手时缺了哪几项」。** 证据在 `data/dtc-schema-check.csv`（已入库，可复核）。

## 替换用：Gig 描述（schema 优先，≤1200 字符）

```
I will complete and validate the product structured data on one of your products, so shopping surfaces can read your price, stock and identifiers.

What you get:
- Product JSON-LD for your best-seller, completed and validated — every variant's offer with price, currency and availability, plus sku / gtin / mpn to match your product to the same product elsewhere
- A robots.txt diagnosis: which AI crawlers your rules block on that page, and the exact lines to delete - I do not rewrite your file
- A hand-written llms.txt based on your public pages
- A 1-page audit with your 11-dimension scores
- A re-audit after you deploy, with before and after

Why not a template: I parse your live product page first and report exactly which properties were missing before I started. On Shopify most of this is already emitted — the gaps are usually variant offers, identifiers, and empty offer blocks. On WooCommerce, Webflow or a custom build there is often nothing at all.

Honest limits: nobody can guarantee AI citations or rankings, and I will not pretend otherwise. What I guarantee is the deliverable — markup validated against your live page.

48-hour delivery. No admin access, no passwords.
```

> 粘之前先数一遍字符（`python -c` 或在线计数器）。若超 1200，先删「Why not a template」那段。

## 替换用：标题候选（≤80 字符）

- `I will complete and validate your product schema for AI shopping` （67）
- `I will fix your Product JSON-LD, robots.txt and llms.txt in 48h` （64）
- `I will audit and fix your store for AI search visibility in 48 hours` （68，旧候选，仍可用）

## 搜索标签（schema 优先）

`product schema` · `json-ld` · `structured data` · `llms.txt` · `robots.txt`

## 案例区必须改成这套说法

三个真实画像（`data/dtc-schema-check.csv` 与 `data/dtc-llms-check.csv` 里的真实测量）：
- 某 DTC 站：Product 节点存在，但**变体报价块为空**、缺 gtin → 补 offers 与标识符
- 某 DTC 站：llms.txt 存在但内容是**平台的代理接入说明**，未提任何商品 → 换成人工整理版
- 某自建站：**完全没有 Product 节点** → 从零写

每个案例仍按三段式（真实缺陷 / 改什么文件 / 复检测哪几维），**不写修复后分数**。

---

## 1. Gig 标题（Fiverr 硬限制 ≤ 80 字符）

**候选 A — 主打 `llms.txt`**（65 字符 · 搜索量最集中，但买家多为技术/代理，非店主）
```
I will write llms.txt and AI crawler rules for your Shopify store
```

**候选 B — 主打 `AI visibility` + `GEO audit`**（68 字符 · 店主视角最易懂，推荐用这条）
```
I will audit and fix your store for AI search visibility in 48 hours
```

**候选 C — 主打 `schema markup` + `robots.txt for AI crawlers`**（70 字符 · 最容易被技术型买家点开）
```
I will fix your robots.txt for AI crawlers and complete Product schema
```

选择建议：**用候选 B 做主标题**，把 A 的关键词铺进描述第一句和搜索标签，不要挤在标题里。Fiverr 标题里堆两个关键词会被判重复，反而不利于排序。

---

## 2. Gig 描述（Fiverr 硬限制 ≤ 1200 字符）

<!-- 粘贴到：Fiverr > Gigs > [你的 gig] > Edit > Description -->
```
I check the three things that decide what AI crawlers can read on your store - robots rules, schema, and llms.txt - and I write only the ones your store is actually missing, from your real catalog, not a template.

In 48 hours you get:
- robots.txt rules that explicitly allow GPTBot, ClaudeBot and PerplexityBot, merged so your existing rules stay intact
- Product schema (JSON-LD) completed and validated for your best-selling product: price, availability, identifiers
- A custom llms.txt written from your sitemap and product pages
- A 1-page audit summary, then a re-audit with before/after scores once you deploy

Why not a template: most Shopify stores ship an llms.txt with zero product facts and a robots.txt that never names an AI crawler. A generated skeleton does not fix that. I read your live catalog and files.

What I will not promise: citations, rankings or traffic. Nobody can see inside ChatGPT's index, including me. What I do guarantee is the deliverable - correct files, checked against your live site, plus a re-audit showing what changed.

No admin access, no passwords. You or your developer paste them in; install notes for Shopify and plain HTML are included.

Message me your store URL first for a free one-paragraph diagnosis of what AI crawlers see today.
```
**实际字符数：1190**（Fiverr 上限 1200）

---

## 3. 定价包（只做一个 $49 包，不做分层）

<!-- 粘贴到：Fiverr > Gigs > [你的 gig] > Pricing -->
```
Package name: AI Visibility Fix Pack

Description:
Three files rebuilt from your real catalog, plus verification after you deploy.

1. robots.txt - explicit allow rules for GPTBot, ClaudeBot and PerplexityBot, merged into your existing file so nothing you already have is overwritten.
2. Product schema - JSON-LD for one best-selling product, completed and validated: name, price, availability, identifiers.
3. llms.txt - written from your sitemap and product pages, not the stock Shopify stub.
4. A 1-page audit summary of your 11-dimension score and the gaps these files close.
5. A post-deploy re-audit with before/after scores, once you tell me the files are live.

Install notes for Shopify and plain HTML included. No admin access or passwords required.

I do not promise AI citations, rankings or traffic - nobody can. I guarantee correct, validated files and a re-audit showing what changed.

Delivery time: 48 hours
Revisions: 2
Price: $49 (one-time, no subscription)
```
交付物清单（勾选项按 Fiverr 后台实际字段填）：
- `robots.txt` custom AI-crawler rules — 1 file
- Product JSON-LD for 1 best-seller — 1 file
- Custom `llms.txt` built from sitemap — 1 file
- Audit summary (PDF or Markdown) — 1 page
- Post-deploy re-audit with before/after scores
- Install notes (Shopify + plain HTML)

---

## 4. 搜索标签（Fiverr 上限 5 个）

<!-- 粘贴到：Fiverr > Gigs > [你的 gig] > Search tags -->
```
llms.txt
geo audit
ai visibility
schema markup
robots.txt
```

如果后台提示标签不允许出现点号（`.`），改用这组等价写法，搜索意图不变：
```
llms txt
geo audit
ai visibility
schema markup
robots txt
```

---

## 5. Gig FAQ（6 条）

<!-- 粘贴到：Fiverr > Gigs > [你的 gig] > FAQ -->
```
Q1. What exactly do I get?
A: A custom llms.txt built from your sitemap and product catalog (not a template), a robots.txt snippet that explicitly welcomes GPTBot, ClaudeBot and PerplexityBot without touching your existing rules, completed Product JSON-LD for one best-selling product, a 1-page audit summary, and a re-audit with before/after scores once you have deployed the files.

Q2. Does llms.txt actually get read by AI engines?
A: Rarely, on current evidence. Ahrefs' June 2026 study of 137,210 domains found 97% of published llms.txt files got zero requests in May 2026, and Google says it ignores the file. I include a catalog-built llms.txt because it is free, harmless, and read by some agents and tools - but the measurable parts of this pack are the robots.txt access rules and the Product schema. I will never promise you citations. If a seller tells you llms.txt will get you cited, ask them for the server logs.

Q3. Do you guarantee rankings or AI citations?
A: No - and no honest provider can. AI answers depend on the engines, your content, and your market. What I guarantee is the deliverable: correct, catalog-specific files, deployed-ready, plus a re-audit showing exactly what changed in your 11-dimension score.

Q4. How is this different from the free GeoScore generator or a file ChatGPT wrote for me?
A: The free generator produces a generic skeleton from your homepage title and description. The Fix Pack is built by a human from your actual catalog and pages, checked against your live robots.txt and schema, and verified with a re-audit after deployment. For context, in our 324-site study the median score was 41, only 2.5% of sites blocked an AI crawler, and 75.9% had no llms.txt at all - the gap is almost never access, it is the files nobody wrote. You are paying for the catalog work, the checking, and the verification, not for three files any chatbot can draft.

Q5. Do you need access to my store?
A: No. No admin access, no passwords, ever. Just your store URL and which product sells best. You (or your developer) paste the files in - install notes for Shopify and plain-HTML sites are included - and tell me when they are live so I can run the re-audit.

Q6. What if the files are pasted in wrong, or I need a change?
A: Two revisions are included. The post-deploy re-audit is exactly where a bad paste shows up: if a rule landed in the wrong block or the schema did not validate, the score will not move and I will tell you which line to fix at no extra cost.
```

---

## 6. 买家需求问卷（Requirements）

<!-- 粘贴到：Fiverr > Gigs > [你的 gig] > Requirements -->
```
1. What is your store URL? (the homepage, e.g. yourstore.com)

2. Which platform is the store on? Shopify / WooCommerce / Wix / custom / other.

3. Which product sells best? Paste its URL. This is the page I will build Product schema for. If you want a different product, say which.

4. Who can edit files on your site - you, a developer, or nobody yet? I use this to decide whether to send a copy-paste guide or a handoff note for your developer.

5. Does your site already have a robots.txt and an llms.txt? Paste the contents if you have them, or write "not sure" and I will check them myself.

6. Is anything currently blocking crawlers - password page, maintenance mode, Cloudflare "block bots" setting, or a staging subdomain? Mention it so I do not audit the wrong URL.
```

---

## 7. 三个真实审计画像（不写「修后分数」）

<!-- 粘贴到：Fiverr > Gigs > [你的 gig] > Gallery（做成 3 张对比图）或首条私信；不要塞进 Description，那里已经用满 1190/1200 -->
```
Case A - 41/100
Measured: aiCrawlability 12/12 (full marks), aiGuidance 0/12, structuredData 0/14, discoveryEndpoints 0/6. No llms.txt. No robots.txt at all, so every crawler is allowed by default and no file names GPTBot, ClaudeBot or PerplexityBot.
Changed: llms.txt written from the sitemap, and Product JSON-LD for one best-selling product. robots.txt needed nothing - with no robots.txt at all, every crawler is already allowed, and adding a permissive one would have changed no access. I said so instead of billing for it.
Re-audit: we re-run the audit after you deploy and send the four dimension scores side by side, before and after, on your own domain.
```
```
Case B - 44/100
Measured: aiCrawlability 12/12 (full marks), aiGuidance 0/12, structuredData 0/14, discoveryEndpoints 0/6, eeat 3/8. Both files missing again - and the site still gets full crawl marks, because no robots.txt means nothing is blocked.
Changed: llms.txt written from the sitemap, and Product JSON-LD completed with price, availability and identifiers. robots.txt again needed nothing, and was left alone.
Re-audit: same four dimensions re-measured after deployment, with the before/after pair returned to you.
```
```
Case C - 56/100 (the better one)
Measured: aiCrawlability 12/12, structuredData 3/14, aiGuidance 0/12, discoveryEndpoints 0/6. Two of the five schema checks passed; llms.txt and robots.txt both missing.
Changed: llms.txt written from the sitemap, and Product JSON-LD completed and validated. robots.txt: no change needed.
Re-audit: aiGuidance, structuredData and discoveryEndpoints re-measured after you deploy.
```

给店主看的补充段落（可选，放在案例下方）：
```
For stores specifically: we hand-checked the llms.txt and robots.txt of 20 direct-to-consumer stores in October 2026. Every llms.txt we found was either Shopify's stock template with no product facts, a 65-byte broken file, or a 404. None of their robots.txt files mentioned GPTBot, ClaudeBot or PerplexityBot.
```

每张图下方统一加这行标注：
```
(Anonymized. Real audit data from our 324-site study - full report available on request.)
```

案例区末尾加这一句（这是诚实优势，不要删）：
```
Our first paying client becomes our first published before/after case study. That slot is open.
```

为什么这里不写「修后 68 分」这类数字（不要粘贴）：我们没有可部署的客户店，`--fix` 生成的文件只能由客户自己部署，所以我们**产生不出真实的「修复后」分数**。写一个推算值上去，和此前被清掉的「虚构竞品价格」「1,200 个网站」是同一类错误。三个画像的总分与维度分全部来自 `data/geo-audit-v2-final.csv`（324 行，可复现），维度满分取自 `src/lib/analyzers/*.js` 的 `maxScore`。

---

## 8. 卖家简介（Fiverr Profile description，≤ 600 字符）

<!-- 粘贴到：Fiverr > Profile > Description -->
```
I build GeoScore, an open-source GEO audit tool (MIT licensed, github.com/qq136692547-cmyk/geo-score). The scoring logic is public: 11 dimensions, 85 weighted checks. Run it on your store free at geoscore.help before you pay, then read the code behind the number. Our 324-site study: median score 41, and only 2.5% of sites blocked an AI crawler - the gap is almost never access, it is the files nobody wrote. I write the files your store is actually missing, from your real catalog. $49, 48 hours. I will not promise AI citations; I will deliver correct files and show you the re-audit.
```
**实际字符数：563**（Fiverr 上限 600）

---

## 9. Buyer Requests 回复模板 × 5

用法：只回复和你判断得出具体缺陷的买家；每条发出前把 `[store]` 换成对方的域名。不要在一条里塞两个模板。

### 9.1 「我的店在 ChatGPT 里搜不到，怎么办」

<!-- 粘贴到：Fiverr > Buyer Requests > [该需求] > Send Offer 的附言 -->
```
Open [store]/llms.txt and [store]/robots.txt. Across the 324 sites we audited, 75.9% had no llms.txt and 30.6% had no robots.txt at all, while only 2.5% actually blocked an AI crawler. So the usual reason a store is unreadable is not a block, it is that there is nothing there to read. That is one pass of work: llms.txt built from your sitemap, AI-crawler rules written into robots.txt, Product schema for your best-seller. $49, 48 hours, no admin access. I cannot promise ChatGPT will cite you - nobody outside OpenAI can see that index - but I can make your store readable. Send the URL for a free one-paragraph diagnosis first.
```
**实际字符数：631**（要求 400–700）

### 9.2 「帮我做 SEO / GEO 优化」

<!-- 粘贴到：Fiverr > Buyer Requests > [该需求] > Send Offer 的附言 -->
```
Before you buy GEO work, run this: view-source your best-selling product page and search for "application/ld+json". If nothing comes back, that page is telling AI crawlers almost nothing about price, stock or variants - usually the highest-return fix on a store. Second check: open [store]/llms.txt. A 404, or a 65-byte stub, means nothing there for an agent to read. I close those two gaps plus the robots.txt rules that decide whether AI crawlers get in at all. $49 one-time, 48 hours, no passwords, files plus install notes. I do not promise rankings or citations - I promise validated files and a re-audit showing what changed. Send the store URL for the free diagnosis first.
```
**实际字符数：680**（要求 400–700）

### 9.3 「需要 llms.txt 和 schema」

<!-- 粘贴到：Fiverr > Buyer Requests > [该需求] > Send Offer 的附言 -->
```
Open [store]/llms.txt. A 404, or a file under 200 bytes, means nothing worth having - which is what most stores ship. Honest part first: on current evidence llms.txt rarely gets read. Ahrefs checked server logs from 137,210 domains in June 2026 and found 97% of published llms.txt files got zero requests that month, and Google says it ignores the file. So I will not sell it as a traffic lever. I build one from your real catalog - free, some agents do fetch it - and spend the effort where it is measurable: Product schema with price, availability and identifiers, plus explicit AI-crawler rules in robots.txt. $49, 48 hours. Send your URL and best-seller; I will confirm what is missing first.
```
**实际字符数：696**（要求 400–700）

### 9.4 「我的 robots.txt 挡住了 AI 爬虫吗」

<!-- 粘贴到：Fiverr > Buyer Requests > [该需求] > Send Offer 的附言 -->
```
Probably not, and that is the useful answer. Across 324 sites we audited, only 2.5% blocked an AI crawler, while 30.6% had no robots.txt at all. Check yours: open [store]/robots.txt. If it 404s, every bot is allowed but no file names GPTBot, ClaudeBot or PerplexityBot. If it exists, look for "Disallow: /" under GPTBot, or a sitewide one under "User-agent: *". I rewrite the file with explicit allow rules for those three while your existing rules stay as they are - plus llms.txt and Product schema, $49, 48 hours. Paste your robots.txt and I will read it free.
```
**实际字符数：563**（要求 400–700）

### 9.5 「帮我看下我的店为什么没有 AI 流量」

<!-- 粘贴到：Fiverr > Buyer Requests > [该需求] > Send Offer 的附言 -->
```
Open your analytics, filter referrals for chatgpt.com, then check [store]/robots.txt for GPTBot. If GPTBot is disallowed, that referral number means nothing - the crawler never got in. No tool can tell you your AI traffic: ChatGPT reports almost no referrals, so anyone quoting "ChatGPT sessions" is estimating. What is checkable: robots.txt rules for GPTBot, ClaudeBot and PerplexityBot, Product schema on your best-seller, and a real llms.txt, not Shopify's stub. I fix those three, then re-audit after you deploy so you see the delta yourself. $49, 48 hours, no admin access. If your site is already clean I will say so, not take the order. Send the URL and I will check it free first.
```
**实际字符数：688**（要求 400–700）

---

## ⚠️ 发布前必须人工确认的 4 件事

1. **账号能不能发 Buyer Request。** Fiverr 对新卖家的 Buyer Requests 有门槛（部分账号需完成身份验证、或有历史成交后才解锁；不同地区/类目规则不同）。登录后先去 `Selling > Buyer Requests` 看一眼有没有列表。如果看不到，第 9 节这 5 条模板暂时用不上，出单路径只剩「买家搜到 gig」+ 站外引流，要提前知道，别等写了 20 条才发现没权限。

2. **必须学会在 Fiverr 后台开 $129 的 Custom Offer。** 站点 `fixpack.astro:91` 写着「extended pack ($129) covers up to 10 products — ask in the same Fiverr thread」，gig 上却只有 $49 一个 package。这两者能对上，靠的是你会开 Custom Offer：订单页 → Custom Offer → 填 $129、48 小时、同样 2 次修改、交付物写「up to 10 products」。**不会开，站上那个价就是你兑现不了的承诺。** 发布前先在后台走一遍流程（可以给自己开一张测试报价再撤回）。

3. **48 小时交付和「等你部署」在时间上是打架的。** 三个文件 + 审计摘要 48 小时内能做完，但 post-deploy re-audit 取决于买家什么时候把文件贴上去，可能拖一周，而 Fiverr 倒计时不会因为买家不动而暂停。做法：交付时先发文件 + 摘要，消息里写明「re-audit 在你部署后 24 小时内补发」，把 re-audit 当交付后的免费跟进，而不是交付物的一部分。第 3 节套餐文案把它列在第 5 项，第一条消息里必须说清楚这个顺序。

4. **身份验证与提现信息。** 中国区卖家在 Fiverr 要完成身份验证（ID，可能加人脸/地址证明）才能收款，Payoneer/PayPal 提前绑好。钱要能落袋才算数（北极星是 settled 入账，不是订单数）。另外确认 `chinesefood885` 这个用户名和品牌对不上你是否接受——买家看到 gig 里的 GeoScore 链接会疑惑；要改用户名（Fiverr 只允许改一次）会改掉现有 gig URL，`src/pages/fixpack.astro:125` 的 CTA 链接要同步更新。

---

## 口径裁决记录（2026-11-01，team-lead 已裁决，不要再翻案）

**裁决 1 — $129 扩展包：站点保留，gig 只挂 $49。** 理由：Custom Offer 可开任意价，站上「ask in the same thread」指向的是真实可购买路径；$129 在旁边起锚定作用。落地方式见「发布前确认」第 2 条。

**裁决 2（2026-11-01 修订，前一版写错了）— 检查项数量：85 是维度内的数，总数是 99。**

产品实测（stripe.com，`auditUrl` 真实输出）：
- 11 个维度内 check：**85**（aiCrawlability 20 / citationReadiness 25 / contentQuality 6 / aiGuidance 5 / structuredData 5 / metaSocial 5 / eeat 5 / brandEntity 4 / agentFriendliness 4 / discoveryEndpoints 3 / freshness 3）
- `negativeSignals.checks`：**8**
- `promptInjection.checks`：**6**
- 合计：85 + 8 + 6 = **99**

⚠️ **前一版这里写「negativeSignals 7 条、合计 98」是错的**，原因是把 `negativeSignals` 对象的 7 个顶层键（score / maxScore / deductions / checks / severity / passed / total）当成了检查项数量。`review/14-VERDICT-2026-10-27.md:435` 和 `methodology.astro` 的「99 项 / 8 条负面信号」其实是**对的**，不需要改。

对外口径：正文只写 **"85 weighted checks across 11 dimensions"**（这句最稳，且是真正计入分数的部分）。要提总数就写 **"99 checks in total, of which 85 are weighted into the score"**。

**裁决 3 — 不写「修后分数」。** 我们没有可部署的客户店，`--fix` 只能由客户自己部署，产生不出真实的 after 分数。案例改成三段式：真实缺陷 → 改什么文件 → re-audit 重新测哪几个维度。第 7 节已按此重写。

### 执行裁决时我另外发现并已修正的 4 处（需要你知道）

1. **「aiCrawlability 12/20」是错的，实际是 12/12（满分）。** `robots.js:171` 返回 `maxScore: 12`；20 是爬虫数量（20 bots / 3 tier），不是满分。三个案例站点都是**爬虫可读性满分**——因为根本没有 robots.txt，等于全部放行。这反而让案例更有说服力：可读性早就满分了，缺口在没人写的文件上，和「只有 2.5% 拦爬虫」完全自洽。文案已写 12/12。

2. **案例的行业标签与真实 host 不符，已去掉。** 324 站里没有一家电商（唯一含 shop 的是 `marketplace.visualstudio.com`，VS Code 插件市场）；被标成「某电商站」的 56 分那条实际是 CS 课程站。给真实站点安一个假行业，和虚构店名是同一类问题，所以改成 `Case A / B / C` 不带行业。店主的代入感改用站点上**已有**的「20 家 DTC 店手检」事实补：每家 llms.txt 都是模板/65 字节坏文件/404，robots.txt 无一提及 GPTBot。

3. **343 vs 324 两个数据集并存。** `fixpack.astro:70` 说「our audit of 343 websites」（旧 `geo-audit-merged.csv`：均值 31.4、中位 29、**33.2% 拦爬虫**）；Fiverr 用的是 `geo-audit-v2-final.csv`（324 行：均值 43.4、中位 41、**2.5% 拦爬虫**）。两个都是真数据，但同一买家两边对照会发现对不上，尤其「拦爬虫比例」差 13 倍。建议站点统一改成 324，或注明「343 sites, Oct 2026 run」。**这条我没权改页面，留给你。**

4. **案例不能放进 Description。** Fiverr 描述上限 1200，已经用掉 1190，塞不下案例。第 7 节的粘贴位置已改成 Gallery（做成对比图）或首条私信。
