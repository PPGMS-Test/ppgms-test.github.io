# AS2 多授权 Flow — Design Spec

**Date:** 2026-07-03
**Project:** bopis-dashboard
**Status:** Approved

---

## 背景与研究目的

现有面板已覆盖：

- `StandardFlow` = **AS1**：`intent=AUTHORIZE` → 单次 authorize → 单次 full capture
- `PartialCapture` = **AS1** 的部分捕获：单 auth → 多次部分 capture
- `VoidFlow` = AS1 + void
- `ResearchMultiAddr` = 探测 tab，已证实 `intent=AUTHORIZE` + 多 PU 被 PayPal 拒绝（422 `UNSUPPORTED_INTENT`）
- `MultiStoreCaptureFlow` = 5 PU + `intent=CAPTURE`

本次新增 **AS2 tab**，验证 AS2 的**定义性特征**——**一个 Order 下的多个 Authorization**（多授权 + 多捕获）。这是 AS2 区别于 AS1 的核心，也是当前面板尚未覆盖的能力。

### 关键技术前提（必须先讲清）

在**纯公开的 Orders / Payments v2 REST** 语义下，无法在一个 order 上得到两个相互独立、可分别 capture、金额不同的 authorization：

- `reauthorize`（Path A）官方语义是 **honor-period 刷新**——生成新 auth id，但用于*替换*即将过期的旧 auth，并非并行多授权。
- 真正的并行多授权正是被 gate 的 **AS2 / Millennium** 能力（Path B），通过 `intent=ORDER`（或 `processing_instruction=ORDER_SAVED_ON_SUCCESS`）。这些值不在我可确认的公开 REST 文档范围内，**需要该商户 sandbox 账号已开启 AS2 能力**才能跑通。

因此本 tab 的定位是「**两种路径都建，实际点击、对比 PayPal 原始响应**」：预期结果是 Path A 表现为「刷新 / 或 too-early 报错」，Path B 仅在账号开启 AS2 时才呈现真正的多授权。tab 的职责是用**原始响应**把这一点实证出来。

---

## 结构

- `src/App.tsx` 的 `TABS` 数组末尾新增一条：`{ id: 'as2', label: 'AS2 (多授权)', icon: Layers, component: AS2Flow }`。
- 新增 scenario 文件 `src/scenarios/AS2Flow.tsx`。
- tab 顶部有一个 **路径切换（radio 子标签）**：`Path A · reauthorize` / `Path B · intent=ORDER`。切换时显示对应的 StepCard 序列。
- 两条路径**各自持有独立的 step state**（`Record<StepId, StepResult>` × 2），切换路径不丢失已跑结果。

---

## Path A — reauthorize（公开 REST，不需特殊账号）

```
Step 1  Create Order
        POST /api/checkout/bopis/orders/create（复用现有 createBopisOrder）
        intent=AUTHORIZE，单 PU，$300.00
        → 返回 orderId

Step 2  Buyer Approval
        PayPal Web SDK v6 按钮（复用 PayPalButton）
        → orderStatus = APPROVED

Step 3  Authorize
        POST /api/checkout/orders/{orderId}/authorize（复用）
        → auth#1

Step 4  Reauthorize auth#1        ★实验点
        POST /api/payments/authorizations/{auth#1}/reauthorize（新增路由）
        → auth#2（或 honor-period too-early 报错，原样展示）

Step 5  Capture auth#2（部分）
        POST /api/payments/authorizations/{auth#2}/capture
        body: { amount: "150.00", final_capture: false }
        → 部分捕获成功

Step 6  Capture auth#2（收尾）
        POST /api/payments/authorizations/{auth#2}/capture
        body: { amount: "150.00", final_capture: true }
        → 演示同一 auth 上的多次捕获

Step 7  View Order Details
        GET /api/checkout/orders/{orderId}
```

Step 4 卡片附小字说明：「这是实验点——请看原始响应判断 reauthorize 行为」。

---

## Path B — intent=ORDER（真 AS2，需账号已开启）

```
Step 1  Create Order              ★实验点
        POST /api/checkout/bopis/orders/create-as2（新增路由）
        intent=ORDER，单 PU，$200.00
        → 原始响应显示账号是否接受 intent=ORDER

Step 2  Buyer Approval
        PayPal Web SDK v6 按钮（复用 PayPalButton）
        → orderStatus = APPROVED

Step 3  Authorize #1（部分金额）
        POST /api/checkout/orders/{orderId}/authorize-amount（新增路由）
        body: { amount: "100.00" }
        → auth#1

Step 4  Authorize #2（部分金额）   ★真正的并行多授权
        POST /api/checkout/orders/{orderId}/authorize-amount
        body: { amount: "100.00" }
        → auth#2（仅账号支持 AS2 时成功）

Step 5  Capture auth#1（全额 $100）
        POST /api/payments/authorizations/{auth#1}/capture

Step 6  Capture auth#2（全额 $100）
        POST /api/payments/authorizations/{auth#2}/capture

Step 7  View Order Details
        GET /api/checkout/orders/{orderId}
        → 观察一个 order 下的多个 authorizations
```

Step 1 卡片附小字说明：「这是实验点——若账号未开启 AS2，此处 / Step 4 会报错，请看原始响应」。

---

## 架构改动

### 后端（`paypal-backend-api/`）

