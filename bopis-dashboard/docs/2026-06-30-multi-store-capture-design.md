# Multi-Store CAPTURE Flow — Design Spec

**Date:** 2026-06-30  
**Project:** bopis-dashboard  
**Status:** Approved

---

## 背景与研究目的

现有 ResearchMultiAddr Tab（实验 B）已验证：PayPal **拒绝** `intent=AUTHORIZE` + 多 purchase_unit 的组合（HTTP 422 `UNSUPPORTED_INTENT`）。

PayPal API 文档表明 `intent=CAPTURE` 支持多 PU。本场景的目的是**端到端验证**：

> 一个订单包含 5 个 Purchase Unit，每个 PU 对应不同城市的门店（`shipping.type = PICKUP_IN_STORE`），使用 `intent=CAPTURE`，买家一次性完成付款并一次性 capture 全部门店。

这是解决"多门店分别提货"问题的关键路径验证。

---

## 流程（4 步）

```
Step 1  Create Multi-Store Order
        POST /api/checkout/bopis/orders/create-multi-capture
        → 返回 orderId

Step 2  Buyer Approval
        PayPal Web SDK v6 按钮
        → 买家授权，orderStatus = APPROVED

Step 3  Capture All Stores
        POST /api/checkout/orders/{orderId}/capture
        → 一次调用，5 个 PU 全部扣款

Step 4  View Order Details
        GET /api/checkout/orders/{orderId}
        → 展示每个 PU 各自的 capture 结果与门店地址
```

---

## 硬编码数据（5 个 Purchase Unit）

| PU | 产品描述 | 金额 | 门店城市 |
|----|---------|------|---------|
| 1 | LG 门对门冰箱 (LG French Door Refrigerator) | $899.00 | San Jose, CA |
| 2 | Samsung 前置滚筒洗衣机 (Samsung Front Load Washer) | $649.00 | Los Angeles, CA |
| 3 | Samsung 烘干机 (Samsung Electric Dryer) | $599.00 | Seattle, WA |
| 4 | Bissell CrossWave 洗地机 | $349.00 | Chicago, IL |
| 5 | Midea 窗式空调 (Midea Window Air Conditioner) | $449.00 | New York, NY |

**订单总金额：$2,945.00**

---

## 架构改动

### 后端（`paypal-backend-api/`）

**新增函数** `src/lib/bopis.ts`：

```typescript
export async function createBopisOrderMultiCapture(): Promise<PayPalRestResponse>
```

- intent = `CAPTURE`
- 5 个 PU 全部硬编码在函数体内，无需接受外部参数
- 每个 PU 包含：`reference_id`、`amount`、`description`（含产品名）、`shipping`（type=`PICKUP_IN_STORE`，各自门店地址）
- 复用现有 `EXPERIENCE_CONTEXT`（`SET_PROVIDED_ADDRESS`）和 `postOrder()` 工具函数

**新增路由** `src/app/api/checkout/bopis/orders/create-multi-capture/route.ts`：

- `POST` handler，无需读取 request body（数据全硬编码）
- 调用 `createBopisOrderMultiCapture()`，返回 PayPal 响应
- 遵循现有路由的 `export const runtime = 'edge'` 和 CORS 模式

### 前端（`bopis-dashboard/`）

**新增组件** `src/scenarios/MultiStoreCaptureFlow.tsx`：

- 4 个步骤，复用现有 `StepCard`、`PayPalButton`、`JsonBlock` 组件
- 状态机与现有场景一致：`Record<StepId, StepResult>`
- 组件顶部注释说明研究目的
- 动态结论显示：
  - Step 1 + Step 3 均成功 → 绿色 `✅ 结论：PayPal 支持 5 PU + intent=CAPTURE 多门店 BOPIS 提货`
  - Step 1 返回 HTTP 422 → 红色 `❌ PayPal 拒绝此组合，错误详见 Step 1 响应`

**修改** `src/App.tsx`：

- 新增第 5 个 Tab，label 为 `Multi-Store CAPTURE`（5 Stores）
- 挂载 `<MultiStoreCaptureFlow>` 组件
- 遵循现有的"全部 Tab 同时挂载，非激活用 CSS hidden 隐藏"模式

---

## 不改动的文件

- `src/lib/paypal-client.ts`（captureOrder、getOrder 已满足需求）
- `src/app/api/checkout/orders/[orderId]/capture/route.ts`（现有路由可用）
- `src/app/api/checkout/orders/[orderId]/route.ts`（现有路由可用）
- 所有现有 scenario 组件

---

## 错误处理

| 场景 | 行为 |
|------|------|
| Step 1 → PayPal HTTP 422 | error badge + debug-id + 红色研究结论 |
| Step 1 → 其他错误 | error badge + 原始错误 JSON |
| Step 3 → `INSTRUMENT_DECLINED` | error badge + 原始错误 JSON |
| Step 3 → `ORDER_ALREADY_CAPTURED` | error badge + 原始错误 JSON |
| 网络超时 | error badge + "Network error" |

---

## 关键 API 接口

```
POST /v2/checkout/orders
  Body: { intent: "CAPTURE", purchase_units: [...5个PU...], payment_source: {...} }
  → 返回 orderId

POST /v2/checkout/orders/{orderId}/capture
  Body: 空
  → 返回 { status: "COMPLETED", purchase_units: [...] }

GET /v2/checkout/orders/{orderId}
  → 返回完整订单，含每个 PU 的 payments.captures[0]
```
