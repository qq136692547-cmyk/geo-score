# GeoScore 设计系统诊断

专项：设计系统（token / 组件一致性 / 视觉记忆点 / 响应式）
范围：`D:/Codex/projects/geo-score`，37 个 `.astro` 页面（EN 26 / ZH 11）、17 个组件文件、1 份全局样式
日期：2026-10-22

## 0. 方法与证据边界（先读这一段）

- **静态取证为主**：读了 `src/styles/global.css` 全文、两个 Layout 全文、`index/pricing/tools/ai-readiness-score` 三页全文、17 个组件文件的导出与样板，其余用计数统计。
- **没有浏览器**：仓库无 playwright/puppeteer 依赖（`package.json` 只有 astro/tailwind/chart.js/vitest）。所以本报告里没有本轮新截的图。**唯一视觉证据是仓库里已有的 `.ux-mobile.png`（实测 390×844）**。
- 凡是从 class 字符串推导出的像素结论，我都标了「算得」并给出算式；凡是没算的，不许当结论用。
- 竞品对比只按 brief 给的描述（Otterly = 绿色仪表盘 / Profound = 深色专业），**本轮未复核竞品**。
- 视觉类建议一律标 **赌注**：日流量个位数，任何"改了会更好"都无法用数据验收。所以我给的是**可计数的不变量**，不是观感。

---

## 1. Token 体系：45 个 token，8 个是死的，13 个从未被页面用过

`src/styles/global.css:4-57` 的 `@theme` 块共 **45 个 token**：

| 类别 | token | 数量 | 页面/组件里的真实引用 |
|---|---|---|---|
| 主色 geo（绿） | `--color-geo-50..900` | 10 | 高频（品牌主色） |
| 次色 brand（蓝） | `--color-brand-50..900` | 10 | 高频 |
| 语义色 score | `--color-score-excellent/good/basic/critical` | 4 | **0** |
| 语义色 warn | `--color-warn-400/500` | 2 | 8 / 25 |
| 语义色 danger | `--color-danger-400/500/600` | 3 | 13 / 44 / 1 |
| 中性覆盖 | `--color-gray-500`（oklch 提亮到 64.5%） | 1 | 249 |
| 表面 | `--color-surface-base/elevated/card/hover` | 4 | base/card/hover 仅在 CSS 内；**elevated = 0** |
| 描边 | `--color-border-subtle/medium` | 2 | 仅 CSS 内；medium 仅在 `.card-hover` 出现 1 次 |
| 文本 | `--color-text-primary/secondary/muted` | 3 | 仅 CSS 内；**muted = 0** |
| 字体 | `--font-sans` / `--font-mono` | 2 | sans 走 body；mono 以 `font-mono` 工具类出现 58 次 |
| 动效 | `--duration-fast/normal/slow` | 3 | normal 3 次；**fast / slow = 0** |
| 缓动 | `--ease-out-expo` | 1 | 7 次（全在 CSS 内） |

### 1.1 死的 token（8 个，占 17.8%）

`score-excellent / score-good / score-basic / score-critical`、`duration-fast`、`duration-slow`、`surface-elevated`、`text-muted` —— 全仓库 `var()` 引用数均为 0，工具类引用数也为 0（`grep -rn 'score-excellent' src --include=*.astro --include=*.js` → 空）。

**这条本身不是"冗余"而是"谎"**：`@theme` 里声明了一套 4 级语义评分色，让人以为分数配色由 token 决定；实际配色逻辑在 6 个 JS 文件里硬编码 `bg-geo-500 / bg-brand-500 / bg-warn-500 / bg-danger-500` 三元表达式（见 §2.3）。**语义 token 存在但不承重，是最容易让后来者改错的一类冗余。**

### 1.2 表面层级：有 3 套写法，视觉上只有 1 级（算得）

- `.card`（`global.css:137`）：`rgba(30,41,59,0.6)` + `1px rgba(148,163,184,0.1)` + **硬编码 `border-radius:16px`**
- `bg-white/5`：全站 **282 次**
- `bg-gray-900/50`（代码块）：12 次

把前两种叠在页面底色 `#0f172a` 上算合成色：

```
bg-white/5   → (15+12, 23+11.6, 42+10.65)       = #1b2335
.card        → (30,41,59)*0.6 + (15,23,42)*0.4  = #182234
Δ = (R 3, G 0.8, B 0.5)  → 肉眼不可分
```

结论：**"卡片"和"行底"是同一个视觉层级，却由两套机制产出**（一个 CSS 类、一个裸工具类）。同时 `--color-surface-card` 定义了但页面全部绕开它，`--color-surface-elevated` 定义了且彻底没人用。

