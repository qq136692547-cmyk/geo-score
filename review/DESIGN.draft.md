# GeoScore DESIGN.md（草案 v0.1）

> 状态：**草案**，2026-10-22 由设计系统诊断产出。配套诊断见 `review/02-design-system.md`。
> 本文件是**规范**，不是现状描述。凡是"目标"必须可计数验收；凡是不可验收的判断一律标 **赌注**。
> 适用范围：`src/styles/global.css`、`src/layouts/*`、`src/components/*`、`src/pages/**`。

---

## 0. 三条总规则

1. **一个语义只有一种实现。** 分数配色、按钮、卡片、徽章各只有一个来源。发现第二份实现视为缺陷，不视为变体。
2. **token 必须承重。** 在 `@theme` 里声明但无引用的 token 视为缺陷（当前 8 个）。新增 token 必须同时在同一次提交里至少改一处使用点。
3. **断点只有 3 个，容器只有 3 档。** 不许出现 `min-[900px]` 之类随手值。

---

## 1. 颜色

### 1.1 基底（唯一深色主题，不做浅色）

| 角色 | token | 值 | 用途 | 禁止 |
|---|---|---|---|---|
| 页面底 | `--color-surface-base` | `#0f172a` | `body` | 页面里再写 `bg-[#0f172a]` |
| 抬升面 | `--color-surface-raised` | `rgba(30,41,59,0.6)` → 合成 `#182234` | `.card` | 用 `bg-white/5` 当卡片底（合成 `#1b2335`，肉眼与卡片同色，会造成两套实现） |
| 内嵌行 | `--color-surface-inset` | `rgba(255,255,255,0.05)` | 卡内的行/输入框/列表项 | 用 `bg-white/10` 表同层级（视觉上跳一级） |
| 凹陷井 | `--color-surface-well` | `rgba(15,23,42,0.5)` | 代码块 | — |
| 描边弱 | `--color-border-subtle` | `rgba(148,163,184,0.1)` | 卡片边框 | — |
| 描边中 | `--color-border-medium` | `rgba(148,163,184,0.2)` | 卡片 hover、分隔线 | 用 `border-gray-700/50`（91 处现状） |

**现状迁移（可验收）**：`bg-white/5` 保留为工具类使用，但**新增 `.card` 内不允许再出现 `border border-gray-*`**；`border-gray-700/50` 从 91 处降到 0（改为 `border-subtle` 工具类或 `.card` 自带）。

### 1.2 品牌双色分工（**当前最需要定死的一条**）

| 色 | token | 语义 | 允许出现的位置 |
|---|---|---|---|
| 绿 `geo` | `--color-geo-400/500/600` | **结果值**：分数、状态、通过项、达成 | 分数数字、评分环起始端、通过图标、进度条达标段 |
| 蓝 `brand` | `--color-brand-400/500/600` | **交互**：链接、按钮、焦点、选中 | 链接、CTA、focus ring、导航 active、图表主线 |
| 渐变 | `--gradient-brand` | **只给"评分"这一件事** | ScoreDial 的弧 + H1 一处；**不许**用于按钮 |

**可验收**：`from-geo-600 to-brand-600` 的实例数从 40 → **0**（全部改为 `.btn-primary` 单色或 `.btn-primary` 使用渐变但只此一处定义）；`bg-gradient-to-*` 手写实例 ≤ 3。

> 这一条是在解决诊断里指出的"两个色都没成为品牌色"：绿蓝同时对等出现，等于两个都不是主色。分工后绿=结果、蓝=操作，语义可记，也不影响现有观感（视觉上改动极小）。

### 1.3 评分状态色（**P0：只允许一套阈值**）

唯一事实源：`src/lib/scoreBands.js`（待建，导出 `SCORE_BANDS` 与 `levelOf()`）。

**区间取 36 / 68 / 86。**

> 本节 v0.2 曾改为 40/70/86，现**回退**。理由由 `rate-authority-auditor` 推翻并经复核成立：40/70/86 不是任何代码路径会算出来的规则，它是 `blog/auditing-1200-websites.astro` 里手写的展示文本。我原先的论证（"只有 40/70/86 能复现文章的 144/152/28/0，所以它才是真规则"）是循环论证——文章的分档计数本来就是按那三段手画出来的桶数出来的，当然只有那三段能复现。**为了让已发布的百分比继续成立而选区间，等于把尺子改成刚好量出那个数。** 项目唯一真正值钱的资产是 `data/STUDY.md` 里"撤回了一个没有证据的结论"；改阈值迁就旧数字与它正好相反。**改文章是更正，改阈值是倒推。**

