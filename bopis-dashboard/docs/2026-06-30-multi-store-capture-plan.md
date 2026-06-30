# Multi-Store CAPTURE Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增第 5 个 Tab，验证 PayPal 是否支持一个订单含 5 个 Purchase Unit（各自对应不同城市门店）+ `intent=CAPTURE` 的多门店 BOPIS 提货流程。

**Architecture:** 后端在 `bopis.ts` 新增 `createBopisOrderMultiCapture()` 函数并对应新增一条 Edge Runtime 路由；前端新增 `MultiStoreCaptureFlow.tsx` 场景组件，在 `App.tsx` 注册为 Tab 5，复用现有 `StepCard`、`PayPalButton` 等组件，无需改动任何已有业务逻辑。

**Tech Stack:** TypeScript, Next.js Edge Runtime, React 18, Vite, Tailwind CSS, PayPal v2 Orders API, PayPal Web SDK v6

---

## File Map

| Action | File |
|--------|------|
| Modify | `paypal-backend-api/src/lib/bopis.ts` — 新增 `createBopisOrderMultiCapture` 函数 |
| Create | `paypal-backend-api/src/app/api/checkout/bopis/orders/create-multi-capture/route.ts` |
| Modify | `bopis-dashboard/src/lib/api.ts` — 新增 `createBopisOrderMultiCapture` 和 `captureOrder` |
| Create | `bopis-dashboard/src/scenarios/MultiStoreCaptureFlow.tsx` |
| Modify | `bopis-dashboard/src/App.tsx` — 新增 Tab 5 |

---

## Task 1: 后端 — 新增 `createBopisOrderMultiCapture` 函数

**Files:**
- Modify: `paypal-backend-api/src/lib/bopis.ts`

- [ ] **Step 1: 在 `bopis.ts` 末尾追加函数**

在文件末尾（`voidAuthorization` 函数之后）添加以下代码：

```typescript
// ── 多门店 CAPTURE 订单（5 PU）Multi-store CAPTURE order ─────
// intent=CAPTURE：直接扣款，无需单独 authorize。
// 5 个 PU 各自对应不同城市门店，验证 PayPal 是否支持此组合。
export async function createBopisOrderMultiCapture(): Promise<PayPalRestResponse> {
  const token = await getSandboxToken()
  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: 'store-a',
        amount: { currency_code: 'USD', value: '899.00' },
        description: 'LG 门对门冰箱 (LG French Door Refrigerator) — Pickup at San Jose Store',
        shipping: {
          type: 'PICKUP_IN_STORE',
          name: { full_name: 'Best Buy San Jose' },
          address: {
            address_line_1: '1600 Saratoga Ave',
            admin_area_2: 'San Jose',
            admin_area_1: 'CA',
            postal_code: '95129',
            country_code: 'US',
          },
          phone_number: { national_number: '4085551001' },
        },
      },
      {
        reference_id: 'store-b',
        amount: { currency_code: 'USD', value: '649.00' },
        description: 'Samsung 前置滚筒洗衣机 (Samsung Front Load Washer) — Pickup at Los Angeles Store',
        shipping: {
          type: 'PICKUP_IN_STORE',
          name: { full_name: 'Best Buy Los Angeles' },
          address: {
            address_line_1: '1015 Wilshire Blvd',
            admin_area_2: 'Los Angeles',
            admin_area_1: 'CA',
            postal_code: '90017',
            country_code: 'US',
          },
          phone_number: { national_number: '2135552002' },
        },
      },
      {
        reference_id: 'store-c',
        amount: { currency_code: 'USD', value: '599.00' },
        description: 'Samsung 烘干机 (Samsung Electric Dryer) — Pickup at Seattle Store',
        shipping: {
          type: 'PICKUP_IN_STORE',
          name: { full_name: 'Best Buy Seattle' },
          address: {
            address_line_1: '400 Pine St',
            admin_area_2: 'Seattle',
            admin_area_1: 'WA',
            postal_code: '98101',
            country_code: 'US',
          },
          phone_number: { national_number: '2065553003' },
        },
      },
      {
        reference_id: 'store-d',
        amount: { currency_code: 'USD', value: '349.00' },
        description: 'Bissell CrossWave 洗地机 — Pickup at Chicago Store',
        shipping: {
          type: 'PICKUP_IN_STORE',
          name: { full_name: 'Best Buy Chicago' },
          address: {
            address_line_1: '900 N Michigan Ave',
            admin_area_2: 'Chicago',
            admin_area_1: 'IL',
            postal_code: '60611',
            country_code: 'US',
          },
          phone_number: { national_number: '3125554004' },
        },
      },
      {
        reference_id: 'store-e',
        amount: { currency_code: 'USD', value: '449.00' },
        description: 'Midea 窗式空调 (Midea Window Air Conditioner) — Pickup at New York Store',
        shipping: {
          type: 'PICKUP_IN_STORE',
          name: { full_name: 'Best Buy New York' },
          address: {
            address_line_1: '529 5th Ave',
            admin_area_2: 'New York',
            admin_area_1: 'NY',
            postal_code: '10017',
            country_code: 'US',
          },
          phone_number: { national_number: '2125555005' },
        },
      },
    ],
    payment_source: {
      paypal: {
        experience_context: EXPERIENCE_CONTEXT,
      },
    },
  }
  return postOrder(token, payload)
}
```

