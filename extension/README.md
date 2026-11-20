# GeoScore Official Chrome Extension (Manifest V3)

Audit any live webpage, `http://localhost:*` dev server, or authenticated staging app across **11 GEO dimensions (85 checks)**, **8 negative signals**, and **6 prompt-injection checks** — directly inside Chrome's Side Panel.

## Key Capabilities

- **85-Check Local Audit Engine**: Shares the exact same pure-JS scoring core (`src/lib/auditEngine.js`) as [geoscore.help](https://geoscore.help/), `npx geoscore`, and `geoscore-mcp`.
- **SSR Raw HTML vs. CSR Live DOM Diff**: Detects JavaScript rendering traps where primary copy or JSON-LD schemas only exist after client-side JS execution (with automatic `401/403` staging fallback).
- **Soft 404 Detection**: Flags `/robots.txt`, `/llms.txt`, `/sitemap.xml`, and `/ai/*.json` endpoints that falsely return `200 OK` with an HTML SPA shell.
- **In-Page DOM X-Ray Mode**: Highlights headings, missing image `alt` attributes, excessive CTAs, popups, broken links, and hidden prompt-injection nodes directly on the page using isolated Shadow DOM overlays.
- **Remediation Artifacts & Fix Prompt**: Preview/download `llms.txt`, diagnostic `robots.txt`, and `JSON-LD`, or copy a structured Markdown fix prompt for Cursor / Claude Code.
- **Least-Privilege MV3 Permissions**: Uses `activeTab`, `sidePanel`, `storage`, and `scripting` only. No `<all_urls>` host permission is required on install.

---

## Installation

### Chrome Web Store (Recommended)

Install directly from the official Chrome Web Store listing:
- **[Install GeoScore: Free GEO, AEO & llms.txt Audit](https://chromewebstore.google.com/detail/geoscore-free-geo-aeo-llm/cboppgehhkhaamcgfcikhekkdaelichn)**

### Developer Mode (From Source)

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/qq136692547-cmyk/geo-score.git
   cd geo-score
   npm install
   ```
2. Build the production extension bundle into `extension/dist/`:
   ```bash
   npm run ext:build
   ```
3. Open `chrome://extensions` in Chrome, enable **Developer mode** (top right), click **Load unpacked**, and select `extension/dist/`.

---

## 安装使用

### Chrome 应用商店直接安装（推荐）

- **[前往 Chrome 应用商店安装 GeoScore](https://chromewebstore.google.com/detail/geoscore-free-geo-aeo-llm/cboppgehhkhaamcgfcikhekkdaelichn)**

### 开发者模式（源码构建）

1. 克隆仓库并安装依赖：
   ```bash
   git clone https://github.com/qq136692547-cmyk/geo-score.git
   cd geo-score
   npm install
   ```
2. 构建 MV3 插件产物（输出至 `extension/dist/`）：
   ```bash
   npm run ext:build
   ```
3. 在 Chrome 地址栏打开 `chrome://extensions`，开启右上角 **开发者模式**，点击 **加载已解压的扩展程序**，选择 `extension/dist/` 目录即可使用。
