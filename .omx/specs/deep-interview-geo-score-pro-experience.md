# Deep Interview Spec: GeoScore 完整 Pro 体验

- profile: standard | rounds: 7 | final_ambiguity: 0.15 | threshold: 0.20 | type: brownfield
- context_snapshot: .omx/context/geo-score-pro-experience.md
- transcript: .omx/interviews/geo-score-pro-experience-*.md

## Intent
把 GeoScore 付费墙从"名义"变为"真实完整"：Pro 付费用户获得真正可交付的能力，免费/Pro 分层清晰，兑现定价页承诺、支撑转化与口碑。

## Desired Outcome
Pro 用户（登录+付费）可监控 5 个域名、每周自动审计、30 天云端历史、回归告警邮件、PDF 导出；免费用户现有功能完全不变（无需登录）；线上部署新版且定价页文案与实际一致。

## In-Scope
1. Worker 服务端审计引擎：复用 src/lib/node-scanner.js + node-fetcher.js（13 分析器）移植到 Cloudflare Worker
2. D1 新增表：sites（监控站点）、audits（云端历史）
3. 云端历史 API：保存/列表/删除（Pro + JWT 鉴权）
4. 监控管理 API：添加/删除站点，上限 5 域名（Pro）
5. Cron 定时任务：每周自动审计全部监控站点（wrangler [triggers] + scheduled handler）
6. 回归告警：分数较上次下降 >=10 分发邮件（Resend）；抓取失败跳过保留上次结果，连续 3 次失败才提醒
7. PDF 导出 API：Worker 端生成（Pro）
8. 前端：监控管理 UI（添加/删除 5 域名、云端历史列表、PDF 下载）、plan 门控
9. 定价页文案与实际能力对齐
10. 测试：审计引擎/配额/告警阈值单元测试 + API 集成测试 + 模拟 Pro 验收
11. 部署：wrangler + Cloudflare token 部署 geoscore-payments；前端 gh-pages

## Out-of-Scope / Non-goals
- Studio/Agency 档位保持 Coming Soon，不实现
- 团队/多用户协作（邀请、权限）
- 浏览器插件 / 移动 App
- 免费用户强制登录
- 服务端托管公开分享报告（保持现有 ?audit= 机制）
- 免费层现有功能一律不动
- 不调整定价、不新增支付方式

## Decision Boundaries（用户授权"都行"）
- 监控频率：周度（cron 每周）
- 回归告警阈值：>=10 分
- 云端历史保留：30 天，自动清理
- PDF：Worker 端生成
- 部署：wrangler + 用户提供 Cloudflare token
- 技术选型自主：PDF 库、cron 表达式、域名归一化（www/root 归一，子域名独立）、抓取失败策略（方案 A）

## Constraints
- 构建必须用 hermes node (C:\Users\13669\AppData\Local\hermes\node\node.exe)
- secrets 已注入 Cloudflare（CREEM/RESEND/JWT/GOOGLE），不索要、不展示
- 服务端审计受 Cloudflare 子请求配额限制（每次审计 3-6 个请求，免费计划 1000/天，可接受）
- 目标站反爬：直连失败 -> CORS 代理 fallback -> 仍失败按策略 A
- 无真实付费账户：验收用模拟 Pro 身份 + 测试 webhook，不触碰真实支付
- PowerShell 将 stderr 当错误，退出码 1 可能实际成功

## Testable Acceptance Criteria
1. Pro 用户可添加 <=5 个监控域名；第 6 个被拒绝
2. 每周 cron 自动审计所有监控站点，写入 audits 表
3. 分数较上次下降 >=10 分 -> Resend 邮件发出（mock 验证）
4. 抓取失败：本轮标记 failed、保留上次成功结果；连续 3 次 failed -> 邮件提醒
5. audits 记录 30 天过期清理
6. Pro 用户可下载 PDF（含 URL/分数/维度/建议）
7. 免费用户：现有功能全部可用、无需登录；调用 Pro API 返回 401/403
8. 定价页 Pro 文案与实际能力一致
9. Worker 部署新版 + 前端 gh-pages 上线，线上抽查验证

## Pressure-pass findings
- Round 7 场景压力：服务端抓取失败容忍策略定为 A（跳过保留上次，3 连败提醒）
- Round 2->3 边界确认：免费不能监控 + 免费层保持现状

## Technical context findings [from-code]
- src/lib/node-scanner.js 已是完整 Node 端审计引擎（13 分析器 + scoring + recommendations），可直接移植
- src/lib/node-fetcher.js：原生 fetch + CORS 代理 fallback（allorigins/codetabs/corsproxy），Worker 端兼容
- worker/index.js 是独立 CORS 代理 Worker（geo-score-proxy），可参考其 fetch 模式
- worker/payments.js 已有 JWT verify、webhook、subscription 查询，可直接扩展 API 层
- 前端 src/scripts/auth.js 已暴露 window.geoscoreAuth.getCurrentUser() 含 plan
- 当前无 .omx 目录/omx CLI，本 spec 与 transcript 手写维护

## Handoff
下一阶段（用户已指定）： 制定并评审方案 ->  拆解执行步骤。本 spec 为需求源；不在此阶段实现。