- [ ] **Step 2: 验证 TypeScript 编译无错误**

```bash
cd paypal-backend-api && npx tsc --noEmit
```

Expected: 无错误输出（exit code 0）

- [ ] **Step 3: Commit**

```bash
git add paypal-backend-api/src/lib/bopis.ts
git commit -m "$(cat <<'EOF'
feat[2026-06-30](paypal-backend-api): 新增 createBopisOrderMultiCapture 函数（5 PU + intent=CAPTURE）

## 解决的问题
多门店 BOPIS 场景验证：一个订单含 5 个 PU，各自绑定不同城市门店，
使用 intent=CAPTURE 直接扣款，测试 PayPal 是否支持此组合。

## 主要改动
- paypal-backend-api/src/lib/bopis.ts: 新增 createBopisOrderMultiCapture()，
  硬编码 5 件大家电（冰箱/洗衣机/烘干机/洗地机/空调），共 $2,945

## 为什么这么改
intent=AUTHORIZE + 多 PU 已被 PayPal 拒绝（HTTP 422）；
intent=CAPTURE + 多 PU 是待验证的替代方案。
EOF
)"
```

---

## Task 2: 后端 — 新增 `create-multi-capture` 路由

**Files:**
- Create: `paypal-backend-api/src/app/api/checkout/bopis/orders/create-multi-capture/route.ts`

- [ ] **Step 1: 创建目录并写入路由文件**

完整文件内容：

```typescript
export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { createBopisOrderMultiCapture } from '@/lib/bopis'

export function OPTIONS() {
  return corsOptions()
}

export async function POST() {
  try {
    const { data, status, debugId } = await createBopisOrderMultiCapture()
    return corsJson(data, status, debugId)
  } catch {
    return corsJson({ error: 'Failed to create multi-store CAPTURE order' }, 500)
  }
}
```

- [ ] **Step 2: 验证 TypeScript 编译无错误**

```bash
cd paypal-backend-api && npx tsc --noEmit
```

Expected: 无错误输出

- [ ] **Step 3: Commit**

```bash
git add paypal-backend-api/src/app/api/checkout/bopis/orders/create-multi-capture/route.ts
git commit -m "$(cat <<'EOF'
feat[2026-06-30](paypal-backend-api): 新增 /api/checkout/bopis/orders/create-multi-capture 路由

## 主要改动
- 新增 Edge Runtime 路由，POST 无需请求体，调用 createBopisOrderMultiCapture()
EOF
)"
```

---

## Task 3: 前端 — `api.ts` 新增两个函数

**Files:**
- Modify: `bopis-dashboard/src/lib/api.ts`