| 等级 | 区间 | 底色 | 文字色 | 语义 |
|---|---|---|---|---|
| Excellent | `≥ 86` | `bg-geo-500` `#22c55e` | `text-geo-500` | AI 基本无阻塞 |
| Good | `68 – 85` | `bg-brand-500` `#3b82f6` | `text-brand-500` | 有明确缺口 |
| Basic | `36 – 67` | `bg-warn-500` `#eab308` | `text-warn-500` | AI 难以理解 |
| Critical | `< 36` | `bg-danger-500` `#ef4444` | `text-danger-500` | 近乎不可见 |

规则：
- **UI 只读 `levelOf(score)`，不读数字。** 禁止再出现区间字面量。现状：3 个文件 4 处对总分硬编码 `80/60/40`（`auditHistory.js:14-16,109`、`sitesPanel.js:17-19`、`trendChart.js:35`）。
- `methodology.astro:53-58` 的公开表**不用改**——它已经是 86-100 / 68-85 / 36-67 / 0-35，与本表一致。
- `data/demo-report.json`（66 → Basic）在三套区间下都是 Basic，不用改。
- 需要同批更正 `blog/auditing-1200-websites.astro:88-94` 的四组计数（107 / 184 / 33 / 0，即 33.0% / 56.8% / 10.2% / 0%）及 TL;DR 里的 44.4% / 8.6%（→ 33.0% / 10.2%）。这是**改正公开数字**，不是调整口径。
- 删除 `@theme` 里的 `--color-score-*` 四个 token（0 引用），配色改由 `SCORE_BANDS` 单一导出。

**前置条件（比选哪套区间更重要）**：这套量表目前**天花板被 4 个坏维度压住**。用 `data/geo-audit-v2-final.csv`（n=324）按各维度满分统计"达到该维度 80% 的站点数"：

| 维度 | 达标站数 | 满分站数 |
|---|---|---|
| aiCrawlability | 320 (98.8%) | 317 |
| citationReadiness | 245 (75.6%) | 229 |
| metaSocial | 151 (46.6%) | 100 |
| contentQuality | 97 (29.9%) | 30 |
| aiGuidance | 48 (14.8%) | 35 |
| freshness | 37 (11.4%) | 37 |
| brandEntity | 13 (4.0%) | 13 |
| structuredData | **1 (0.3%)** | **0** |
| eeat | **1 (0.3%)** | **0** |
| discoveryEndpoints | **1 (0.3%)** | 1 |
| agentFriendliness | **0 (0%)** | **0** |

**没有任何一站 11 个维度全部 ≥80%；"该站最低维度完成度"的中位数是 0%。** 其中 `agentFriendliness` 结构上不可能拿满分：`src/lib/analyzers/agentFriendly.js:23` 用 `/X-RateLimit|x-ratelimit/i.test(html)` 去匹配**响应头名**，而 `html` 是正文——响应头永远不会出现在正文里。

所以在修完 discovery / agent / schema 之前，**换哪套区间都只是给一个天花板被压住的量表调刻度**。本表先按 36/68/86 定死（因为它是唯一代码真会算的东西），但 DESIGN 不承诺这组数字是最终产品口径：修完维度后应按可陈述的原则（例如"11 个维度全部 ≥80% 才算 Excellent"）反推区间，并标注生效版本。

**为什么维度百分比跟随同一张表**：维度百分比与总分都是"0–100 的一个数"，且在同一个报告面板里相邻呈现（总分环 + 维度条）。同一屏同一单位两种映射，用户不会去区分"这是总分的口径"。我采纳 `rate-authority-auditor` 的条件——**必须让口径可见**：`dimensionBreakdown.js:31` 已经在每行渲染 `82% · 12/12`，分母本来就是可见的，因此只需把裸 `%` 改为"完成度 82% · 12/12"，不新增脚注。

**可验收**：全站区间字面量只有 1 处（`scoreBands.js`）；`methodology.astro` 与本表逐行一致；文章四组计数与 CSV 用 36/68/86 重算一致。

---

## 2. 间距刻度