### 1.3 缺失的 token 类别（完全为 0）

| 缺失类别 | 现状后果 |
|---|---|
| `--radius-*` | 圆角靠工具类散落：`rounded-lg` 158 / `rounded-xl` 121 / `rounded-full` 75 / `rounded-md` 3，另有 `.card` 内部硬编码 16px（= `rounded-2xl`，而 `rounded-2xl` 作为工具类使用 0 次 → **`.card` 的圆角无法用工具类表达**） |
| `--spacing-*` | 卡片内边距有 5 档：`p-4/16px`(90) `p-5/20px`(32) `p-6/24px`(73) `p-8/32px`(133) `p-2`(6) |
| `--container-*` | 内容宽度 **11 档**：`2xl 26 / 3xl 27 / 4xl 16 / 5xl 2 / 6xl 2 / 7xl 6 / xl 9 / lg 6 / md 1 / xs 2 / none 13`。首页自己一页就用了 7 档 |
| `--shadow-*` | 阴影全部内联或裸工具类 |
| z-index | 只有两个值：`z-50`（header ×2）与 `z-[60]`（consent ×2）。**未体系化但也没乱**，属于可接受 |
| `--text-*` | 字号 10 档（`text-xs` 218 → `text-6xl` 2），标题尺寸全写在页面里，无 token |

### 1.4 字体

`--font-sans: system-ui, ...`（`global.css:51`）—— **没有 web font，没有 display 字体**。中文页也吃同一个 `system-ui` 栈（`LayoutZh` 没覆盖 font-family），Windows 上会落到「微软雅黑」，与拉丁段的 Segoe UI 字重观感不一致。这是"成本最低、可记忆度最能提升"的一处，但也因此撞上 §3 的赌注条款。

---

## 2. 组件一致性

### 2.1 清单：1 个 Astro 组件 + 16 个 JS 渲染器 = 0 个 UI 原语

`src/components/` 全部文件：

| 文件 | 行数 | 形态 | 导出 |
|---|---|---|---|
| `Adsterra.astro` | 13 | **唯一的 `.astro` 组件**（广告位） | Astro props |
| `auditHistory.js` | 175 | 返回 HTML 字符串 | `renderAuditHistory`-族 |
| `comparisonPanel.js` | 33 | 同上 | `renderComparisonPanel` |
| `dimensionBreakdown.js` | 37 | 同上 | `renderDimensionBreakdown` |
| `exportButtons.js` | 10 | 同上 | `renderExportButtons` |
| `fixFilesPanel.js` | 55 | 同上 | `renderFixFilesPanel` |
| `fixesPanel.js` | 20 | 同上 | `renderFixesPanel` |
| `historyList.js` | 14 | 同上 | `renderHistoryList` |
| `negativeSignals.js` | 18 | 同上 | `renderNegativeSignals` |
| `radarChart.js` | 65 | 容器 + Chart.js 初始化 | `renderRadarContainer` / `initRadarChart` ← **命名偏离** |
| `reportHeader.js` | 31 | 同上 | `renderScoreHeader` |
| `seoSupplement.js` | 23 | 同上 | `renderSeoSupplement` |
| `shareButtons.js` | 53 | 同上 | `renderShareButtons` |
| `sitesPanel.js` | 118 | 同上 + 事件 | — |
| `trendChart.js` | 83 | 容器 + Chart.js 初始化 | `renderTrendContainer` / `initTrendChart` ← **命名偏离** |
| `upgradeCta.js` | 92 | 同上 | 内部 `ctaShell()` |
| `visibilityPanel.js` | 171 | 同上 | — |

**命名/结构一致性**：16 个 JS 里 14 个是 `render<名词>`，词性统一、可预测——这部分是好的。2 个例外用 `render<名词>Container`（`radarChart.js:4`、`trendChart.js:1`），因为它们同时导出 `init*`。**建议把 `Container` 后缀统一掉**，或把 Chart 类组件单开一个 `charts/` 子目录，避免"看名字猜不到返回的是容器还是内容"。

**真正的结论**：**37 个页面只有 1 个可复用的展示型组件，且那个组件是广告位。** 没有 Button / Card / Badge / Input / Section / Prose 任何一种原语。所有 UI 靠复制 class 字符串。

### 2.2 复制粘贴的量化（这是本专项最硬的一条）