需要新增两个函数：
1. `createBopisOrderMultiCapture` — 调用新的后端路由
2. `captureOrder` — 调用 `/api/checkout/orders/{orderId}/capture`（CAPTURE intent 专用，区别于 `captureAuthorization` 的 AUTHORIZE 流程）

- [ ] **Step 1: 在 `api.ts` 末尾（`getSandboxClientToken` 之前）追加两个函数**

在 `// ── 获取 Sandbox Client Token` 注释行之前，插入：

```typescript
// ── 多门店 CAPTURE 订单创建 Multi-store CAPTURE order ────────
/**
 * 创建 5 门店 BOPIS 订单（5 purchase_unit，intent=CAPTURE）。
 * Creates a 5-store BOPIS order with intent=CAPTURE.
 * 数据全部硬编码在后端，无需传参。
 * All PU data is hardcoded in the backend — no parameters needed.
 *
 * 后端路由：paypal-backend-api/.../bopis/orders/create-multi-capture/route.ts
 */
export async function createBopisOrderMultiCapture() {
  return req('/api/checkout/bopis/orders/create-multi-capture', { method: 'POST' })
}

// ── 捕获整个订单 Capture entire order ───────────────────────
/**
 * 捕获 intent=CAPTURE 订单中的所有 purchase_unit（一次性扣款）。
 * Captures all purchase units in a CAPTURE-intent order in a single call.
 *
 * 与 captureAuthorization 的区别：
 *   - captureAuthorization: AUTHORIZE flow 专用，针对单个 authorizationId
 *   - captureOrder: CAPTURE flow 专用，针对整个 orderId
 *
 * 对应 PayPal API：POST /v2/checkout/orders/{orderId}/capture
 * 后端路由：paypal-backend-api/.../checkout/orders/[orderId]/capture/route.ts
 */
export async function captureOrder(orderId: string) {
  return req(`/api/checkout/orders/${orderId}/capture`, { method: 'POST' })
}
```

- [ ] **Step 2: 验证 TypeScript 编译无错误**

```bash
cd bopis-dashboard && npx tsc --noEmit
```

Expected: 无错误输出

- [ ] **Step 3: Commit**

```bash
git add bopis-dashboard/src/lib/api.ts
git commit -m "$(cat <<'EOF'
feat[2026-06-30](bopis-dashboard): api.ts 新增 createBopisOrderMultiCapture 和 captureOrder

## 主要改动
- bopis-dashboard/src/lib/api.ts: 新增两个函数供 MultiStoreCaptureFlow 使用
  - createBopisOrderMultiCapture(): POST /api/checkout/bopis/orders/create-multi-capture
  - captureOrder(orderId): POST /api/checkout/orders/{orderId}/capture（CAPTURE intent 专用）
EOF
)"
```

---

## Task 4: 前端 — 创建 `MultiStoreCaptureFlow.tsx`

**Files:**
- Create: `bopis-dashboard/src/scenarios/MultiStoreCaptureFlow.tsx`

- [ ] **Step 1: 创建完整文件**