基数 4px。**卡片内边距只用 3 档**（现状 5 档：16/20/24/32/8）。

| 档位 | px | 用途 |
|---|---|---|
| `p-4` | 16 | 紧凑卡（列表行、内嵌块、报告子面板） |
| `p-6` | 24 | 标准卡（**默认**） |
| `p-8` | 32 | 内容卡（博客正文块、工具页主卡） |

垂直节奏（页面级）：`py-8`（区块内）/ `py-12`（区块间）/ `py-16`（hero）。

**可验收**：`p-5`、`p-2` 作为卡片内边距的出现次数 → 0；新增卡片只用 4/6/8。

---

## 3. 字号与字重

现状 10 档、`text-sm` 用了 459 次。**收成 6 档**：

| 角色 | class | 说明 |
|---|---|---|
| 大标题 H1 | `text-4xl md:text-5xl font-extrabold tracking-tight` | 全站统一；首页 hero 允许 `md:text-6xl`（唯一例外） |
| 区块标题 H2 | `text-2xl font-bold` | 不再出现 `text-xl`/`text-lg` 的 H2（现状 15 种） |
| 小节标题 H3 | `text-lg font-semibold` | |
| 正文 | `text-base text-gray-300` | 营销段落、prose |
| 界面正文 | `text-sm text-gray-400` | **产品 UI 默认**（报告、卡片、列表） |
| 辅助 | `text-xs text-gray-500` | 时间戳、单位、脚注 |

**可验收**：h1 的 class 组合 ≤ 2 种（现状 6 种）；h2 ≤ 4 种（现状 15+ 种）。

字体：`--font-sans: system-ui...` 保持不变（见 §7 赌注 3）。

---

## 4. 圆角 / 层级 / 动效

| token | 值 | 用途 |
|---|---|---|
| `--radius-control` | `8px` | 按钮、输入框、标签 |
| `--radius-surface` | `16px` | 卡片、面板（`.card` 改为引用此 token，不再硬编码） |
| `--radius-full` | `9999px` | 徽章 pill、圆点 |

- 现状 `rounded-lg`(158) / `rounded-xl`(121) / `rounded-md`(3) 三档并存 → **引入上述 2 个 token 后，`rounded-xl` 只允许出现在卡片上，其余一律 `rounded-lg`**。
- z-index 两级：`--z-header: 50`、`--z-overlay: 60`。不许新增。
- 动效时长沿用 `--duration-normal: 300ms` + `--ease-out-expo`。`duration-fast` / `duration-slow` 无引用 → 删除，需要时用 normal。
- **`:focus-visible` 不得改 `border-radius`**（`global.css:222` 现在强加 4px，导致胶囊按钮键盘聚焦时变直角）。改为只设 `outline` + `outline-offset`。

**可验收**：`getComputedStyle(focusedPill).borderRadius` === 未聚焦时的值。

---

## 5. 组件清单

### 5.1 必须存在的原语（现在一个都没有）

| 组件 | 现状替代 | 变体上限 | 状态 |
|---|---|---|---|
| `Btn` | 40 处手写渐变串 / 9 变体 | **3**：`primary`（绿实或渐变单一来源）、`secondary`（`bg-white/10`）、`ghost`（文字+边框） | default / hover / active / disabled / focus |
| `Card` | `.card` 230 处 + 17 处手搓 | **2**：`default`、`interactive`（hover 抬边） | 内边距 3 档 |
| `Badge` | 25 处、2 套配色（geo/brand） | **2**：`status`（吃 §1.3 等级色）、`neutral`（`bg-gray-700`） | — |
| `AuditInput` | 8 个文件逐字复制的 URL 输入块 | **1** | 空 / focus / invalid / loading |
| `Section` | 每页各写 `max-w-*` + `py-*` | **3**：`page`(排他)、`prose`(768)、`wide`(1024) | — |
| `ScoreDial` | `reportHeader.js:14-19` 内联一次 | **3 档尺寸**：96/128/192 | 静态（无动画）/ 动画（审计后） |

### 5.2 保留的现有组件（命名统一）

