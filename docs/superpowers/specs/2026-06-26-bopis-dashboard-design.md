# BOPIS Dashboard — Design Spec

**Date:** 2026-06-26  
**Status:** Approved  
**Owner:** Yuncong Qiang

---

## 背景

PayPal BOPIS（Buy Online Pick Up In Store）：买家网上下单 → PayPal 冻结资金（Authorize）→ 买家到店取货 → 店员确认后扣款（Capture）→ 若未取货则释放（Void）。

本工程目标：构建一个交互式技术演示 Dashboard，逐步测试 BOPIS 的所有 API，并专项研究老板提出的问题：**一次 Auth、多次 Capture，每次是否可以指定不同的提货地址？**

---

## 技术栈

与 `applepay-dashboard/` 完全一致：

- Vite 6 + React 18 + TypeScript
- Tailwind CSS 3 + Lucide React
- 无额外状态管理库（useState + useReducer 足够）
- 后端复用 `paypal-backend-api/`（`https://ppgms-test-github-io.pages.dev`）

---

## 项目结构

```
bopis-dashboard/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
└── src/
    ├── main.tsx
    ├── App.tsx                  ← Tab 切换 + 全局布局
    ├── index.css
    ├── types.ts                 ← 所有 TypeScript 类型
    ├── lib/
    │   └── api.ts               ← 所有后端调用函数（typed）
    ├── components/
    │   ├── StepCard.tsx         ← 单步卡片（标题/描述/请求JSON/执行按钮/响应JSON）
    │   ├── JsonBlock.tsx        ← 可折叠 JSON 展示（语法高亮）
    │   ├── StatusBadge.tsx      ← idle / loading / success / error
    │   ├── ScenarioTabs.tsx     ← Tab 导航
    │   └── PayPalButton.tsx     ← v6 SDK <paypal-button> 封装（动态注入 <script>）
    └── scenarios/
        ├── StandardFlow.tsx     ← Tab 1：标准 BOPIS 主流程
        ├── PartialCapture.tsx   ← Tab 2：部分提货
        ├── ResearchMultiAddr.tsx← Tab 3：Research — 多地址研究
        └── VoidFlow.tsx         ← Tab 4：弃单 Void
```

---

## 新增 Backend Routes（paypal-backend-api/）

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/checkout/bopis/orders/create` | POST | 固定 `intent: AUTHORIZE` + `shipping.type: PICKUP_IN_STORE` + `shipping_preference: SET_PROVIDED_ADDRESS`，接受 `amount`、`storeAddress`、`pickupCode` 参数 |
| `/api/checkout/orders/[orderId]/authorize` | POST | 转发 PayPal `/v2/checkout/orders/{id}/authorize`，返回 `authorizationId` |
| `/api/payments/authorizations/[authId]/capture` | POST | 转发 PayPal `/v2/payments/authorizations/{id}/capture`，支持可选 `amount`（partial capture） |
| `/api/payments/authorizations/[authId]/void` | POST | 转发 PayPal `/v2/payments/authorizations/{id}/void` |

全部用 raw `fetch` + Bearer token 实现（与现有 `paypal-rest.ts` 风格一致），Edge Runtime。

---

## 四个测试场景

### Tab 1 — Standard BOPIS（标准主流程）

| Step | 动作 | API |
|------|------|-----|
| 1 | Create BOPIS Order | `POST /api/checkout/bopis/orders/create` |
| 2 | Buyer Approval | v6 SDK `<paypal-button>`（client-token 来自 `/api/auth/sandbox-client-token`） |
| 3 | Authorize Order | `POST /api/checkout/orders/{orderId}/authorize` |
| 4 | Capture at Pickup | `POST /api/payments/authorizations/{authId}/capture` |
| 5 | View Order Details | `GET /api/checkout/orders/{orderId}`（已有路由） |

步骤状态自动传递：Step 1 返回 `orderId` → Step 2 使用 → Step 3 返回 `authorizationId` → Step 4 使用。

### Tab 2 — Partial Capture（部分提货）

Step 1-3 同上（auth $100）。

| Step | 动作 | 参数 |
|------|------|------|
| 4 | Partial Capture（仅取部分商品） | `amount: { value: "60.00" }` |
| 5 | Void Remainder（释放剩余 $40） | Void 同一 authId |

### Tab 3 — Research: 一次 Auth，能否多次 Capture 指定不同地址？

**实验 A：单 purchase_unit，尝试连续 capture**
- 创建订单（1 个 PU，固定 Store A 地址）→ Authorize
- Capture 1（$50）：观察 response 中地址是否为 Store A
- Capture 2（$30）：地址仍为 Store A
- **预期结论**：❌ 不能改地址，地址在创建订单时即锁定

**实验 B：多 purchase_unit，各自不同 storeAddress**
- 创建订单（PU1=Store A $50，PU2=Store B $50）→ Authorize
- 得到 `authId_A`（Store A）+ `authId_B`（Store B）
- Capture `authId_A` → Store A 提货
- Capture `authId_B` → Store B 提货
- **预期结论**：✅ 可以，每个 PU 有独立 authId 和独立地址

每个实验结论在 UI 上高亮显示（绿色 ✅ / 红色 ❌ + 说明文字）。

### Tab 4 — Void（弃单）

| Step | 动作 | API |
|------|------|-----|
| 1-3 | Create → Approve → Authorize | 同 Tab 1 |
| 4 | Void Authorization | `POST /api/payments/authorizations/{authId}/void` |

---

## UI 组件设计

### StepCard 结构

```
┌──────────────────────────────────────────────┐
│ Step N  STEP TITLE               [● STATUS]  │
│ 一句话描述这个步骤做什么                       │
│                                              │
│ ▼ Request Body                              │
│   { "intent": "AUTHORIZE", ... }            │
│                                              │
│ [Execute →]                                 │
│                                              │
│ ▼ Response                                  │
│   { "id": "5XY...", "status": "..." }       │
└──────────────────────────────────────────────┘
```

- `idle`（灰）→ `loading`（蓝，spinner）→ `success`（绿）/ `error`（红）
- 上一步成功后，下一步 Execute 按钮才激活（disabled 否则）
- Step 2（SDK button）：Execute 按钮替换为 `<paypal-button>` 元素

### PayPalButton 封装

动态向 `<head>` 注入：
```html
<script async src="https://www.sandbox.paypal.com/web-sdk/v6/core" onload="..."></script>
```
使用 `clientToken`（来自 `/api/auth/sandbox-client-token`）初始化 SDK，`createPayPalOneTimePaymentSession` 的 `onApprove` 回调触发父组件状态更新，解锁 Step 3。

---

## 数据流

```
useBopisState（per-scenario hook）
  ├── orderId: string | null
  ├── authorizationId: string | null
  ├── captureIds: string[]
  └── stepResults: Record<stepId, StepResult>

StepResult {
  status: 'idle' | 'loading' | 'success' | 'error'
  requestBody: unknown
  responseBody: unknown
  error?: string
}
```

每个 Tab 维护独立的 state 实例，Tab 切换不会丢失已有结果。

---

## 约束

- Sandbox 环境，Client ID 硬编码（与其他 demo 一致）
- 不需要登录/鉴权
- 不需要持久化（页面刷新状态清空）
- 部署：与 `applepay-dashboard` 同样方式（独立静态站点，或集成到 GitHub Pages）