```typescript
// ============================================================
// scenarios/MultiStoreCaptureFlow.tsx — Tab 5: 多门店 CAPTURE 流程
// Multi-Store CAPTURE flow — research scenario.
//
// 研究目的 Research goal:
//   验证 PayPal 是否支持：一个 Order 含 5 个 Purchase Unit（各自对应
//   不同城市的 PICKUP_IN_STORE 门店），使用 intent=CAPTURE 一次性扣款。
//   Verify whether PayPal accepts a single Order with 5 PUs each mapped
//   to a different city's PICKUP_IN_STORE location, using intent=CAPTURE.
//
// 背景 Background:
//   ResearchMultiAddr 实验 B 已证明 intent=AUTHORIZE + 多 PU 被 PayPal
//   拒绝（HTTP 422 UNSUPPORTED_INTENT）。本场景改用 intent=CAPTURE。
//   Experiment B showed PayPal rejects intent=AUTHORIZE + multi-PU (HTTP 422).
//   This scenario tests the CAPTURE alternative.
//
// 步骤 Steps（必须按顺序执行）：
//   1. Create Order  — 创建 5 PU + intent=CAPTURE 订单
//   2. Buyer Approval — PayPal SDK v6 按钮，买家授权
//   3. Capture All   — POST /orders/{orderId}/capture，一次扣款全部 PU
//   4. View Details  — GET /orders/{orderId}，查看每个 PU 的 capture 结果
// ============================================================

import { useState } from 'react'
import type { StepResult } from '@/types'
import { StepCard } from '@/components/StepCard'
import { PayPalButton } from '@/components/PayPalButton'
import {
  createBopisOrderMultiCapture,
  captureOrder,
  getOrder,
  getSandboxClientToken,
} from '@/lib/api'

// ── 展示用 Payload（实际构造在后端）Display-only payload ─────
// 仅用于 UI 中展示"发给 PayPal 的原始请求体"，实际字段以后端为准。
// For display in the UI only — actual construction is in the backend.
const PAYPAL_CREATE_PAYLOAD = {
  intent: 'CAPTURE',
  purchase_units: [
    {
      reference_id: 'store-a',
      amount: { currency_code: 'USD', value: '899.00' },
      description: 'LG 门对门冰箱 (LG French Door Refrigerator) — Pickup at San Jose Store',
      shipping: {
        type: 'PICKUP_IN_STORE',
        name: { full_name: 'Best Buy San Jose' },
        address: { address_line_1: '1600 Saratoga Ave', admin_area_2: 'San Jose', admin_area_1: 'CA', postal_code: '95129', country_code: 'US' },
        phone_number: { national_number: '4085551001' },
      },
    },
    {
      reference_id: 'store-b',
      amount: { currency_code: 'USD', value: '649.00' },
      description: 'Samsung 前置滚筒洗衣机 (Samsung Front Load Washer) — Pickup at Los Angeles Store',
      shipping: {
        type: 'PICKUP_IN_STORE',
        name: { full_name: 'Best Buy Los Angeles' },
        address: { address_line_1: '1015 Wilshire Blvd', admin_area_2: 'Los Angeles', admin_area_1: 'CA', postal_code: '90017', country_code: 'US' },
        phone_number: { national_number: '2135552002' },
      },
    },
    {
      reference_id: 'store-c',
      amount: { currency_code: 'USD', value: '599.00' },
      description: 'Samsung 烘干机 (Samsung Electric Dryer) — Pickup at Seattle Store',
      shipping: {
        type: 'PICKUP_IN_STORE',
        name: { full_name: 'Best Buy Seattle' },
        address: { address_line_1: '400 Pine St', admin_area_2: 'Seattle', admin_area_1: 'WA', postal_code: '98101', country_code: 'US' },
        phone_number: { national_number: '2065553003' },
      },
    },
    {
      reference_id: 'store-d',
      amount: { currency_code: 'USD', value: '349.00' },
      description: 'Bissell CrossWave 洗地机 — Pickup at Chicago Store',
      shipping: {
        type: 'PICKUP_IN_STORE',
        name: { full_name: 'Best Buy Chicago' },
        address: { address_line_1: '900 N Michigan Ave', admin_area_2: 'Chicago', admin_area_1: 'IL', postal_code: '60611', country_code: 'US' },
        phone_number: { national_number: '3125554004' },
      },
    },
    {
      reference_id: 'store-e',
      amount: { currency_code: 'USD', value: '449.00' },
      description: 'Midea 窗式空调 (Midea Window Air Conditioner) — Pickup at New York Store',
      shipping: {
        type: 'PICKUP_IN_STORE',
        name: { full_name: 'Best Buy New York' },
        address: { address_line_1: '529 5th Ave', admin_area_2: 'New York', admin_area_1: 'NY', postal_code: '10017', country_code: 'US' },
        phone_number: { national_number: '2125555005' },
      },
    },
  ],
  payment_source: {
    paypal: {
      experience_context: {
        shipping_preference: 'SET_PROVIDED_ADDRESS',
        return_url: 'https://ppgms-test-github-io.pages.dev/bopis/return',
        cancel_url: 'https://ppgms-test-github-io.pages.dev/bopis/cancel',
      },
    },
  },
}

// ── 步骤 ID 和初始状态 ───────────────────────────────────────
type StepId = 'create' | 'approve' | 'capture' | 'details'
type Steps = Record<StepId, StepResult>

const INIT: Steps = {
  create:  { status: 'idle' },
  approve: { status: 'idle' },
  capture: { status: 'idle' },
  details: { status: 'idle' },
}

export function MultiStoreCaptureFlow() {
  const [orderId, setOrderId]         = useState<string | null>(null)
  const [clientToken, setClientToken] = useState<string | null>(null)
  const [steps, setSteps]             = useState<Steps>(INIT)

  const set = (id: StepId, update: Partial<StepResult>) =>
    setSteps((p) => ({ ...p, [id]: { ...p[id], ...update } }))

  // ── Step 1: 创建订单 ─────────────────────────────────────
  const handleCreate = async () => {
    set('create', { status: 'loading' })
    try {
      const { data, status, debugId } = await createBopisOrderMultiCapture()
      if (status >= 200 && status < 300) {
        const id = (data as { id: string }).id
        setOrderId(id)
        const token = await getSandboxClientToken()
        setClientToken(token)
        set('create', { status: 'success', response: data, debugId })
      } else {
        set('create', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) {
      set('create', { status: 'error', error: String(e) })
    }
  }

  // ── Step 3: 捕获所有 PU ──────────────────────────────────
  const handleCapture = async () => {
    if (!orderId) return
    set('capture', { status: 'loading' })
    try {
      const { data, status, debugId } = await captureOrder(orderId)
      if (status >= 200 && status < 300) {
        set('capture', { status: 'success', response: data, debugId })
      } else {
        set('capture', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) {
      set('capture', { status: 'error', error: String(e) })
    }
  }

  // ── Step 4: 查询订单详情 ─────────────────────────────────
  const handleDetails = async () => {
    if (!orderId) return
    set('details', { status: 'loading' })
    try {
      const { data, status, debugId } = await getOrder(orderId)
      set('details', {
        status: status >= 200 && status < 300 ? 'success' : 'error',
        response: data,
        error: status >= 400 ? `HTTP ${status}` : undefined,
        debugId,
      })
    } catch (e) {
      set('details', { status: 'error', error: String(e) })
    }
  }

  // ── 研究结论（动态）Research conclusion ──────────────────
  const showFailConclusion = steps.create.status === 'error'
  const showSuccessConclusion = steps.capture.status === 'success'

  return (
    <div className="space-y-4">

      {/* 场景说明 */}
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">研究目标</p>
        <p>
          一个 Order 含 <strong>5 个 Purchase Unit</strong>，每个 PU 绑定不同城市的 PICKUP_IN_STORE 门店。
          使用 <code className="font-mono bg-muted px-1 rounded">intent=CAPTURE</code> 直接扣款（无 Authorize 步骤）。
        </p>
        <p className="text-xs">
          背景：ResearchMultiAddr 实验 B 已证明 intent=AUTHORIZE + 多 PU 被 PayPal 拒绝（HTTP 422）。
          本场景测试 CAPTURE 是否可行。
        </p>
        <p className="text-xs font-mono">总金额：$2,945.00（冰箱 $899 + 洗衣机 $649 + 烘干机 $599 + 洗地机 $349 + 空调 $449）</p>
      </div>

      {/* Step 1 — 创建订单 */}
      <StepCard
        number={1}
        title="Create Multi-Store Order (5 PU)"
        description="POST /v2/checkout/orders — intent=CAPTURE，5 个 purchase_unit，各自对应不同城市门店（PICKUP_IN_STORE）。"
        requestBody={PAYPAL_CREATE_PAYLOAD}
        result={steps.create}
        onExecute={handleCreate}
      />

      {/* Step 2 — 买家批准 */}
      <StepCard
        number={2}
        title="Buyer Approval (PayPal SDK v6)"
        description="买家通过 PayPal 批准付款。intent=CAPTURE 下买家批准即锁定扣款意图，下一步 capture 时正式扣款。"
        result={steps.approve}
        disabled={steps.create.status !== 'success'}
      >
        {steps.create.status === 'success' && clientToken && orderId && (
          <PayPalButton
            clientToken={clientToken}
            orderId={orderId}
            onApprove={async (data) => {
              setOrderId(data.orderId)
              set('approve', { status: 'success', response: { orderId: data.orderId, status: 'APPROVED' } })
            }}
            onError={(e) => set('approve', { status: 'error', error: e.message })}
            onCancel={() => set('approve', { status: 'idle' })}
          />
        )}
      </StepCard>

      {/* Step 3 — Capture 全部 PU */}
      <StepCard
        number={3}
        title="Capture All Stores"
        badge={{ label: 'Capture × 5 PU', variant: 'green' }}
        description="一次调用捕获全部 5 个 PU，PayPal 同时扣款 $2,945.00。body 为空。"
        requestUrl={`POST https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId ?? '{orderId}'}/capture`}
        result={steps.capture}
        onExecute={handleCapture}
        disabled={steps.approve.status !== 'success'}
      />

      {/* Step 4 — 查询订单详情 */}
      <StepCard
        number={4}
        title="View Order Details"
        description="查看完整订单，重点关注 purchase_units[].payments.captures[0] 确认每个门店的扣款结果与地址。"
        requestUrl={`GET https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId ?? '{orderId}'}`}
        result={steps.details}
        onExecute={handleDetails}
        disabled={steps.capture.status !== 'success'}
      />

      {/* 动态研究结论 */}
      {showFailConclusion && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">📌 研究结论：Step 1 失败</p>
          <p>
            PayPal 拒绝了此请求，错误详见 Step 1 响应中的 JSON。
            若错误名为 <code className="font-mono">UNSUPPORTED_INTENT</code>，
            说明 PayPal 同样不支持 intent=CAPTURE + 多 PU 的 BOPIS 场景。
          </p>
        </div>
      )}
      {showSuccessConclusion && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="font-semibold">
            ✅ 结论：PayPal 支持 5 PU + intent=CAPTURE 多门店 BOPIS 提货
          </p>
          <p>
            5 个 Purchase Unit 各自绑定不同城市门店，一次 Capture 调用同时完成扣款。
            在 Step 4 的响应中可确认每个 PU 的 <code className="font-mono">payments.captures[0]</code> 状态。
          </p>
        </div>
      )}

    </div>
  )
}
```

