# icp-probe.csv — 目标客群（ICP）平台缺口实测

- **采集时间**：2026-11-02 01:30 CST
- **生成脚本**：`tools/icp-probe.mjs`
- **复现**：`node tools/icp-probe.mjs`（默认 concurrency 2 / timeout 30s；15 个目标约 15 秒）
- **样本**：15 个真实商品页，按假设的 5 个平台分组，每组 3 个

---

## 一、这份数据回答什么问题

2026-11-01 我们实跑发现 **$49 Fix Pack 在 Shopify 店上只交付 1 个文件**（Product 节点完整、AI 爬虫已放行、llms.txt 平台自带），于是把 ICP 改到 WooCommerce / Webflow / 自建站。

**但那个结论当时只存在于会话里，仓库没有 CSV。** 项目自己的规则是：凡对外声称的样本量，必须有 CSV + 生成脚本。这份文件就是补这个口子。

---

## 二、方法

| 项 | 做法 |
|---|---|
| **平台识别** | 读 markup 指纹，**不采信分组标签**。标签只是假设，指纹才是结果。CSV 里 `platform_matches_group` 列直接暴露两者是否一致 |
| **Product 节点** | 解析所有 `application/ld+json`，深度遍历找 `Product` / `ProductGroup`（Shopify 多变体发 ProductGroup，offers 在 `hasVariant[]` 里） |
| **必填项** | `name` / `image` / `offers` / `offers.price` / `offers.priceCurrency` / `offers.availability` / 至少一个 `sku\|gtin\|mpn` |
| **brand** | 单独成列（schema.org 里它可选，不算"坏了"），因为它是 WooCommerce 核心唯一留下的缺口 |
| **价格** | 只在**有且仅有一种读法**时记录。`1,299` 歧义（1299 或 1.299）直接拒收 |
| **定价页** | 判 `not-applicable`，不硬凑成商品页 |

---

## 三、结果

### 按组

| 组 | 可读 | 需要修 | 具体 |
|---|---|---|---|
| **Shopify** | 3 | **0 / 3** | 全部 `no-gap`（Product 节点完整、有 brand、价格可取） |
| **WooCommerce** | 2（1 被 403 拦） | **2 / 2** | 全部 `needs-product-schema`（无 Product 节点） |
| **Webflow** | 3 | **3 / 3** | 2 个无节点 + 1 个有节点但缺整个 offers 块 |
| **自建** | 3 | **2 / 3** | Apple 缺 offers.price/availability/identifiers；Sonos 缺 offers；**IKEA 完整** |
| **B2B SaaS** | 3 | — | 全部 `not-applicable`（定价页不是商品页） |

### 按判定

```
no-gap               4    ← 3 Shopify + 1 IKEA
needs-product-schema 4    ← 2 WooCommerce + 2 Webflow
incomplete-schema    3    ← 1 Webflow + 2 自建
not-applicable       3    ← 3 SaaS
fetch-blocked        1    ← nalgene.com（403）
```

### 价格可得性（这是 $49 交付物的真实卡点）

| 价格来源 | 数量 |
|---|---|
| `jsonld`（有值有币种） | **4** |
| `jsonld-no-currency` | 1 |
| `text-single-symbol`（页面唯一数字，币种靠符号猜） | 1 |
| **`ambiguous`（多个数字，拒收）** | **4** |
| `none` | 1 |

⇒ **11 个可读商品页里，只有 5 个能拿到可信价格。**

---

## 四、🔴 与上一轮交接书（HANDOVER-ROUND2）结论的三处差异

这份数据推翻了交接书 §2.4 的三处表述。**以本文件为准。**

| 交接书说 | 实测 |
|---|---|
| 「Webflow 3/3 完全无 Product 节点」 | **不准确**。bondandgrace 有 Product 节点，但整个 `offers` 块缺失。准确说法：**3/3 需要修，其中 2 个无节点、1 个节点残缺** |
| 「自建 3/3 完全无 Product JSON-LD」 | **不准确**。IKEA 是 `no-gap`（ProductGroup 结构完整，价格 219 走 `offers.price`）；Apple 和 Sonos 有节点但缺 offer 字段。准确说法：**2/3 需要修** |
| 「clicks.tech 属于 Webflow」 | **结果对，但当时是蒙对的**。该站是 Webflow 前端 + Shopify 后端，markup 里同时有 `data-wf-page` 和 `myshopify`。第一版脚本按 Shopify 优先判定，把它误判成 Shopify —— **已修**（Webflow 的 `data-wf-page`/`data-wf-site` 特异性更高，优先判定） |

### 另一处：WooCommerce 组样本只有 2 个

nalgene.com **对 curl 返回 200、对 Node fetch 返回 403**（全站反爬，连首页都 403）。第一版脚本把这个 403 页面当正常页面分析，输出 `needs-product-schema` —— **等于对一个我们从未读到的站说「你缺 schema」**。已改为 `fetch-blocked`，不做内容判定。

⇒ 该组可读样本 **2 个**，不是 3 个。**2/2 无 Product 节点**这个方向仍然成立，但样本量要如实说 2，不能说 3。

---

## 五、这份数据**不能**证明什么（使用限制）

1. ❌ **不能证明「补了 schema 就会被 AI 引用」**。我们没有那个数据，页面文案也不许这样写。
2. ❌ **不能代表全平台**。15 个样本，每组 3 个，是**方向性抽样**，不是随机样本。对外只能写「抽样的 N 个站」。
3. ❌ **不能推断收入**。这些站缺 schema ≠ 它们愿意付 $49。
4. ⚠️ **IKEA / Sonos 的结果在不同次运行间有过波动**（no-gap ↔ incomplete-schema），疑似页面按区域或 A/B 返回不同变体。若引用这两个站，须注明「单次采集」。
5. ⚠️ **`text-single-symbol` 与 `jsonld-no-currency` 的币种是推断的**，不是 ISO 码。交付时不能直接采信。

---

## 六、对销售页的含义

**可以说的**：
> "我抽查了 15 个真实商品页。三个 Shopify 店全部已经完整，不需要我动手；两个可读的 WooCommerce 店、三个 Webflow 店都有结构性缺口。"

**不能说的**：
> ~~"大多数电商站都缺 schema"~~（样本不是随机的）
> ~~"修了就能被 AI 引用"~~（无数据）
> ~~"WooCommerce 3/3 全缺"~~（只有 2 个可读）
