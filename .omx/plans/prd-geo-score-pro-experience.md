# PRD: GeoScore 完整 Pro 体验（监控 5 域名）— REV2

- status: REV2 (Architect + Critic feedback merged; consensus reached)
- source: .omx/specs/deep-interview-geo-score-pro-experience.md
- architect_review: APPROVE with amendments (10 items, merged in REV1)
- critic_review: APPROVE with amendments (2 items handled in REV2; 1 boundary overridden by user decision)
- date: 2026-08-16

## 0. 用户已决硬约束（不可被评审推翻）
- 免费层保持现状：单次审计、sitemap 批量(20)、多站对比、本地历史、4 种导出(md/json/csv/html)、修复文件下载全部免费、无需登录。
- 只新增 Pro 能力：监控 5 域名 + 周度自动审计 + 30 天云端历史 + 回归告警(>=10分) + PDF 导出。
- 不做：Studio/Agency 实现、团队协作、插件/App、强制免费登录、服务端公开分享。
- 无真实付费账户：验收用模拟 Pro 身份 + 测试 webhook。
- Critic 曾建议"免费=单次审计+修复文件"——与 Round 3 用户裁决 A 冲突，**驳回**，维持现状。

## 1. Requirements Summary
Pro 用户（登录 + 付费）获得真实可用的监控能力：最多监控 5 个域名（定价页英文/中文均为 1 个域名，需改为 5），每周自动服务端审计，云端保存 30 天历史，分数较上次下降 >=10 分触发 Resend 邮件告警，抓取失败跳过保留上次结果（连续 3 次失败才提醒），可下载 PDF 报告。免费用户现有功能完全不变、无需登录。Worker 部署新版 + 前端 gh-pages 上线，定价页文案与实际能力一致。

## 2. Acceptance Criteria（全部可测试）
1. Pro 用户可添加 <=5 个监控域名（host 归一化去 www，子域名独立）；第 6 个返回 409/403。
2. 每周 cron（wrangler [triggers] + scheduled handler）自动审计全部 active 站点并写入 audits 表；source='scheduled'。
3. 分数较上次下降 >=10 分 -> 调用 Resend API 发邮件（测试 mock fetch 断言）。
4. 抓取失败：本轮 audits 记录 status='failed'、error 记录原因；保留上次成功结果；consecutive_failures 达 3 时发提醒邮件并计数归零。
5. audits 中 created_at 超过 30 天被清理（scheduled handler 内执行 DELETE）。
6. Pro 用户 GET /api/audits/:id/pdf 返回 application/pdf，内容含 URL/score/level/维度/建议（校验 %PDF 头与 ASCII 关键字）；非 ASCII 字符替换为 '?' 的策略在验收中明确验证，UI 标注"报告内容为英文"。
7. 免费/未登录调用 /api/sites、/api/audits、/api/audits/:id/pdf 返回 401（未登录）或 403（免费）；现有免费页面功能不受影响。
8. 前端监控面板：Pro 可添加/删除站点（删除提示并级联清除该站点云端历史）、查看云端历史、下载 PDF；免费看到升级提示。
9. 定价页（英文 pricing.astro + 中文 zh/pricing.astro）Pro 卡片与对比表：域名数 1 -> 5，其余 Coming Soon 不变。
10. Worker 部署 + gh-pages 上线后，线上抽查：/health 正常、模拟 Pro 流程走通（本地 wrangler dev + 测试账号置 pro）。
11. 【Arch1】scheduled 模拟"5 站点全部抓取失败"仍能在 Worker 执行限内（<60s）完成，且每站均写出 status='failed' + consecutive_failures 递增。
12. 【Arch2】CORS 预检对 DELETE /api/sites 通过（Access-Control-Allow-Methods 含 DELETE）。
13. 【Arch3】订阅过期（current_period_end < now 且 status=active）的用户调用 Pro API 返回 403（resolvePlan 统一降级 free）。
14. 【Critic1】付费绑定：登录用户点击 Pro 购买时，Creem checkout 携带邮箱（验证 ?customer_email= 参数支持；若 Creem 不支持则评估 Creem API 创建 checkout 或成功回跳+绑定提示），webhook 按 email 激活；测试模拟 checkout.completed webhook 后 users.plan='pro' 且订阅记录正确。