- [ ] **Step 2: 验证 TypeScript 编译无错误**

```bash
cd bopis-dashboard && npx tsc --noEmit
```

Expected: 无错误输出

- [ ] **Step 3: Commit**

```bash
git add bopis-dashboard/src/scenarios/MultiStoreCaptureFlow.tsx
git commit -m "$(cat <<'EOF'
feat[2026-06-30](bopis-dashboard): 新增 MultiStoreCaptureFlow.tsx — 5 门店 CAPTURE 场景

## 解决的问题
新增第 5 个 Tab 的场景组件，4 步流程验证多门店 BOPIS + intent=CAPTURE 可行性。

## 主要改动
- bopis-dashboard/src/scenarios/MultiStoreCaptureFlow.tsx: 新增组件
  - 4 步：Create → Approve → Capture All → View Details
  - 展示 5 PU 完整 payload（冰箱/洗衣机/烘干机/洗地机/空调）
  - 动态研究结论（成功绿色 / 失败红色）
EOF
)"
```

---

## Task 5: 前端 — `App.tsx` 注册 Tab 5

**Files:**
- Modify: `bopis-dashboard/src/App.tsx`

- [ ] **Step 1: 更新 import 行**

将：
```typescript
import { ShoppingBag, Scissors, FlaskConical, Ban } from 'lucide-react'
import { StandardFlow } from '@/scenarios/StandardFlow'
import { PartialCapture } from '@/scenarios/PartialCapture'
import { ResearchMultiAddr } from '@/scenarios/ResearchMultiAddr'
import { VoidFlow } from '@/scenarios/VoidFlow'
```