| 重复单元 | 实例数 | 变体数 | 证据 |
|---|---|---|---|
| 渐变主按钮 `bg-gradient-to-r from-geo-600 to-brand-600` | 40 | **9** | 唯一差异是 `shadow-lg`/`whitespace-nowrap`/`active:`/`self-start`/`shrink-0`/`w-full sm:w-auto` 的任意组合 |
| 顶部徽章 pill | 25 | **2 套配色**（`bg-geo-500/10` 14 次 vs `bg-brand-500/10` 11 次） | 同一个"标签"组件，两种颜色语义未定义 |
| `.card` | 230 | 1 个 CSS 类 + **5 档内边距** | `global.css:137` |
| URL 审计输入框块（时钟图标 + input + 按钮） | **8 个文件**逐字复制 | 1 | `index` / `tools/*` 各 EN+ZH：`grep -rln 'pl-12 pr-5 py-3.5 rounded-xl bg-white/5'` |
| 手搓卡片（绕开 `.card`） | 17 + 9 | 2 | `rounded-xl bg-white/5 border border-gray-700/50`、`p-5 rounded-xl bg-white/5 border` |
| 行内代码 | 114 | 2 | `text-brand-400 bg-white/5 px-1.5 py-0.5 rounded`(114) vs `text-gray-300 bg-white/5 ...`(10)；好在已在 `global.css:85` 归并为 `.prose code`，但**非 prose 的 114 处仍是手写** |

### 2.3 组件内部的重复（16 个文件内部就有 6 处同构代码）

| 重复物 | 份数 | 位置 |
|---|---|---|
| `var IS_ZH = ...; function t(en, zh){...}` | **13** | 除 `radarChart / trendChart / exportButtons` 外全部 |
| 11 维标签映射表 | **4 份**（EN×3 + ZH×2 交错） | `comparisonPanel.js:4-5`、`dimensionBreakdown.js:6,9`、`radarChart.js:1` |
| `scoreClass()` 阈值→颜色 | 2 | `auditHistory.js:13`、`sitesPanel.js:16`（函数体逐字相同） |
| `LEVEL_ZH` | 2 | `reportHeader.js:6`、`shareButtons.js:8` |
| `LEVEL_CLR` vs `BG_CLR` | 2 个名字 1 张表 | `historyList.js:4`、`reportHeader.js:9` |
| `getChartJs()` 动态 import | 2 | `radarChart.js:59`、`trendChart.js` |
| Chart.js 调色板硬编码 hex | 4 个文件 | `auditHistory.js:104-129`、`radarChart.js:2,20-48`、`trendChart.js:30-62`、`visibilityPanel.js:25` |

### 2.4 【P0】分数分档有**三套**，且其中一套让已发布的研究数据自相矛盾

| # | 来源 | 分档 | 谁在用 |
|---|---|---|---|
| A | `src/lib/scoring.js:41-45` | `≥86` Excellent / `≥68` Good / `≥36` Basic / `<36` Critical | 生产代码的 `level` 字段 |
| A′ | `src/pages/methodology.astro:53-58`（公开的 Score Levels 表） | 86-100 / 68-85 / 36-67 / 0-35 —— **与 A 一致** | 对外方法论页 |
| B | UI 组件 3 个文件 4 处：`auditHistory.js:14-16,109`、`sitesPanel.js:17-19`、`trendChart.js:35` | `≥80` / `≥60` / `≥40` | 历史列表、站点列表、趋势图的三色映射 |
| C | `src/pages/blog/auditing-1200-websites.astro:88-94` | Critical 0-39 / Basic 40-69 / Good 70-85 / Excellent 86+ —— 即 **40/70/86** | 已发布的研究文章（**手写展示文本，不是代码规则**，见下） |

**这里要更正我先前的口径**：我最初把 `dimensionBreakdown.js:20`、`comparisonPanel.js:23` 也算进冲突，那是我读错了——那两处着色的变量是 `d.percentage`（单个维度百分比，见 `dimensionBreakdown.js:17-20`），不是总分。**真正对总分套 80/60/40 的是 3 个文件 4 处（B）**，这一点 `rate-authority-auditor` 的核对是对的。

但这里要标一句：**C 能和文章数字严格对上，不等于 C 是规则** —— 它的边界是从数字反推出来的，证据见本节末尾"支撑 40/70/86 是手写的两条硬证据"。用仓库里的原始数据 `data/geo-audit-v2-final.csv`（有效样本 n=324，取 `score` 列）重算：

| 分档表 | Critical | Basic | Good | Excellent |
|---|---|---|---|---|
| A 36/68/86 | 107 (33.0%) | 184 (56.8%) | 33 (10.2%) | 0 |
| B 40/60/80 | 144 (44.4%) | 113 (34.9%) | 65 (20.1%) | 2 (0.6%) |
| **C 40/70/86** | **144 (44.4%)** | **152 (46.9%)** | **28 (8.6%)** | **0** |