`src/components/*.js` 14 个 `render<名词>` 命名统一，**保留**。需修：
- `renderRadarContainer` / `renderTrendContainer` → 改名 `renderRadarChart` / `renderTrendChart`，或移入 `src/components/charts/`。
- 抽出 `src/lib/i18n.js` 提供 `t(en, zh)`（现状 13 份复制）。
- 抽出 `src/lib/dimensions.js` 提供 11 维标签表（现状 4 份，其中 `radarChart.js` 缺中文 → 顺带修 §2.5 的 P1）。
- 抽出 `src/lib/scoreBands.js` 提供 §1.3 唯一阈值（现状三套区间：`scoring.js`、`methodology.astro`、`blog/auditing-1200-websites.astro`，外加 3 个组件文件 4 处硬编码）。

**可验收**：`grep -c 'var IS_ZH' src/components/*.js` → 0；`DIM_LABELS` 定义处 → 1；`scoreClass` 函数 → 1。

### 5.3 复用率（现在的基线 / 目标）

| 指标 | 现状 | 目标 |
|---|---|---|
| 共享 UI 原语数量 | **0**（唯一 `.astro` 组件是广告位） | 6 |
| 手写渐变按钮实例 | 40（9 变体） | ≤ 6（1 变体） |
| 徽章配色套数 | 2（geo/brand 混用） | 2（按 `status`/`neutral` 定义，不按颜色） |
| URL 输入块复制份数 | 8 | 1 |
| 卡片内边距档位 | 5 | 3 |
| 容器宽度档位 | 11 | 3 |

---

## 6. 响应式规则

### 6.1 断点（3 个，语义固定）

| 断点 | px | 唯一的语义 |
|---|---|---|
| `sm` | 640 | **表单/按钮从竖排变横排**（`flex-col → flex-row`，`w-full → w-auto`）。不做栅格变更 |
| `md` | 768 | **栅格列数变更**（1 列 → 2/3 列）。**4 列必须等到 `lg`** |
| `lg` | 1024 | **桌面排版**：4 列栅格、H1 放大、侧栏出现 |

`xl` / `2xl` **不使用**（保持现状 0）。

**可验收**：`grep -rn 'md:grid-cols-4' src` 的结果中，**含两个及以上文字元素的卡片**为 0。现状 3 处里 `pricing.astro:54`、`zh/pricing.astro:15` 需改为 `md:grid-cols-2 lg:grid-cols-4`（消掉 §4.2 算出的 114px 卡宽挤压）；`seoSupplement.js:16` 的 `grid-cols-2 md:grid-cols-4` 是短数字格，保留。

### 6.2 容器（3 档）

| 名字 | 宽度 | 用途 |
|---|---|---|
| `page` | `max-w-3xl` (768) | 所有阅读型页面：博客、方法论、法律页、工具页正文 |
| `wide` | `max-w-5xl` (1024) | 定价、报告结果、对比 |
| `full` | `max-w-7xl` (1280) | 仅 Layout 外框（导航/页脚） |

现状首页一页用 7 档宽度（`2xl/3xl/4xl/6xl/lg/xl/none`）→ 收到 3 档。

**可验收**：`max-w-` 不同取值数 ≤ 3（`max-w-none` 用于 prose 内部除外）。

### 6.3 首屏安全区（P0 修复的规则）

`#geoscore-consent-banner` 是 `fixed bottom-0`，**必须在 `html[data-consent="pending"]` 时给 `main` 加等高的 `padding-bottom`**，或把面板改为不遮挡 CTA 的位置。

**可验收**：390×844、首次访问（无 localStorage）、不滚动的情况下，`#audit-btn` 的 `getBoundingClientRect()` 完整可见且 `document.elementFromPoint(center)` 返回按钮本身。

### 6.4 标题折行

H1 里**不用 `<br/>`** 控制断行（`index.astro:102` 现状导致 390 下 3 行）。改用 `text-balance`（Chrome 114+）或让容器宽度决定。

**可验收**：390px 下 H1 行数 ≤ 2。

---

## 7. 视觉记忆点

### 7.1 主标记：**ScoreDial（渐变评分环）**

现状：`reportHeader.js:14-19`，只在审计完成后出现 1 次。
问题：站点最有性格的元素藏在交互之后，37 页里 36 页看不到。

规则：
- 环的描边**永远**取 `--gradient-brand`（绿→蓝），不新增色。
- 环内数字用 `gradient-text`，字号随环径等比：96px 环 → `text-2xl`，128 → `text-4xl`，192 → `text-5xl`。
- 出现位置（目标 ≥ 30/37 页）：首页 hero 用 `data/demo-report.json` 的静态分数渲染一个 192px 环；工具页副标题旁 96px 环；博客文章头部若被引用则用 96px 环体现实例；OG 图沿用同一构图。
- **不许**在环上叠加第二种装饰（光晕、脉冲、虚线），环本身就是标记。

