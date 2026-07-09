# PSP Path Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建纯前端 subrepo `psp-path-dashboard`，做一个走真实 PayPal sandbox 的「PSP Path 分步演练台」，照 Postman collection 一步步点（Auth → Onboarding → Create Order → Capture → Disburse → Refund），每步配中文讲解，帮助理解 PSP Path 资金流与核心概念。

**Architecture:** 前端 React 18 + Vite 5 + TS + Tailwind（对齐 applepay/bopis），zustand 管状态，react-router-dom 分「演练台」与「凭证管理」两页；真实调用复用现有 `paypal-backend-api`（Next.js Edge 代理），新增一组 `/api/byok/psp/*` 路由。第 1 步用 BYOK（Basic auth: clientId:secret）换取 OAuth `access_token` 返回前端，后续步骤前端带 `Authorization: Bearer <access_token>` 调用（忠实还原 Postman 流程）。

**Tech Stack:** React 18, Vite 5, TypeScript, TailwindCSS 3, zustand 5, react-router-dom 6, lucide-react, class-variance-authority + clsx + tailwind-merge, vitest（仅测纯逻辑）。后端 Next.js 15 Edge Runtime。

**参考 spec：** `psp-path-dashboard/docs/2026-07-09-psp-path-playground-design.md`

---

## File Structure

### 后端（paypal-backend-api，扩展）
- Modify: `paypal-backend-api/src/lib/paypal-rest.ts` — 导出 `getAccessToken`
- Create: `paypal-backend-api/src/lib/psp.ts` — PSP 专属 fetch 封装 + body 模板 + `parseBearerToken`
- Create: `paypal-backend-api/src/lib/psp.test.ts` — psp.ts 单测（mock fetch）
- Create: `paypal-backend-api/vitest.config.ts` — 测试配置
- Create: `paypal-backend-api/src/app/api/byok/psp/access-token/route.ts`
- Create: `paypal-backend-api/src/app/api/byok/psp/partner-referrals/route.ts`
- Create: `paypal-backend-api/src/app/api/byok/psp/orders/route.ts`
- Create: `paypal-backend-api/src/app/api/byok/psp/orders/[orderId]/capture/route.ts`
- Create: `paypal-backend-api/src/app/api/byok/psp/referenced-payouts-items/route.ts`
- Create: `paypal-backend-api/src/app/api/byok/psp/captures/[captureId]/refund/route.ts`

### 前端（psp-path-dashboard，新建）
- Create 脚手架: `package.json` `index.html` `vite.config.ts` `tailwind.config.ts` `postcss.config.js` `tsconfig.json` `tsconfig.app.json` `tsconfig.node.json` `vitest.config.ts` `public/favicon.svg`
- Create: `src/main.tsx` `src/App.tsx` `src/index.css`
- Create: `src/lib/utils.ts`（cn） `src/lib/api.ts` `src/lib/steps.ts` `src/lib/concepts.ts`
- Create: `src/store/credentials.ts` `src/store/credentials.test.ts` `src/store/flow.ts` `src/store/flow.test.ts`
- Create: `src/components/ui/Badge.tsx` `src/components/ui/Card.tsx` `src/components/ui/Button.tsx`
- Create: `src/components/TopBar.tsx` `src/components/StepRail.tsx` `src/components/FundFlowBar.tsx` `src/components/StepDetail.tsx` `src/components/ConceptPanel.tsx`
- Create: `src/pages/PlaygroundPage.tsx` `src/pages/CredentialsPage.tsx`
- Modify: `pnpm-workspace.yaml` — 加入 `psp-path-dashboard`

---

## Phase A — 后端 PSP 端点

### Task A1: 导出 getAccessToken

**Files:**
- Modify: `paypal-backend-api/src/lib/paypal-rest.ts`

- [ ] **Step 1: 把 `getAccessToken` 从私有改为导出**

在 `paypal-backend-api/src/lib/paypal-rest.ts` 中，将：
```ts
async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
```
改为：
```ts
export async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
```

- [ ] **Step 2: 确认类型检查通过**

Run: `cd paypal-backend-api && npx tsc --noEmit`
Expected: 无新增报错（原有 tsbuildinfo 变化可忽略）

- [ ] **Step 3: Commit**

```bash
git add paypal-backend-api/src/lib/paypal-rest.ts
git commit -m "refactor[$(date +%Y-%m-%d)](paypal-backend-api): 导出 getAccessToken 供 PSP 路由复用"
```

---

### Task A2: psp.ts 核心库（TDD）

**Files:**
- Create: `paypal-backend-api/vitest.config.ts`
- Create: `paypal-backend-api/src/lib/psp.ts`
- Test: `paypal-backend-api/src/lib/psp.test.ts`

- [ ] **Step 1: 加 vitest 依赖与配置**

```bash
cd paypal-backend-api && pnpm add -D vitest
```

Create `paypal-backend-api/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

在 `paypal-backend-api/package.json` 的 `scripts` 加一行：
```json
    "test": "vitest run",
```

- [ ] **Step 2: 写失败测试**

Create `paypal-backend-api/src/lib/psp.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildPartnerReferralBody,
  buildPspOrderBody,
  createPartnerReferral,
  createPspOrder,
  capturePspOrder,
  createReferencedPayout,
  refundCapture,
  parseBearerToken,
} from './psp'
import { PayPalAuthError, PAYPAL_SANDBOX_BASE } from './paypal-rest'

function mockFetchOnce(status = 200, json: unknown = { ok: true }) {
  const spy = vi.fn().mockResolvedValue({
    status,
    json: () => Promise.resolve(json),
  } as Response)
  vi.stubGlobal('fetch', spy)
  return spy
}

afterEach(() => vi.unstubAllGlobals())

describe('parseBearerToken', () => {
  it('提取 Bearer token', () => {
    const req = new Request('http://x', { headers: { authorization: 'Bearer abc.def' } })
    expect(parseBearerToken(req)).toBe('abc.def')
  })
  it('缺失时抛 PayPalAuthError', () => {
    const req = new Request('http://x')
    expect(() => parseBearerToken(req)).toThrow(PayPalAuthError)
  })
})

describe('body 模板', () => {
  it('partner referral 含 DELAY_FUNDS_DISBURSEMENT 与 tracking_id', () => {
    const body = buildPartnerReferralBody('trk-1', 'https://ret')
    expect(body.tracking_id).toBe('trk-1')
    const features = body.operations[0].api_integration_preference.rest_api_integration
      .third_party_details.features
    expect(features).toContain('DELAY_FUNDS_DISBURSEMENT')
    expect(body.partner_configuration_override.return_url).toBe('https://ret')
  })
  it('order body 带 payee email 与金额', () => {
    const body = buildPspOrderBody({ amount: '160.00', currency: 'GBP', payeeEmail: 'm@x.com', referenceId: 'r1' })
    expect(body.intent).toBe('CAPTURE')
    expect(body.purchase_units[0].payee.email_address).toBe('m@x.com')
    expect(body.purchase_units[0].amount.value).toBe('160.00')
  })
})

