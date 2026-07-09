# PSP Path Playground UI v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把演练台改成「前端拥有完整请求、所见即所发」：新增后端通用转发路由 `/api/common`，前端构建真实 body + headers（含可选 Auth Assertion），中间区回显可编辑的 request body、下方显示 response；删除右侧概念 panel，概念降级为内联 Tips；页面改左+中两栏。

**Architecture:** 前端在 `psp-requests.ts` 构建各步真实 PayPal body、`auth-assertion.ts` 生成 JWT，经 `callCommon()` 把完整请求发给新的 `paypal-backend-api/src/app/api/common/route.ts`（目标 path 走 `x-target-path` 头、body 原样转发、限 sandbox host）。Auth 步骤仍用现有 `byok/psp/access-token`。现有 `byok/psp/*` 路由与 `psp.ts` 全部保留。

**Tech Stack:** React 18 + Vite + TS + Tailwind + zustand + react-router + lucide-react；后端 Next.js 15 Edge；vitest 测纯逻辑。

**参考 spec：** `psp-path-dashboard/docs/2026-07-09-psp-path-playground-ui-v2-design.md`

---

## File Structure

### 后端
- Create: `paypal-backend-api/src/lib/common-forward.ts` — 转发的纯逻辑（SSRF 校验 + URL 拼接 + 头白名单）
- Test: `paypal-backend-api/src/lib/common-forward.test.ts`
- Create: `paypal-backend-api/src/app/api/common/route.ts` — 通用转发路由
- Modify: `paypal-backend-api/src/lib/cors.ts` — 增补允许的头与方法

### 前端
- Create: `psp-path-dashboard/src/lib/psp-requests.ts` (+ `.test.ts`) — body 模板
- Create: `psp-path-dashboard/src/lib/auth-assertion.ts` (+ `.test.ts`) — JWT 生成
- Modify: `psp-path-dashboard/src/store/flow.ts` (+ `flow.test.ts`) — config 新字段 + requestBodies/bodyEditing
- Modify: `psp-path-dashboard/src/lib/api.ts` — 改为 `callCommon`（保留 `fetchAccessToken`）
- Create: `psp-path-dashboard/src/components/StepTips.tsx` — 内联 Tips
- Delete: `psp-path-dashboard/src/components/ConceptPanel.tsx`
- Modify: `psp-path-dashboard/src/components/StepDetail.tsx` — 结构化输入 + 可编辑 body + headers 回显 + response 下移
- Modify: `psp-path-dashboard/src/pages/PlaygroundPage.tsx` — 两栏布局

---

## Phase A — 后端 `/api/common`

### Task A1: 转发纯逻辑 common-forward.ts（TDD）

**Files:**
- Create: `paypal-backend-api/src/lib/common-forward.ts`
- Test: `paypal-backend-api/src/lib/common-forward.test.ts`

- [ ] **Step 1: 写失败测试**

Create `paypal-backend-api/src/lib/common-forward.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { resolveTargetUrl, pickForwardHeaders, FORWARD_HEADERS } from './common-forward'
import { PAYPAL_SANDBOX_BASE } from './paypal-rest'

describe('resolveTargetUrl', () => {
  it('合法 path 拼成 sandbox 完整 URL', () => {
    expect(resolveTargetUrl('/v2/checkout/orders')).toEqual({
      url: `${PAYPAL_SANDBOX_BASE}/v2/checkout/orders`,
    })
  })
  it('拒绝完整 URL（防 SSRF）', () => {
    expect('error' in resolveTargetUrl('https://evil.com/x')).toBe(true)
  })
  it('拒绝协议相对 //host', () => {
    expect('error' in resolveTargetUrl('//evil.com/x')).toBe(true)
  })
  it('拒绝不以 / 开头', () => {
    expect('error' in resolveTargetUrl('v2/checkout/orders')).toBe(true)
  })
  it('拒绝空值', () => {
    expect('error' in resolveTargetUrl(null)).toBe(true)
  })
})

describe('pickForwardHeaders', () => {
  it('只挑白名单头，丢弃控制头/其它头', () => {
    const h = new Headers({
      authorization: 'Bearer T',
      'content-type': 'application/json',
      prefer: 'return=representation',
      'paypal-partner-attribution-id': 'HKPSP',
      'paypal-auth-assertion': 'a.b.',
      'x-target-path': '/v2/checkout/orders',
      host: 'localhost',
    })
    const out = pickForwardHeaders(h)
    expect(out.authorization).toBe('Bearer T')
    expect(out['paypal-partner-attribution-id']).toBe('HKPSP')
    expect(out['paypal-auth-assertion']).toBe('a.b.')
    expect(out['x-target-path']).toBeUndefined()
    expect(out.host).toBeUndefined()
  })
  it('FORWARD_HEADERS 含 auth assertion 与 attribution id', () => {
    expect(FORWARD_HEADERS).toContain('paypal-auth-assertion')
    expect(FORWARD_HEADERS).toContain('paypal-partner-attribution-id')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd paypal-backend-api && pnpm test`
Expected: FAIL（`./common-forward` 不存在）

- [ ] **Step 3: 实现 common-forward.ts**