文章 `:88-94` 印的是 **144 / 152 / 28 / 0 = 44.4% / 46.9% / 8.6% / 0%** —— **只有 C 能复现**。

于是 A（方法论页正在对外承诺的那一套）和 C（文章正在对外承诺的那一套）**互斥**：按 A 公布同一批数据，应该是 33.0% / 56.8% / 10.2%，而不是页面上的 44.4% / 46.9% / 8.6%。这不是配色问题，是**同一个站在两个页面上对同一批 324 个站点给出两套分布**。

**冲突的实际后果**（举例，总分 82）：报告头徽章走 A 的 `level=Good` → 蓝（`reportHeader.js:9`）；历史列表走 B 的 `score>=80` → 绿（`auditHistory.js:14`）；趋势图点色走 B → 绿（`trendChart.js:35`）。**同一个 82 分，同一屏，蓝徽章 + 绿数字。**

**修法：统一到 A = 36/68/86**（`DESIGN.draft.md` §1.3 已按此定稿）。

> **口径已两次更正，最终以本节为准。** 我先说"5 文件 10 处"（错，含维度百分比）→ 改为"3 文件 4 处"（`rate-authority-auditor` 指出，成立）→ 又主张"终局取 40/70/86，因为它能复现文章的 144/152/28/0"（**错，循环论证**，同一位指出，成立）。40/70/86 不是规则，是文章里手写的展示文本；为了让已发布百分比继续成立而选区间，等于把尺子改成刚好量出那个数。

| 改动项 | 内容 |
|---|---|
| `scoring.js:42-44` | **不动**（已是 86/68/36，属唯一代码事实） |
| `methodology.astro:53-58` | **不动**（已是 86-100 / 68-85 / 36-67 / 0-35） |
| UI（B 的 3 文件 4 处） | `>=80→>=86`、`>=60→>=68`、`>=40→>=36` |
| `blog/auditing-1200-websites.astro:88-94` | 四组计数改为 **107 / 184 / 33 / 0**（33.0% / 56.8% / 10.2% / 0%），TL;DR 的 44.4%→33.0%、8.6%→10.2%。**这是改正公开数字，不是调整口径** |
| 维度百分比着色 | 跟随同一张表，并把裸 `%` 改为"完成度 82% · 12/12"（分母已在 `dimensionBreakdown.js:31` 显示） |
| `data/demo-report.json` | `score 66 / level Basic`，三套区间下都是 Basic → **无需改** |

**支撑"40/70/86 是手写的"的两条硬证据**（比"能复现"更强，因为它证明了边界的来历）：

1. **git 历史里边界被改过。** `git log -p` 显示上一版用的是 `Critical (0–39) / Basic (40–59) / Good (60–79)`，也就是 **40/60/80**（与 UI 组件同表）；当前版本在同一个提交 `f83bed5`（"study: publish the re-run scores and retire the pre-fix baseline"）里把边界改成了 `40–69 / 70–85 / 86+`，同时把样本从 343 换成 324、中位数 29→41。**边界是和数字在同一次提交里一起改的**——这恰好是"尺子跟着数字走"的实证。
2. **这套区间在 324 样本上的效果是把"好"变稀有、把"优"清零**：同样 324 个站，40/60/80 给 144/113/65/2，40/70/86 给 144/152/28/0。Critical 一格未动（因为下界都是 40），Good 从 65 掉到 28，Excellent 从 2 变成 0。
3. **提交信息自己承认数字全变了，但没提边界也变了。** `f83bed5` 的 message 原文：*"Fixing the robots.txt rule moved aiCrawlability from 0/12 to 12/12 for 331 of 337 sites. That dimension carries 12 of the 98 total weight, so every score in the study moved with it and the post was quoting numbers the tool no longer produces."*（由 `rate-authority-auditor` 找出）——作者知道每个分数都变了、也重跑了，**唯独分档边界是在同一次提交里顺手改的，且没写理由**。
4. **决定性的一条：作者自己的前后对比表用的是 36/68/86，不是文章印的那套。** `data/STUDY.md:175-181` 和同一个提交的 message 都给了 v1∩v2 交集上的前后对比，写着 `Critical 62.9% → 33.9%`、`Good 2.0% → 10.1%`。我用仓库里的 `data/geo-audit.csv`（v1，335 个成功）对 `data/geo-audit-v2.csv`（v2，307 个成功）取交集重算（我重建的交集是 **300** 个 host，他们写 302；2 个 host 的差最多动 0.7pp）：