describe('PSP fetch 封装', () => {
  it('createPspOrder 带 Bearer + BN code header 打 orders 接口', async () => {
    const spy = mockFetchOnce(201, { id: 'ORDER1' })
    const { status, data } = await createPspOrder('tok', { amount: '1.00', currency: 'GBP', payeeEmail: 'm@x.com', referenceId: 'r', bnCode: 'BN123' })
    expect(status).toBe(201)
    expect((data as { id: string }).id).toBe('ORDER1')
    const [url, init] = spy.mock.calls[0]
    expect(url).toBe(`${PAYPAL_SANDBOX_BASE}/v2/checkout/orders`)
    expect((init as RequestInit).method).toBe('POST')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer tok')
    expect(headers['PayPal-Partner-Attribution-Id']).toBe('BN123')
  })

  it('capturePspOrder 打 capture 接口并带 BN code', async () => {
    const spy = mockFetchOnce(201, { id: 'ORDER1', status: 'COMPLETED' })
    await capturePspOrder('tok', 'ORDER1', 'BN123')
    const [url, init] = spy.mock.calls[0]
    expect(url).toBe(`${PAYPAL_SANDBOX_BASE}/v2/checkout/orders/ORDER1/capture`)
    expect(((init as RequestInit).headers as Record<string, string>)['PayPal-Partner-Attribution-Id']).toBe('BN123')
  })

  it('createReferencedPayout 用 capture_id 组 TRANSACTION_ID body', async () => {
    const spy = mockFetchOnce(200, { items: [] })
    await createReferencedPayout('tok', 'CAP99')
    const [url, init] = spy.mock.calls[0]
    expect(url).toBe(`${PAYPAL_SANDBOX_BASE}/v1/payments/referenced-payouts-items`)
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ reference_type: 'TRANSACTION_ID', reference_id: 'CAP99' })
  })

  it('refundCapture 打 refund 接口', async () => {
    const spy = mockFetchOnce(201, { id: 'REF1', status: 'COMPLETED' })
    await refundCapture('tok', 'CAP99')
    const [url] = spy.mock.calls[0]
    expect(url).toBe(`${PAYPAL_SANDBOX_BASE}/v2/payments/captures/CAP99/refund`)
  })

  it('createPartnerReferral 打 partner-referrals 接口', async () => {
    const spy = mockFetchOnce(201, { links: [] })
    await createPartnerReferral('tok', 'trk-1', 'https://ret')
    const [url] = spy.mock.calls[0]
    expect(url).toBe(`${PAYPAL_SANDBOX_BASE}/v2/customer/partner-referrals`)
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd paypal-backend-api && pnpm test`
Expected: FAIL（`psp.ts` 不存在 / 函数未定义）

- [ ] **Step 4: 实现 psp.ts**

Create `paypal-backend-api/src/lib/psp.ts`:
```ts
// PSP Path 专属 REST 封装。所有调用带 caller 传入的 OAuth Bearer token（来自 access-token 步骤），
// 忠实还原 Postman collection「PSP PATH Collection - HK」的请求。仅 sandbox。
import { PAYPAL_SANDBOX_BASE, PayPalAuthError, type PayPalRestResponse } from './paypal-rest'

export function parseBearerToken(req: Request): string {
  const header = req.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) throw new PayPalAuthError('Missing or malformed Authorization: Bearer header')
  return match[1].trim()
}

async function pspFetch(
  token: string,
  path: string,
  method: 'POST',
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<PayPalRestResponse> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...extraHeaders,
  }
  const res = await fetch(`${PAYPAL_SANDBOX_BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  return { data, status: res.status }
}

// ── Body 模板（取自 Postman collection）──────────────────────────────────────

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

export interface PspOrderInput {
  amount: string
  currency: string
  payeeEmail: string
  referenceId: string
  bnCode?: string
}

export function buildPspOrderBody(input: PspOrderInput) {
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

// ── 各步骤封装 ───────────────────────────────────────────────────────────────

export function createPartnerReferral(token: string, trackingId: string, returnUrl: string) {
  return pspFetch(token, '/v2/customer/partner-referrals', 'POST', buildPartnerReferralBody(trackingId, returnUrl))
}

export function createPspOrder(token: string, input: PspOrderInput) {
  const extra = input.bnCode ? { 'PayPal-Partner-Attribution-Id': input.bnCode } : {}
  return pspFetch(token, '/v2/checkout/orders', 'POST', buildPspOrderBody(input), extra)
}

export function capturePspOrder(token: string, orderId: string, bnCode?: string) {
  const extra = bnCode ? { 'PayPal-Partner-Attribution-Id': bnCode } : {}
  return pspFetch(token, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, 'POST', undefined, extra)
}

export function createReferencedPayout(token: string, captureId: string) {
  return pspFetch(token, '/v1/payments/referenced-payouts-items', 'POST', {
    reference_type: 'TRANSACTION_ID',
    reference_id: captureId,
  })
}

export function refundCapture(token: string, captureId: string) {
  return pspFetch(token, `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, 'POST', {})
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd paypal-backend-api && pnpm test`
Expected: PASS（全部用例绿）

- [ ] **Step 6: Commit**

```bash
git add paypal-backend-api/src/lib/psp.ts paypal-backend-api/src/lib/psp.test.ts paypal-backend-api/vitest.config.ts paypal-backend-api/package.json
git commit -m "feat[$(date +%Y-%m-%d)](paypal-backend-api): 新增 psp.ts 与单测（PSP Path REST 封装）"
```

---

### Task A3: PSP 路由（6 个 route）

**Files:**
- Create: `paypal-backend-api/src/app/api/byok/psp/access-token/route.ts`
- Create: `paypal-backend-api/src/app/api/byok/psp/partner-referrals/route.ts`
- Create: `paypal-backend-api/src/app/api/byok/psp/orders/route.ts`
- Create: `paypal-backend-api/src/app/api/byok/psp/orders/[orderId]/capture/route.ts`
- Create: `paypal-backend-api/src/app/api/byok/psp/referenced-payouts-items/route.ts`
- Create: `paypal-backend-api/src/app/api/byok/psp/captures/[captureId]/refund/route.ts`

- [ ] **Step 1: access-token 路由（Basic → access_token）**

Create `paypal-backend-api/src/app/api/byok/psp/access-token/route.ts`:
```ts
export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { PayPalAuthError, getAccessToken, parseBasicAuth } from '@/lib/paypal-rest'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request) {
  let creds: { clientId: string; clientSecret: string }
  try {
    creds = parseBasicAuth(req)
  } catch (error) {
    if (error instanceof PayPalAuthError) return corsJson({ error: error.message }, 401)
    throw error
  }
  try {
    const accessToken = await getAccessToken(creds.clientId, creds.clientSecret)
    return corsJson({ accessToken })
  } catch (error) {
    if (error instanceof PayPalAuthError) return corsJson({ error: error.message }, 401)
    return corsJson({ error: 'Failed to issue access token' }, 500)
  }
}
```

- [ ] **Step 2: partner-referrals 路由**

Create `paypal-backend-api/src/app/api/byok/psp/partner-referrals/route.ts`:
```ts
export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { PayPalAuthError } from '@/lib/paypal-rest'
import { createPartnerReferral, parseBearerToken } from '@/lib/psp'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request) {
  let token: string
  try {
    token = parseBearerToken(req)
  } catch (error) {
    if (error instanceof PayPalAuthError) return corsJson({ error: error.message }, 401)
    throw error
  }
  let trackingId: string | undefined
  let returnUrl: string | undefined
  try {
    const body = (await req.json()) as { trackingId?: string; returnUrl?: string }
    trackingId = body.trackingId
    returnUrl = body.returnUrl
  } catch {
    return corsJson({ error: 'Request body must be valid JSON' }, 400)
  }
  if (!trackingId || !returnUrl) return corsJson({ error: 'trackingId and returnUrl are required' }, 400)
  const { data, status } = await createPartnerReferral(token, trackingId, returnUrl)
  return corsJson(data, status)
}
```

- [ ] **Step 3: create order 路由**

Create `paypal-backend-api/src/app/api/byok/psp/orders/route.ts`:
```ts
export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { PayPalAuthError } from '@/lib/paypal-rest'
import { createPspOrder, parseBearerToken, type PspOrderInput } from '@/lib/psp'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request) {
  let token: string
  try {
    token = parseBearerToken(req)
  } catch (error) {
    if (error instanceof PayPalAuthError) return corsJson({ error: error.message }, 401)
    throw error
  }
  let input: PspOrderInput
  try {
    input = (await req.json()) as PspOrderInput
  } catch {
    return corsJson({ error: 'Request body must be valid JSON' }, 400)
  }
  if (!input.amount || !input.currency || !input.payeeEmail || !input.referenceId) {
    return corsJson({ error: 'amount, currency, payeeEmail, referenceId are required' }, 400)
  }
  const { data, status } = await createPspOrder(token, input)
  return corsJson(data, status)
}
```

- [ ] **Step 4: capture 路由**

Create `paypal-backend-api/src/app/api/byok/psp/orders/[orderId]/capture/route.ts`:
```ts
export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { PayPalAuthError } from '@/lib/paypal-rest'
import { capturePspOrder, parseBearerToken } from '@/lib/psp'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  let token: string
  try {
    token = parseBearerToken(req)
  } catch (error) {
    if (error instanceof PayPalAuthError) return corsJson({ error: error.message }, 401)
    throw error
  }
  const { orderId } = await params
  const bnCode = req.headers.get('x-paypal-bn-code') ?? undefined
  const { data, status } = await capturePspOrder(token, orderId, bnCode)
  return corsJson(data, status)
}
```

- [ ] **Step 5: referenced-payouts-items 路由**

Create `paypal-backend-api/src/app/api/byok/psp/referenced-payouts-items/route.ts`:
```ts
export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { PayPalAuthError } from '@/lib/paypal-rest'
import { createReferencedPayout, parseBearerToken } from '@/lib/psp'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request) {
  let token: string
  try {
    token = parseBearerToken(req)
  } catch (error) {
    if (error instanceof PayPalAuthError) return corsJson({ error: error.message }, 401)
    throw error
  }
  let captureId: string | undefined
  try {
    const body = (await req.json()) as { captureId?: string }
    captureId = body.captureId
  } catch {
    return corsJson({ error: 'Request body must be valid JSON' }, 400)
  }
  if (!captureId) return corsJson({ error: 'captureId is required' }, 400)
  const { data, status } = await createReferencedPayout(token, captureId)
  return corsJson(data, status)
}
```

- [ ] **Step 6: refund 路由**

Create `paypal-backend-api/src/app/api/byok/psp/captures/[captureId]/refund/route.ts`:
```ts
export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { PayPalAuthError } from '@/lib/paypal-rest'
import { parseBearerToken, refundCapture } from '@/lib/psp'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request, { params }: { params: Promise<{ captureId: string }> }) {
  let token: string
  try {
    token = parseBearerToken(req)
  } catch (error) {
    if (error instanceof PayPalAuthError) return corsJson({ error: error.message }, 401)
    throw error
  }
  const { captureId } = await params
  const { data, status } = await refundCapture(token, captureId)
  return corsJson(data, status)
}
```

- [ ] **Step 7: 类型检查 + 构建冒烟**

Run: `cd paypal-backend-api && npx tsc --noEmit`
Expected: 无新增报错

- [ ] **Step 8: Commit**

```bash
git add paypal-backend-api/src/app/api/byok/psp
git commit -m "feat[$(date +%Y-%m-%d)](paypal-backend-api): 新增 PSP Path 6 个 BYOK 路由（access-token/onboarding/order/capture/disburse/refund）"
```

> ⚠️ 本 Phase 动了 `paypal-backend-api`，全部完成后需在最终验收时**明确提醒用户 push**（见 Task E2；用户偏好 feedback_push_reminder）。

---

## Phase B — 前端脚手架

### Task B1: Vite 工程脚手架 + 加入 workspace

**Files:** 见 File Structure「前端脚手架」

- [ ] **Step 1: 建目录与 package.json**

```bash
mkdir -p psp-path-dashboard/src/{lib,store,components/ui,pages} psp-path-dashboard/public
```

Create `psp-path-dashboard/package.json`:
```json
{
  "name": "psp-path-dashboard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "lucide-react": "^0.511.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "zustand": "^5.0.3"
  },
  "devDependencies": {
    "@types/react": "^18.3.23",
    "@types/react-dom": "^18.3.7",
    "@vitejs/plugin-react": "^4.5.2",
    "autoprefixer": "^10.4.21",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "postcss": "^8.5.3",
    "tailwind-merge": "^3.3.0",
    "tailwindcss": "^3.4.17",
    "tailwindcss-animate": "^1.0.7",
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: 配置文件**

Create `psp-path-dashboard/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: { port: 5180, host: true, open: false },
  build: { outDir: 'dist', emptyOutDir: true },
})
```

Create `psp-path-dashboard/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'] },
})
```

> 注：vitest jsdom 需要 `jsdom`。在 Step 6 安装时一并加 `-D jsdom`。

Create `psp-path-dashboard/postcss.config.js`:
```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}
```

Create `psp-path-dashboard/tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        ink: 'var(--ink)',
        accent: 'var(--accent)',
        ok: 'var(--ok)',
        line: 'var(--line)',
        muted: 'var(--muted)',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [animate],
}
export default config
```

- [ ] **Step 3: tsconfig 三件套**

Create `psp-path-dashboard/tsconfig.json`:
```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

Create `psp-path-dashboard/tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
```

Create `psp-path-dashboard/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "tailwind.config.ts"]
}
```

- [ ] **Step 4: index.html + favicon + 主题 CSS**

Create `psp-path-dashboard/index.html`:
```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>PSP Path Playground</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `psp-path-dashboard/public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2a335f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/><circle cx="12" cy="12" r="3"/></svg>
```