Create `paypal-backend-api/src/lib/common-forward.ts`:
```ts
// /api/common 通用转发的纯逻辑：把调用方给的 PayPal API path 拼成 sandbox 完整 URL，
// 并从入站请求里挑出可透传给 PayPal 的头。控制头（x-target-*）与 host 等不转发。
import { PAYPAL_SANDBOX_BASE } from './paypal-rest'

export const FORWARD_HEADERS = [
  'authorization',
  'content-type',
  'prefer',
  'paypal-partner-attribution-id',
  'paypal-auth-assertion',
  'paypal-request-id',
] as const

// 只接受以单个 / 开头、且不含协议/host 的 path，后端拼 sandbox base，防止被当开放代理(SSRF)。
export function resolveTargetUrl(targetPath: string | null): { url: string } | { error: string } {
  if (
    !targetPath ||
    !targetPath.startsWith('/') ||
    targetPath.startsWith('//') ||
    targetPath.includes('://')
  ) {
    return { error: 'x-target-path must be a sandbox API path starting with a single /' }
  }
  return { url: `${PAYPAL_SANDBOX_BASE}${targetPath}` }
}

export function pickForwardHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of FORWARD_HEADERS) {
    const v = headers.get(name)
    if (v) out[name] = v
  }
  return out
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd paypal-backend-api && pnpm test`
Expected: PASS（新增用例 + 原 psp 用例都绿）

- [ ] **Step 5: Commit**

```bash
git add paypal-backend-api/src/lib/common-forward.ts paypal-backend-api/src/lib/common-forward.test.ts
git commit -m "feat[$(date +%Y-%m-%d)](paypal-backend-api): 加 common-forward 转发纯逻辑与单测（SSRF 校验+头白名单）"
```

---

### Task A2: `/api/common` 路由 + CORS 增补

**Files:**
- Create: `paypal-backend-api/src/app/api/common/route.ts`
- Modify: `paypal-backend-api/src/lib/cors.ts`

- [ ] **Step 1: 增补 CORS 允许的头与方法**

在 `paypal-backend-api/src/lib/cors.ts` 中，把 `CORS_HEADERS` 改为：
```ts
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, x-paypal-bn-code, x-target-path, x-target-method, Prefer, PayPal-Partner-Attribution-Id, PayPal-Auth-Assertion, PayPal-Request-Id',
  'Access-Control-Expose-Headers': 'X-PayPal-Debug-Id',
}
```

- [ ] **Step 2: 实现 `/api/common` 路由**

Create `paypal-backend-api/src/app/api/common/route.ts`:
```ts
export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { pickForwardHeaders, resolveTargetUrl } from '@/lib/common-forward'

export function OPTIONS() {
  return corsOptions()
}

// 通用转发：x-target-path 指定 PayPal API path（只限 sandbox），x-target-method 指定方法（默认 POST），
// 请求 body 原样转发，白名单头透传，PayPal 响应原样返回。
export async function POST(req: Request) {
  const resolved = resolveTargetUrl(req.headers.get('x-target-path'))
  if ('error' in resolved) {
    return corsJson({ error: resolved.error }, 400)
  }

  const method = (req.headers.get('x-target-method') ?? 'POST').toUpperCase()
  const headers = pickForwardHeaders(req.headers)
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const rawBody = hasBody ? await req.text() : undefined

  try {
    const res = await fetch(resolved.url, {
      method,
      headers,
      ...(rawBody ? { body: rawBody } : {}),
    })
    const data = await res.json().catch(() => ({}))
    return corsJson(data, res.status)
  } catch {
    return corsJson({ error: 'Failed to forward request to PayPal' }, 502)
  }
}
```

- [ ] **Step 3: 类型检查**

Run: `cd paypal-backend-api && npx tsc --noEmit`
Expected: 无新增报错

- [ ] **Step 4: Commit**

```bash
git add paypal-backend-api/src/app/api/common/route.ts paypal-backend-api/src/lib/cors.ts
git commit -m "feat[$(date +%Y-%m-%d)](paypal-backend-api): 新增 /api/common 通用转发路由并增补 CORS 头"
```

> ⚠️ 本 Phase 动了 `paypal-backend-api/`，完成后需在 Task E 明确提醒用户 push。

---

## Phase B — 前端请求构建

### Task B1: psp-requests.ts（TDD）

**Files:**
- Create: `psp-path-dashboard/src/lib/psp-requests.ts`
- Test: `psp-path-dashboard/src/lib/psp-requests.test.ts`

- [ ] **Step 1: 写失败测试**

Create `psp-path-dashboard/src/lib/psp-requests.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  buildPartnerReferralBody,
  buildOrderBody,
  buildReferencedPayoutBody,
  buildRefundBody,
} from './psp-requests'

describe('psp-requests', () => {
  it('partner referral 含 DELAY_FUNDS_DISBURSEMENT 与 tracking/return', () => {
    const b = buildPartnerReferralBody('trk-1', 'https://ret')
    expect(b.tracking_id).toBe('trk-1')
    expect(
      b.operations[0].api_integration_preference.rest_api_integration.third_party_details.features,
    ).toContain('DELAY_FUNDS_DISBURSEMENT')
    expect(b.partner_configuration_override.return_url).toBe('https://ret')
  })
  it('order body 带 payee email、金额、CAPTURE intent', () => {
    const b = buildOrderBody({ amount: '160.00', currency: 'GBP', payeeEmail: 'm@x.com', referenceId: 'psp_GBP' })
    expect(b.intent).toBe('CAPTURE')
    expect(b.purchase_units[0].payee.email_address).toBe('m@x.com')
    expect(b.purchase_units[0].amount.value).toBe('160.00')
    expect(b.purchase_units[0].reference_id).toBe('psp_GBP')
  })
  it('referenced payout 用 TRANSACTION_ID + captureId', () => {
    expect(buildReferencedPayoutBody('CAP1')).toEqual({
      reference_type: 'TRANSACTION_ID',
      reference_id: 'CAP1',
    })
  })
  it('refund body 为空对象', () => {
    expect(buildRefundBody()).toEqual({})
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd psp-path-dashboard && pnpm test`
Expected: FAIL（`./psp-requests` 不存在）

