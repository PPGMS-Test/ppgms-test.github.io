# webhook-listener 多路径 & 验签重构设计

日期：2026-09-07
状态：已确认，待实现

## 背景

当前 `webhook-listener` 只支持单一 webhook 端点 `/api/webhook`，验签凭证从全局环境变量读取（`PAYPAL_CLIENT_ID` 等）。实际场景中需要接收来自多个不同 PayPal app/site 的 webhook，每个有独立的凭证。

## 目标

1. **多路径支持**：admin 可注册多个 webhook 端点，每个绑定独立的验签凭证
2. **验签改进**：不再依赖全局环境变量，改为每个路径独立配置凭证
3. **Dashboard 双视图**：默认「All Events」全局时间线 + 「By Endpoint」按路径分组

---

## 数据模型

### 新表 `endpoints`

```sql
CREATE TABLE endpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  paypal_env TEXT DEFAULT 'sandbox',
  paypal_client_id TEXT DEFAULT '',
  paypal_client_secret TEXT DEFAULT '',
  paypal_webhook_id TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
```

- `enabled = 0` 时该路径返回 404
- 凭证全部留空时验签为 `skipped`

### `webhook_events` 加字段

```sql
ALTER TABLE webhook_events ADD COLUMN endpoint_id INTEGER;
ALTER TABLE webhook_events ADD COLUMN endpoint_slug TEXT;
```

- `endpoint_slug` 冗余字段，避免查询时 JOIN
- 保留策略保持全局 200 条不变

### 预设 default 路径

Migration 自动创建 `slug='default'`、`label='Default'`、凭证留空的记录。

---

## API 变更

### 接收端

| 方法 | 路径 | 变动 |
|------|------|------|
| `POST` | `/api/webhook/[slug]` | **新**：按 slug 查 endpoint 拿凭证验签，落库带 endpoint_id |
| `POST` | `/api/webhook` | **改**：308 redirect → `/api/webhook/default` |
| `GET` | `/api/webhook` | 不变：返回提示信息 |

验签逻辑改动：
- 删除 `verify.ts` 中对 `process.env.PAYPAL_*` 的读取
- `verifyWebhookSignature()` 改为接收显式传入的凭证对象 `{ env, clientId, clientSecret, webhookId }`
- webhook route handler 从 endpoint 记录中取凭证传入

### 事件查询

| 方法 | 路径 | 变动 |
|------|------|------|
| `GET` | `/api/events?after=&limit=&endpoint_id=` | **改**：新增 `endpoint_id` 可选过滤参数 |

### 路径管理（admin only）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/endpoints` | 列出所有 endpoint（需登录，用于 dashboard 路径选择器） |
| `POST` | `/api/admin/endpoints` | 创建 endpoint |
| `PUT` | `/api/admin/endpoints/[id]` | 编辑 endpoint（label/slug/description/凭证/env） |
| `DELETE` | `/api/admin/endpoints/[id]` | 删除 endpoint（同时删除关联 events） |
| `POST` | `/api/admin/endpoints/[id]/toggle` | 切换 enabled 状态 |

---

## 前端变更

### Dashboard 页面

- **视图切换**：顶部增加「All Events」/「By Endpoint」切换（默认 All Events）
- **All Events 视图**：和现在一样，所有事件按时间倒序混排。`endpoint_slug` 以 badge 形式显示在事件列表项中
- **By Endpoint 视图**：顶部 Tab 栏列出所有 endpoint 的 label，选中 Tab 后只显示该路径的事件
- **空状态**：没有 endpoint 时引导去 `/admin` 注册
- **轮询**：All Events 视图传 `after` 不带 `endpoint_id`；By Endpoint 视图带当前选中 endpoint 的 `endpoint_id`

### Admin 页面

- 现有用户管理保持不变
- 新增「Endpoints」section（Tab 或独立区域）
- 表格列：label、slug（可一键复制完整 URL）、env、enabled 开关、事件数
- 行操作：编辑（弹窗表单）、启停 toggle、删除（需确认）
- 新增按钮弹出创建表单

### Copy URL 改进

- TopBar 的 copy webhook URL 改为显示当前选中路径的 URL（All Events 视图显示 default）

---

## 模块边界变更

| 文件 | 变动 |
|------|------|
| `src/lib/db.ts` | 新增 endpoint CRUD 函数、getEvents 支持 endpoint_id 过滤 |
| `src/lib/verify.ts` | 删除 env 读取，凭证改为参数传入 |
| `src/lib/parse.ts` | 不变 |
| `src/lib/auth.ts` | 不变 |
| `src/app/api/webhook/route.ts` | 删除，改为 `[slug]/route.ts` |
| `src/app/api/webhook/[slug]/route.ts` | **新**：根据 slug 查 endpoint 取凭证验签 |
| `src/app/api/events/route.ts` | 改：支持 endpoint_id 过滤 |
| `src/app/api/events/[id]/route.ts` | 不变 |
| `src/app/api/endpoints/route.ts` | **新**：GET 列出 endpoint |
| `src/app/api/admin/endpoints/route.ts` | **新**：POST 创建 |
| `src/app/api/admin/endpoints/[id]/route.ts` | **新**：PUT 编辑 / DELETE 删除 |
| `src/app/api/admin/endpoints/[id]/toggle/route.ts` | **新**：POST 启停 |
| `src/middleware.ts` | 更新路由匹配规则，`/api/webhook` 不需要 auth |
| `src/app/page.tsx` | 重构：双视图切换 + endpoint badge |
| `src/app/admin/page.tsx` | 新增 endpoint 管理 section |
| `migrations/0002_endpoints.sql` | 新 migration |

---

## 向后兼容

- 原 `/api/webhook` POST → 308 redirect 到 `/api/webhook/default`
- `default` endpoint 预设凭证为空 → 验签 skipped，行为和原来不配凭证时一致
- 已有的 `webhook_events` 行 `endpoint_id` 和 `endpoint_slug` 为 NULL，dashboard 上显示为 "unknown"

---

## 非目标

- 不做 endpoint 级别的数据保留策略（仍是全局 200 条）
- 不做 endpoint 间数据隔离/权限（所有登录用户看到所有 endpoint 的事件）
- 不做 webhook 转发/replay