Create `psp-path-dashboard/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --paper: #f5f0e6;
  --ink: #2a335f;
  --accent: #c0392b;
  --ok: #2e7d54;
  --line: #d8cfbc;
  --muted: #8a8371;
}

html, body, #root { height: 100%; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}
```

- [ ] **Step 5: 注册到 pnpm workspace**

在 `pnpm-workspace.yaml` 的 `packages:` 列表末尾加：
```yaml
  - psp-path-dashboard
```

- [ ] **Step 6: 安装依赖**

```bash
cd /Users/yqiang/Documents/paypal-work/ppgms-test.github.io && pnpm install --filter psp-path-dashboard && cd psp-path-dashboard && pnpm add -D jsdom
```
Expected: 安装成功，生成 `psp-path-dashboard/node_modules`

- [ ] **Step 7: Commit**

```bash
git add psp-path-dashboard/package.json psp-path-dashboard/*.ts psp-path-dashboard/*.json psp-path-dashboard/*.js psp-path-dashboard/index.html psp-path-dashboard/public psp-path-dashboard/src/index.css pnpm-workspace.yaml
git commit -m "chore[$(date +%Y-%m-%d)](psp-path-dashboard): 初始化 Vite+TS+Tailwind 脚手架并加入 workspace"
```

---

### Task B2: UI primitives + cn 工具

**Files:**
- Create: `psp-path-dashboard/src/lib/utils.ts`
- Create: `psp-path-dashboard/src/components/ui/Card.tsx`
- Create: `psp-path-dashboard/src/components/ui/Badge.tsx`
- Create: `psp-path-dashboard/src/components/ui/Button.tsx`

- [ ] **Step 1: cn 工具**

Create `psp-path-dashboard/src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 2: Card**

Create `psp-path-dashboard/src/components/ui/Card.tsx`:
```tsx
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-lg border border-line bg-white/60 p-4 shadow-sm', className)}>
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Badge（语义色）**

Create `psp-path-dashboard/src/components/ui/Badge.tsx`:
```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badge = cva('inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-mono', {
  variants: {
    tone: {
      ink: 'border-ink text-ink',
      accent: 'border-accent text-accent',
      ok: 'border-ok text-ok',
      muted: 'border-line text-muted',
    },
  },
  defaultVariants: { tone: 'ink' },
})

export function Badge({ tone, className, children }: VariantProps<typeof badge> & { className?: string; children: React.ReactNode }) {
  return <span className={cn(badge({ tone }), className)}>{children}</span>
}
```

- [ ] **Step 4: Button**

Create `psp-path-dashboard/src/components/ui/Button.tsx`:
```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-paper hover:opacity-90',
        outline: 'border border-ink text-ink hover:bg-ink/5',
        ghost: 'text-ink hover:bg-ink/5',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
)

export function Button({
  variant,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>) {
  return <button className={cn(button({ variant }), className)} {...props} />
}
```

- [ ] **Step 5: Commit**

```bash
git add psp-path-dashboard/src/lib/utils.ts psp-path-dashboard/src/components/ui
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 加 cn 工具与 Card/Badge/Button UI 原语"
```

---

## Phase C — 状态、API、内容

### Task C1: credentials store（TDD）

**Files:**
- Create: `psp-path-dashboard/src/store/credentials.ts`
- Test: `psp-path-dashboard/src/store/credentials.test.ts`

- [ ] **Step 1: 写失败测试**