- [ ] **Step 3: 实现 psp-requests.ts**

Create `psp-path-dashboard/src/lib/psp-requests.ts`:
```ts
// PSP Path 各步真实 PayPal request body 模板（前端构建，所见即所发）。
// 内容与后端 psp.ts 的 build 函数一致；后端 psp.ts 仍供保留的 byok 路由使用。

export function buildPartnerReferralBody(trackingId: string, returnUrl: string) {
  return {
    tracking_id: trackingId,
    operations: [
      {
        operation: 'API_INTEGRATION',
        api_integration_preference: {
          rest_api_integration: {
            integration_method: 'PAYPAL',
            integration_type: 'THIRD_PARTY',
            third_party_details: {
              features: [
                'PAYMENT',
                'REFUND',
                'ACCESS_MERCHANT_INFORMATION',
                'DELAY_FUNDS_DISBURSEMENT',
                'UPDATE_SELLER_DISPUTE',
                'READ_SELLER_DISPUTE',
              ],
            },
          },
        },
      },
    ],
    partner_configuration_override: { return_url: returnUrl, action_renewal_url: returnUrl },
    legal_consents: [{ type: 'SHARE_DATA_CONSENT', granted: true }],
    products: ['EXPRESS_CHECKOUT'],
  }
}

export interface OrderInput {
  amount: string
  currency: string
  payeeEmail: string
  referenceId: string
}

export function buildOrderBody(input: OrderInput) {
  return {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: input.referenceId,
        description: 'PSP Path Playground',
        amount: {
          currency_code: input.currency,
          value: input.amount,
          breakdown: {
            item_total: { currency_code: input.currency, value: input.amount },
          },
        },
        payee: { email_address: input.payeeEmail },
        items: [
          {
            name: 'Playground Item',
            quantity: '1',
            unit_amount: { currency_code: input.currency, value: input.amount },
          },
        ],
      },
    ],
  }
}

export function buildReferencedPayoutBody(captureId: string) {
  return { reference_type: 'TRANSACTION_ID', reference_id: captureId }
}

export function buildRefundBody() {
  return {}
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd psp-path-dashboard && pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add psp-path-dashboard/src/lib/psp-requests.ts psp-path-dashboard/src/lib/psp-requests.test.ts
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 加 psp-requests.ts（前端 body 模板）与单测"
```

---

### Task B2: auth-assertion.ts（TDD）

**Files:**
- Create: `psp-path-dashboard/src/lib/auth-assertion.ts`
- Test: `psp-path-dashboard/src/lib/auth-assertion.test.ts`

- [ ] **Step 1: 写失败测试**

Create `psp-path-dashboard/src/lib/auth-assertion.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { generateAuthAssertion } from './auth-assertion'

describe('generateAuthAssertion', () => {
  it('生成三段式 JWT（第三段签名为空）', () => {
    const jwt = generateAuthAssertion('CID', 'PAYER1')
    const parts = jwt.split('.')
    expect(parts).toHaveLength(3)
    expect(parts[2]).toBe('')
  })
  it('payload 解码出 iss 与 payer_id', () => {
    const jwt = generateAuthAssertion('CID', 'PAYER1')
    const payload = JSON.parse(atob(jwt.split('.')[1]))
    expect(payload).toEqual({ iss: 'CID', payer_id: 'PAYER1' })
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd psp-path-dashboard && pnpm test`
Expected: FAIL

- [ ] **Step 3: 实现 auth-assertion.ts（移植自 applepay-dashboard）**

Create `psp-path-dashboard/src/lib/auth-assertion.ts`:
```ts
// 生成 PayPal-Auth-Assertion 头值：partner 代商户操作时声明代表哪个商户(payer_id)。
// 格式 base64({"alg":"none"}).base64({"iss":clientId,"payer_id":payerId}). —— 仅 base64，非签名，无需保密。
// 移植自 applepay-dashboard/src/lib/auth-assertion.ts。
export function generateAuthAssertion(clientId: string, payerId: string): string {
  const header = 'eyJhbGciOiJub25lIn0=' // base64({"alg":"none"})
  const json = JSON.stringify({ iss: clientId, payer_id: payerId })
  const payload = btoa(unescape(encodeURIComponent(json)))
  return `${header}.${payload}.`
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd psp-path-dashboard && pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add psp-path-dashboard/src/lib/auth-assertion.ts psp-path-dashboard/src/lib/auth-assertion.test.ts
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 加 auth-assertion.ts（PayPal-Auth-Assertion JWT）与单测"
```

---

## Phase C — flow store 扩展

### Task C1: flow store 加 config 字段与 requestBodies（TDD）

**Files:**
- Modify: `psp-path-dashboard/src/store/flow.ts`
- Modify: `psp-path-dashboard/src/store/flow.test.ts`

- [ ] **Step 1: 追加失败测试**