| 区间 | v1 Critical | v1 Good | v2 Critical | v2 Good |
|---|---|---|---|---|
| **36/68/86** | **63.0%** | **2.0%** | **33.3%** | 10.3% |
| 40/60/80 | 69.7% | 8.7% | 44.7% | 20.7% |
| 40/70/86 | 69.7% | 1.7% | 44.7% | 8.7% |
| STUDY.md 印的 | **62.9%** | **2.0%** | **33.9%** | **10.1%** |

**只有 36/68/86 对得上**：`Good 2.0%` 逐位相同，`Critical 62.9%` 差 0.1pp（1 个 host）；而 40/70/86 在 v1 Critical 上是 **69.7%，差 6.8pp** —— 2 个 host 的差解释不了这个缺口，直接排除。

也就是说：**同一份提交里，作者算回归统计用的是 36/68/86，文章里印的分档表却写 0-39/40-69/70-85/86+。** 代码、方法论页、作者的前后对比三处一致，文章那张表是唯一的孤例。这比"手写文本"强得多——它不是笔误，是同一份工作里两套口径并存。


**另一条做重算时必须先约定的坑**：`data/geo-audit-v2-final.csv` 里 **`score` 列与 11 个维度列不是同一个量**——前者是"归一化到 100 后再扣负向信号/提示注入"的最终分（`scoring.js:32-39`），后者是扣分前的加权和，且权重合计 **98 不是 100**（`scoring.js:1-13`）。

我按 `round(维度和/98*100) − score` 逐行算过全部 324 行：**差值全部 ≥ 0，最小 0、最大 12、中位数 3**，其中 22 行恰好为 0。**全为非负**这一点说明这不是数据损坏，而是扣分段在正常工作（扣分只可能往下走）。所以先前"234 行不一致 / 数据内部矛盾"的说法是**错的，撤回**：两列只是流水线上前后两个阶段。

但它仍然是个复现陷阱：**任何"用 CSV 重算分档"的动作必须声明用哪一列。** 用 `score` 列（产品实际会报出来的分）得 107/184/33/0；用维度列重算会得到另一组分布（口径不同，不可直接对比），这正是同一份数据能被算出两套结论的原因。建议对外统一为"按 `score` 列"。

> 边界：分档区间属**展示/承诺口径**，改它不影响任何费率。但"先修维度再定区间"是不可绕过的前置——见 `DESIGN.draft.md` §1.3 的维度达标表：`structuredData / eeat / discovery` 各只有 1 站达到 80%，`agentFriendliness` **0 站**，且 `agentFriendly.js:23` 用 `/X-RateLimit/i.test(html)` 去匹配响应头名、结构上不可能成立。在 4 个维度压住天花板的前提下调刻度，只是让刻度好看。

**同一个数字，在同一个页面上既是"蓝色 Good"又是"绿色优秀"。** 这不是审美问题，是事实错误，而且是最容易被访客（和对家）抓到的。修法见 `DESIGN.draft.md` §1.3：只保留一套阈值，UI 一律读 `level`，不读数字。

### 2.5 【P1】中文页的雷达图轴标签是英文

`radarChart.js:1` 只有 `const LABELS`（纯英文），没有 `IS_ZH`、没有 `t()` —— 与其余 13 个组件的做法相反。`/zh/` 跑一次审计，11 根轴全是 "AI Crawlability / Structured Data…"。这是 i18n 一致性的破口，也是"设计系统没有单一事实源"的必然结果。

### 2.6 【P1】品牌 mark 有两套实现，且都读成"笑脸"

- EN：`Layout.astro:194-199`，SVG 圆圈 `stroke-width="2"` + 蓝弧 + 两个绿点，配 `gradient-text` 的 "GeoScore"（`text-xl`）
- ZH：`LayoutZh.astro:194`，**没有 SVG**，只有 `<span class="text-geo-500">Geo</span><span class="text-brand-500">Score</span>`（`text-lg`）
- favicon：`public/favicon.svg`，同样的图形但 `stroke-width="2.5"` + 字面 hex（与 header 版本不同粗细）

三个问题：
1. 中英文站的 logo 不是同一个东西（一个带图标、一个纯文字、字号差一档）；
2. 图形本身：圆弧 `M10 20 Q16 8 22 20` 开口朝下 + 两个点落在 y=18（弧下方）→ 在 32px 下**读作笑脸上半部**，不读作"仪表/刻度"；
3. 16px favicon 下，绿环 + 蓝弧两种色相会塌成一团，图形识别度归零。