Create `psp-path-dashboard/src/store/credentials.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useCredentialsStore } from './credentials'

beforeEach(() => {
  sessionStorage.clear()
  useCredentialsStore.getState().reset()
})

describe('credentials store', () => {
  it('初始未配置', () => {
    expect(useCredentialsStore.getState().isConfigured()).toBe(false)
  })
  it('设置 clientId/secret 后视为已配置', () => {
    useCredentialsStore.getState().setClientId('cid')
    useCredentialsStore.getState().setClientSecret('csec')
    expect(useCredentialsStore.getState().isConfigured()).toBe(true)
  })
  it('持久化到 sessionStorage', () => {
    useCredentialsStore.getState().setClientId('cid')
    expect(sessionStorage.getItem('psp-credentials')).toContain('cid')
  })
  it('basicAuth 生成 base64(clientId:secret)', () => {
    useCredentialsStore.getState().setClientId('a')
    useCredentialsStore.getState().setClientSecret('b')
    expect(useCredentialsStore.getState().basicAuth()).toBe(btoa('a:b'))
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd psp-path-dashboard && pnpm test`
Expected: FAIL（`./credentials` 不存在）

- [ ] **Step 3: 实现 store**

Create `psp-path-dashboard/src/store/credentials.ts`:
```ts
// BYOK 凭证 store。存 sessionStorage（关标签即清），不落磁盘、不进代码。
// bnCode 为 PayPal-Partner-Attribution-Id（BN code），PSP Path 用它做结算路由。
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface CredentialsState {
  clientId: string
  clientSecret: string
  bnCode: string
  setClientId: (v: string) => void
  setClientSecret: (v: string) => void
  setBnCode: (v: string) => void
  reset: () => void
  isConfigured: () => boolean
  basicAuth: () => string
}

const INITIAL = { clientId: '', clientSecret: '', bnCode: '' }

export const useCredentialsStore = create<CredentialsState>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      setClientId: (clientId) => set({ clientId }),
      setClientSecret: (clientSecret) => set({ clientSecret }),
      setBnCode: (bnCode) => set({ bnCode }),
      reset: () => set(INITIAL),
      isConfigured: () => Boolean(get().clientId && get().clientSecret),
      basicAuth: () => btoa(`${get().clientId}:${get().clientSecret}`),
    }),
    { name: 'psp-credentials', storage: createJSONStorage(() => sessionStorage) },
  ),
)
```

- [ ] **Step 4: 运行确认通过**

Run: `cd psp-path-dashboard && pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add psp-path-dashboard/src/store/credentials.ts psp-path-dashboard/src/store/credentials.test.ts
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 加 BYOK credentials store（sessionStorage 持久化）"
```

---

### Task C2: flow store（TDD）

**Files:**
- Create: `psp-path-dashboard/src/store/flow.ts`
- Test: `psp-path-dashboard/src/store/flow.test.ts`

- [ ] **Step 1: 写失败测试**

Create `psp-path-dashboard/src/store/flow.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useFlowStore } from './flow'

beforeEach(() => useFlowStore.getState().reset())

describe('flow store', () => {
  it('初始所有产出为空、步骤 idle', () => {
    const s = useFlowStore.getState()
    expect(s.accessToken).toBe('')
    expect(s.orderId).toBe('')
    expect(s.stepStatus.auth).toBe('idle')
  })
  it('setStepResult 写入状态与响应', () => {
    useFlowStore.getState().setStepResult('auth', 'success', { accessToken: 'T' })
    expect(useFlowStore.getState().stepStatus.auth).toBe('success')
    expect(useFlowStore.getState().responses.auth).toEqual({ accessToken: 'T' })
  })
  it('产出串联：设置 orderId 供后续读取', () => {
    useFlowStore.getState().setOrderId('ORD1')
    useFlowStore.getState().setCaptureId('CAP1')
    expect(useFlowStore.getState().orderId).toBe('ORD1')
    expect(useFlowStore.getState().captureId).toBe('CAP1')
  })
  it('reset 清空一切', () => {
    useFlowStore.getState().setOrderId('X')
    useFlowStore.getState().reset()
    expect(useFlowStore.getState().orderId).toBe('')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd psp-path-dashboard && pnpm test`
Expected: FAIL

- [ ] **Step 3: 实现 flow store**

Create `psp-path-dashboard/src/store/flow.ts`:
```ts
// 演练台流程状态：串联各步产出 + 每步状态/响应 + 可编辑请求配置。
import { create } from 'zustand'

export type StepId = 'auth' | 'onboarding' | 'createOrder' | 'capture' | 'disburse' | 'refund'
export type StepStatus = 'idle' | 'running' | 'success' | 'error'

export interface FlowConfig {
  amount: string
  currency: string
  payeeEmail: string
  trackingId: string
  returnUrl: string
}

interface FlowState {
  // 串联产出
  accessToken: string
  orderId: string
  captureId: string
  refundId: string
  // 每步状态与原始响应
  stepStatus: Record<StepId, StepStatus>
  responses: Partial<Record<StepId, unknown>>
  errors: Partial<Record<StepId, string>>
  // 可编辑配置
  config: FlowConfig
  activeStep: StepId
  // actions
  setActiveStep: (s: StepId) => void
  setAccessToken: (v: string) => void
  setOrderId: (v: string) => void
  setCaptureId: (v: string) => void
  setRefundId: (v: string) => void
  setStepResult: (s: StepId, status: StepStatus, response?: unknown, error?: string) => void
  updateConfig: (patch: Partial<FlowConfig>) => void
  reset: () => void
}

const INITIAL = {
  accessToken: '',
  orderId: '',
  captureId: '',
  refundId: '',
  stepStatus: {
    auth: 'idle', onboarding: 'idle', createOrder: 'idle', capture: 'idle', disburse: 'idle', refund: 'idle',
  } as Record<StepId, StepStatus>,
  responses: {} as Partial<Record<StepId, unknown>>,
  errors: {} as Partial<Record<StepId, string>>,
  config: {
    amount: '160.00',
    currency: 'GBP',
    payeeEmail: '',
    trackingId: 'psp-playground-merchant-1',
    returnUrl: 'https://example.com/return',
  } as FlowConfig,
  activeStep: 'auth' as StepId,
}

export const useFlowStore = create<FlowState>((set) => ({
  ...INITIAL,
  setActiveStep: (activeStep) => set({ activeStep }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setOrderId: (orderId) => set({ orderId }),
  setCaptureId: (captureId) => set({ captureId }),
  setRefundId: (refundId) => set({ refundId }),
  setStepResult: (s, status, response, error) =>
    set((state) => ({
      stepStatus: { ...state.stepStatus, [s]: status },
      responses: response !== undefined ? { ...state.responses, [s]: response } : state.responses,
      errors: error !== undefined ? { ...state.errors, [s]: error } : state.errors,
    })),
  updateConfig: (patch) => set((state) => ({ config: { ...state.config, ...patch } })),
  reset: () => set(INITIAL),
}))
```

- [ ] **Step 4: 运行确认通过**

Run: `cd psp-path-dashboard && pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add psp-path-dashboard/src/store/flow.ts psp-path-dashboard/src/store/flow.test.ts
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 加 flow store（串联产出/步骤状态/请求配置）"
```

---

### Task C3: API 客户端

**Files:**
- Create: `psp-path-dashboard/src/lib/api.ts`

- [ ] **Step 1: 实现 api.ts**

Create `psp-path-dashboard/src/lib/api.ts`:
```ts
// 调 paypal-backend-api 的 PSP 路由。第 1 步用 Basic auth 换 access_token；
// 后续步骤带 Bearer access_token。代理地址由 VITE_PROXY_BASE 决定，默认本地后端端口 30041。
import { useCredentialsStore } from '@/store/credentials'

const PROXY_BASE = import.meta.env.VITE_PROXY_BASE ?? 'http://localhost:30041'

export interface ApiResult<T = unknown> {
  ok: boolean
  status: number
  data: T
}

async function postJson<T>(path: string, headers: Record<string, string>, body?: unknown): Promise<ApiResult<T>> {
  const res = await fetch(`${PROXY_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const data = (await res.json().catch(() => ({}))) as T
  return { ok: res.ok, status: res.status, data }
}

