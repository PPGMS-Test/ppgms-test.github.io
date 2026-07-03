# AS2 多授权 Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "AS2 (多授权)" tab to bopis-dashboard that experimentally runs two paths for multiple authorizations under one order — Path A via public `reauthorize`, Path B via `intent=ORDER` — surfacing raw PayPal responses to determine which the sandbox account supports.

**Architecture:** Backend (`paypal-backend-api/src/lib/bopis.ts`) gains three new functions and one modified function; four new/updated Edge Runtime routes proxy to PayPal. Frontend adds `src/lib/api.ts` wrappers, a new `src/scenarios/AS2Flow.tsx` with an internal A/B toggle, and one new entry in `App.tsx`'s `TABS` array.

**Tech Stack:** Next.js Edge Runtime (backend), React 18 + Vite 5 + TypeScript (frontend), PayPal Orders v2 REST API, Tailwind CSS.

---

## File Map

| Action | Path |
|--------|------|
| **Modify** | `paypal-backend-api/src/lib/bopis.ts` |
| **Modify** | `paypal-backend-api/src/app/api/payments/authorizations/[authId]/capture/route.ts` |
| **Create** | `paypal-backend-api/src/app/api/payments/authorizations/[authId]/reauthorize/route.ts` |
| **Create** | `paypal-backend-api/src/app/api/checkout/bopis/orders/create-as2/route.ts` |
| **Create** | `paypal-backend-api/src/app/api/checkout/orders/[orderId]/authorize-amount/route.ts` |
| **Modify** | `bopis-dashboard/src/lib/api.ts` |
| **Create** | `bopis-dashboard/src/scenarios/AS2Flow.tsx` |
| **Modify** | `bopis-dashboard/src/App.tsx` |

---

## Task 1 — Backend: extend `captureAuthorization` + update capture route

**Files:**
- Modify: `paypal-backend-api/src/lib/bopis.ts` (function signature + body construction)
- Modify: `paypal-backend-api/src/app/api/payments/authorizations/[authId]/capture/route.ts`

### Why

Path A uses `final_capture: false` / `true` on two sequential captures of the same auth. The current `captureAuthorization` in `bopis.ts` doesn't support this field, and the existing capture route doesn't read it from the request body.

- [ ] **Step 1: Modify `captureAuthorization` in `bopis.ts`**

Replace the existing `captureAuthorization` function body. Find the line `const body = amount ? ...` and replace the whole function:

```typescript
export async function captureAuthorization(authId: string, amount?: string, finalCapture?: boolean): Promise<PayPalRestResponse> {
  const token = await getSandboxToken()
  const body: Record<string, unknown> = {}
  if (amount) body.amount = { currency_code: 'USD', value: amount }
  if (finalCapture !== undefined) body.final_capture = finalCapture
  const res = await fetch(
    `${BASE}/v2/payments/authorizations/${encodeURIComponent(authId)}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `${authId}-cap-${Date.now()}`,
      },
      body: JSON.stringify(body),
    },
  )
  const data = await res.json().catch(() => ({}))
  const debugId = res.headers.get('paypal-debug-id') ?? undefined
  return { data, status: res.status, debugId }
}
```

- [ ] **Step 2: Update the capture route to pass `final_capture` through**

Replace the entire content of `paypal-backend-api/src/app/api/payments/authorizations/[authId]/capture/route.ts`:

```typescript
export const runtime = 'edge'
import { corsJson, corsOptions } from '@/lib/cors'
import { captureAuthorization } from '@/lib/bopis'

export function OPTIONS() { return corsOptions() }

export async function POST(
  req: Request,
  { params }: { params: Promise<{ authId: string }> },
) {
  const { authId } = await params
  try {
    const body = await req.json().catch(() => ({})) as { amount?: string; final_capture?: boolean }
    const { data, status, debugId } = await captureAuthorization(authId, body.amount, body.final_capture)
    return corsJson(data, status, debugId)
  } catch {
    return corsJson({ error: 'Failed to capture authorization' }, 500)
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd paypal-backend-api && pnpm tsc --noEmit
```

Expected: no errors. If TypeScript complains about `Record<string, unknown>`, add `as Record<string, unknown>` cast if needed.

- [ ] **Step 4: Commit**

```bash
git add paypal-backend-api/src/lib/bopis.ts \
        paypal-backend-api/src/app/api/payments/authorizations/\\[authId\\]/capture/route.ts
git commit -m "feat[$(date +%Y-%m-%d)](bopis-dashboard): 后端 captureAuthorization 支持 final_capture 参数"
```

---

## Task 2 — Backend: add `reauthorizeAuthorization` + reauthorize route

**Files:**
- Modify: `paypal-backend-api/src/lib/bopis.ts` (add function)
- Create: `paypal-backend-api/src/app/api/payments/authorizations/[authId]/reauthorize/route.ts`

### Why

Path A Step 4 calls PayPal's `/v2/payments/authorizations/{id}/reauthorize` to refresh the honor period. No existing lib function or route covers this.

- [ ] **Step 1: Add `reauthorizeAuthorization` to `bopis.ts`**

Append this function before the last export in `bopis.ts`:

```typescript
export async function reauthorizeAuthorization(authId: string, amount?: string): Promise<PayPalRestResponse> {
  const token = await getSandboxToken()
  const body = amount ? { amount: { currency_code: 'USD', value: amount } } : {}
  const res = await fetch(
    `${BASE}/v2/payments/authorizations/${encodeURIComponent(authId)}/reauthorize`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `${authId}-reauth-${Date.now()}`,
      },
      body: JSON.stringify(body),
    },
  )
  const data = await res.json().catch(() => ({}))
  const debugId = res.headers.get('paypal-debug-id') ?? undefined
  return { data, status: res.status, debugId }
}
```

- [ ] **Step 2: Create the reauthorize route**

Create file `paypal-backend-api/src/app/api/payments/authorizations/[authId]/reauthorize/route.ts`:

```typescript
export const runtime = 'edge'
import { corsJson, corsOptions } from '@/lib/cors'
import { reauthorizeAuthorization } from '@/lib/bopis'