在 `psp-path-dashboard/src/store/flow.test.ts` 末尾（最后一个 `})` 之前）追加：
```ts
describe('flow store v2 扩展', () => {
  it('config 新增 payerId 默认值与 authAssertionEnabled=false', () => {
    const s = useFlowStore.getState()
    expect(s.config.payerId).toBe('WYFHZPJBHKKYU')
    expect(s.config.authAssertionEnabled).toBe(false)
  })
  it('setRequestBody / setBodyEditing 读写', () => {
    useFlowStore.getState().setRequestBody('createOrder', '{"a":1}')
    useFlowStore.getState().setBodyEditing('createOrder', true)
    expect(useFlowStore.getState().requestBodies.createOrder).toBe('{"a":1}')
    expect(useFlowStore.getState().bodyEditing.createOrder).toBe(true)
  })
  it('reset 清空 requestBodies/bodyEditing 与新 config', () => {
    useFlowStore.getState().setRequestBody('refund', '{}')
    useFlowStore.getState().updateConfig({ authAssertionEnabled: true })
    useFlowStore.getState().reset()
    expect(useFlowStore.getState().requestBodies.refund).toBeUndefined()
    expect(useFlowStore.getState().config.authAssertionEnabled).toBe(false)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd psp-path-dashboard && pnpm test`
Expected: FAIL（payerId/setRequestBody 未定义）

- [ ] **Step 3: 扩展 flow.ts**

在 `psp-path-dashboard/src/store/flow.ts`：

(a) 顶部 import 追加：
```ts
import { DEFAULT_PAYER_ID } from '@/config/default-credentials'
```

(b) `FlowConfig` 接口加两字段：
```ts
export interface FlowConfig {
  amount: string
  currency: string
  payeeEmail: string
  trackingId: string
  returnUrl: string
  payerId: string
  authAssertionEnabled: boolean
}
```

(c) `FlowState` 接口在 `config: FlowConfig` 之后、`activeStep` 之前加：
```ts
  requestBodies: Partial<Record<StepId, string>>
  bodyEditing: Partial<Record<StepId, boolean>>
```
并在 actions 区（`updateConfig` 之后）加：
```ts
  setRequestBody: (s: StepId, raw: string) => void
  setBodyEditing: (s: StepId, on: boolean) => void
```

(d) `INITIAL` 的 `config` 加两字段，并加 `requestBodies`/`bodyEditing`：
```ts
  config: {
    amount: '160.00',
    currency: 'GBP',
    payeeEmail: DEFAULT_PAYEE_EMAIL,
    trackingId: 'psp-playground-merchant-1',
    returnUrl: 'https://example.com/return',
    payerId: DEFAULT_PAYER_ID,
    authAssertionEnabled: false,
  } as FlowConfig,
  requestBodies: {} as Partial<Record<StepId, string>>,
  bodyEditing: {} as Partial<Record<StepId, boolean>>,
  activeStep: 'auth' as StepId,
```
（注意：`DEFAULT_PAYEE_EMAIL` 已在现有 import 中；只需新增 `DEFAULT_PAYER_ID`。）

(e) store 实现里（`updateConfig` 之后）加两个 action：
```ts
  setRequestBody: (s, raw) =>
    set((state) => ({ requestBodies: { ...state.requestBodies, [s]: raw } })),
  setBodyEditing: (s, on) =>
    set((state) => ({ bodyEditing: { ...state.bodyEditing, [s]: on } })),
```

- [ ] **Step 4: 运行确认通过**

Run: `cd psp-path-dashboard && pnpm test`
Expected: PASS（含原有 flow 用例）

- [ ] **Step 5: Commit**

```bash
git add psp-path-dashboard/src/store/flow.ts psp-path-dashboard/src/store/flow.test.ts
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): flow store 加 payerId/authAssertion 与可编辑 requestBodies"
```

---

## Phase D — api.ts / 组件 / 布局

### Task D1: api.ts 改为 callCommon

**Files:**
- Modify: `psp-path-dashboard/src/lib/api.ts`

- [ ] **Step 1: 用 callCommon 重写 api.ts（保留 fetchAccessToken）**

替换 `psp-path-dashboard/src/lib/api.ts` 全部内容：
```ts
// Step 1 Auth 用 BYOK Basic auth 换 access_token（走保留的 byok/psp/access-token）。
// 其余步骤前端拼完整 body + headers，走通用转发路由 /api/common（x-target-path 指定 PayPal path）。
import { useCredentialsStore } from '@/store/credentials'

const PROXY_BASE = import.meta.env.VITE_PROXY_BASE ?? 'http://localhost:30041'

export interface ApiResult<T = unknown> {
  ok: boolean
  status: number
  data: T
}

/** Step 1：BYOK Basic auth → access_token */
export async function fetchAccessToken(): Promise<ApiResult<{ accessToken?: string; error?: string }>> {
  const auth = useCredentialsStore.getState().basicAuth()
  const res = await fetch(`${PROXY_BASE}/api/byok/psp/access-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
  })
  const data = (await res.json().catch(() => ({}))) as { accessToken?: string; error?: string }
  return { ok: res.ok, status: res.status, data }
}

export interface CommonOpts {
  method?: string
  /** 原始 JSON body 字符串（所见即所发）；无 body 的步骤（如 capture）省略 */
  rawBody?: string
  token: string
  bnCode?: string
  authAssertion?: string
}