/** 第 1 步：BYOK Basic auth → access_token */
export function fetchAccessToken() {
  const auth = useCredentialsStore.getState().basicAuth()
  return postJson<{ accessToken?: string; error?: string }>('/api/byok/psp/access-token', {
    Authorization: `Basic ${auth}`,
  })
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export function createPartnerReferral(token: string, trackingId: string, returnUrl: string) {
  return postJson('/api/byok/psp/partner-referrals', bearer(token), { trackingId, returnUrl })
}

export function createOrder(
  token: string,
  input: { amount: string; currency: string; payeeEmail: string; referenceId: string },
) {
  const bnCode = useCredentialsStore.getState().bnCode
  return postJson('/api/byok/psp/orders', bearer(token), { ...input, bnCode })
}

export function captureOrder(token: string, orderId: string) {
  const bnCode = useCredentialsStore.getState().bnCode
  return postJson(`/api/byok/psp/orders/${encodeURIComponent(orderId)}/capture`, {
    ...bearer(token),
    'x-paypal-bn-code': bnCode,
  })
}

export function disburse(token: string, captureId: string) {
  return postJson('/api/byok/psp/referenced-payouts-items', bearer(token), { captureId })
}

export function refund(token: string, captureId: string) {
  return postJson(`/api/byok/psp/captures/${encodeURIComponent(captureId)}/refund`, bearer(token))
}
```

- [ ] **Step 2: 类型检查**

Run: `cd psp-path-dashboard && npx tsc --noEmit -p tsconfig.app.json`
Expected: 无报错

- [ ] **Step 3: Commit**

```bash
git add psp-path-dashboard/src/lib/api.ts
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 加 api.ts（调 paypal-backend-api PSP 路由）"
```

---

### Task C4: 步骤定义 steps.ts

**Files:**
- Create: `psp-path-dashboard/src/lib/steps.ts`

- [ ] **Step 1: 实现 steps.ts**

Create `psp-path-dashboard/src/lib/steps.ts`:
```ts
// 6 步定义：分组/名称/图标名/HTTP 预览/文档章节/资金流高亮段/概念 key。
import type { StepId } from '@/store/flow'

export type IconName =
  | 'KeyRound' | 'Store' | 'ShoppingCart' | 'HandCoins' | 'ArrowLeftRight' | 'RefreshCw'
export type FundSegment = 'buyer' | 'gl' | 'psa' | 'psp' | 'seller' | null

export interface StepDef {
  id: StepId
  group: string
  order: number
  title: string
  icon: IconName
  method: 'POST'
  /** 展示用路径模板；{orderId}/{captureId} 运行时替换 */
  pathTemplate: string
  docSection: string
  fundSegment: FundSegment
  conceptKeys: string[]
}

export const STEPS: StepDef[] = [
  { id: 'auth', group: 'AUTH', order: 1, title: 'Get access token', icon: 'KeyRound',
    method: 'POST', pathTemplate: '/v1/oauth2/token', docSection: '§7 Integration', fundSegment: null,
    conceptKeys: ['byok'] },
  { id: 'onboarding', group: 'ONBOARDING', order: 2, title: 'Create Partner Referral', icon: 'Store',
    method: 'POST', pathTemplate: '/v2/customer/partner-referrals', docSection: '§6 Onboarding', fundSegment: null,
    conceptKeys: ['consent', 'delayDisbursement'] },
  { id: 'createOrder', group: 'ORDER', order: 3, title: 'Create Order (CAPTURE intent)', icon: 'ShoppingCart',
    method: 'POST', pathTemplate: '/v2/checkout/orders', docSection: '§1 Three-Part Model', fundSegment: 'buyer',
    conceptKeys: ['bnCode'] },
  { id: 'capture', group: 'ORDER', order: 4, title: 'Capture Order', icon: 'ShoppingCart',
    method: 'POST', pathTemplate: '/v2/checkout/orders/{orderId}/capture', docSection: '§1 Three-Part Model', fundSegment: 'gl',
    conceptKeys: ['generalLedger'] },
  { id: 'disburse', group: 'MONEY MOVE', order: 5, title: 'Disburse Funds (referenced payouts)', icon: 'ArrowLeftRight',
    method: 'POST', pathTemplate: '/v1/payments/referenced-payouts-items', docSection: '§10 PSA', fundSegment: 'psa',
    conceptKeys: ['psa', 'elmo'] },
  { id: 'refund', group: 'MONEY MOVE', order: 6, title: 'Refund Payment', icon: 'RefreshCw',
    method: 'POST', pathTemplate: '/v2/payments/captures/{captureId}/refund', docSection: '§4 Risk', fundSegment: 'psp',
    conceptKeys: ['riskLiability'] },
]

export const STEP_GROUPS = ['AUTH', 'ONBOARDING', 'ORDER', 'MONEY MOVE'] as const
```

- [ ] **Step 2: Commit**

```bash
git add psp-path-dashboard/src/lib/steps.ts
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 加 steps.ts（6 步定义）"
```

---

### Task C5: 概念讲解内容 concepts.ts

**Files:**
- Create: `psp-path-dashboard/src/lib/concepts.ts`

- [ ] **Step 1: 实现 concepts.ts（内容取自 Configuration & Onboarding Guide）**

Create `psp-path-dashboard/src/lib/concepts.ts`:
```ts
// 概念讲解官内容，取自 enhance-context-page 的 Configuration & Onboarding Guide。
// 每条含标题、正文、对应文档章节，以及可选的「为什么」折叠问答。
export interface ConceptQA {
  q: string
  a: string
}
export interface Concept {
  key: string
  title: string
  body: string
  section: string
  faqs?: ConceptQA[]
}

export const CONCEPTS: Record<string, Concept> = {
  byok: {
    key: 'byok',
    title: 'BYOK 与 access token',
    body: 'PSP 用自己的 sandbox client id/secret 通过 client_credentials 换取 OAuth access_token。演练台第 1 步换到 token 后，后续每步都带着它调用——完全对齐 Postman collection 的 "1 - Auth" 步骤。',
    section: '§7 Integration Overview',
    faqs: [{ q: '为什么要单独一步换 token？', a: '真实集成里 token 有有效期、需复用；把它作为显式第一步能看清"凭证→令牌→调用"的关系。' }],
  },
  consent: {
    key: 'consent',
    title: 'Merchant Consent（授权同意）',
    body: 'Onboarding 时通过 Partner Referral 生成商户授权链接。商户点击授予 PSP 代其发起支付/退款、访问信息、延迟放款等权限（features 列表）。legal_consents 里的 SHARE_DATA_CONSENT 即数据共享同意。',
    section: '§11 Merchant Consent – Permission Grant',
    faqs: [{ q: '为什么需要 Consent？', a: 'PSP 是第三方（THIRD_PARTY 集成），代商户操作资金，必须先拿到商户明确授权。' }],
  },
  delayDisbursement: {
    key: 'delayDisbursement',
    title: 'DELAY_FUNDS_DISBURSEMENT（延迟放款）',
    body: 'Partner Referral 的 features 里包含 DELAY_FUNDS_DISBURSEMENT，表示放款不随 capture 立即发生，而是由 PSP 之后通过 referenced-payouts 主动发起。这是 PSP Path 资金聚合的关键。',
    section: '§7 / §3 Evolution',
  },
  bnCode: {
    key: 'bnCode',
    title: 'BN Code（PayPal-Partner-Attribution-Id）',
    body: 'BN code 通过 PayPal-Partner-Attribution-Id 请求头带上，PSP Path 2.0 用它做结算账户路由（取代 1.0 的按币种路由），把这笔资金正确导向对应的 PSA。',
    section: '§10.1 BN Code Validation Rules',
    faqs: [{ q: 'BN code 干嘛用？', a: '2.0 用 BN code 决定钱结算到哪个 PSA；1.0 只能按币种路由，容易出错。' }],
  },
  generalLedger: {
    key: 'generalLedger',
    title: '商户 General Ledger（GL）',
    body: 'Capture 成功后，钱先落到商户的 PayPal General Ledger，但商户余额保持 $0——因为 PSP Path 下资金会被划走给 PSP，商户不直接从 PayPal 提现。',
    section: '§1 How It Works',
  },
  psa: {
    key: 'psa',
    title: 'PSA — Partner Settlement Account',
    body: 'PSA 是 PSP 的 Type 5 omnibus（综合）账户。referenced-payouts 触发后，PayPal 把钱从商户 GL 划到 PSA；每日 EOD sweep 再把 PSA 的钱打到 PSP 的银行/FBO 账户。',
    section: '§10 Partner Settlement Account',
    faqs: [{ q: '为什么钱先到 PSA 而不是直接给商户？', a: 'PSP 要聚合所有子商户的资金，用自己的通道统一结算给卖家——这正是 PSP Path 的价值。' }],
  },
  elmo: {
    key: 'elmo',
    title: 'ELMO（2.0 组件）',
    body: 'ELMO 是 PSP Path 2.0 引入的组件，负责在放款链路里做映射/编排，配合 BN code 路由。它可回滚，有 sandbox / production 状态区分。',
    section: '§9 The Role of ELMO in 2.0',
  },
  riskLiability: {
    key: 'riskLiability',
    title: '风险归属（Partner Liable for Risk）',
    body: '与 Connected Path 最大的不同：PSP Path 下退款、争议、拒付、冲正全部由 PSP 承担（Partner Liable for Risk 标记）。PayPal 只负责买家侧风险与商户 KYC/KYB。',
    section: '§4 Risk & Compliance Responsibilities',
    faqs: [{ q: 'Refund 的钱从哪出？', a: '2.0 修复了 1.0 的 bug：退款正确地从 PSA 出，而不是错误地扣商户余额。' }],
  },
}

export function conceptsFor(keys: string[]): Concept[] {
  return keys.map((k) => CONCEPTS[k]).filter(Boolean)
}
```

- [ ] **Step 2: Commit**

```bash
git add psp-path-dashboard/src/lib/concepts.ts
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 加 concepts.ts（概念讲解内容，取自 Guide）"
```

---

## Phase D — UI 组件与页面

### Task D1: 凭证管理 sub-page

**Files:**
- Create: `psp-path-dashboard/src/pages/CredentialsPage.tsx`

- [ ] **Step 1: 实现 CredentialsPage**

Create `psp-path-dashboard/src/pages/CredentialsPage.tsx`:
```tsx
import { Link } from 'react-router-dom'
import { ArrowLeft, KeyRound, Trash2 } from 'lucide-react'
import { useCredentialsStore } from '@/store/credentials'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export function CredentialsPage() {
  const { clientId, clientSecret, bnCode, setClientId, setClientSecret, setBnCode, reset, isConfigured } =
    useCredentialsStore()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft size={16} /> 返回演练台
        </Link>
        <Badge tone={isConfigured() ? 'ok' : 'muted'}>{isConfigured() ? '已配置' : '未配置'}</Badge>
      </div>

      <h1 className="flex items-center gap-2 text-xl font-semibold">
        <KeyRound size={20} /> BYOK 凭证管理
      </h1>
      <p className="text-sm text-muted">
        填入你的 PSP <b>sandbox</b> client id / secret 与 BN code。仅存于当前标签页 sessionStorage，不写入代码、不上传。
      </p>

      <Card className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Client ID
          <input
            className="rounded border border-line bg-white px-3 py-2 font-mono text-sm"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="A21..."
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Client Secret
          <input
            className="rounded border border-line bg-white px-3 py-2 font-mono text-sm"
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="EC..."
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          BN Code（PayPal-Partner-Attribution-Id，可选）
          <input
            className="rounded border border-line bg-white px-3 py-2 font-mono text-sm"
            value={bnCode}
            onChange={(e) => setBnCode(e.target.value)}
            placeholder="XXXXXXXX_PSP"
          />
        </label>
        <div className="flex justify-end">
          <Button variant="outline" onClick={reset}>
            <Trash2 size={16} /> 清空
          </Button>
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add psp-path-dashboard/src/pages/CredentialsPage.tsx
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 加凭证管理 sub-page"
```

---

### Task D2: TopBar + 路由骨架（可跑起来）

**Files:**
- Create: `psp-path-dashboard/src/components/TopBar.tsx`
- Create: `psp-path-dashboard/src/pages/PlaygroundPage.tsx`（占位，后续任务填充）
- Create: `psp-path-dashboard/src/App.tsx`
- Create: `psp-path-dashboard/src/main.tsx`

- [ ] **Step 1: TopBar**

Create `psp-path-dashboard/src/components/TopBar.tsx`:
```tsx
import { Link } from 'react-router-dom'
import { KeyRound, Workflow } from 'lucide-react'
import { useCredentialsStore } from '@/store/credentials'
import { Badge } from '@/components/ui/Badge'

export function TopBar() {
  const isConfigured = useCredentialsStore((s) => s.isConfigured())
  return (
    <header className="flex items-center justify-between border-b border-line bg-paper/80 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <Workflow size={20} className="text-ink" />
        <span className="font-semibold">PSP Path Playground</span>
        <Badge tone="muted" className="ml-2">Capture Intent</Badge>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="flex items-center gap-1 text-muted">
          <span className={`inline-block h-2 w-2 rounded-full ${isConfigured ? 'bg-ok' : 'bg-accent'}`} />
          Sandbox
        </span>
        <Link to="/credentials" className="flex items-center gap-1 rounded-md border border-ink px-3 py-1.5 hover:bg-ink/5">
          <KeyRound size={16} /> 凭证
        </Link>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: PlaygroundPage 占位**

Create `psp-path-dashboard/src/pages/PlaygroundPage.tsx`:
```tsx
import { TopBar } from '@/components/TopBar'

export function PlaygroundPage() {
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <main className="flex-1 p-6 text-muted">演练台主体（后续任务填充三栏）</main>
    </div>
  )
}
```

- [ ] **Step 3: App 路由**

Create `psp-path-dashboard/src/App.tsx`:
```tsx
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { PlaygroundPage } from '@/pages/PlaygroundPage'
import { CredentialsPage } from '@/pages/CredentialsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PlaygroundPage />} />
        <Route path="/credentials" element={<CredentialsPage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 4: main.tsx**

Create `psp-path-dashboard/src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const root = document.getElementById('root')
if (!root) throw new Error('#root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 5: 启动 dev 冒烟**

Run: `cd psp-path-dashboard && pnpm dev`（浏览器开 http://localhost:5180 ）
Expected: 看到 TopBar「PSP Path Playground」+「凭证」按钮；点凭证进入 `/credentials` 页可输入并保存；刷新后（同标签）值仍在。手动 Ctrl-C 结束。

- [ ] **Step 6: Commit**

```bash
git add psp-path-dashboard/src/components/TopBar.tsx psp-path-dashboard/src/pages/PlaygroundPage.tsx psp-path-dashboard/src/App.tsx psp-path-dashboard/src/main.tsx
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 加 TopBar 与路由骨架（演练台/凭证两页）"
```

---

### Task D3: StepRail（左侧步骤流）

**Files:**
- Create: `psp-path-dashboard/src/components/StepRail.tsx`

- [ ] **Step 1: 实现 StepRail**

Create `psp-path-dashboard/src/components/StepRail.tsx`:
```tsx
import { CircleCheck, CircleX, Circle, LoaderCircle } from 'lucide-react'
import { STEP_GROUPS, STEPS } from '@/lib/steps'
import { useFlowStore, type StepId, type StepStatus } from '@/store/flow'
import { cn } from '@/lib/utils'

const STATUS_ICON: Record<StepStatus, typeof Circle> = {
  idle: Circle,
  running: LoaderCircle,
  success: CircleCheck,
  error: CircleX,
}
const STATUS_COLOR: Record<StepStatus, string> = {
  idle: 'text-muted',
  running: 'text-ink animate-spin',
  success: 'text-ok',
  error: 'text-accent',
}

export function StepRail() {
  const activeStep = useFlowStore((s) => s.activeStep)
  const stepStatus = useFlowStore((s) => s.stepStatus)
  const setActiveStep = useFlowStore((s) => s.setActiveStep)

  return (
    <nav className="flex flex-col gap-4">
      {STEP_GROUPS.map((group) => (
        <div key={group} className="flex flex-col gap-1">
          <div className="px-2 text-xs font-semibold uppercase tracking-wider text-muted">{group}</div>
          {STEPS.filter((s) => s.group === group).map((step) => {
            const status = stepStatus[step.id as StepId]
            const Icon = STATUS_ICON[status]
            const active = activeStep === step.id
            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition',
                  active ? 'border-ink bg-ink/5' : 'border-transparent hover:bg-ink/5',
                )}
              >
                <Icon size={16} className={cn('shrink-0', STATUS_COLOR[status])} />
                <span className="flex-1">
                  <span className="font-mono text-xs text-muted">{step.order}.</span> {step.title}
                </span>
                <span className="text-[10px] text-muted">{step.docSection}</span>
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add psp-path-dashboard/src/components/StepRail.tsx
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 加 StepRail 左侧步骤流"
```

---

### Task D4: FundFlowBar（资金流条）

**Files:**
- Create: `psp-path-dashboard/src/components/FundFlowBar.tsx`

- [ ] **Step 1: 实现 FundFlowBar**

Create `psp-path-dashboard/src/components/FundFlowBar.tsx`:
```tsx
import { ChevronRight } from 'lucide-react'
import { STEPS, type FundSegment } from '@/lib/steps'
import { useFlowStore } from '@/store/flow'
import { cn } from '@/lib/utils'

const SEGMENTS: { key: Exclude<FundSegment, null>; label: string }[] = [
  { key: 'buyer', label: 'Buyer' },
  { key: 'gl', label: 'Merchant GL' },
  { key: 'psa', label: 'PSA' },
  { key: 'psp', label: 'PSP' },
  { key: 'seller', label: 'Seller' },
]

export function FundFlowBar() {
  const activeStep = useFlowStore((s) => s.activeStep)
  const current = STEPS.find((s) => s.id === activeStep)?.fundSegment ?? null

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-line bg-white/40 px-3 py-2 text-xs">
      {SEGMENTS.map((seg, i) => (
        <div key={seg.key} className="flex items-center gap-1">
          <span
            className={cn(
              'rounded px-2 py-1 font-mono transition',
              current === seg.key ? 'bg-accent text-paper' : 'text-muted',
            )}
          >
            {seg.label}
          </span>
          {i < SEGMENTS.length - 1 && <ChevronRight size={12} className="text-line" />}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add psp-path-dashboard/src/components/FundFlowBar.tsx
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 加 FundFlowBar 资金流条"
```

---

### Task D5: StepDetail（讲解/请求预览/发送/响应）

**Files:**
- Create: `psp-path-dashboard/src/components/StepDetail.tsx`

- [ ] **Step 1: 实现 StepDetail**

Create `psp-path-dashboard/src/components/StepDetail.tsx`:
```tsx
import { Send } from 'lucide-react'
import { STEPS } from '@/lib/steps'
import { useFlowStore, type StepId } from '@/store/flow'
import { useCredentialsStore } from '@/store/credentials'
import * as api from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

// 每步的中文讲解（干什么/钱在哪/谁担风险）
const EXPLAIN: Record<StepId, string> = {
  auth: '用 BYOK 凭证换取 OAuth access_token。之后每一步都带着它调用，等价于 Postman 里的第 1 步 Auth。',
  onboarding: '通过 Partner Referral 让商户授权 PSP 代其收款/退款/延迟放款。产出一个商户点击授权的链接。',
  createOrder: '以 CAPTURE intent 建单，payee 指向被授权商户，带 BN code 头。此刻还没扣钱。',
  capture: '捕获订单，买家的钱进入商户 General Ledger（商户余额仍为 $0，等待划给 PSP）。',
  disburse: '用 capture id 触发 referenced-payouts，把钱从商户 GL 划到 PSP 的 PSA（Type 5 账户），日终 sweep 到 PSP 银行账户。',
  refund: '发起退款。PSP Path 下退款由 PSP 承担，且 2.0 保证退款从 PSA 出而非错误扣商户余额。',
}

async function runStep(id: StepId): Promise<{ status: number; data: unknown; ok: boolean }> {
  const flow = useFlowStore.getState()
  const { accessToken, orderId, captureId, config } = flow
  switch (id) {
    case 'auth': {
      const r = await api.fetchAccessToken()
      if (r.ok && r.data.accessToken) flow.setAccessToken(r.data.accessToken)
      return r
    }
    case 'onboarding':
      return api.createPartnerReferral(accessToken, config.trackingId, config.returnUrl)
    case 'createOrder': {
      const r = await api.createOrder(accessToken, {
        amount: config.amount, currency: config.currency, payeeEmail: config.payeeEmail,
        referenceId: `psp_${config.currency}`,
      })
      const id2 = (r.data as { id?: string }).id
      if (r.ok && id2) flow.setOrderId(id2)
      return r
    }
    case 'capture': {
      const r = await api.captureOrder(accessToken, orderId)
      const cap = (r.data as { purchase_units?: Array<{ payments?: { captures?: Array<{ id: string }> } }> })
        .purchase_units?.[0]?.payments?.captures?.[0]?.id
      if (r.ok && cap) flow.setCaptureId(cap)
      return r
    }
    case 'disburse':
      return api.disburse(accessToken, captureId)
    case 'refund': {
      const r = await api.refund(accessToken, captureId)
      const rid = (r.data as { id?: string }).id
      if (r.ok && rid) flow.setRefundId(rid)
      return r
    }
  }
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
  const isConfigured = useCredentialsStore((s) => s.isConfigured())

  const step = STEPS.find((s) => s.id === activeStep)!
  const resolvedPath = step.pathTemplate
    .replace('{orderId}', orderId || '{orderId}')
    .replace('{captureId}', captureId || '{captureId}')

  const onSend = async () => {
    setStepResult(activeStep, 'running')
    try {
      const r = await runStep(activeStep)
      setStepResult(activeStep, r.ok ? 'success' : 'error', r.data, r.ok ? undefined : `HTTP ${r.status}`)
    } catch (e) {
      setStepResult(activeStep, 'error', { error: String(e) }, String(e))
    }
  }

  const showConfigFields = activeStep === 'createOrder' || activeStep === 'onboarding'

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">这一步在干什么</div>
        <p className="text-sm leading-relaxed">{EXPLAIN[activeStep]}</p>
      </Card>

      <Card>
        <div className="mb-2 flex items-center gap-2">
          <Badge tone="ink">{step.method}</Badge>
          <span className="font-mono text-sm">{resolvedPath}</span>
        </div>
        {showConfigFields && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            {activeStep === 'createOrder' && (
              <>
                <label className="flex flex-col gap-1">金额
                  <input className="rounded border border-line bg-white px-2 py-1 font-mono"
                    value={config.amount} onChange={(e) => updateConfig({ amount: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1">币种
                  <input className="rounded border border-line bg-white px-2 py-1 font-mono"
                    value={config.currency} onChange={(e) => updateConfig({ currency: e.target.value })} />
                </label>
                <label className="col-span-2 flex flex-col gap-1">Payee Email（被授权商户）
                  <input className="rounded border border-line bg-white px-2 py-1 font-mono"
                    value={config.payeeEmail} onChange={(e) => updateConfig({ payeeEmail: e.target.value })} />
                </label>
              </>
            )}
            {activeStep === 'onboarding' && (
              <>
                <label className="flex flex-col gap-1">Tracking ID
                  <input className="rounded border border-line bg-white px-2 py-1 font-mono"
                    value={config.trackingId} onChange={(e) => updateConfig({ trackingId: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1">Return URL
                  <input className="rounded border border-line bg-white px-2 py-1 font-mono"
                    value={config.returnUrl} onChange={(e) => updateConfig({ returnUrl: e.target.value })} />
                </label>
              </>
            )}
          </div>
        )}
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={onSend} disabled={!isConfigured || status === 'running'}>
          <Send size={16} /> 发送
        </Button>
        {!isConfigured && <span className="text-xs text-accent">请先到「凭证」页填 client id/secret</span>}
        {status !== 'idle' && (
          <Badge tone={status === 'success' ? 'ok' : status === 'error' ? 'accent' : 'muted'}>{status}</Badge>
        )}
      </div>

      {response !== undefined && (
        <Card>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">响应</div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
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
Expected: 无报错

- [ ] **Step 3: Commit**

```bash
git add psp-path-dashboard/src/components/StepDetail.tsx
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 加 StepDetail（讲解/请求预览/发送/响应+串联）"
```

---

### Task D6: ConceptPanel（右侧讲解官）

**Files:**
- Create: `psp-path-dashboard/src/components/ConceptPanel.tsx`

- [ ] **Step 1: 实现 ConceptPanel**

Create `psp-path-dashboard/src/components/ConceptPanel.tsx`:
```tsx
import { useState } from 'react'
import { BookOpen, ChevronRight } from 'lucide-react'
import { STEPS } from '@/lib/steps'
import { conceptsFor } from '@/lib/concepts'
import { useFlowStore } from '@/store/flow'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

export function ConceptPanel() {
  const activeStep = useFlowStore((s) => s.activeStep)
  const step = STEPS.find((s) => s.id === activeStep)!
  const concepts = conceptsFor(step.conceptKeys)
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <BookOpen size={18} /> 概念讲解官
      </div>
      {concepts.length === 0 && <p className="text-xs text-muted">这一步没有额外概念。</p>}
      {concepts.map((c) => (
        <Card key={c.key} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">{c.title}</span>
            <Badge tone="muted">{c.section}</Badge>
          </div>
          <p className="text-sm leading-relaxed text-ink/90">{c.body}</p>
          {c.faqs?.map((f) => {
            const id = `${c.key}:${f.q}`
            const isOpen = open === id
            return (
              <div key={id} className="border-t border-line pt-2">
                <button
                  onClick={() => setOpen(isOpen ? null : id)}
                  className="flex w-full items-center gap-1 text-left text-sm text-ink"
                >
                  <ChevronRight size={14} className={cn('transition', isOpen && 'rotate-90')} />
                  {f.q}
                </button>
                {isOpen && <p className="mt-1 pl-5 text-sm text-muted">{f.a}</p>}
              </div>
            )
          })}
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add psp-path-dashboard/src/components/ConceptPanel.tsx
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 加 ConceptPanel 右侧概念讲解官"
```

---

### Task D7: PlaygroundPage 三栏组装 + 移动端塌缩

**Files:**
- Modify: `psp-path-dashboard/src/pages/PlaygroundPage.tsx`

- [ ] **Step 1: 用三栏 flex 布局替换占位实现**

替换 `psp-path-dashboard/src/pages/PlaygroundPage.tsx` 全部内容：
```tsx
import { TopBar } from '@/components/TopBar'
import { StepRail } from '@/components/StepRail'
import { FundFlowBar } from '@/components/FundFlowBar'
import { StepDetail } from '@/components/StepDetail'
import { ConceptPanel } from '@/components/ConceptPanel'

export function PlaygroundPage() {
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      {/* 桌面三栏；窄屏（<lg）塌缩为单列 */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* 左：步骤流。窄屏时横向可滑 */}
        <aside className="shrink-0 overflow-x-auto border-b border-line p-3 lg:w-72 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <StepRail />
        </aside>
        {/* 中：资金流条 + 详情 */}
        <main className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <FundFlowBar />
          <StepDetail />
        </main>
        {/* 右：概念讲解官。窄屏时移到底部 */}
        <aside className="shrink-0 overflow-y-auto border-t border-line p-4 lg:w-80 lg:border-l lg:border-t-0">
          <ConceptPanel />
        </aside>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: dev 冒烟（桌面 + 窄屏）**

Run: `cd psp-path-dashboard && pnpm dev`
Expected:
- 桌面：三栏并排（步骤流 / 资金流条+详情 / 讲解官）
- 点不同步骤：中间讲解与请求路径变化、资金流条高亮段变化、右侧概念卡变化
- 缩到窄屏（DevTools 移动视图）：塌缩为单列，步骤流在顶部可横滑
- 手动 Ctrl-C 结束

- [ ] **Step 3: Commit**

```bash
git add psp-path-dashboard/src/pages/PlaygroundPage.tsx
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 组装三栏演练台并做移动端塌缩"
```

---

## Phase E — 验收

### Task E1: 全量构建与测试

**Files:** 无（验证）

- [ ] **Step 1: 前端类型检查 + 构建**

Run: `cd psp-path-dashboard && pnpm build`
Expected: `tsc -b` 无报错，`vite build` 产出 `dist/`

- [ ] **Step 2: 前端单测**

Run: `cd psp-path-dashboard && pnpm test`
Expected: credentials/flow store 用例全绿

- [ ] **Step 3: 后端单测 + 类型检查**

Run: `cd paypal-backend-api && pnpm test && npx tsc --noEmit`
Expected: psp.test.ts 全绿；tsc 无新增报错

---

### Task E2: 真实 sandbox 端到端手测 + push 提醒

**Files:** 无（人工验证）

- [ ] **Step 1: 同时起前后端**

在两个终端：
```bash
# 终端 1（后端代理）
cd /Users/yqiang/Documents/paypal-work/ppgms-test.github.io && pnpm dev:api
# 终端 2（前端）
cd /Users/yqiang/Documents/paypal-work/ppgms-test.github.io/psp-path-dashboard && pnpm dev
```

- [ ] **Step 2: 走一遍主链路（需真实 PSP sandbox 凭证）**

在 http://localhost:5180 ：
1. 「凭证」页填入真实 PSP sandbox client id/secret（+ BN code），返回
2. 依次点 Auth → Onboarding → Create Order（填 payee email）→ Capture → Disburse → Refund，每步「发送」
Expected: Auth 返回 accessToken；Create Order 返回 order id 并串联；Capture 得到 capture id；Disburse/Refund 用该 id 成功。逐步核对左侧状态图标转绿、资金流条高亮、右侧概念讲解正确。

> 说明：真实 sandbox 结果依赖账号配置（是否已授予 DELAY_FUNDS_DISBURSEMENT、BN code 是否有效等），部分步骤可能返回业务错误——这属于真实反馈，演练台如实展示响应即可。

- [ ] **Step 3: ⚠️ 明确提醒用户 push（用户偏好 feedback_push_reminder）**

本次改动包含 `paypal-backend-api/`（新增 PSP 路由与 psp.ts）。向用户输出明确提醒：
> 「本次改了 `paypal-backend-api/`（新增 6 个 PSP 路由 + psp.ts + vitest）。按你的习惯，需要你自己执行 push；要我把改动列给你确认吗？」
不代替用户 push。

---

## Self-Review（作者自检）

**1. Spec 覆盖：**
- 分步演练台 → StepRail + StepDetail + PlaygroundPage ✓
- 真实 sandbox → api.ts + 后端 6 路由 + Task E2 手测 ✓
- 主链路 Capture Intent 全程（Auth/Onboarding/CreateOrder/Capture/Disburse/Refund）→ steps.ts + runStep ✓
- BYOK 凭证 sessionStorage → credentials store（persist+sessionStorage）+ CredentialsPage ✓
- token 方案 A（显式 Auth 步 + Bearer 串联）→ access-token 路由 + api.ts bearer ✓
- 纯前端 + 复用 paypal-backend-api → 无独立后端，proxy base 指向 30041 ✓
- zustand / react-router / lucide / CVA 工具链 → package.json + 各文件 ✓
- OFFROUTE.AI 视觉（米底/藏青/红/细边框卡/三栏）→ index.css 变量 + tailwind colors + 组件 ✓
- 概念讲解（PSA/ELMO/BN/Consent/风险/GL/delay）→ concepts.ts ✓
- 移动端 flex 塌缩 → PlaygroundPage lg: 断点 ✓
- 图标全 lucide 无 emoji → 各组件用 lucide-react ✓
- 测试（后端 mock fetch / store）→ psp.test.ts + credentials.test.ts + flow.test.ts ✓
- push 提醒 → Task E2 Step 3 ✓

**2. 占位符扫描：** 无 TBD/TODO；每个改代码的 Step 均含完整代码。

**3. 类型/命名一致性：**
- 后端 `PspOrderInput` 在 psp.ts 定义并在 orders/route.ts 复用 ✓
- `parseBearerToken` 在 psp.ts 定义、被 5 个路由 import ✓
- 前端 `StepId`/`StepStatus`/`FlowConfig` 在 flow.ts 定义，被 steps.ts/StepRail/StepDetail 复用 ✓
- api.ts 函数名（fetchAccessToken/createPartnerReferral/createOrder/captureOrder/disburse/refund）与 StepDetail `runStep` 调用一致 ✓
- `conceptsFor` / `CONCEPTS` key 与 steps.ts `conceptKeys`（byok/consent/delayDisbursement/bnCode/generalLedger/psa/elmo/riskLiability）一致 ✓

> 注意点（实现时留意）：后端 `orders/route.ts` 直接把请求体当 `PspOrderInput`，其中含前端多传的 `bnCode` 字段——psp.ts 的 `createPspOrder` 已在 `PspOrderInput` 里声明可选 `bnCode`，一致。