## 3. Implementation Steps（带文件引用）

### 3.1 Worker 服务端审计引擎
- 将 src/lib/node-scanner.js、node-fetcher.js、scoring.js、recommendations.js、analyzers/*.js 复制到 worker/lib/（保持 ESM 相对 import）。
- 前置验证：先用现有 vitest（tests/analyzers/*.test.js、tests/fixtures/*）对复制后的文件跑一遍，确认无浏览器专属 API（DOMParser/window/document）。
- node-fetcher 的 AbortSignal.timeout(15000) 在 Workers compatibility_date 2024-09-25 可用；直连超时降为 8-10s，第三方 CORS 代理 fallback 保留但每代理超时降至 8-10s。
- 【Arch8】防漂移：tests 增加 worker/lib 与 src/lib 对应文件一致性校验（对比文件内容 hash），或提供 sync:worker 脚本。

### 3.2 D1 Schema（worker/schema.sql 追加）
- sites 表：id, user_id, email, host(UNIQUE per user), url, status, last_audit_at, last_score, last_success_at, consecutive_failures, created_at。
- audits 表：id, user_id, email, site_id(NULL 允许), url, host, score, level, summary, dimensions(JSON), negative_signals(JSON), prompt_injection(JSON), recommendations(JSON), raw(JSON 截断), source('manual'|'scheduled'), status('ok'|'failed'), error, created_at。
- 索引：sites(user_id), audits(user_id, created_at), audits(site_id, created_at)。

### 3.3 Worker API（worker/payments.js 扩展）
- CORS：Access-Control-Allow-Methods 增加 DELETE（当前 payments.js:39 仅 GET, POST, OPTIONS）。
- 【Arch3】新增公共 resolvePlan(user, env)：订阅 status 非 active/trialing 或 current_period_end < now 一律按 free；requireAuth 与 handleMe（payments.js:332）共用该逻辑。
- 路由（全部 requireAuth + resolvePlan）：
  - POST /api/sites（Pro，配额 5，host 归一化：new URL(u).hostname.replace(/^www\./,'')，子域名独立）
  - GET /api/sites（Pro，返回站点 + 最近审计摘要）
  - DELETE /api/sites?id=（Pro；【Arch5】事务内级联删除该站点 audits，UI 提示"删除后历史一并清除"）
  - GET /api/audits?site_id=&limit=（Pro，按 created_at DESC）
  - POST /api/audits（Pro：手动审计后保存云端历史；【Arch4】服务端白名单字段归一化 result：score 0-100 校验、dimensions/negative_signals/prompt_injection/recommendations 结构校验，统一 schema 与 cron 结果一致）
  - GET /api/audits/:id/pdf（Pro，返回 PDF）
- 配额与权限检查集中 helper：assertPro(user) / assertSiteOwner(site, user)。

### 3.4 Cron 定时审计（worker/payments.js + wrangler.toml）
- wrangler.toml 增加 [triggers] crons = ["0 3 * * 1"]（每周一 03:00 UTC）。
- 【Arch1】总时间预算与有界并发：
  - 单站点总预算 20s（node-fetcher 直连+代理超时统一 8-10s，三核心资源并行）
  - 站点间 Promise.allSettled 有界并发 3，分批处理；5 站点全失败场景 <60s 内完成
- 【Arch9】收敛单一 auditSite(site, env) 函数：auditUrl -> 写 audits(source='scheduled') -> 对比 last_score：下降 >=10 发邮件 -> 更新 sites(last_score/last_audit_at/last_success_at/consecutive_failures=0)；失败 -> audits(status='failed') + consecutive_failures+1，==3 时发提醒并归零。未来接 Browser Rendering 只换内部实现，schema/API 不变。
- 每批结束写汇总日志（站点数、成功/失败、告警数）到 console，便于 wrangler tail 观测。
- 最后执行 30 天 audits 清理 DELETE。
- 邮件复用 Resend（payments.js:125 模式，env.RESEND_API_KEY）。

### 3.5 PDF 生成（worker/lib/pdf.js 新增）
- 零依赖最小 PDF writer（PDF 1.4 文本+表格）：页眉 URL/日期/score/level，维度百分比表，Top 10 建议。
- 仅 ASCII + WinAnsi 子集；非 ASCII 字符替换为 '?'（【Arch6】UI 明确标注"报告内容为英文"，定价页不承诺中文 PDF；验收验证 PDF 可打开且 ASCII 关键字齐全）。
- 输出：%PDF-1.4 头 + xref 正确，可直接被浏览器/PDF 查看器打开。

### 3.6 前端（src/）
- src/scripts/auth.js：扩展 window.geoscoreAuth 增加 api() 封装（带 Bearer token 调 Worker，401 时清理登录态）。
- src/pages/index.astro：
  - 新增"监控"区块（仅登录+Pro 渲染）：添加 URL 输入、站点列表（score/last_audit_at/删除）、"查看历史"、PDF 下载按钮；免费用户显示 Upgrade 提示。
  - 手动审计完成后（boot.js 内 addToHistory 处）：若 Pro 且用户开启，POST /api/audits 保存云端。
- src/components/sitesPanel.js（新增）：站点管理 UI 渲染逻辑；src/components/auditHistory.js（新增）：历史列表 + 分数趋势（复用 trendChart.js 模式）。
- src/pages/pricing.astro + src/pages/zh/pricing.astro：Pro 卡片与对比表域名数 1 -> 5；FAQ 的 Pro 描述同步补域名数；PDF 说明标注英文报告。
- 【Critic1】Pro 购买绑定：src/pages/pricing.astro / zh/pricing.astro 的 upgrade-pro 点击逻辑（pricing.astro:188-202）：已登录用户跳 Creem checkout 时附加邮箱参数（?customer_email=），未登录仍提示先登录；实现时验证 Creem 参数支持，不支持则评估 Creem API / 成功回跳绑定。

### 3.7 测试（tests/）
- worker 单元：quota.test.js（第 6 域名 409）、hostNormalize.test.js（www/root、子域名独立）、resolvePlan.test.js（过期降级 free）、alert.test.js（下降 >=10 触发邮件 mock）、failurePolicy.test.js（3 连败提醒）、cleanup.test.js（30 天清理）、pdf.test.js（%PDF 头 + ASCII 关键字）。
- worker 集成：api.test.js 用内存 mock DB + mock fetch 覆盖 auth 401/403、sites CRUD（含 DELETE 级联）、audits 保存/列表/归一化校验、pdf 下载、CORS 预检含 DELETE。
- 支付绑定：webhook.test.js 模拟 checkout.completed 事件 -> users.plan='pro' + 订阅 upsert（含 Critic1 的 email 关联路径）。
- cron 模拟：scheduled 测试事件 + 5 站点全失败场景，断言限内完成（<60s）且逐站 failed。
- 一致性校验：worker/lib vs src/lib 文件 hash 比对测试。
- 移植验证：复制到 worker/lib 后跑现有 13 套 analyzer 测试。
- 前端：sitesPanel 渲染逻辑单测（vitest）；无 jsdom 则手工验收。

### 3.8 部署与验收
- 构建：hermes node（C:\Users\13669\AppData\Local\hermes\node\node.exe）。
- 【Arch7】部署顺序固定：cd worker && wrangler d1 execute geoscore-db --file=schema.sql -> wrangler deploy（含 [triggers]）-> wrangler dev --test-scheduled 本地触发 cron 验证 -> 部署后确认 cron 生效（wrangler tail / 控制台 Triggers）。
- 前端：astro build -> 复制 dist 到临时仓库整目录提交 -> push --force gh-pages（勿用 subtree split）。
- 模拟验收：本地 wrangler dev + wrangler d1 execute 把测试账号 plan='pro'，走添加站点->手动审计保存->历史->PDF 全流程；cron 用 --test-scheduled 触发。
- 部署后 /health 抽查 + 观察 wrangler tail 日志。

## 4. Risks & Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| 分析器含浏览器 API 在 Worker 不兼容 | 移植失败 | 复制后先跑现有 13 套 analyzer 测试，逐个排除 |
| 目标站反爬/403，服务端抓不到 | 自动审计不完整 | 直连->CORS 代理 fallback->策略 A（failed 保留上次，3 连败提醒），验收用可访问站点 |
| JS 渲染 SPA 站点 fetch 只拿到空壳 | 内容维度分数偏低 | v1 验收诚实标注 fetch 局限；Browser Rendering 作为演进缝（auditSite 内部实现可替换） |
| 第三方 CORS 代理不可靠/下线 | fallback 失效 | 直连优先；代理超时 8-10s 有界；cron 失败可重试；文档记录限制 |
| 【Critic1】Creem 游客结账 email 关联落空 | 付了钱激活不了 | checkout 携带 customer_email（若支持）；webhook 兜底 email 关联；验收含模拟 webhook 激活；UI 提示登录后购买 |
| PDF 中文乱码/替换 | 报告可读性 | v1 WinAnsi+替换，UI 标注英文；后续迭代加字体 |
| 【Arch10】免费档 Worker CPU 限制（约 10ms/调用） | scheduled 超时 | 验收观察 CPU time；若超限升级 Workers Paid（/mo），不改架构 |
| wrangler 本地未装/凭证缺失 | 无法部署 | 安装 wrangler(hermes node) + 用户提供 token；部署前先本地 dev 验证 |
| cron 免费计划限制 | 定时任务不执行 | Cloudflare 免费计划支持每周 cron；部署后用 --test-scheduled + 控制台验证 |
| D1 配额 | 超限 | 5 站点 x 每周 6 请求 + 历史 30 天，远低于免费限额 |

## 5. RALPLAN-DR Summary（deliberate）

### Principles
1. 简洁优先：零新依赖（PDF 手写、审计引擎复用现有 node-scanner），不引入构建链复杂度。
2. 最小侵入：扩展现有 payments.js 与 D1，不动免费层；现有 13 分析器/评分逻辑不重写。
3. 名实相符：定价页宣称的每一项 Pro 能力都必须真实交付且可验收；无法兑现的（中文 PDF）明确标注。
4. 安全默认：所有新 API 走 JWT 鉴权 + plan 校验 + 资源归属校验（site 属于当前用户）。
5. 可观测可回滚：错误写 error 字段、连续失败计数、scheduled 分批日志，部署前本地模拟验收。

### Decision Drivers
1. 服务端审计能力（cron 自动化）是 Pro 核心，必须能在 Worker 环境稳定运行（含时间预算）。
2. 交付速度与维护成本：优先复用现有 node-scanner 引擎与无依赖方案。
3. 免费层不可回归：前端现有功能零改动是硬约束（用户裁决）。

### Viable Options
**Option A：复用 node-scanner 移植到 Worker（推荐）**
- Pros：已有 13 分析器 + 测试，逻辑一致；零新依赖；手动审计与服务端审计结果可比。
- Cons：需验证 Worker 兼容性；第三方代理 fallback 在 Worker 环境可用性未知；JS 渲染站点内容维度偏低。

**Option B：服务端只做"抓取+转存"，分析仍走浏览器端**
- Pros：Worker 改动最小。
- Cons：cron 无法复用浏览器逻辑，自动审计没有分析结果；方案不成立。

**Option C：引入 Cloudflare Browser Rendering**
- Pros：真实浏览器渲染，抓取成功率与 JS 站点支持最佳；是监控服务业界标准答案。
- Cons：付费服务、复杂度高、成本不可控；本期违背简洁原则。
- 综合结论：不简单否决，保留为明确演进缝（auditSite 内部实现可替换），未来 Pro 收入稳定后评估。

**Invalidation rationale**：B 无法实现 cron 自动审计（核心需求）；C 本期成本/复杂度不可接受，但其论证成立，作为架构演进方向保留。

### Pre-mortem（3 scenarios）
1. **Worker 部署后分析器报错**：某分析器用了浏览器 API 导致 scheduled 崩溃。缓解：移植后先跑 13 套现有测试；auditSite 内逐站点 try/catch，单站失败不影响全局；错误写入 audits.error。
2. **cron 触发但全部抓取失败**：目标站屏蔽数据中心 IP，5 个域名全 failed。缓解：直连->代理 fallback；时间预算+有界并发保证限内完成并逐站写 failed；连续 3 次才发邮件；验收前用真实可访问站点验证。
3. **PDF 中文乱码导致用户投诉**：缓解：v1 明确 ASCII 子集+替换，UI 标注英文；定价页不承诺中文 PDF；后续迭代加字体。

### Expanded Test Plan
- Unit：quota、host 归一化、resolvePlan（过期降级）、alert 阈值、failure policy、cleanup、pdf writer。
- Integration：api.test.js（mock DB + mock fetch）：auth 401/403、sites CRUD（含 DELETE 级联）、audits 保存/归一化/列表、pdf 下载、CORS DELETE 预检；webhook.test.js（checkout.completed -> plan=pro）。
- E2E/模拟：wrangler dev + --test-scheduled（含 5 站点全失败限内完成断言），测试账号 plan=pro 走全流程；线上部署后 /health + 抽查。
- Observability：scheduled 每批汇总日志；sites.consecutive_failures 可见；wrangler tail；CPU time 观察。

## 6. ADR（共识决策记录）
- **Decision**：采用 Option A（复用 node-scanner 移植到 Worker），零新依赖，扩展现有 geoscore-payments Worker，新增 D1 sites/audits 表 + JWT 鉴权 API + 每周 cron + Resend 告警 + 手写 PDF；前端新增 Pro 监控面板，免费层零改动。
- **Drivers**：服务端 cron 审计是 Pro 核心；复用已有 13 分析器与测试降低成本与风险；免费层零回归是用户硬约束；简洁优先（零新依赖）。
- **Alternatives considered**：B（服务端仅抓取转存，无法支撑 cron 分析，否决）；C（Browser Rendering，成本复杂度高，保留为演进缝）。
- **Why chosen**：A 是唯一同时满足"cron 自动审计 + 复用现有引擎 + 免费层零回归 + 简洁"的选项；Architect/Critic 的修正（时间预算、resolvePlan、级联删除、checkout 绑定、防漂移等）已全部合入，风险可控。
- **Consequences**：Worker 代码量显著增加（审计引擎+API+cron+PDF）；scheduled 有 10ms CPU/免费档限制风险（观察后决定是否升 Paid）；JS 重站点内容维度评分偏低（诚实标注+演进缝）；PDF 仅英文（v1）。
- **Follow-ups**：中文 PDF 字体、Daily/Hourly 频率（Studio/Agency）、Browser Rendering 评估、Workers Paid 评估。

## 7. Review Amendments Log
- REV1（Architect，10 项）：cron 时间预算+并发、CORS DELETE、resolvePlan、audits 归一化、级联删除、PDF 标注、部署顺序、防漂移、auditSite 收敛+演进缝、CPU 风险。
- REV2（Critic，2 项采纳 + 1 项驳回）：
  - 采纳 C1：Creem checkout 绑定登录用户（customer_email + webhook 兜底 + 验收）-> AC14, 3.6, 风险表。
  - 采纳 C2：中英文定价页都要改（zh/pricing.astro 域名 1->5）-> AC9, 3.6。
  - 驳回 C3：Critic 建议"免费=单次审计+修复文件"与用户 Round 3 裁决（免费层保持现状）冲突，维持用户决策。