---

## 3. 视觉记忆点：**没有**（唯一候选覆盖 5/37 页）

### 3.1 判决与证据

问"看一眼能不能记住"——**现在答不能**。原因是：全站唯一有辨识度的处理（绿→蓝渐变文字）只出现在 **5 个文件 / 6 处**，占 37 页的 **13.5%**，且 **16 篇博客文章一篇都没有**。

| 记忆候选 | 实现位置 | 覆盖面 | 判定 |
|---|---|---|---|
| 绿→蓝渐变字 `.gradient-text` | `global.css:145-152` + 闪烁动画 | 5 文件 / 6 处（`index`、`zh/index`、`pricing`、`zh/pricing`、`404`、`reportHeader`） | **唯一候选**，但已经是 SaaS 通用语汇，且覆盖面太小 |
| 渐变评分环（弧 + 渐变数字） | `reportHeader.js:14-19` | **1 处**，且必须跑完审计才出现 | 最强资产，但藏在交互后 |
| 11 维雷达图 | `radarChart.js` | 1 处 | 图形可记忆，但**配色无语义**：11 个点 11 种颜色（`radarChart.js:2`），颜色不编码任何值，属于"假编码"，而且 10 个色不在 token 里 |
| hero 网格/雷达底纹 | `global.css:125-129` + `:64-65` | 3 处 | 图案 fill-opacity 0.03 + 径向 0.08，**基本看不见**（`--pattern-grid` 里 `fill-opacity='0.03'`） |
| 品牌 mark | 见 §2.6 | 全站 | 读成笑脸，不是一个"测量"的动作 |
| 扫描动效 `.scan-step` / `.scan-bar` | `global.css:183-207` | 47 处引用，但只在审计进行中的 2-4 秒 | 有性格，但只在等待态 |

**更直白的判断**：剩下 **32 页**（16 篇博客 + 法律页 + 工具页 + 方法论）的构成是 `#0f172a 底 + .card 卡片堆 + text-sm 灰字 + 绿/蓝少量点缀`，这套配方与任意 Tailwind 深色后台模板不可区分。博客尤其明显：`blog/what-is-geo.astro:19-38` 的模板是 `section.max-w-3xl > article.prose > div.card.p-8.mb-6` 一层套一层，读到第 5 个卡片就失去位置感。

### 3.2 与两个竞品的差异（按 brief 描述，本轮未复核）

- **Otterly.AI**：绿色 + 仪表盘。它把"仪表"做成了产品隐喻——整站都在反复出现盘面。
- **Profound**：深色 + 专业感。深色是它的底座，不靠颜色做记忆，靠密度和排版。
- **GeoScore 现状**：深色**同时**想要绿（geo）和蓝（brand），于是所有强调都是"绿→蓝渐变"。**结果是两个色都没有成为品牌色**——用户记不住"这是那个绿色的"还是"那个蓝色的"。

这是本专项最需要补的一项，但也是唯一无法验收的一项 → 见 §3.3 的赌注条款。

### 3.3 建议（全部标 **赌注**）

> **赌注——零流量下无法验证。** 下面 3 条都无法用行为数据验收，只能验收"是否做到"这个事实本身。

1. **把评分环升格为全站标记（主）**
   现状：`reportHeader.js:14-19` 的渐变弧 + 渐变数字，只在审计完成后出现一次。
   做法：抽成 `ScoreDial` 可复用组件，在首页 hero 用 demo 数据渲染一个静态盘（`data/demo-report.json` 已有 `score/level`），博客文章头部用 64px 小盘体现实例分数，OG 图沿用同一构图。
   可验收：`ScoreDial` 出现页数 ≥ 30/37；环的描边永远取自 `--gradient-brand`（不新增色）。
2. **给两个色分工，禁止"渐变即强调"**
   geo（绿）= 分数/状态值；brand（蓝）= 交互/链接。渐变只允许出现在 ScoreDial 与 hero 的 H1 一处。可验收：`bg-gradient-to-r from-geo-600 to-brand-600` 的实例数从 40 降到 ≤ 6（全部走 `.btn-primary`）。
3. **字体加一层 display（成本最高、风险最大）**
   现状 `--font-sans: system-ui` 全站。加一个可变字重的 display 字（数字优先，因为产品核心是分数）能让"分数"这个数字本身有辨识度。
   **不推荐先做**：多语种（中英）配字成本翻倍，且零流量下无法验证。

---

## 4. 响应式抽查