export function OPTIONS() { return corsOptions() }

export async function POST(
  req: Request,
  { params }: { params: Promise<{ authId: string }> },
) {
  const { authId } = await params
  try {
    const body = await req.json().catch(() => ({})) as { amount?: string }
    const { data, status, debugId } = await reauthorizeAuthorization(authId, body.amount)
    return corsJson(data, status, debugId)
  } catch {
    return corsJson({ error: 'Failed to reauthorize' }, 500)
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd paypal-backend-api && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add paypal-backend-api/src/lib/bopis.ts \
        paypal-backend-api/src/app/api/payments/authorizations/\\[authId\\]/reauthorize/route.ts
git commit -m "feat[$(date +%Y-%m-%d)](bopis-dashboard): 新增 reauthorizeAuthorization 函数及路由（Path A）"
```

---

## Task 3 — Backend: add `createBopisOrderAS2` + create-as2 route

**Files:**
- Modify: `paypal-backend-api/src/lib/bopis.ts` (add function)
- Create: `paypal-backend-api/src/app/api/checkout/bopis/orders/create-as2/route.ts`

### Why

Path B Step 1 creates an order with `intent=ORDER` (the AS2 gated value). No existing create function uses this intent.

- [ ] **Step 1: Add `createBopisOrderAS2` to `bopis.ts`**

Append this function to `bopis.ts`:

```typescript
export async function createBopisOrderAS2(amount: string): Promise<PayPalRestResponse> {
  const token = await getSandboxToken()
  const payload = {
    intent: 'ORDER',
    purchase_units: [
      {
        amount: { currency_code: 'USD', value: amount },
        shipping: {
          type: 'PICKUP_IN_STORE',
          name: { full_name: 'AS2 Test Store (Path B)' },
          address: {
            address_line_1: '123 Main Street',
            admin_area_2: 'San Jose',
            admin_area_1: 'CA',
            postal_code: '95131',
            country_code: 'US',
          },
          phone_number: { national_number: '4085551234' },
        },
        custom_id: 'AS2-TEST-001',
        description: 'AS2 Multi-Auth Test Order (Path B)',
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

- [ ] **Step 2: Create the create-as2 route**

Create file `paypal-backend-api/src/app/api/checkout/bopis/orders/create-as2/route.ts`:

```typescript
export const runtime = 'edge'
import { corsJson, corsOptions } from '@/lib/cors'
import { createBopisOrderAS2 } from '@/lib/bopis'

export function OPTIONS() { return corsOptions() }

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as { amount?: string }
    const { data, status, debugId } = await createBopisOrderAS2(body.amount ?? '200.00')
    return corsJson(data, status, debugId)
  } catch {
    return corsJson({ error: 'Failed to create AS2 order' }, 500)
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd paypal-backend-api && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add paypal-backend-api/src/lib/bopis.ts \
        paypal-backend-api/src/app/api/checkout/bopis/orders/create-as2/route.ts
git commit -m "feat[$(date +%Y-%m-%d)](bopis-dashboard): 新增 createBopisOrderAS2 函数及路由（intent=ORDER，Path B）"
```

---

## Task 4 — Backend: add `authorizeOrderAmount` + authorize-amount route

**Files:**
- Modify: `paypal-backend-api/src/lib/bopis.ts` (add function)
- Create: `paypal-backend-api/src/app/api/checkout/orders/[orderId]/authorize-amount/route.ts`

### Why

Path B Steps 3 and 4 call authorize with an explicit amount in the body — enabling partial authorizations on the same order. The existing `authorizeOrder` sends an empty body and is reused by the other tabs unchanged.

- [ ] **Step 1: Add `authorizeOrderAmount` to `bopis.ts`**

Append this function to `bopis.ts`:

```typescript
export async function authorizeOrderAmount(orderId: string, amount?: string): Promise<PayPalRestResponse> {
  const token = await getSandboxToken()
  const body = amount ? { amount: { currency_code: 'USD', value: amount } } : {}
  const res = await fetch(
    `${BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
  const data = await res.json().catch(() => ({}))
  const debugId = res.headers.get('paypal-debug-id') ?? undefined
  return { data, status: res.status, debugId }
}
```

- [ ] **Step 2: Create the authorize-amount route**

Create file `paypal-backend-api/src/app/api/checkout/orders/[orderId]/authorize-amount/route.ts`:

```typescript
export const runtime = 'edge'
import { corsJson, corsOptions } from '@/lib/cors'
import { authorizeOrderAmount } from '@/lib/bopis'

export function OPTIONS() { return corsOptions() }

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params
  try {
    const body = await req.json().catch(() => ({})) as { amount?: string }
    const { data, status, debugId } = await authorizeOrderAmount(orderId, body.amount)
    return corsJson(data, status, debugId)
  } catch {
    return corsJson({ error: 'Failed to authorize order' }, 500)
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd paypal-backend-api && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add paypal-backend-api/src/lib/bopis.ts \
        paypal-backend-api/src/app/api/checkout/orders/\\[orderId\\]/authorize-amount/route.ts
git commit -m "feat[$(date +%Y-%m-%d)](bopis-dashboard): 新增 authorizeOrderAmount 函数及路由（Path B 多次授权）"
```

---

## Task 5 — Frontend: extend `api.ts`

**Files:**
- Modify: `bopis-dashboard/src/lib/api.ts`

### Why

The frontend needs wrappers for the three new backend routes, and `captureAuthorization` must forward the new `finalCapture` parameter.

- [ ] **Step 1: Update `captureAuthorization` in `api.ts`**

Find the existing `captureAuthorization` export in `src/lib/api.ts` and replace it:

```typescript
export async function captureAuthorization(authId: string, amount?: string, finalCapture?: boolean) {
  const body: Record<string, unknown> = {}
  if (amount) body.amount = amount
  if (finalCapture !== undefined) body.final_capture = finalCapture
  return req(`/api/payments/authorizations/${authId}/capture`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
```

- [ ] **Step 2: Append three new functions to `api.ts`**

Add these after the existing exports:

```typescript
// ── Reauthorize authorization (Path A) ──────────────────────
/**
 * 刷新已有 authorization 的 honor period，产生新的 auth id。
 * Refreshes the honor period of an existing authorization, yielding a new auth id.
 * 这是 AS2 Path A 的实验点：行为可能因 sandbox 时机而异（too-early 报错）。
 * Experimental: behavior varies by timing (may fail with too-early error in sandbox).
 *
 * 对应 PayPal API: POST /v2/payments/authorizations/{authId}/reauthorize
 */
export async function reauthorizeAuthorization(authId: string, amount?: string) {
  return req(`/api/payments/authorizations/${authId}/reauthorize`, {
    method: 'POST',
    body: JSON.stringify(amount ? { amount } : {}),
  })
}

// ── 创建 AS2 订单 (Path B) ───────────────────────────────────
/**
 * 创建 intent=ORDER 的 AS2 订单（需账号已开启 AS2 / Millennium 能力）。
 * Creates an order with intent=ORDER — the AS2 gated mode.
 * 若账号未开启，PayPal 返回 422 / INVALID，原始响应即为实验结论。
 * If unsupported, PayPal returns 422/INVALID — the raw response is the experiment finding.
 *
 * 后端路由: /api/checkout/bopis/orders/create-as2
 */
export async function createBopisOrderAS2(amount: string) {
  return req('/api/checkout/bopis/orders/create-as2', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  })
}

// ── 带金额授权 (Path B 多次授权) ─────────────────────────────
/**
 * 对同一 order 发起带金额的 authorize（Path B 多次授权核心）。
 * Authorizes a specific amount on an order — enables multiple authorizations in Path B.
 * 在 AS2 模式下可多次调用；非 AS2 账号第二次调用会报错。
 * Can be called multiple times under AS2; non-AS2 accounts reject the second call.
 *
 * 后端路由: /api/checkout/orders/{orderId}/authorize-amount
 */
export async function authorizeOrderAmount(orderId: string, amount?: string) {
  return req(`/api/checkout/orders/${orderId}/authorize-amount`, {
    method: 'POST',
    body: JSON.stringify(amount ? { amount } : {}),
  })
}
```

- [ ] **Step 3: Verify TypeScript compiles (frontend)**

```bash
cd bopis-dashboard && pnpm tsc --noEmit
```

Expected: no errors. (`Record<string, unknown>` is already in use elsewhere in the project so no tsconfig issues expected.)

- [ ] **Step 4: Commit**

```bash
git add bopis-dashboard/src/lib/api.ts
git commit -m "feat[$(date +%Y-%m-%d)](bopis-dashboard): api.ts 新增 AS2 相关函数（reauthorize / createAS2 / authorizeAmount）"
```

---

## Task 6 — Frontend: create `AS2Flow.tsx`

**Files:**
- Create: `bopis-dashboard/src/scenarios/AS2Flow.tsx`

### Why

This is the new scenario component. It renders an A/B path toggle plus the full step sequences for both paths. All state is local; all API calls go through `api.ts`.

- [ ] **Step 1: Create `AS2Flow.tsx`**

Create `bopis-dashboard/src/scenarios/AS2Flow.tsx` with this content:

```tsx
// ============================================================
// scenarios/AS2Flow.tsx — AS2 多授权实验 Tab
//
// AS2 Model (Order-Auth-Capture) 定义性特征：一个 Order 下
// 支持多个独立的 Authorization，每个 Authorization 可以单独
// Capture——用于分批发货、B2B 多阶段结算等场景。
//
// 两条实验路径（A/B 切换，各自保留独立 step 状态）：
//
// Path A — reauthorize（公开 REST，无需特殊账号）
//   reauthorize 是 honor-period 刷新机制，产生新 auth id，
//   但并非真正的并行多授权。可能报 too-early 错误。
//
// Path B — intent=ORDER（真 AS2，需账号已开启 gated 能力）
//   若账号未开启，Step 1（intent=ORDER）或 Step 4（第二次
//   authorize）会报错——原始响应即为实验结论。
// ============================================================

import { useState } from 'react'
import { Layers } from 'lucide-react'
import type { StepResult } from '@/types'
import { StepCard } from '@/components/StepCard'
import { PayPalButton } from '@/components/PayPalButton'
import {
  createBopisOrder,
  authorizeOrder,
  captureAuthorization,
  getOrder,
  getSandboxClientToken,
  reauthorizeAuthorization,
  createBopisOrderAS2,
  authorizeOrderAmount,
} from '@/lib/api'

// ── 步骤 ID 类型 ─────────────────────────────────────────────
type PathAStepId = 'create' | 'approve' | 'authorize' | 'reauthorize' | 'capture1' | 'capture2' | 'details'
type PathBStepId = 'create' | 'approve' | 'auth1' | 'auth2' | 'capture1' | 'capture2' | 'details'
type PathASteps  = Record<PathAStepId, StepResult>
type PathBSteps  = Record<PathBStepId, StepResult>

const INIT_A: PathASteps = {
  create:      { status: 'idle' },
  approve:     { status: 'idle' },
  authorize:   { status: 'idle' },
  reauthorize: { status: 'idle' },
  capture1:    { status: 'idle' },
  capture2:    { status: 'idle' },
  details:     { status: 'idle' },
}

const INIT_B: PathBSteps = {
  create:   { status: 'idle' },
  approve:  { status: 'idle' },
  auth1:    { status: 'idle' },
  auth2:    { status: 'idle' },
  capture1: { status: 'idle' },
  capture2: { status: 'idle' },
  details:  { status: 'idle' },
}

// ── 展示用 Payload（仅 UI 展示，实际由后端构造）───────────────

const PATH_A_CREATE_PAYLOAD = {
  intent: 'AUTHORIZE',
  purchase_units: [{
    amount: { currency_code: 'USD', value: '300.00' },
    shipping: {
      type: 'PICKUP_IN_STORE',
      name: { full_name: 'AS2 Test Store (Path A)' },
      address: { address_line_1: '123 Main Street', admin_area_2: 'San Jose',
                 admin_area_1: 'CA', postal_code: '95131', country_code: 'US' },
    },
    custom_id: 'PICKUP-AS2-A-001',
  }],
  payment_source: { paypal: { experience_context: { shipping_preference: 'SET_PROVIDED_ADDRESS' } } },
}

const PATH_B_CREATE_PAYLOAD = {
  intent: 'ORDER',
  purchase_units: [{
    amount: { currency_code: 'USD', value: '200.00' },
    shipping: {
      type: 'PICKUP_IN_STORE',
      name: { full_name: 'AS2 Test Store (Path B)' },
      address: { address_line_1: '123 Main Street', admin_area_2: 'San Jose',
                 admin_area_1: 'CA', postal_code: '95131', country_code: 'US' },
    },
    custom_id: 'AS2-TEST-001',
  }],
  payment_source: { paypal: { experience_context: { shipping_preference: 'SET_PROVIDED_ADDRESS' } } },
}

export function AS2Flow() {
  const [path, setPath] = useState<'A' | 'B'>('A')

  // ── Path A 状态 ──────────────────────────────────────────────
  const [aOrderId,    setAOrderId]    = useState<string | null>(null)
  const [aAuth1Id,    setAAuth1Id]    = useState<string | null>(null)
  const [aAuth2Id,    setAAuth2Id]    = useState<string | null>(null)
  const [aClientToken, setAClientToken] = useState<string | null>(null)
  const [stepsA, setStepsA] = useState<PathASteps>(INIT_A)

  // ── Path B 状态 ──────────────────────────────────────────────
  const [bOrderId,    setBOrderId]    = useState<string | null>(null)
  const [bAuth1Id,    setBAuth1Id]    = useState<string | null>(null)
  const [bAuth2Id,    setBAuth2Id]    = useState<string | null>(null)
  const [bClientToken, setBClientToken] = useState<string | null>(null)
  const [stepsB, setStepsB] = useState<PathBSteps>(INIT_B)

  const setA = (id: PathAStepId, u: Partial<StepResult>) =>
    setStepsA((p) => ({ ...p, [id]: { ...p[id], ...u } }))
  const setB = (id: PathBStepId, u: Partial<StepResult>) =>
    setStepsB((p) => ({ ...p, [id]: { ...p[id], ...u } }))

  // ── Path A handlers ──────────────────────────────────────────

  const handleACreate = async () => {
    setA('create', { status: 'loading' })
    try {
      const { data, status, debugId } = await createBopisOrder({
        amount: '300.00',
        storeName: 'AS2 Test Store (Path A)',
        storeAddress: { address_line_1: '123 Main Street', admin_area_2: 'San Jose',
                        admin_area_1: 'CA', postal_code: '95131', country_code: 'US' },
        pickupCode: 'AS2-A-001',
      })
      if (status >= 200 && status < 300) {
        setAOrderId((data as { id: string }).id)
        setAClientToken(await getSandboxClientToken())
        setA('create', { status: 'success', response: data, debugId })
      } else {
        setA('create', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) { setA('create', { status: 'error', error: String(e) }) }
  }

  const handleAAuthorize = async () => {
    if (!aOrderId) return
    setA('authorize', { status: 'loading' })
    try {
      const { data, status, debugId } = await authorizeOrder(aOrderId)
      if (status >= 200 && status < 300) {
        const d = data as { purchase_units: Array<{ payments: { authorizations: Array<{ id: string }> } }> }
        setAAuth1Id(d.purchase_units[0].payments.authorizations[0].id)
        setA('authorize', { status: 'success', response: data, debugId })
      } else {
        setA('authorize', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) { setA('authorize', { status: 'error', error: String(e) }) }
  }

  const handleAReauthorize = async () => {
    if (!aAuth1Id) return
    setA('reauthorize', { status: 'loading' })
    try {
      const { data, status, debugId } = await reauthorizeAuthorization(aAuth1Id, '300.00')
      if (status >= 200 && status < 300) {
        setAAuth2Id((data as { id: string }).id)
        setA('reauthorize', { status: 'success', response: data, debugId })
      } else {
        // error is a valid experimental result — show it as-is
        setA('reauthorize', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) { setA('reauthorize', { status: 'error', error: String(e) }) }
  }

  const handleACapture1 = async () => {
    if (!aAuth2Id) return
    setA('capture1', { status: 'loading' })
    try {
      const { data, status, debugId } = await captureAuthorization(aAuth2Id, '150.00', false)
      if (status >= 200 && status < 300) {
        setA('capture1', { status: 'success', response: data, debugId })
      } else {
        setA('capture1', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) { setA('capture1', { status: 'error', error: String(e) }) }
  }

  const handleACapture2 = async () => {
    if (!aAuth2Id) return
    setA('capture2', { status: 'loading' })
    try {
      const { data, status, debugId } = await captureAuthorization(aAuth2Id, '150.00', true)
      if (status >= 200 && status < 300) {
        setA('capture2', { status: 'success', response: data, debugId })
      } else {
        setA('capture2', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) { setA('capture2', { status: 'error', error: String(e) }) }
  }

  const handleADetails = async () => {
    if (!aOrderId) return
    setA('details', { status: 'loading' })
    try {
      const { data, status, debugId } = await getOrder(aOrderId)
      setA('details', { status: status >= 200 && status < 300 ? 'success' : 'error',
                        response: data, error: status >= 400 ? `HTTP ${status}` : undefined, debugId })
    } catch (e) { setA('details', { status: 'error', error: String(e) }) }
  }

  // ── Path B handlers ──────────────────────────────────────────

  const handleBCreate = async () => {
    setB('create', { status: 'loading' })
    try {
      const { data, status, debugId } = await createBopisOrderAS2('200.00')
      if (status >= 200 && status < 300) {
        setBOrderId((data as { id: string }).id)
        setBClientToken(await getSandboxClientToken())
        setB('create', { status: 'success', response: data, debugId })
      } else {
        setB('create', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) { setB('create', { status: 'error', error: String(e) }) }
  }

  const handleBAuth1 = async () => {
    if (!bOrderId) return
    setB('auth1', { status: 'loading' })
    try {
      const { data, status, debugId } = await authorizeOrderAmount(bOrderId, '100.00')
      if (status >= 200 && status < 300) {
        const d = data as { purchase_units: Array<{ payments: { authorizations: Array<{ id: string }> } }> }
        setBAuth1Id(d.purchase_units[0].payments.authorizations[0].id)
        setB('auth1', { status: 'success', response: data, debugId })
      } else {
        setB('auth1', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) { setB('auth1', { status: 'error', error: String(e) }) }
  }

  const handleBAuth2 = async () => {
    if (!bOrderId) return
    setB('auth2', { status: 'loading' })
    try {
      const { data, status, debugId } = await authorizeOrderAmount(bOrderId, '100.00')
      if (status >= 200 && status < 300) {
        // If AS2 is supported, the response will contain multiple authorizations;
        // take the last one as auth#2 to avoid re-using auth#1's id.
        const d = data as { purchase_units: Array<{ payments: { authorizations: Array<{ id: string }> } }> }
        const auths = d.purchase_units[0].payments.authorizations
        setBAuth2Id(auths[auths.length - 1].id)
        setB('auth2', { status: 'success', response: data, debugId })
      } else {
        setB('auth2', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) { setB('auth2', { status: 'error', error: String(e) }) }
  }

  const handleBCapture1 = async () => {
    if (!bAuth1Id) return
    setB('capture1', { status: 'loading' })
    try {
      const { data, status, debugId } = await captureAuthorization(bAuth1Id)
      setB('capture1', { status: status >= 200 && status < 300 ? 'success' : 'error',
                         response: data, error: status >= 400 ? `HTTP ${status}` : undefined, debugId })
    } catch (e) { setB('capture1', { status: 'error', error: String(e) }) }
  }

  const handleBCapture2 = async () => {
    if (!bAuth2Id) return
    setB('capture2', { status: 'loading' })
    try {
      const { data, status, debugId } = await captureAuthorization(bAuth2Id)
      setB('capture2', { status: status >= 200 && status < 300 ? 'success' : 'error',
                         response: data, error: status >= 400 ? `HTTP ${status}` : undefined, debugId })
    } catch (e) { setB('capture2', { status: 'error', error: String(e) }) }
  }

  const handleBDetails = async () => {
    if (!bOrderId) return
    setB('details', { status: 'loading' })
    try {
      const { data, status, debugId } = await getOrder(bOrderId)
      setB('details', { status: status >= 200 && status < 300 ? 'success' : 'error',
                        response: data, error: status >= 400 ? `HTTP ${status}` : undefined, debugId })
    } catch (e) { setB('details', { status: 'error', error: String(e) }) }
  }

  // ── Path B 动态实验结论 ───────────────────────────────────────
  const bConclusion = (() => {
    if (stepsB.create.status === 'error')
      return { ok: false, msg: '❌ intent=ORDER 被 PayPal 拒绝（账号未开启 AS2），详见 Step 1 响应' }
    if (stepsB.auth2.status === 'error')
      return { ok: false, msg: '❌ 第二次 authorize 被拒（账号不支持并行多授权），详见 Step 4 响应' }
    if (stepsB.auth2.status === 'success')
      return { ok: true,  msg: '✅ 账号支持 AS2：同一 order 下成功创建了多个独立 authorization' }
    return null
  })()

  return (
    <div className="space-y-4">

      {/* ── 路径切换 Path toggle ───────────────────────────── */}
      <div className="flex items-center gap-3">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {(['A', 'B'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPath(p)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                path === p
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p === 'A' ? 'Path A · reauthorize' : 'Path B · intent=ORDER'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Path A ────────────────────────────────────────── */}
      <div className={path === 'A' ? 'space-y-4' : 'hidden'}>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
          <strong>Path A</strong>：公开 REST，无需特殊账号。
          <code className="mx-1 px-1 bg-blue-100 rounded">reauthorize</code>
          是 honor-period 刷新机制——产生新 auth id，但并非真正的并行多授权。
          实验点在 Step 4，请看原始响应。
        </div>

        <StepCard
          number={1}
          title="Create Order (intent=AUTHORIZE, $300)"
          description="POST /v2/checkout/orders — 单 PU intent=AUTHORIZE，$300.00"
          requestBody={PATH_A_CREATE_PAYLOAD}
          result={stepsA.create}
          onExecute={handleACreate}
        />

        <StepCard
          number={2}
          title="Buyer Approval (PayPal SDK v6)"
          description="买家通过 PayPal sandbox 账号批准付款。"
          result={stepsA.approve}
          disabled={stepsA.create.status !== 'success'}
        >
          {stepsA.create.status === 'success' && aClientToken && aOrderId && (
            <PayPalButton
              clientToken={aClientToken}
              orderId={aOrderId}
              onApprove={async (data) => {
                setAOrderId(data.orderId)
                setA('approve', { status: 'success', response: { orderId: data.orderId, status: 'APPROVED' } })
              }}
              onError={(e) => setA('approve', { status: 'error', error: e.message })}
              onCancel={() => setA('approve', { status: 'idle' })}
            />
          )}
        </StepCard>

        <StepCard
          number={3}
          title="Authorize → auth#1"
          description="服务端授权，冻结 $300，返回 auth#1。"
          requestUrl={`POST https://api-m.sandbox.paypal.com/v2/checkout/orders/${aOrderId ?? '{orderId}'}/authorize`}
          result={stepsA.authorize}
          onExecute={handleAAuthorize}
          disabled={stepsA.approve.status !== 'success'}
        />

        <StepCard
          number={4}
          title="Reauthorize auth#1 → auth#2"
          badge={{ label: '★ 实验点', variant: 'amber' }}
          description="POST /v2/payments/authorizations/{auth1}/reauthorize — 刷新 honor period，产生新 auth id（auth#2）。若报错（too-early / 不允许），原始响应即为实验结论。"
          requestUrl={`POST https://api-m.sandbox.paypal.com/v2/payments/authorizations/${aAuth1Id ?? '{auth1Id}'}/reauthorize`}
          requestBody={{ amount: { currency_code: 'USD', value: '300.00' } }}
          result={stepsA.reauthorize}
          onExecute={handleAReauthorize}
          disabled={stepsA.authorize.status !== 'success'}
        />

        <StepCard
          number={5}
          title="Capture auth#2（部分，$150）"
          badge={{ label: 'Partial · final_capture=false', variant: 'blue' }}
          description="部分捕获 $150，final_capture=false 表示此 auth 后续还有捕获。"
          requestUrl={`POST https://api-m.sandbox.paypal.com/v2/payments/authorizations/${aAuth2Id ?? '{auth2Id}'}/capture`}
          requestBody={{ amount: { currency_code: 'USD', value: '150.00' }, final_capture: false }}
          result={stepsA.capture1}
          onExecute={handleACapture1}
          disabled={stepsA.reauthorize.status !== 'success'}
        />

        <StepCard
          number={6}
          title="Capture auth#2（收尾，$150）"
          badge={{ label: 'Partial · final_capture=true', variant: 'green' }}
          description="再次捕获 $150，final_capture=true 关闭此 auth 的剩余冻结额。"
          requestUrl={`POST https://api-m.sandbox.paypal.com/v2/payments/authorizations/${aAuth2Id ?? '{auth2Id}'}/capture`}
          requestBody={{ amount: { currency_code: 'USD', value: '150.00' }, final_capture: true }}
          result={stepsA.capture2}
          onExecute={handleACapture2}
          disabled={stepsA.capture1.status !== 'success'}
        />

        <StepCard
          number={7}
          title="View Order Details"
          description="查看完整订单状态，确认 payments 字段正确。"
          requestUrl={`GET https://api-m.sandbox.paypal.com/v2/checkout/orders/${aOrderId ?? '{orderId}'}`}
          result={stepsA.details}
          onExecute={handleADetails}
          disabled={stepsA.capture2.status !== 'success'}
        />
      </div>

      {/* ── Path B ────────────────────────────────────────── */}
      <div className={path === 'B' ? 'space-y-4' : 'hidden'}>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <strong>Path B</strong>：真 AS2，需商户账号已开启 AS2 / Millennium 能力。
          若账号未开启，Step 1 或 Step 4 会报错——
          <strong className="ml-0.5">原始响应即为实验结论</strong>。
        </div>

        <StepCard
          number={1}
          title="Create Order (intent=ORDER, $200)"
          badge={{ label: '★ 实验点', variant: 'amber' }}
          description="POST /v2/checkout/orders — intent=ORDER（AS2 gated 模式）。若账号未开启 AS2，PayPal 此处返回 422 / INVALID。"
          requestBody={PATH_B_CREATE_PAYLOAD}
          result={stepsB.create}
          onExecute={handleBCreate}
        />

        <StepCard
          number={2}
          title="Buyer Approval (PayPal SDK v6)"
          description="买家通过 PayPal sandbox 账号批准付款。"
          result={stepsB.approve}
          disabled={stepsB.create.status !== 'success'}
        >
          {stepsB.create.status === 'success' && bClientToken && bOrderId && (
            <PayPalButton
              clientToken={bClientToken}
              orderId={bOrderId}
              onApprove={async (data) => {
                setBOrderId(data.orderId)
                setB('approve', { status: 'success', response: { orderId: data.orderId, status: 'APPROVED' } })
              }}
              onError={(e) => setB('approve', { status: 'error', error: e.message })}
              onCancel={() => setB('approve', { status: 'idle' })}
            />
          )}
        </StepCard>

        <StepCard
          number={3}
          title="Authorize #1（$100）"
          description="第一次部分授权，金额 $100 → auth#1。"
          requestUrl={`POST https://api-m.sandbox.paypal.com/v2/checkout/orders/${bOrderId ?? '{orderId}'}/authorize`}
          requestBody={{ amount: { currency_code: 'USD', value: '100.00' } }}
          result={stepsB.auth1}
          onExecute={handleBAuth1}
          disabled={stepsB.approve.status !== 'success'}
        />

        <StepCard
          number={4}
          title="Authorize #2（$100）"
          badge={{ label: '★ 实验点', variant: 'amber' }}
          description="同一 order 上的第二次 authorize（$100）→ auth#2。这是 AS2 并行多授权的核心步骤——非 AS2 账号此处报错。"
          requestUrl={`POST https://api-m.sandbox.paypal.com/v2/checkout/orders/${bOrderId ?? '{orderId}'}/authorize`}
          requestBody={{ amount: { currency_code: 'USD', value: '100.00' } }}
          result={stepsB.auth2}
          onExecute={handleBAuth2}
          disabled={stepsB.auth1.status !== 'success'}
        />

        <StepCard
          number={5}
          title="Capture auth#1（全额 $100）"
          badge={{ label: 'Full Capture', variant: 'green' }}
          description="捕获第一个授权全额 $100。"
          requestUrl={`POST https://api-m.sandbox.paypal.com/v2/payments/authorizations/${bAuth1Id ?? '{auth1Id}'}/capture`}
          result={stepsB.capture1}
          onExecute={handleBCapture1}
          disabled={stepsB.auth2.status !== 'success'}
        />

        <StepCard
          number={6}
          title="Capture auth#2（全额 $100）"
          badge={{ label: 'Full Capture', variant: 'green' }}
          description="捕获第二个授权全额 $100——AS2 真正的并行多捕获。"
          requestUrl={`POST https://api-m.sandbox.paypal.com/v2/payments/authorizations/${bAuth2Id ?? '{auth2Id}'}/capture`}
          result={stepsB.capture2}
          onExecute={handleBCapture2}
          disabled={stepsB.capture1.status !== 'success'}
        />

        <StepCard
          number={7}
          title="View Order Details"
          description="查看完整订单状态，观察 purchase_units[].payments.authorizations 是否含多条。"
          requestUrl={`GET https://api-m.sandbox.paypal.com/v2/checkout/orders/${bOrderId ?? '{orderId}'}`}
          result={stepsB.details}
          onExecute={handleBDetails}
          disabled={stepsB.capture2.status !== 'success'}
        />

        {/* 动态实验结论 */}
        {bConclusion && (
          <div className={`text-sm font-medium px-4 py-3 rounded-md border ${
            bConclusion.ok
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {bConclusion.msg}
          </div>
        )}
      </div>

    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles (frontend)**

```bash
cd bopis-dashboard && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add bopis-dashboard/src/scenarios/AS2Flow.tsx
git commit -m "feat[$(date +%Y-%m-%d)](bopis-dashboard): 新增 AS2Flow 场景组件（Path A reauthorize + Path B intent=ORDER）"
```

---

## Task 7 — Frontend: add AS2 tab to `App.tsx`

**Files:**
- Modify: `bopis-dashboard/src/App.tsx`

### Why

The new scenario component must be wired into the tab navigation to be reachable.

- [ ] **Step 1: Update the import line in `App.tsx`**

Find the line:
```typescript
import { ShoppingBag, Scissors, FlaskConical, Ban, Store } from 'lucide-react'
```

Replace with:
```typescript
import { ShoppingBag, Scissors, FlaskConical, Ban, Store, Layers } from 'lucide-react'
```

- [ ] **Step 2: Add the `AS2Flow` import in `App.tsx`**

Add after the last scenario import (after `MultiStoreCaptureFlow`):
```typescript
import { AS2Flow } from '@/scenarios/AS2Flow'
```

- [ ] **Step 3: Add the tab entry to the `TABS` array in `App.tsx`**

Find the `TABS` array. After the `multistore` entry, append one line before `] as const`:

```typescript
  { id: 'as2',       label: 'AS2 (多授权)',         icon: Layers,       component: AS2Flow              },
```

The full `TABS` array should look like:
```typescript
const TABS = [
  { id: 'standard',   label: 'Standard BOPIS',       icon: ShoppingBag,  component: StandardFlow          },
  { id: 'partial',    label: 'Partial Capture',       icon: Scissors,     component: PartialCapture        },
  { id: 'research',   label: 'Research: 多地址',       icon: FlaskConical, component: ResearchMultiAddr     },
  { id: 'void',       label: 'Void (弃单)',             icon: Ban,          component: VoidFlow              },
  { id: 'multistore', label: 'Multi-Store CAPTURE',   icon: Store,        component: MultiStoreCaptureFlow },
  { id: 'as2',        label: 'AS2 (多授权)',            icon: Layers,       component: AS2Flow              },
] as const
```

- [ ] **Step 4: Verify TypeScript compiles (frontend)**

```bash
cd bopis-dashboard && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Start the dev server and visually verify the tab**

```bash
cd bopis-dashboard && pnpm dev
```

Open http://localhost:3000 (or the port printed in the terminal).

Verify:
- A new "AS2 (多授权)" tab appears at the right end of the tab bar.
- Clicking it shows the A/B path toggle with "Path A · reauthorize" and "Path B · intent=ORDER".
- Switching between A and B shows the corresponding step cards.
- Step cards 1–7 are present in each path.
- Step cards 2–7 are disabled (semi-transparent) until Step 1 is clicked.
- The `★ 实验点` amber badge appears on Path A Step 4 and Path B Steps 1 and 4.

- [ ] **Step 6: Commit**

```bash
git add bopis-dashboard/src/App.tsx
git commit -m "feat[$(date +%Y-%m-%d)](bopis-dashboard): App.tsx 新增 AS2 多授权 Tab"
```

---

## Deployment Note

All new backend routes (`/reauthorize`, `/create-as2`, `/authorize-amount`) require deployment to Cloudflare Pages before the frontend can actually call them. During `pnpm dev` these routes 404 (same as all other backend routes in this project). To deploy: push to `master` → GitHub Actions builds and deploys automatically.
