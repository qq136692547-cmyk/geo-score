# Context Snapshot: geo-score-pro-experience

- timestamp: 2026-08-16T15:49:12Z
- profile: standard (threshold 0.20, max_rounds 12)
- type: brownfield

## Task statement
用户要求 GeoScore 实现"完整的 Pro 体验"。此前审查发现：定价页宣称的 4 项 Pro 能力（Weekly automated audits / 30-day audit history / Regression alerts / PDF export）全部未实现，且现有功能（导出、历史、批量审计、对比、修复文件）全部无 plan 门控。支付订阅链路本身完整（Creem webhook -> D1 users.plan）。

## Desired outcome
真实可交付、名实相符的 Pro 功能 + 清晰免费/付费分层。

## Stated solution (用户初步选择)
第 3 层完整方案：Cloudflare cron trigger + 服务端审计逻辑 + Resend 邮件回归告警，含云端历史与 PDF 导出。

## Known facts / evidence [from-code]
- 后端 worker/payments.js：auth + webhook + subscription，D1 表 users/subscriptions/verify_codes
- wrangler.toml 无 [triggers]，payments.js 无 scheduled handler
- 前端审计全在浏览器端；src/lib/node-scanner.js 已是完整 Node 端审计引擎（13 分析器+scoring+recommendations），node-fetcher.js 用原生 fetch + CORS 代理 fallback
- worker/index.js 是另一个 CORS 代理 Worker（geo-score-proxy），与 payments 独立
- export.js 仅 md/json/csv/html，无 PDF；history.js 为 localStorage 50 条，无 plan 门控
- pricing.astro 宣称 Pro: Weekly automated audits / 30-day audit history / Regression alerts / PDF export
- 免费用户当前可用：单 URL 审计、sitemap 批量(≤20)、对比、历史、4 种导出、修复文件下载

## Constraints
- 构建必须用 hermes node (C:\Users\13669\AppData\Local\hermes\node\node.exe)
- secrets 已注入 Cloudflare（CREEM/RESEND/JWT/GOOGLE 等），不索要不展示
- 部署需 wrangler（本地未装）+ Cloudflare 凭证

## Unknowns / open questions
- "完整 Pro 体验"的确切能力清单与边界（访谈中）
- 免费层应保留/限制哪些功能
- 服务端审计的可用性约束（Cloudflare 子请求配额、目标站屏蔽）的可接受度
- 部署方式（本地 wrangler token vs 手动控制台）

## Likely codebase touchpoints
- worker/payments.js, worker/wrangler.toml, worker/schema.sql
- src/lib/node-scanner.js, node-fetcher.js, scoring.js, analyzers/*
- src/scripts/boot.js, src/scripts/auth.js, src/components/historyList.js
- src/pages/pricing.astro, src/pages/index.astro
- 新增: worker 审计路由、D1 audits 表、cron、邮件告警、PDF 生成