### 4.1 断点使用（全站）

| 断点 | 像素 | 使用次数 | 判定 |
|---|---|---|---|
| `sm:` | 640 | 44 | 用于 2 件事：按钮从 `w-full` 变 `w-auto`、表单纵向变横向 |
| `md:` | 768 | **66** | 承担几乎全部布局切换（栅格列数、导航折叠） |
| `lg:` | 1024 | **10** | 仅 3 处场景（`px-4 sm:px-6 lg:px-8` 内边距、reportHeader 的 `lg:flex-row`） |
| `xl:` / `2xl:` | 1280 / 1536 | **0** | 未使用 |
| 任意值断点（`min-[...]`） | — | **0** | 未使用 |

**好的一面**：没有自造断点，没有 `min-[900px]` 这种随手值，10 个 `lg:` 也确实是同一套语义（容器内边距）。这部分是成体系的。

**问题**：**全站实际只有 2 层布局（<768 / ≥768）**。`lg` 只做内边距和一处 flex 方向，`xl/2xl` 为零。所以 1440px 下渲染的就是 768px 那套布局，只是两侧留白更多——而它外面还套了一层 `max-w-7xl`（`Layout.astro:220`），内层内容又各自收窄到 `max-w-3xl/4xl`。"宽屏空、内容窄"是必然结果，不是选择。

补充：`md:grid-cols-4` 全站共 3 处（`pricing.astro:54`、`zh/pricing.astro:15`、`seoSupplement.js:16`）。**只有价格卡那两处是问题**——`seoSupplement` 是 `grid-cols-2 md:grid-cols-4` 的短数字格，768 下每格 ~160px 装一个数字够用。所以规则不能写成"禁用 md:grid-cols-4"，而是"**含两个及以上文字元素的卡不得在 md 档排 4 列**"。

### 4.2 三页 × 三档

| 页面 | 390px | 768px | 1440px |
|---|---|---|---|
| `/` | `text-4xl` + **强制 `<br/>`**（`index.astro:102`）→ 实测在 `.ux-mobile.png` 里断成 3 行「Check Your / Website's / GEO Readiness」。`sm=` 仅 2 处（按钮宽度、表单方向）。**首屏 CTA 被 cookie 面板覆盖**（见 §4.3） | `md:` 7 处：工具卡 3 列、文章卡 4 列、数据 3 列、hero `py-8→md:py-16`。布局在此一档全部就位 | 与 768 相同布局，仅 hero 字号 `md:text-6xl`。内容列 `max-w-3xl`(768px) 居中在 1280 容器里 → 两侧各空 256px |
| `/pricing/` | `grid-cols-1`，4 张卡竖排。**无 `sm:`** → 390 与 767 完全一致 | **`md:grid-cols-4`（`pricing.astro:54`）在此档就四列**。算得：`(768−48 内边距−72 间距)/4 = 162px` 卡宽，减 `p-6`(48) = **114px 内容宽**；Pro 卡内还有 `grid-cols-2` 的两个价格按钮 → 每个 ≈45px，而 `$79/yr` 以 `text-lg`(18px) 渲染约 52px → **溢出/挤压** | 同 768 布局。容器 `max-w-5xl`(1024)，1440 下左右各空 208px |
| `/tools/ai-readiness-score/` | 单列卡片流。`sm=` 1 处（输入框横排） | `md:grid-cols-2`（11 维列表，`:97`）。**h1 无 `md:`**（`:61` `text-4xl` 固定）→ 1440 下仍是 36px，与首页 `md:text-6xl`(60px) 差一档 | 内容 `max-w-4xl`(896)。h1 不缩放 → **宽屏下标题显得很小**，是"没有桌面层"最明显的一页 |

### 4.3 【P0】cookie 面板在 390px 首屏压住主 CTA

证据：`.ux-mobile.png`（390×844，仓库现存截图）。图中：
- URL 输入框约 y 500–560，`#audit-btn`（`index.astro:118`）位于其正下方 y ≈ 565–615，只露出渐变按钮的顶边约 8px；
- `#geoscore-consent-banner`（`Layout.astro:274`，`fixed bottom-0`）从 y ≈ 576 起，**把 CTA 整块盖住**。

这不是"挡住了内容"，是**首次访问者在移动端看不到"开始审计"这个唯一动作**。顺带推翻 `ux-review-2026-10-08.md` 里「390px 下 CTA 在 568px，首屏可见 ✅」这条——那条测的是已决策状态（banner 不在），不是首次访问状态。

