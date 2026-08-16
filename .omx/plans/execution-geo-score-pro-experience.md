# Execution Plan: GeoScore 完整 Pro 体验

- source: .omx/plans/prd-geo-score-pro-experience.md (REV2, consensus reached)
- build_node: C:\Users\13669\AppData\Local\hermes\node\node.exe
- date: 2026-08-16

## Phase 0 — 准备（前置）
- [x] 0.1 环境：确认 wrangler 可用（hermes node 执行 npx wrangler --version）；向用户索取 CLOUDFLARE_API_TOKEN（仅部署阶段需要）；确认 git 工作树干净
- [x] 0.2 引擎移植预检：复制 src/lib/{node-scanner,node-fetcher,scoring,recommendations,analyzers}*.js 到 worker/lib/，用 hermes node 跑现有 tests/analyzers/*.test.js，全部通过后再继续
  验证：vitest 13 套 analyzer 测试全绿；无 DOMParser/window/document 引用

## Phase 1 — Worker 后端
- [x] 1.1 D1 schema：worker/schema.sql 追加 sites + audits 表（含索引、host 唯一约束）；本地 d1 execute 先行验证 SQL
  验证：sqlite 语法通过；表结构符合 PRD 3.2
- [x] 1.2 payments.js 基建：CORS Allow-Methods 加 DELETE；新增 resolvePlan(user,env) 与 requireAuth(request,env)（复用 verifyJWT）；handleMe 改为走 resolvePlan
  验证：node 单测——过期订阅 resolvePlan 返回 free
- [x] 1.3 sites API：POST/GET/DELETE /api/sites（Pro 校验、host 归一化去 www、配额 5、DELETE 事务级联删 audits）
  验证：quota.test.js（第 6 个 409）+ api.test.js（401/403/CRUD/级联）
- [x] 1.4 audits API：GET /api/audits?site_id=&limit=、POST /api/audits（白名单归一化校验）、GET /api/audits/:id/pdf
  验证：api.test.js + pdf.test.js（%PDF 头 + 关键字）
- [x] 1.5 PDF 生成器：worker/lib/pdf.js（零依赖，ASCII/WinAnsi，维度表 + Top10 建议）
  验证：pdf.test.js 结构断言；浏览器/查看器可打开
- [x] 1.6 cron：wrangler.toml [triggers] crons=["0 3 * * 1"]；scheduled handler：auditSite 单函数（时间预算 20s/站、并发 3、失败策略 3 连败提醒、告警 >=10 分、30 天清理、分批日志）
  验证：scheduled 模拟（含 5 站全失败 <60s 完成、逐站 failed）；alert.test.js / failurePolicy.test.js / cleanup.test.js

## Phase 2 — 前端
- [x] 2.1 auth.js：window.geoscoreAuth.api() 封装（Bearer + 401 清理登录态）
- [x] 2.2 组件：src/components/sitesPanel.js（站点管理）、auditHistory.js（历史列表 + 趋势，复用 trendChart.js）
- [x] 2.3 index.astro：监控区块（Pro 渲染：添加/删除/历史/PDF；免费显示 Upgrade 提示）；boot.js 在审计完成后 Pro 用户可保存云端
- [x] 2.4 定价页：pricing.astro + zh/pricing.astro 域名 1->5（卡片 + 对比表 + FAQ）；upgrade-pro 点击时已登录用户携带 customer_email 到 Creem checkout（实现时验证参数支持）
  验证：本地 astro build 通过；两版定价页文案一致

## Phase 3 — 测试收口
- [x] 3.1 全套测试：worker 单元 + 集成 + webhook（checkout.completed -> plan=pro）+ cron 模拟 + worker/lib vs src/lib 一致性校验
  验证：hermes node 跑 vitest 全绿
- [x] 3.2 回归：现有 tests/ 全部通过（前端未动免费功能）

## Phase 4 — 验收与部署
- [x] 4.1 本地模拟验收：wrangler dev + d1 本地；测试账号置 plan=pro；走添加 5 站点（第 6 个被拒）-> 手动审计保存 -> 历史 -> PDF 下载全流程；--test-scheduled 触发 cron 验证
  验证：全流程可操作，无 401/403 意外，PDF 可打开
- [x] 4.2 部署 Worker：d1 execute schema.sql -> wrangler deploy（确认 Triggers 显示 cron）；wrangler tail 观察
- [x] 4.3 前端部署：astro build（hermes node）-> 复制 dist 到临时仓库整目录提交 -> push --force gh-pages
- [x] 4.4 线上抽查：/health、定价页两版、监控面板可用；提供验收证据汇总

## 依赖与并行
- 0.2 -> 1.1/1.6（可并行）；1.3/1.4 依赖 1.2；1.6 依赖 1.5；2.x 依赖 1.x API 定稿
- 3.1 随各阶段增量写；4.x 全部完成后执行

## 输出物
- 修改文件：worker/{payments.js, wrangler.toml, schema.sql, lib/*}; src/{scripts/auth.js, pages/index.astro, pages/pricing.astro, pages/zh/pricing.astro, components/sitesPanel.js, components/auditHistory.js}; tests/*
- 验收证据：vitest 输出、本地模拟记录、部署后 /health + 页面抽查截图/日志
- 文档：更新 .omx/plans/ 状态；按需更新 PROJECT_HANDOVER.md 待办（用户确认后）

## 需要用户提供
- Cloudflare API Token（仅 Phase 4.2 部署 Worker 用；可用 Edit Cloudflare Workers with D1 模板创建）
- 或确认沿用之前的部署方式（如 wrangler login 浏览器授权）