**可验收**：`ScoreDial` 组件出现在 ≥ 30 个页面；全站 `stroke="url(#scoreGrad)"` 定义处 === 1。

### 7.2 副标记：扫描动效（保留，不扩张）

`.scan-step` / `.scan-bar`（`global.css:183-207`）是全站第二个有性格的东西，且与产品行为强绑定。规则：**只在审计进行中的等待态出现**，不许当 loading 骨架屏复用到其他地方。

### 7.3 需要砍掉的"伪记忆点"

| 元素 | 问题 | 处置 |
|---|---|---|
| `--pattern-grid` hero 底纹 | `fill-opacity='0.03'`，`global.css:64` —— 看不见，但每次都要传一段 data-URI | 要么提到 0.06 并只留 `+` 网格（去掉径向叠加），要么删 |
| `.glass` / `.glass-light` | 3 条规则、3 处使用，模糊对象是深色卡片，`backdrop-filter` 几乎无效果 | 删除（保留 `.card`） |
| `fade-in-delay-1..8` | 8 条**空规则** `{ }`，同时也作 JS 钩子 | 保留类名，删除空壳规则，改为注释说明"仅 JS 钩子" |
| 雷达图 11 色 | 颜色不编码任何值（`radarChart.js:2`，10 色不在 token 内） | 点统一 `--color-brand-500`，只在最低分的 1-2 个点点 `--color-danger-500`（让颜色重新携带信息） |

### 7.4 赌注（无法验收）

> **赌注——零流量下无法验证。** 以下 3 条改动无法用任何行为数据判断成败，只能判断"是否执行"。

1. **把 ScoreDial 提到全站标记位**（§7.1）。赌的是"一个反复出现的测量盘面，比一句渐变大标题更能让人记住这是一个测分数的工具"。
2. **绿=结果 / 蓝=操作 的强制分工**（§1.2）。赌的是"减少一种强调手段会让品牌更清晰，而不是更平淡"。
3. **加 display 字体（数字优先）**。成本最高，中英双语配字风险大，**建议不先做**。若要做，先只换数字字形（`tnum` + 一个可变字重数字字），正文保持 system-ui。

---

## 8. 治理规则

1. 新增 `@theme` token 必须在**同一次提交**里出现 ≥1 处引用，否则 CI 失败。
2. 新增渐变按钮 / 新徽章配色 / 新容器宽度 → 视为回归，PR 阶段打回。
3. `src/layouts/Layout.astro` 与 `LayoutZh.astro` 的差异**只允许出现在文案与 `lang`**。Header/Footer/Consent 抽成组件（现状：ZH 版少一个 SVG logo、少 3 个导航项、少 active 态、body 色不同，已在诊断 §2.6 记录）。
4. 每条 `rgba()` / hex 若出现在 `.astro` 或 `.js` 里，必须能回答"为什么不走 token"。

**可验收（季度）**：`@theme` token ≤ 30 个；死 token = 0；`bg-gradient-to-r from-geo-600` = 0；价格卡类 4 列 `md:grid-cols-4` = 0；h1 class 组合 ≤ 2。

---

## 附：与现状的差异摘要（改这个文件的人先看这里）

| 项 | 现状 | 本规范 |
|---|---|---|
| `@theme` token 数 | 45（8 死） | ≤ 30（0 死） |
| 评分阈值 | 三套（36/68/86、40/60/80、40/70/86），且方法论页与研究报告互斥 | 一套（36/68/86），UI 只读 `levelOf()` |
| 共享 UI 组件 | 0 | 6 |
| 渐变按钮变体 | 9 | 1 |
| 断点 | 3 用 / 2 未用 / 无桌面层 | 3，语义固定，`md:grid-cols-4` 禁用 |
| 容器宽度档位 | 11 | 3 |
| 卡片内边距档位 | 5 | 3 |
| 视觉标记覆盖 | 5/37 页 | ScoreDial ≥ 30/37 页 |
| 深浅色 | 仅深色 | 仅深色（不新增浅色，避免双主题维护成本） |
