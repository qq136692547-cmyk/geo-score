# GeoScore 上线前检查表

- **创建**：2026-10-27
- **依据**：`review/10-site-health-2026-10-27.md`、`review/14-VERDICT-2026-10-27.md`
- **用法**：每次部署前逐项打勾；**任一 🔴 项 FAIL 不得上线**。

---

## 一、构建与测试（🔴 必过）

- [ ] `npm test` 全量通过（当前基线 **389/389**，35 个测试文件）
- [ ] `npm run build` 产出 **40 个 HTML**（38 路由 + 404 + 多语言变体）
- [ ] 构建产物与上一版 diff 无意外变更
  > ⚠️ 本机已知：WorkBuddy node 安全 shim 会在 Astro 收尾删 `dist/` 时返回**退出码 1**，
  > 但页面已全部生成完毕。**这是本地环境问题，不要据此判定构建失败。**

## 二、页面与路由（🔴 必过）

- [ ] `sitemap.xml` 内 **38 个 URL 逐个 curl，全部 200，零死链**
- [ ] 裸路径补斜杠正常：`/fixpack` → 308 → `/fixpack/` → 200（中英双语各验一条）
- [ ] `_redirects` 规则生效（可用 `wrangler pages dev dist --port 8788` 离线验收）
- [ ] 中英双语页面内容对等（中文页汉字计数 > 1000）

## 三、功能真实性（🔴 必过 —— 本次审核最大风险项）

- [ ] 确认页面/文案**没有把模拟结果描述成真实引擎流量**
- [ ] 若有「AI 可见度」模块，必须带明确标注（当前自述为
      *"LLM-simulated answers … labelled as estimates, not live engine traffic"*）
- [ ] 全仓 grep 确认无未声明的引擎 API 调用：
      `grep -rnE "api\.openai|api\.anthropic|perplexity\.ai|generativelanguage|api\.x\.ai|groq" src worker`

## 四、埋点（🔴 必过）

- [ ] GA4 事件数逻辑自洽：**`audit_completed` 不得 > `audit_started`**（当前 22 > 21，缺陷）
- [ ] `sign_in` 事件数与 DB users 数对得上（当前 GA4=1 vs DB=2，漏计）
- [ ] 队列补发生效：`__geoPending` / `__geoFlushPending` 在页面内存在
- [ ] 验证**必须用无代理环境**（带代理的 headless Edge 连生产已验证可用的事件也发不出）

## 五、合规（🔴 必过）

- [ ] 隐私政策托管方描述与实际一致（**当前仍写「GitHub Pages」，实为 Cloudflare Pages**）
- [ ] 定价页**不得点名竞品并给具体价格**（比较广告风险）
      > 🔴 当前 FAQ 称 *"GeoReady charges $9-89/month"*，实际为 **$0/$19/$89**（founding 后 $29/$199）
- [ ] 若有「提分保证」，必须限定为「自家方法论分数」并加免责语
- [ ] consent gate 生效（同意前不加载 GA4 / 广告脚本）

## 六、性能与可用性

- [ ] 10 个关键页状态码全 200，TTFB 中位数 < 2s
      （当前 981–1517ms ✅；跨境链路偶发抖动至 16–25s，属网络问题）
- [ ] Brotli 生效（当前 42,973 → 11,979 B，3.6:1 ✅）
- [ ] 控制台零 JS 错误
- [ ] 建议补：HSTS、CSP、静态资源 CDN 缓存规则（当前 `cf-cache-status: DYNAMIC`）

## 七、部署后核验（D2/D3/D4）

- [ ] **D2**：裸路径 308 → 补斜杠 → 200
- [ ] **D3**：既有页面与本地构建逐字节一致（**必须剔除三样 Cloudflare 边缘注入**：
      ① `email-decode.min.js` ② `cloudflareinsights beacon.min.js` ③ `mailto:` → `/cdn-cgi/l/email-protection#…`）
- [ ] **D4**：关键埋点真的进了 GA4（用 GA4 realtime 或 DebugView 确认）

---

## 已知遗留（不阻塞上线，需排期）

1. 🔴 `review/`（16 文件）与 `scripts/` 整个目录**未 git 跟踪** ⇒ 审批后入库
2. 🔴 官网 FAQ 竞品价格错误 ⇒ 改代码 + 重建 + 部署
3. 🟡 CORS 代理单点依赖：5 个候选仅自建 `geo-score-proxy.pages.dev` 可用
4. 🟡 Fiverr 站外成交无站内归因；账号 `chinesefood885` 与品牌无关
5. 🟡 `mailto:` 被 CF 邮件保护改写，依赖 CF 前端脚本还原 ⇒ 建议改表单或明文邮箱
6. 🟢 根目录 74 项未跟踪垃圾（40.8 MB 图片、4 个 audit-*.html、3 个 log）
