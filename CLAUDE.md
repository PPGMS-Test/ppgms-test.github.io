# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Build nav data then start dev server (localhost:3000)
pnpm build        # Generate nav + build to dist/
pnpm generate-nav # Regenerate src/router/nav-data.json and src/router/pages.json only
```

`prebuild` automatically runs `generate-nav` before every build. The dev script also pre-builds to ensure nav data is fresh.

## Architecture

`github-homepage/` 是 **React 18 + Vite 5 + TypeScript** 静态站点（2026-04 从 Vue 3 重构），作为 PayPal/GMS 测试页面的导航中心。

### Monorepo 结构

```
ppgms-test.github.io/
├── github-homepage/      ← React 前端（本文档主要描述范围）
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── types.ts
│   │   ├── components/
│   │   │   ├── NavPanel.tsx     ← 导航面板卡片
│   │   │   ├── TodoPanel.tsx    ← Todo + 历史 Dialog
│   │   │   └── ThemeToggle.tsx
│   │   ├── styles/global.css
│   │   ├── router/              ← 构建时生成，勿手动编辑
│   │   │   ├── nav-data.json
│   │   │   └── pages.json
│   │   └── pages/               ← 各 SDK 测试 HTML 页面
│   ├── scripts/
│   │   ├── generate-nav.js
│   │   ├── scanner.js
│   │   └── formatter.js
│   ├── public/                  ← SVG 图标（favicon、自定义 panel icon）
│   ├── todo.md                  ← Todo 数据源（Obsidian Tasks 格式）
│   └── vite.config.ts
├── paypal-backend-api/   ← Next.js API 代理（Edge Runtime）
└── pnpm-workspace.yaml
```

### How the nav system works

1. **Source pages** live in `github-homepage/src/pages/` as standalone `.html` files organized into folders.
2. **`scripts/generate-nav.js`** runs at build time and:
   - Calls `scanner.js` → recursively walks `src/pages/` and returns a directory tree
   - Calls `formatter.js` → converts the tree into a 4-level nav JSON structure
   - Writes `src/router/nav-data.json` (consumed by `App.tsx`) and `src/router/pages.json`
3. **`vite.config.ts`** has two custom plugins:
   - `copyPages`: copies `.html` files from `src/pages/` to `dist/` at build time (skipping `noshow-` prefixed items)
   - `serve-src-pages`: dev server middleware that serves `src/pages/*.html` files directly
4. **`App.tsx`** imports `nav-data.json` and renders `<NavPanel>` + `<TodoPanel>` in a `react-masonry-css` grid.

### Folder/file naming conventions in `src/pages/`

| Pattern | Behavior |
|---------|----------|
| `[N]-name/` | Sets sort order; displayed name strips the `[N]-` prefix |
| `noshow-name/` | Excluded from both nav and dist copy |
| `hidden-name/` | Copied to dist but hidden from nav |
| `config.json` in a folder | Sets `name`, `icon`, `expanded` for that folder's nav entry |
| `link-xxx.json` in a folder | Rendered as an external link in the nav (contains `href` and `name`) |
| `index.html` in a folder | The folder becomes a single nav item; sibling `.html` files are ignored in nav |

### Nav data structure (`nav-data.json`)

4-level hierarchy: **panel → groups → subGroups → items**. Each item has `url`, `text`, `isExternal`, `isFolder`, and optionally `children`/`subGroups`.

### Frontend tech stack

| 关注点 | 选择 |
|--------|------|
| 框架 | React 18 + Vite 5 + TypeScript |
| 图标 | `lucide-react`（面板也支持 `public/` 下的自定义 `.svg`） |
| 布局 | `react-masonry-css`（4→3→2→1 列响应式） |
| 主题 | CSS 自定义属性 + `dark-mode` class，localStorage 持久化 |
| Todo | `todo.md` 以 `?raw` 导入，Obsidian Tasks 格式解析 |

### Panel icon 规则（`config.json` 中的 `icon` 字段）

- 填写 Lucide 图标 kebab-case 名（如 `credit-card`）→ 渲染 Lucide 组件
- 填写自定义名称（如 `number-five`）→ 渲染 `public/number-five.svg`，自动加 `filter: brightness(0) invert(1)` 适配白色 header
- 未填写 → 按 panel 索引循环使用预设 8 个 Lucide 图标

### Todo / History 系统

- **数据源**：`github-homepage/todo.md`，Obsidian Tasks 格式
  - 优先级：`⏫` = high，`🔼` = medium，`🔽` = low（无 emoji 默认 medium）
  - 完成日期：行尾加 `✅ YYYY-MM-DD`
  - 正则匹配 emoji 须加 `u` flag，否则 surrogate pair 无法匹配
- **TodoPanel**：
  - 默认折叠，点击 header 展开
  - 展开后显示待完成 items + 已完成计数入口按钮（不列出 item）
  - "View All" 打开 **HistoryDialog**（portal overlay，Escape/背景点击关闭）
  - HistoryDialog 按年月倒序分组，展示文字、优先级 badge、完成日期

### Deployment

GitHub Actions (`.github/workflows/deploy.yml`) builds and deploys to GitHub Pages at `https://ppgms-test.github.io/`.

构建命令（在 `github-homepage/` 内）：`pnpm build` → 先 `generate-nav`，再 `vite build`，输出到 `dist/`。

---

## PayPal Pay Later 相关工作记录

### 背景

PayPal Pay Later Message 的资格检测（Eligibility Check）存在两个主要问题：

1. **SDK timeout 问题**：直接用 `paypal.Messages().render()` 渲染时，网络差或并发多时容易触发 timeout，且无法区分"真正无权限"和"网络超时"。
2. **错误捕获问题**：`paypal_messages_buyer_country_not_authorized` 错误由 PayPal SDK 内部脚本抛出，无法通过 `.catch()`、`unhandledrejection`、`console.error/warn` 拦截，JS 层完全无感知。

### 两套方案

#### 方案一：SDK 渲染法（[3]-paylater-msg-dashboard.html）

路径：`src/pages/[3]-paylater/PLM-admin-dashboard/[3]-paylater-msg-dashboard.html`

- 直接加载 PayPal JS SDK，调用 `paypal.Messages({ buyerCountry, placement, onRender }).render()`
- 8 秒 timeout fallback，超时显示"Timeout - SDK did not respond"
- 加入**重试机制**：第一次 timeout 静默记录 log，第二次才显示在卡片上
- 并发执行（`Promise.all`），不使用串行避免太慢
- **已知限制**：无法区分 timeout 和"无权限"，SDK 完全吞掉错误

#### 方案二：API 直接请求法（[1]-paylater-eligibility-api.html）

路径：`src/pages/[3]-paylater/PLM-admin-dashboard/[1]-paylater-eligibility-api.html`

- 不加载 SDK，直接通过后端代理请求 PayPal 的 `credit-presentment/smart/message` API
- HTTP 200 = Eligible，HTTP 403 = Not authorized，AbortError = 真正超时
- **可靠区分**"无权限"和"超时"
- 原本支持 Cloudflare Workers / Vercel 两个代理节点切换，但公司网络封锁了这两个域名

### API 端点发现

通过浏览器 Network 面板，找到 PayPal 实际请求的接口：
```
https://www.paypal.com/credit-presentment/smart/message?buyer_country=XX&client_id=XXX&amount=160&placement=checkout...
```
- 返回 HTTP 200 → 该国家 Eligible
- 返回 HTTP 403 → 该国家无权限（client_id 未被授权）

### 模拟结算页（[2]-checkout-page-eligibility.html）

路径：`src/pages/[3]-paylater/PLM-admin-dashboard/[2]-checkout-page-eligibility.html`

- 模拟真实结算页面，展示 Pay Later 支付选项的完整流程
- 国家切换 → 货币自动联动（US→USD, GB→GBP, DE/FR/IT/ES→EUR, AU→AUD, CA→CAD）
- 使用 namespace 隔离避免多次加载 SDK 时旧实例干扰（`paypal_${country}_${timestamp}`）
- 支持 8 个国家：US, GB, DE, FR, IT, ES, AU, CA
- 不支持国家（CN, JP）保留在列表中作对比

### Next.js 迁移工程

因公司网络封锁了外部代理节点，将 [1] 和 [2] 迁移为独立的 Next.js 工程，内置 API Route 代理，前后端同域解决 CORS 问题。

**工程路径**：`C:\Users\yqiang\Desktop\test\paylater-check`

**路由结构**：
- `/` → 首页导航（两个工具入口卡片）
- `/eligibility` → Eligibility Check 工具（迁移自 [1]）
- `/checkout` → 模拟结算页（迁移自 [2]）
- `/api/paylater-check` → PayPal API 代理 Route Handler（Edge Runtime）

**共享模块**：
- `src/lib/countries.ts` → 国家列表、货币映射、展示标签
- `src/lib/paypal.ts` → Client ID 常量、环境 URL 工具函数

**部署目标**：Cloudflare Pages（通过 GitHub 仓库关联，无需本地 wrangler）