改为：
```typescript
import { ShoppingBag, Scissors, FlaskConical, Ban, Store } from 'lucide-react'
import { StandardFlow } from '@/scenarios/StandardFlow'
import { PartialCapture } from '@/scenarios/PartialCapture'
import { ResearchMultiAddr } from '@/scenarios/ResearchMultiAddr'
import { VoidFlow } from '@/scenarios/VoidFlow'
import { MultiStoreCaptureFlow } from '@/scenarios/MultiStoreCaptureFlow'
```

- [ ] **Step 2: 在 TABS 数组末尾追加 Tab 5**

将：
```typescript
const TABS = [
  { id: 'standard',  label: 'Standard BOPIS',   icon: ShoppingBag,  component: StandardFlow      },
  { id: 'partial',   label: 'Partial Capture',   icon: Scissors,     component: PartialCapture    },
  { id: 'research',  label: 'Research: 多地址',   icon: FlaskConical, component: ResearchMultiAddr },
  { id: 'void',      label: 'Void (弃单)',         icon: Ban,          component: VoidFlow          },
] as const
```

改为：
```typescript
const TABS = [
  { id: 'standard',   label: 'Standard BOPIS',       icon: ShoppingBag,  component: StandardFlow          },
  { id: 'partial',    label: 'Partial Capture',       icon: Scissors,     component: PartialCapture        },
  { id: 'research',   label: 'Research: 多地址',       icon: FlaskConical, component: ResearchMultiAddr     },
  { id: 'void',       label: 'Void (弃单)',             icon: Ban,          component: VoidFlow              },
  { id: 'multistore', label: 'Multi-Store CAPTURE',   icon: Store,        component: MultiStoreCaptureFlow },
] as const
```

