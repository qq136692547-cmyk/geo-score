# GeoScore 养护与更新说明

- **创建**：2026-10-27
- **适用**：`D:/Codex/projects/geo-score` · 生产 `https://geoscore.help/`（Cloudflare Pages）
- **配套**：`docs/prelaunch-checklist.md`（部署前）、`docs/handbook/`（内容与方法论）

---

## 一、部署方式（务必按此执行）

**生产 = Cloudflare Pages Direct Upload（wrangler 直传 dist）。**

```bash
npm test && npm run build
npx wrangler pages deploy dist --project-name geoscore-532
```

### ⚠️ 三个已经踩过的坑

1. **不是 GitHub Pages。** `.github/workflows/deploy.yml` 推的是 `gh-pages` 镜像分支，
   **停更于 2026-08-31**。别改它，也别以为改了能上线。
2. **`dist` 没有入库**（`.gitignore:7` 忽略，`git ls-files dist` = 0）。
   CI 在 runner 现 build ⇒ **任何人从 main 重新构建，都会丢掉没合进 main 的功能**。
   修完代码必须 `git add` + 推送，再部署。
3. **凭据**：需带 **Cloudflare Pages: Edit** 的 token，或 `wrangler login` 一次。
   登录态在 `C:/Users/13669/AppData/Roaming/xdg.config/.wrangler/config/default.toml`。

---

## 二、定期养护节奏

| 周期 | 事项 | 判据 |
|---|---|---|
| **每周** | 查 GA4 事件数逻辑自洽（`audit_completed` ≤ `audit_started`） | 对得上 |
| **每周** | 查 `leads` 表增长 | ≥ 1 条 |
| **每月** | D1 行数快照（users / audits / leads / ai_visibility） | 有增长 |
| **每月** | 跑 `tools/gsc-queries.mjs` 拉 GSC 数据 | 有输出 |
| **每季度** | **更新 324 站点基准数据**（若已建成基准页） | 页面日期更新 |
| **每季度** | 竞品定价复核 | 价格表时间戳更新 |
| **每半年** | 依赖升级（Astro / Tailwind / Chart.js / vitest） | 测试仍全过 |

---

## 三、必须常盯的四个指标

| 指标 | 当前 | 目标 | 观察窗口 |
|---|---|---|---|
| GSC 点击 | **2**（90 天基线，10-07 采） | > 2 | **11-05**（改词满 4 周） |
| 有效线索（邮箱 + URL） | **0** | 30 条 | 14 天 |
| $49 成交 | **0** | 3 单 | 14 天 |
| 可提现现金 | **未核** | $150 | 14 天 |

### 关键待办：D1 核验

**登录 Creem 后台，确认那 1 笔 pro 订阅是否真实扣款。**
若仅处于 7 天试用未扣款 ⇒ **MRR $9 实为 $0**，全盘结论需重算。这是所有变现决策的前置条件。

---

## 四、已知的本地环境限制（不是代码缺陷）

1. **`astro build` 退出码 1** —— WorkBuddy node 安全 shim 的 `checkBulkDeleteGuard`
   拦截了 Astro 收尾批量删 `dist/`。页面全部生成完毕。CI 若用同一 shim 会红。
2. **bash 工具链残缺** —— `ls` / `dirname` / `head` 常报 command not found。
   改用 Glob / Read / `find ... | wc -l` / `grep -oE` / `awk` / `tr -d '\r'`。
3. **PowerShell 工具 stdout 不回显**，且**禁止从 bash 调 powershell**（安全策略拦截）。
4. **联网需代理且端口会变**（10-08 是 10809，10-22 是 7897）⇒ 每次先探测：
   ```bash
   for p in 7897 10809 10808 7890 10807; do
     echo "$p -> $(curl -s -o /dev/null -m 5 -w '%{http_code}' -x http://127.0.0.1:$p https://example.com/)"
   done
   ```
5. **禁止 D:/ 全盘 os.walk 扫描**（超时被 SIGTERM）。

---

## 五、部署后必须做的核验（D2/D3/D4）

**D3 逐字节比对时，必须剔除三样 Cloudflare 边缘行为，否则会误判成"部署差异"：**

| # | 边缘行为 |
|---|---|
| 1 | 注入的 `<script .../email-decode.min.js>` |
| 2 | 注入的 `static.cloudflareinsights.com/beacon.min.js` |
| 3 | `mailto:` 被改写成 `/cdn-cgi/l/email-protection#…` |

不剔除就会看到"每页都差一点点"的假象（实际只差一个空格）。

---

## 六、清理项（需审批后执行）

根目录 **74 项未跟踪**文件，其中：

- 🔴 **`review/`（16 文件、4,752 行）与 `scripts/` 整个目录未入库** —— 所有审计成果裸奔，
  一次误 `git clean -fd` 全没
- 🟡 `assets/promotional/` 约 40.8 MB 图片
- 🟢 4 个 `audit-*.html` 抓页快照、`fix-analyzers.py`（`.gitignore` 只忽略 `_*.py`，没盖住）
- 🟢 3 个 log 文件
- ✅ `dist.bak-*` / `dist-verify`（8.19 MB）已被 `.gitignore` 正确覆盖，可放心删

建议追加到 `.gitignore`：`*.log`、`dist.bak-*`、`dist-verify/`、`.astro/`、`fix-analyzers.py`