设计系统层面的根因：面板是 `position:fixed; bottom:0`，**没有给布局预留空间**，也没有在 `html[data-consent="pending"]` 时给 `main` 加底部 padding。这条修起来不涉及审美，纯布局，可以验收（390×844 首屏内 CTA 完全可见）。

### 4.4 其他可验收的响应式缺陷

| 级别 | 问题 | 位置 | 验收方式 |
|---|---|---|---|
| P1 | `:focus-visible` 给所有元素强加 `border-radius:4px`，**键盘聚焦时胶囊按钮会变成 4px 直角** | `global.css:222` | 键盘 Tab 到 `rounded-full` 元素，`getComputedStyle().borderRadius` 应等于其默认值 |
| P1 | 首页 H1 的 `<br/>` 与自动折行叠加，390 下 3 行且断点难看 | `index.astro:102` | 390 宽下 H1 行数 ≤ 2，或去掉 `<br/>` 改 `text-balance` |
| P2 | Pro 卡缺 `text-3xl` 价格槽（Free/Studio/Agency 都有），四个价格卡的"价格区"结构不一致 | `pricing.astro:71-74` | 4 张卡价格槽高度相同 |
| P2 | 标题字号无响应：h1 有 6 种 class、h2 有 15+ 种，其中 25 处 `text-4xl` 完全不带断点 | 全站 | h1 处理方式 ≤ 2 种 |

---

## 5. 缺陷总表

| 级别 | 缺陷 | 证据 | 可验收判据 |
|---|---|---|---|
| **P0** | 分数分档有三套（36/68/86 与 40/60/80 与 40/70/86），且对外两个页面互斥 | `scoring.js:41-45`、`methodology.astro:53-58`、`blog/auditing-1200-websites.astro:88-94`、3 个组件 4 处 | 全站只有 1 处定义分档（36/68/86）；文章四组计数改为 107/184/33/0 并与 CSV 一致 |
| **P0** | 390 首屏 cookie 面板压住主 CTA | `.ux-mobile.png`、`Layout.astro:274` | 390×844 首屏 `#audit-btn` 完整可见（顶+底都在 844 内且无遮挡） |
| **P1** | 渐变 CTA 9 个变体 / 40 处 | §2.2 | 变体 ≤ 3 |
| **P1** | 0 个共享 UI 原语，URL 输入块复制 8 份 | §2.1、§2.2 | 抽出 `AuditInput` / `Btn` / `Card` / `Badge`，新增页面 0 处手写 CTA class |
| **P1** | 中文站 mark 与导航与英文站不一致（无 SVG、无 active 态、链接数 5 vs 8、body 色不同） | `Layout.astro:190-216` vs `LayoutZh.astro:189-211` | 两站共用同一 Header 组件，差异只在文案 |
| **P1** | 中文页雷达轴标签英文 | `radarChart.js:1` | `/zh/` 审计后 11 轴全中文 |
| **P1** | focus-visible 改圆角 | `global.css:222` | 见 §4.4 |
| **P1** | `.card` 圆角硬编码 16px，无法用工具类表达；`rounded-*` 三档并存 | `global.css:137` | 引入 `--radius-*`，`.card` 引用 token |
| **P2** | 8 个死 token / 13 个未承重的语义 token | §1.1 | `@theme` token 数 ≤ 30，且每个 token 至少 1 处非 CSS 引用 |
| **P2** | 11 维雷达 11 色无语义，10 色不在 token 内 | `radarChart.js:2` | 点色 ≤ 2（品牌色 + 状态色），其余点位统一 |
| **P2** | 内容宽度 11 档、卡片内边距 5 档、h2 15 种 | §1.3、§2.2 | 容器 3 档、内边距 3 档、h2 ≤ 4 种 |
| **P2** | `.glass*` 3 条规则仅 3 处使用；`fade-in-delay-1..8` 8 条空规则 | `global.css:132-134, 168-175` | 无用规则清零（空壳类如需保留改注释说明是 JS 钩子） |

---

## 6. 一句话结论

Token 层**写了但没承重**（45 个里 8 个死、13 个只在样式表内自嗨），组件层**只有 1 个真组件**（其余是 40 处手写按钮的 9 个变体），响应式**只有 2 层**（768 一档吃完全站，1440 就是放大版 768），视觉记忆点**唯一候选只覆盖 13.5% 页面**。最该先修的不是"更好看"，而是 §5 里两条 P0——一条是同屏配色自相矛盾、且站内两个页面已对外承诺了两套互斥分档（用仓库 CSV 一秒可证），一条是移动端首屏看不到唯一行动按钮。两条都是事实错误级别，不是审美偏好。