- [ ] **Step 3: 验证 TypeScript 编译无错误**

```bash
cd bopis-dashboard && npx tsc --noEmit
```

Expected: 无错误输出

- [ ] **Step 4: 启动开发服务器，确认 Tab 5 出现**

```bash
cd bopis-dashboard && pnpm dev
```

打开 `http://localhost:5173`，检查：
- Tab 栏最右侧出现 "Multi-Store CAPTURE" Tab，带有 Store 图标
- 点击后展示 4 个 StepCard（Create / Approve / Capture All / View Details）
- 场景说明区域显示研究背景和 $2,945.00 总金额
- 各 StepCard 默认 disabled 状态正确（只有 Step 1 可点击）

- [ ] **Step 5: Commit**

```bash
git add bopis-dashboard/src/App.tsx
git commit -m "$(cat <<'EOF'
feat[2026-06-30](bopis-dashboard): App.tsx 新增 Multi-Store CAPTURE Tab（Tab 5）

## 主要改动
- bopis-dashboard/src/App.tsx: TABS 数组新增 multistore 条目，
  引入 MultiStoreCaptureFlow 组件和 Store 图标
EOF
)"
```

---

## 验证清单（手动测试）

完成所有任务后，使用 PayPal Sandbox 账号走完完整流程：

- [ ] Step 1 成功 → 返回包含 `id` 的 JSON，即 orderId
- [ ] Step 2 成功 → PayPal 按钮弹出，sandbox 账号批准后回调 onApprove
- [ ] Step 3 成功 → 响应 `status: "COMPLETED"`，或包含 `purchase_units` 的 capture 结果
- [ ] Step 4 成功 → `purchase_units[0..4].payments.captures[0].status` 均为 `COMPLETED`，各自地址正确
- [ ] 绿色研究结论显示在页面底部
- [ ] 切换其他 Tab 后回到 "Multi-Store CAPTURE"，步骤状态保持（非重置）