/** 通用转发：把完整请求发给 /api/common，由它转给 PayPal */
export async function callCommon(targetPath: string, opts: CommonOpts): Promise<ApiResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-target-path': targetPath,
    'x-target-method': opts.method ?? 'POST',
    Authorization: `Bearer ${opts.token}`,
    Prefer: 'return=representation',
  }
  if (opts.bnCode) headers['PayPal-Partner-Attribution-Id'] = opts.bnCode
  if (opts.authAssertion) headers['PayPal-Auth-Assertion'] = opts.authAssertion

  const res = await fetch(`${PROXY_BASE}/api/common`, {
    method: 'POST',
    headers,
    ...(opts.rawBody !== undefined ? { body: opts.rawBody } : {}),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}
```

- [ ] **Step 2: 类型检查（StepDetail 暂时会报错，先只查 api.ts 语法）**

Run: `cd psp-path-dashboard && npx tsc --noEmit -p tsconfig.app.json`
Expected: 仅 `StepDetail.tsx` 可能因引用旧 api 函数报错（下个任务修）；`api.ts` 本身无语法错误。如果只想验证本文件，可临时 `git stash` 其它——不必，继续 Task D2 一起过 tsc。

- [ ] **Step 3: Commit**

```bash
git add psp-path-dashboard/src/lib/api.ts
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): api.ts 改为 callCommon（保留 fetchAccessToken）"
```

---

### Task D2: 新增 StepTips，删除 ConceptPanel

**Files:**
- Create: `psp-path-dashboard/src/components/StepTips.tsx`
- Delete: `psp-path-dashboard/src/components/ConceptPanel.tsx`

- [ ] **Step 1: 实现 StepTips.tsx**

Create `psp-path-dashboard/src/components/StepTips.tsx`:
```tsx
import { useState } from 'react'
import { Lightbulb, ChevronRight } from 'lucide-react'
import { STEPS } from '@/lib/steps'
import { conceptsFor } from '@/lib/concepts'
import { useFlowStore, type StepId } from '@/store/flow'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

// 每步一句话：这一步在干什么/钱在哪/谁担风险。
const EXPLAIN: Record<StepId, string> = {
  auth: '用 BYOK 凭证换取 OAuth access_token。之后每一步都带着它调用，等价于 Postman 里的第 1 步 Auth。',
  onboarding: '通过 Partner Referral 让商户授权 PSP 代其收款/退款/延迟放款。产出一个商户点击授权的链接。',
  createOrder: '以 CAPTURE intent 建单，payee 指向被授权商户，带 BN code 头。此刻还没扣钱。',
  capture: '捕获订单，买家的钱进入商户 General Ledger（商户余额仍为 $0，等待划给 PSP）。',
  disburse: '用 capture id 触发 referenced-payouts，把钱从商户 GL 划到 PSP 的 PSA（Type 5 账户），日终 sweep 到 PSP 银行账户。',
  refund: '发起退款。PSP Path 下退款由 PSP 承担，且 2.0 保证退款从 PSA 出而非错误扣商户余额。',
}