**`src/lib/bopis.ts` 新增函数：**

```typescript
// Path A：reauthorize 一个已有 authorization
export async function reauthorizeAuthorization(
  authId: string, amount?: string,
): Promise<PayPalRestResponse>
// → POST /v2/payments/authorizations/{authId}/reauthorize
//   body: amount ? { amount: { currency_code:'USD', value: amount } } : {}
//   带 PayPal-Request-Id 幂等头（沿用 captureAuthorization 的写法）

// Path B：创建 intent=ORDER 订单
export async function createBopisOrderAS2(
  amount: string,
): Promise<PayPalRestResponse>
// → 复用 postOrder，payload.intent = 'ORDER'，单 PU（沿用 createBopisOrder 的 shipping/EXPERIENCE_CONTEXT）

// Path B：带金额授权（部分授权）
export async function authorizeOrderAmount(
  orderId: string, amount?: string,
): Promise<PayPalRestResponse>
// → POST /v2/checkout/orders/{orderId}/authorize
//   body: amount ? { amount: { currency_code:'USD', value: amount } } : {}
```

**修改现有 `captureAuthorization`**：增加可选 `finalCapture?: boolean` 形参，为真/假时把 `final_capture` 写入 body（Path A Step 5/6 需要）。默认不传时行为不变，兼容现有调用方。

**新增路由：**

| 路由文件 | PayPal 端点 |
|---------|------------|
| `api/payments/authorizations/[authId]/reauthorize/route.ts` | `POST /v2/payments/authorizations/{id}/reauthorize` |
| `api/checkout/bopis/orders/create-as2/route.ts` | `POST /v2/checkout/orders`（intent=ORDER） |
| `api/checkout/orders/[orderId]/authorize-amount/route.ts` | `POST /v2/checkout/orders/{id}/authorize`（带 amount body） |

- 全部遵循现有 `export const runtime = 'edge'`、`corsJson` / `corsOptions` 模式。
- 修改 `api/payments/authorizations/[authId]/capture/route.ts`：从 body 读取可选 `final_capture` 并透传给 `captureAuthorization`。

### 前端（`bopis-dashboard/`）

**`src/lib/api.ts` 新增函数：**

- `reauthorizeAuthorization(authId, amount?)`
- `createBopisOrderAS2(amount)`
- `authorizeOrderAmount(orderId, amount?)`
- `captureAuthorization` 增加可选 `finalCapture` 形参并写入 body

**新增组件 `src/scenarios/AS2Flow.tsx`：**

- 顶部路径切换（`useState<'A' | 'B'>`）。
- 两套 step state（A: 7 步；B: 7 步），各自 `Record<StepId, StepResult>`，与现有 scenario 状态机一致。
- 复用 `StepCard`、`PayPalButton`、`JsonBlock`。
- 组件顶部注释写明研究目的与「关键技术前提」。
- 每条路径底部动态结论：
  - Path A：Step 4 成功 → 「reauthorize 生成了新 auth（honor-period 刷新）」；报错 → 原样展示错误结论。
  - Path B：Step 1 + Step 4 均成功 → 绿色「✅ 账号支持 AS2：一个 order 上成功创建多个 authorization」；Step 1 或 Step 4 报错 → 红色「❌ 账号未开启 AS2 / intent=ORDER，详见原始响应」。

**修改 `src/App.tsx`：** 在 `TABS` 数组末尾追加 AS2 条目，import `Layers` 图标与 `AS2Flow` 组件。沿用「所有 tab 同时挂载、非激活 CSS hidden」模式。

---

## 不改动的文件

- `src/components/*`（StepCard / PayPalButton / JsonBlock / StatusBadge 均满足需求）
- 现有所有 scenario 组件
- 现有 `authorize`、`capture`、order 详情等既有路由（除 capture 增加 `final_capture` 透传外）

---

## 错误处理

| 场景 | 行为 |
|------|------|
| Path A Step 4 → `reauthorize` too-early / 不被允许 | error badge + debug-id + 原始 JSON（这是有效实验结论） |
| Path B Step 1 → `intent=ORDER` 被拒（如 422 / INVALID） | error badge + debug-id + 红色结论 |
| Path B Step 4 → 第二次 authorize 被拒 | error badge + 原始 JSON（说明账号不支持并行多授权） |
| 任意 capture → `INSTRUMENT_DECLINED` / 已捕获 | error badge + 原始 JSON |
| 网络超时 | error badge + "Network error" |

---

## 部署提醒

新增后端路由需部署到 Cloudflare Pages 后前端才可用；本地 `pnpm dev` 期间这些新路由会 404（与既有 tab 一致）。

---

## 关键 API 接口

```
# Path A
POST /v2/payments/authorizations/{authId}/reauthorize
  Body: { amount: { currency_code:"USD", value:"300.00" } }  (可空)
  → 新 authorization

POST /v2/payments/authorizations/{authId}/capture
  Body: { amount: {...}, final_capture: false|true }

# Path B
POST /v2/checkout/orders
  Body: { intent:"ORDER", purchase_units:[...], payment_source:{...} }

POST /v2/checkout/orders/{orderId}/authorize
  Body: { amount: { currency_code:"USD", value:"100.00" } }   ← 部分授权，可多次

GET  /v2/checkout/orders/{orderId}
  → purchase_units[].payments.authorizations[] 可能含多条
```