export function StepTips() {
  const activeStep = useFlowStore((s) => s.activeStep)
  const step = STEPS.find((s) => s.id === activeStep)!
  const concepts = conceptsFor(step.conceptKeys)
  const [openTips, setOpenTips] = useState(false)

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm">
        <Lightbulb size={16} className="text-ink" />
        <span className="leading-relaxed">{EXPLAIN[activeStep]}</span>
      </div>
      {concepts.length > 0 && (
        <div className="border-t border-line pt-2">
          <button
            onClick={() => setOpenTips((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted hover:text-ink"
          >
            <ChevronRight size={14} className={cn('transition', openTips && 'rotate-90')} />
            相关概念 {concepts.length} 条
          </button>
          {openTips && (
            <div className="mt-2 flex flex-col gap-2">
              {concepts.map((c) => (
                <div key={c.key} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.title}</span>
                    <Badge tone="muted">{c.section}</Badge>
                  </div>
                  <p className="text-ink/80">{c.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
```

- [ ] **Step 2: 删除 ConceptPanel.tsx**

```bash
git rm psp-path-dashboard/src/components/ConceptPanel.tsx
```
（其在 PlaygroundPage 的引用会在 Task D4 一并移除。）

- [ ] **Step 3: Commit**

```bash
git add psp-path-dashboard/src/components/StepTips.tsx
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 加内联 StepTips，删除独立 ConceptPanel"
```

---

### Task D3: 改写 StepDetail（结构化输入 + 可编辑 body + headers 回显 + response）

**Files:**
- Modify: `psp-path-dashboard/src/components/StepDetail.tsx`

- [ ] **Step 1: 用新版整体替换 StepDetail.tsx**

替换 `psp-path-dashboard/src/components/StepDetail.tsx` 全部内容：
```tsx
import { useEffect, useState } from 'react'
import { Send, Pencil, RotateCcw, Eye, EyeOff } from 'lucide-react'
import { STEPS } from '@/lib/steps'
import { useFlowStore, type StepId, type FlowConfig } from '@/store/flow'
import { useCredentialsStore } from '@/store/credentials'
import * as api from '@/lib/api'
import {
  buildPartnerReferralBody,
  buildOrderBody,
  buildReferencedPayoutBody,
  buildRefundBody,
} from '@/lib/psp-requests'
import { generateAuthAssertion } from '@/lib/auth-assertion'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

// 哪些步骤有 request body（capture 无 body；auth 走独立路由）。
const STEP_HAS_BODY: Record<StepId, boolean> = {
  auth: false,
  onboarding: true,
  createOrder: true,
  capture: false,
  disburse: true,
  refund: true,
}

// 由 config + 链路 id 构建某步的 body 对象；无 body 或依赖未就绪时返回 null。
function buildBodyFor(id: StepId, config: FlowConfig, captureId: string): object | null {
  switch (id) {
    case 'onboarding':
      return buildPartnerReferralBody(config.trackingId, config.returnUrl)
    case 'createOrder':
      return buildOrderBody({
        amount: config.amount,
        currency: config.currency,
        payeeEmail: config.payeeEmail,
        referenceId: `psp_${config.currency}`,
      })
    case 'disburse':
      return captureId ? buildReferencedPayoutBody(captureId) : null
    case 'refund':
      return buildRefundBody()
    default:
      return null
  }
}

async function runStep(id: StepId): Promise<api.ApiResult> {
  const flow = useFlowStore.getState()
  const cred = useCredentialsStore.getState()
  const { accessToken, orderId, captureId, config, requestBodies } = flow

  if (id === 'auth') {
    const r = await api.fetchAccessToken()
    if (r.ok && r.data.accessToken) flow.setAccessToken(r.data.accessToken)
    return r
  }

  const step = STEPS.find((s) => s.id === id)!
  const targetPath = step.pathTemplate
    .replace('{orderId}', orderId)
    .replace('{captureId}', captureId)
  const authAssertion =
    config.authAssertionEnabled && cred.clientId && config.payerId
      ? generateAuthAssertion(cred.clientId, config.payerId)
      : undefined

  const r = await api.callCommon(targetPath, {
    method: 'POST',
    rawBody: STEP_HAS_BODY[id] ? requestBodies[id] : undefined,
    token: accessToken,
    bnCode: cred.bnCode || undefined,
    authAssertion,
  })

  if (id === 'createOrder') {
    const oid = (r.data as { id?: string }).id
    if (r.ok && oid) flow.setOrderId(oid)
  } else if (id === 'capture') {
    const cap = (r.data as {
      purchase_units?: Array<{ payments?: { captures?: Array<{ id: string }> } }>
    }).purchase_units?.[0]?.payments?.captures?.[0]?.id
    if (r.ok && cap) flow.setCaptureId(cap)
  } else if (id === 'refund') {
    const rid = (r.data as { id?: string }).id
    if (r.ok && rid) flow.setRefundId(rid)
  }
  return r
}

export function StepDetail() {
  const activeStep = useFlowStore((s) => s.activeStep)
  const status = useFlowStore((s) => s.stepStatus[s.activeStep])
  const response = useFlowStore((s) => s.responses[s.activeStep])
  const config = useFlowStore((s) => s.config)
  const updateConfig = useFlowStore((s) => s.updateConfig)
  const setStepResult = useFlowStore((s) => s.setStepResult)
  const orderId = useFlowStore((s) => s.orderId)
  const captureId = useFlowStore((s) => s.captureId)
  const accessToken = useFlowStore((s) => s.accessToken)
  const requestBody = useFlowStore((s) => s.requestBodies[s.activeStep])
  const editing = useFlowStore((s) => Boolean(s.bodyEditing[s.activeStep]))
  const setRequestBody = useFlowStore((s) => s.setRequestBody)
  const setBodyEditing = useFlowStore((s) => s.setBodyEditing)
  const isConfigured = useCredentialsStore((s) => s.isConfigured())
  const clientId = useCredentialsStore((s) => s.clientId)
  const bnCode = useCredentialsStore((s) => s.bnCode)
  const [showToken, setShowToken] = useState(false)

  const step = STEPS.find((s) => s.id === activeStep)!
  const resolvedPath = step.pathTemplate
    .replace('{orderId}', orderId || '{orderId}')
    .replace('{captureId}', captureId || '{captureId}')

  // 进入某步时若还没生成 body，则由 config 生成初值。
  useEffect(() => {
    if (!STEP_HAS_BODY[activeStep]) return
    if (requestBody !== undefined) return
    const built = buildBodyFor(activeStep, config, captureId)
    if (built !== null) setRequestBody(activeStep, JSON.stringify(built, null, 2))
  }, [activeStep, requestBody, config, captureId, setRequestBody])

  const regenerate = () => {
    const built = buildBodyFor(activeStep, config, captureId)
    if (built !== null) setRequestBody(activeStep, JSON.stringify(built, null, 2))
  }

  // 改结构化字段：更新 config 并按新值重建当前步 body（覆盖手动编辑）。
  const onField = (patch: Partial<FlowConfig>) => {
    updateConfig(patch)
    const built = buildBodyFor(activeStep, { ...config, ...patch }, captureId)
    if (built !== null) setRequestBody(activeStep, JSON.stringify(built, null, 2))
  }

  const authAssertionPreview =
    config.authAssertionEnabled && clientId && config.payerId
      ? generateAuthAssertion(clientId, config.payerId)
      : ''

  const maskedToken = accessToken
    ? `Bearer ${accessToken.slice(0, 12)}…${accessToken.slice(-6)}`
    : 'Bearer <先执行 Auth 获取>'

  const onSend = async () => {
    setStepResult(activeStep, 'running')
    try {
      const r = await runStep(activeStep)
      setStepResult(activeStep, r.ok ? 'success' : 'error', r.data, r.ok ? undefined : `HTTP ${r.status}`)
    } catch (e) {
      setStepResult(activeStep, 'error', { error: String(e) }, String(e))
    }
  }

  const inputCls = 'rounded border border-line bg-white px-2 py-1 font-mono text-sm'

  return (
    <div className="flex flex-col gap-3">
      {/* 请求行 */}
      <Card>
        <div className="flex items-center gap-2">
          <Badge tone="ink">{step.method}</Badge>
          <span className="font-mono text-sm">{resolvedPath}</span>
        </div>
      </Card>

      {/* 结构化输入 */}
      <Card className="flex flex-col gap-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">关键参数</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {activeStep === 'createOrder' && (
            <>
              <label className="flex flex-col gap-1">金额
                <input className={inputCls} value={config.amount}
                  onChange={(e) => onField({ amount: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1">币种
                <input className={inputCls} value={config.currency}
                  onChange={(e) => onField({ currency: e.target.value })} />
              </label>
              <label className="col-span-2 flex flex-col gap-1">Payee Email（被授权商户）
                <input className={inputCls} value={config.payeeEmail}
                  onChange={(e) => onField({ payeeEmail: e.target.value })} />
              </label>
            </>
          )}
          {activeStep === 'onboarding' && (
            <>
              <label className="flex flex-col gap-1">Tracking ID
                <input className={inputCls} value={config.trackingId}
                  onChange={(e) => onField({ trackingId: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1">Return URL
                <input className={inputCls} value={config.returnUrl}
                  onChange={(e) => onField({ returnUrl: e.target.value })} />
              </label>
            </>
          )}
          {/* payer_id + Auth Assertion 开关：对所有走 /common 的步骤可用 */}
          {activeStep !== 'auth' && (
            <>
              <label className="flex flex-col gap-1">Payer ID（商户）
                <input className={inputCls} value={config.payerId}
                  onChange={(e) => updateConfig({ payerId: e.target.value })} />
              </label>
              <label className="flex items-end gap-2">
                <input type="checkbox" checked={config.authAssertionEnabled}
                  onChange={(e) => updateConfig({ authAssertionEnabled: e.target.checked })} />
                带 PayPal-Auth-Assertion
              </label>
            </>
          )}
        </div>
      </Card>

      {/* Request body（默认只读，可编辑，实时保存） */}
      {STEP_HAS_BODY[activeStep] && (
        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Request Body</span>
            <div className="flex gap-2">
              <Button variant="ghost" className="px-2 py-1 text-xs"
                onClick={() => setBodyEditing(activeStep, !editing)}>
                <Pencil size={14} /> {editing ? '完成' : '编辑'}
              </Button>
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={regenerate}>
                <RotateCcw size={14} /> 重新生成
              </Button>
            </div>
          </div>
          {editing ? (
            <textarea
              className="min-h-48 w-full rounded border border-line bg-white p-2 font-mono text-xs"
              value={requestBody ?? ''}
              onChange={(e) => setRequestBody(activeStep, e.target.value)}
            />
          ) : (
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
              {requestBody ?? '（尚未生成 —— disburse 需先完成 Capture 拿到 capture id，可点「重新生成」）'}
            </pre>
          )}
        </Card>
      )}

      {/* Headers 回显 */}
      <Card className="flex flex-col gap-1">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Request Headers</div>
        <div className="font-mono text-xs leading-relaxed">
          {activeStep === 'auth' ? (
            <div>Authorization: Basic &lt;clientId:secret 的 base64&gt;</div>
          ) : (
            <>
              <div className="flex items-center gap-1">
                Authorization: {showToken ? `Bearer ${accessToken || '<先执行 Auth>'}` : maskedToken}
                <button className="text-muted hover:text-ink" onClick={() => setShowToken((v) => !v)}>
                  {showToken ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              <div>Content-Type: application/json</div>
              <div>Prefer: return=representation</div>
              {bnCode && <div>PayPal-Partner-Attribution-Id: {bnCode}</div>}
              {authAssertionPreview && <div className="break-all">PayPal-Auth-Assertion: {authAssertionPreview}</div>}
            </>
          )}
        </div>
      </Card>

      {/* 发送 */}
      <div className="flex items-center gap-3">
        <Button onClick={onSend} disabled={!isConfigured || status === 'running'}>
          <Send size={16} /> 发送
        </Button>
        {!isConfigured && <span className="text-xs text-accent">请先到「凭证」页填 client id/secret</span>}
        {status !== 'idle' && (
          <Badge tone={status === 'success' ? 'ok' : status === 'error' ? 'accent' : 'muted'}>{status}</Badge>
        )}
      </div>

      {/* Response（发送后显示在下方） */}
      {response !== undefined && (
        <Card>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Response</div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
            {JSON.stringify(response, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

Run: `cd psp-path-dashboard && npx tsc --noEmit -p tsconfig.app.json`
Expected: 无报错（`FlowConfig` 已从 flow.ts 导出；`api.ApiResult` 已导出）

- [ ] **Step 3: Commit**

```bash
git add psp-path-dashboard/src/components/StepDetail.tsx
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): StepDetail 改为可编辑真实 body + headers 回显 + response 下移"
```

---

### Task D4: PlaygroundPage 改两栏

**Files:**
- Modify: `psp-path-dashboard/src/pages/PlaygroundPage.tsx`

- [ ] **Step 1: 替换为左+中两栏（删 ConceptPanel、加 StepTips）**

替换 `psp-path-dashboard/src/pages/PlaygroundPage.tsx` 全部内容：
```tsx
import { TopBar } from '@/components/TopBar'
import { StepRail } from '@/components/StepRail'
import { FundFlowBar } from '@/components/FundFlowBar'
import { StepTips } from '@/components/StepTips'
import { StepDetail } from '@/components/StepDetail'

export function PlaygroundPage() {
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      {/* 左：步骤流；中：资金流条 + Tips + 请求/响应。窄屏塌成单列 */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className="shrink-0 overflow-x-auto border-b border-line p-3 lg:w-72 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <StepRail />
        </aside>
        <main className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <FundFlowBar />
          <StepTips />
          <StepDetail />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: dev/构建冒烟**

Run: `cd psp-path-dashboard && npx tsc --noEmit -p tsconfig.app.json && pnpm build`
Expected: tsc 无报错；`vite build` 产出 `dist/`。（可选 `pnpm dev` 开 http://localhost:5180 目测：两栏、无右侧 panel、点步骤中间变化、编辑 body 生效、发送后响应显示在下方。）

- [ ] **Step 3: Commit**

```bash
git add psp-path-dashboard/src/pages/PlaygroundPage.tsx
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): PlaygroundPage 改左+中两栏（删右侧 panel，加 StepTips）"
```

---

## Phase E — 验收

### Task E1: 全量测试与构建

**Files:** 无（验证）

- [ ] **Step 1: 前端测试 + 构建**

Run: `cd psp-path-dashboard && pnpm test && pnpm build`
Expected: 所有单测通过（psp-requests / auth-assertion / flow / credentials）；构建成功。

- [ ] **Step 2: 后端测试 + tsc**

Run: `cd paypal-backend-api && pnpm test && npx tsc --noEmit`
Expected: common-forward 与 psp 单测全绿；tsc 无新增报错。

### Task E2: sandbox 手测 + push 提醒

**Files:** 无（人工）

- [ ] **Step 1: 起前后端**

```bash
cd /Users/yqiang/Documents/paypal-work/ppgms-test.github.io && pnpm dev:api   # 终端1
cd /Users/yqiang/Documents/paypal-work/ppgms-test.github.io/psp-path-dashboard && pnpm dev  # 终端2
```

- [ ] **Step 2: 走主链路并验证新功能**

http://localhost:5180 ：Auth → Onboarding → Create Order → Capture → Disburse → Refund。逐步确认：
- 中间显示真实 request body（默认只读），点「编辑」可改、实时保存，「重新生成」可恢复；
- Headers 卡显示 Authorization/Prefer/BN code；勾上「带 PayPal-Auth-Assertion」后出现该头且各步都带；
- 发送后 Response 显示在中间下方；orderId/captureId 串联正常（disburse/refund 用到 captureId）。

- [ ] **Step 3: ⚠️ 提醒用户 push（feedback_push_reminder）**

本次改动含 `paypal-backend-api/`（`/api/common` + `common-forward` + `cors.ts`）。明确提醒用户自行 push，不代劳。

---

## Self-Review（作者自检）

**1. Spec 覆盖：**
- 删 ConceptPanel + 概念降级 Tips → Task D2（StepTips）+ 删除文件 ✓
- 回显真实 request body（可编辑/默认只读/实时保存/重新生成）→ Task D3 ✓
- 回显关键 headers 含 Auth Assertion → Task D3 headers 卡 ✓
- Auth Assertion 可选、都挂步骤 2–6 → Task D3 `runStep` authAssertion + onField/开关 ✓
- 两栏布局、response 下移 → Task D4 + D3 ✓
- `/api/common`（path 走 header、body 转发、限 sandbox host）→ Task A1/A2 ✓
- 保留 byok/psp/* 与 psp.ts → 未删除，仅新增 ✓
- Auth 步骤仍用 access-token 路由 → api.ts fetchAccessToken 保留、runStep auth 分支 ✓
- 测试（common-forward / psp-requests / auth-assertion / flow）→ A1/B1/B2/C1 ✓
- push 提醒 → E2 ✓

**2. 占位符扫描：** 无 TBD/TODO；每个改代码 Step 均含完整代码。

**3. 类型/命名一致性：**
- `FlowConfig` 加 `payerId`/`authAssertionEnabled`（C1）→ StepDetail 用（D3）✓
- `requestBodies`/`bodyEditing` + `setRequestBody`/`setBodyEditing`（C1）→ StepDetail 用（D3）✓
- `callCommon(targetPath, CommonOpts{method,rawBody,token,bnCode,authAssertion})`（D1）→ StepDetail `runStep` 调用一致 ✓
- `fetchAccessToken` 返回 `ApiResult<{accessToken?}>`（D1）→ runStep auth 读 `r.data.accessToken` ✓
- `generateAuthAssertion(clientId, payerId)`（B2）→ StepDetail 调用一致 ✓
- `buildPartnerReferralBody/buildOrderBody/buildReferencedPayoutBody/buildRefundBody`（B1）→ StepDetail `buildBodyFor` 调用一致 ✓
- `resolveTargetUrl`/`pickForwardHeaders`/`FORWARD_HEADERS`（A1）→ 路由（A2）用 ✓
- `DEFAULT_PAYER_ID`/`DEFAULT_PAYEE_EMAIL` 来自现有 `config/default-credentials.ts` → flow.ts import ✓
- `step.pathTemplate` 值即真实 PayPal path（onboarding/createOrder/capture/disburse/refund）→ callCommon 直接用 ✓

> 注意点（实现时留意）：`onField` 改结构化字段会用新值重建 body、覆盖手动编辑——这是设计选择（§9 非目标里已说明字段是初值来源、原始 JSON 编辑为最终真相），非 bug。
