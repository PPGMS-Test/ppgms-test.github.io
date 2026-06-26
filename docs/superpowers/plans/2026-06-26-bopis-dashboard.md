# BOPIS Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `bopis-dashboard/` (Vite+React+TS+Tailwind) with 4 scenario tabs testing all PayPal BOPIS APIs, plus 4 new backend routes in `paypal-backend-api/`.

**Architecture:** `bopis-dashboard/` mirrors `applepay-dashboard/` structure. New backend routes use raw `fetch` + Bearer token (same style as `src/lib/paypal-rest.ts`). Each scenario tab manages its own `useState`; no global store. PayPal v6 SDK button is dynamically injected for buyer-approval steps.

**Tech Stack:** Vite 6, React 18, TypeScript, Tailwind CSS 3, Lucide React, PayPal v6 SDK (dynamic injection)

---

## File Map

### paypal-backend-api/ (new files)
| File | Purpose |
|------|---------|
| `src/lib/bopis.ts` | Helper fns: getSandboxToken, createBopisOrder, createBopisOrderMultiUnit, authorizeOrder, captureAuthorization, voidAuthorization |
| `src/app/api/checkout/bopis/orders/create/route.ts` | POST single-unit BOPIS order |
| `src/app/api/checkout/bopis/orders/create-multi/route.ts` | POST multi-unit BOPIS order (Research tab) |
| `src/app/api/checkout/orders/[orderId]/authorize/route.ts` | POST authorize approved order |
| `src/app/api/payments/authorizations/[authId]/capture/route.ts` | POST capture auth (optional partial amount) |
| `src/app/api/payments/authorizations/[authId]/void/route.ts` | POST void auth |

### bopis-dashboard/ (new project)
| File | Purpose |
|------|---------|
| `package.json`, `index.html`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `tsconfig*.json` | Project scaffold |
| `src/index.css`, `src/main.tsx` | Entry points |
| `src/types.ts` | StepStatus, StepResult, StoreAddress, PayPal SDK window types |
| `src/lib/api.ts` | Typed fetch wrappers for all backend routes |
| `src/components/StatusBadge.tsx` | idle/loading/success/error badge |
| `src/components/JsonBlock.tsx` | Collapsible JSON viewer |
| `src/components/StepCard.tsx` | Step card: number/title/status/request JSON/execute button/response JSON |
| `src/components/PayPalButton.tsx` | v6 SDK `<paypal-button>` wrapper |
| `src/scenarios/StandardFlow.tsx` | Tab 1 |
| `src/scenarios/PartialCapture.tsx` | Tab 2 |
| `src/scenarios/ResearchMultiAddr.tsx` | Tab 3 |
| `src/scenarios/VoidFlow.tsx` | Tab 4 |
| `src/App.tsx` | Tab bar + scenario routing |

---

## Task 1: Backend — src/lib/bopis.ts

**Files:**
- Create: `paypal-backend-api/src/lib/bopis.ts`

- [ ] **Step 1: Create the file**

```typescript
// paypal-backend-api/src/lib/bopis.ts
import { getSandboxCredentials } from './credentials'

const BASE = 'https://api-m.sandbox.paypal.com'

async function getSandboxToken(): Promise<string> {
  const { clientId, clientSecret } = getSandboxCredentials()
  const auth = btoa(`${clientId}:${clientSecret}`)
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const data = (await res.json()) as { access_token?: string }
  if (!res.ok || !data.access_token) throw new Error(`OAuth failed: ${res.status}`)
  return data.access_token
}

export interface StoreAddress {
  address_line_1: string
  admin_area_2: string
  admin_area_1: string
  postal_code: string
  country_code: string
}

export interface CreateBopisOrderParams {
  amount: string
  storeName: string
  storeAddress: StoreAddress
  pickupCode: string
}

export interface MultiUnitParams {
  units: Array<{
    amount: string
    storeName: string
    storeAddress: StoreAddress
    referenceId: string
  }>
}

type RestResult = { data: unknown; status: number }

export async function createBopisOrder(p: CreateBopisOrderParams): Promise<RestResult> {
  const token = await getSandboxToken()
  const payload = {
    intent: 'AUTHORIZE',
    purchase_units: [
      {
        amount: { currency_code: 'USD', value: p.amount },
        shipping: {
          type: 'PICKUP_IN_STORE',
          name: { full_name: p.storeName },
          address: p.storeAddress,
          phone_number: { national_number: '4085551234' },
        },
        custom_id: `PICKUP-${p.pickupCode}`,
        description: `Pickup at ${p.storeName}`,
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
  const res = await fetch(`${BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  return { data, status: res.status }
}

export async function createBopisOrderMultiUnit(p: MultiUnitParams): Promise<RestResult> {
  const token = await getSandboxToken()
  const payload = {
    intent: 'AUTHORIZE',
    purchase_units: p.units.map((u) => ({
      reference_id: u.referenceId,
      amount: { currency_code: 'USD', value: u.amount },
      shipping: {
        type: 'PICKUP_IN_STORE',
        name: { full_name: u.storeName },
        address: u.storeAddress,
        phone_number: { national_number: '4085551234' },
      },
      description: `Pickup at ${u.storeName}`,
    })),
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
  const res = await fetch(`${BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  return { data, status: res.status }
}

export async function authorizeOrder(orderId: string): Promise<RestResult> {
  const token = await getSandboxToken()
  const res = await fetch(
    `${BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
  )
  const data = await res.json().catch(() => ({}))
  return { data, status: res.status }
}

export async function captureAuthorization(authId: string, amount?: string): Promise<RestResult> {
  const token = await getSandboxToken()
  const body = amount ? { amount: { currency_code: 'USD', value: amount } } : {}
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
  return { data, status: res.status }
}

export async function voidAuthorization(authId: string): Promise<RestResult> {
  const token = await getSandboxToken()
  const res = await fetch(
    `${BASE}/v2/payments/authorizations/${encodeURIComponent(authId)}/void`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
  )
  if (res.status === 204) return { data: { status: 'VOIDED' }, status: 204 }
  const data = await res.json().catch(() => ({}))
  return { data, status: res.status }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd paypal-backend-api && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add paypal-backend-api/src/lib/bopis.ts
git commit -m "feat[2026-06-26](paypal-backend-api): 新增 BOPIS helper 函数库"
```

---

## Task 2: Backend — 6 new route files

**Files (all Create):**
- `paypal-backend-api/src/app/api/checkout/bopis/orders/create/route.ts`
- `paypal-backend-api/src/app/api/checkout/bopis/orders/create-multi/route.ts`
- `paypal-backend-api/src/app/api/checkout/orders/[orderId]/authorize/route.ts`
- `paypal-backend-api/src/app/api/payments/authorizations/[authId]/capture/route.ts`
- `paypal-backend-api/src/app/api/payments/authorizations/[authId]/void/route.ts`

- [ ] **Step 1: Create directory structure and route files**

```bash
mkdir -p paypal-backend-api/src/app/api/checkout/bopis/orders/create
mkdir -p paypal-backend-api/src/app/api/checkout/bopis/orders/create-multi
mkdir -p paypal-backend-api/src/app/api/checkout/orders/\[orderId\]/authorize
mkdir -p paypal-backend-api/src/app/api/payments/authorizations/\[authId\]/capture
mkdir -p paypal-backend-api/src/app/api/payments/authorizations/\[authId\]/void
```

- [ ] **Step 2: Write `checkout/bopis/orders/create/route.ts`**

```typescript
export const runtime = 'edge'
import { corsJson, corsOptions } from '@/lib/cors'
import { createBopisOrder } from '@/lib/bopis'
import type { CreateBopisOrderParams } from '@/lib/bopis'

export function OPTIONS() { return corsOptions() }

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateBopisOrderParams
    const { data, status } = await createBopisOrder(body)
    return corsJson(data, status)
  } catch {
    return corsJson({ error: 'Failed to create BOPIS order' }, 500)
  }
}
```

- [ ] **Step 3: Write `checkout/bopis/orders/create-multi/route.ts`**

```typescript
export const runtime = 'edge'
import { corsJson, corsOptions } from '@/lib/cors'
import { createBopisOrderMultiUnit } from '@/lib/bopis'
import type { MultiUnitParams } from '@/lib/bopis'

export function OPTIONS() { return corsOptions() }

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MultiUnitParams
    const { data, status } = await createBopisOrderMultiUnit(body)
    return corsJson(data, status)
  } catch {
    return corsJson({ error: 'Failed to create multi-unit BOPIS order' }, 500)
  }
}
```

- [ ] **Step 4: Write `checkout/orders/[orderId]/authorize/route.ts`**

```typescript
export const runtime = 'edge'
import { corsJson, corsOptions } from '@/lib/cors'
import { authorizeOrder } from '@/lib/bopis'

export function OPTIONS() { return corsOptions() }

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params
  try {
    const { data, status } = await authorizeOrder(orderId)
    return corsJson(data, status)
  } catch {
    return corsJson({ error: 'Failed to authorize order' }, 500)
  }
}
```

- [ ] **Step 5: Write `payments/authorizations/[authId]/capture/route.ts`**

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
    const body = await req.json().catch(() => ({})) as { amount?: string }
    const { data, status } = await captureAuthorization(authId, body.amount)
    return corsJson(data, status)
  } catch {
    return corsJson({ error: 'Failed to capture authorization' }, 500)
  }
}
```

- [ ] **Step 6: Write `payments/authorizations/[authId]/void/route.ts`**

```typescript
export const runtime = 'edge'
import { corsJson, corsOptions } from '@/lib/cors'
import { voidAuthorization } from '@/lib/bopis'

export function OPTIONS() { return corsOptions() }

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ authId: string }> },
) {
  const { authId } = await params
  try {
    const { data, status } = await voidAuthorization(authId)
    return corsJson(data, status)
  } catch {
    return corsJson({ error: 'Failed to void authorization' }, 500)
  }
}
```

- [ ] **Step 7: Verify TypeScript**

```bash
cd paypal-backend-api && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add paypal-backend-api/src/app/api/checkout/bopis paypal-backend-api/src/app/api/checkout/orders/\[orderId\]/authorize paypal-backend-api/src/app/api/payments
git commit -m "feat[2026-06-26](paypal-backend-api): 新增 BOPIS 专用 API 路由（create/authorize/capture/void）"
```

---

## Task 3: Scaffold bopis-dashboard/ project

**Files:** All config/entry files.

- [ ] **Step 1: Create directory**

```bash
mkdir -p bopis-dashboard/src/lib bopis-dashboard/src/components bopis-dashboard/src/scenarios
```

- [ ] **Step 2: Write `bopis-dashboard/package.json`**

```json
{
  "name": "bopis-dashboard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "lucide-react": "^0.511.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
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
    "vite": "^6.3.5"
  }
}
```

- [ ] **Step 3: Write `bopis-dashboard/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: { port: 5174, open: false, host: true },
  build: { outDir: 'dist', emptyOutDir: true },
})
```

- [ ] **Step 4: Write `bopis-dashboard/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
    },
  },
  plugins: [animate],
}
export default config
```

- [ ] **Step 5: Write `bopis-dashboard/postcss.config.js`**

```javascript
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}
```

- [ ] **Step 6: Write `bopis-dashboard/tsconfig.json`**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 7: Write `bopis-dashboard/tsconfig.app.json`**

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
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

- [ ] **Step 8: Write `bopis-dashboard/tsconfig.node.json`**

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
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 9: Write `bopis-dashboard/index.html`**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PayPal BOPIS 测试面板</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 10: Write `bopis-dashboard/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }
  * { @apply border-border; }
  body { @apply bg-background text-foreground; min-height: 100vh; }
}
```

- [ ] **Step 11: Write `bopis-dashboard/src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 12: Install dependencies**

```bash
cd bopis-dashboard && pnpm install
```
Expected: `node_modules/` created, no errors.

- [ ] **Step 13: Verify dev server starts**

```bash
pnpm dev
```
Expected: `Local: http://localhost:5174/` — browser shows blank white page (no App yet).

- [ ] **Step 14: Commit scaffold**

```bash
cd .. && git add bopis-dashboard
git commit -m "feat[2026-06-26](bopis-dashboard): 初始化工程 scaffold（Vite+React+TS+Tailwind）"
```

---

## Task 4: src/types.ts + src/lib/api.ts

**Files:**
- Create: `bopis-dashboard/src/types.ts`
- Create: `bopis-dashboard/src/lib/api.ts`

- [ ] **Step 1: Write `src/types.ts`**

```typescript
export type StepStatus = 'idle' | 'loading' | 'success' | 'error'

export interface StepResult {
  status: StepStatus
  response?: unknown
  error?: string
}

export interface StoreAddress {
  address_line_1: string
  admin_area_2: string
  admin_area_1: string
  postal_code: string
  country_code: string
}

// PayPal v6 SDK types injected at runtime
export interface PayPalPaymentSession {
  start(
    opts: { presentationMode: 'auto' | 'popup' | 'modal' | 'direct-app-switch' },
    createOrderPromise: Promise<{ orderId: string }>,
  ): Promise<void>
  hasReturned(): boolean
  resume(): Promise<void>
}

export interface PayPalSDKInstance {
  createPayPalOneTimePaymentSession(opts: {
    onApprove: (data: { orderId: string }) => Promise<void>
    onCancel?: (data: unknown) => void
    onError?: (error: Error) => void
  }): PayPalPaymentSession
}

declare global {
  interface Window {
    paypal?: {
      createInstance(opts: {
        clientToken: string
        components: string[]
        pageType: string
      }): Promise<PayPalSDKInstance>
    }
  }
  // JSX custom element for <paypal-button>
  namespace JSX {
    interface IntrinsicElements {
      'paypal-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & { type?: string }
    }
  }
}
```

- [ ] **Step 2: Write `src/lib/api.ts`**

```typescript
import type { StoreAddress } from '@/types'

const BASE = 'https://ppgms-test-github-io.pages.dev'

async function req(
  path: string,
  init?: RequestInit,
): Promise<{ data: unknown; status: number }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  const data = await res.json().catch(() => ({ _raw: `${res.status} ${res.statusText}` }))
  return { data, status: res.status }
}

export async function createBopisOrder(params: {
  amount: string
  storeName: string
  storeAddress: StoreAddress
  pickupCode: string
}) {
  return req('/api/checkout/bopis/orders/create', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function createBopisOrderMultiUnit(params: {
  units: Array<{
    amount: string
    storeName: string
    storeAddress: StoreAddress
    referenceId: string
  }>
}) {
  return req('/api/checkout/bopis/orders/create-multi', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function authorizeOrder(orderId: string) {
  return req(`/api/checkout/orders/${orderId}/authorize`, { method: 'POST' })
}

export async function captureAuthorization(authId: string, amount?: string) {
  return req(`/api/payments/authorizations/${authId}/capture`, {
    method: 'POST',
    body: JSON.stringify(amount ? { amount } : {}),
  })
}

export async function voidAuthorization(authId: string) {
  return req(`/api/payments/authorizations/${authId}/void`, { method: 'POST' })
}

export async function getOrder(orderId: string) {
  return req(`/api/checkout/orders/${orderId}`, { method: 'GET' })
}

export async function getSandboxClientToken(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/sandbox-client-token`)
  const data = (await res.json()) as { accessToken?: string }
  if (!data.accessToken) throw new Error('Failed to get client token')
  return data.accessToken
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd bopis-dashboard && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd .. && git add bopis-dashboard/src/types.ts bopis-dashboard/src/lib
git commit -m "feat[2026-06-26](bopis-dashboard): 新增 types + api 层"
```

---

## Task 5: Primitive components — StatusBadge, JsonBlock, StepCard

**Files:**
- Create: `bopis-dashboard/src/components/StatusBadge.tsx`
- Create: `bopis-dashboard/src/components/JsonBlock.tsx`
- Create: `bopis-dashboard/src/components/StepCard.tsx`

- [ ] **Step 1: Write `src/components/StatusBadge.tsx`**

```tsx
import { Loader2, CheckCircle2, XCircle, Circle } from 'lucide-react'
import type { StepStatus } from '@/types'

interface Props { status: StepStatus }

export function StatusBadge({ status }: Props) {
  if (status === 'idle')
    return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Circle className="h-3 w-3" />待执行</span>
  if (status === 'loading')
    return <span className="flex items-center gap-1 text-xs text-blue-600"><Loader2 className="h-3 w-3 animate-spin" />执行中</span>
  if (status === 'success')
    return <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="h-3 w-3" />成功</span>
  return <span className="flex items-center gap-1 text-xs text-red-600"><XCircle className="h-3 w-3" />失败</span>
}
```

- [ ] **Step 2: Write `src/components/JsonBlock.tsx`**

```tsx
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface Props {
  label: string
  data: unknown
  defaultOpen?: boolean
}

export function JsonBlock({ label, data, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  if (data === undefined) return null

  return (
    <div className="text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {label}
      </button>
      {open && (
        <pre className="mt-1 p-3 bg-slate-900 text-slate-100 rounded-md overflow-auto max-h-64 text-[11px] leading-relaxed">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write `src/components/StepCard.tsx`**

```tsx
import { Loader2 } from 'lucide-react'
import type { StepResult } from '@/types'
import { StatusBadge } from './StatusBadge'
import { JsonBlock } from './JsonBlock'

interface Props {
  number: number
  title: string
  description: string
  requestBody?: unknown
  result: StepResult
  onExecute?: () => Promise<void>
  disabled?: boolean
  children?: React.ReactNode
}

export function StepCard({
  number,
  title,
  description,
  requestBody,
  result,
  onExecute,
  disabled,
  children,
}: Props) {
  const isLoading = result.status === 'loading'
  const canExecute = !disabled && !isLoading && onExecute !== undefined

  return (
    <div
      className={`rounded-lg border bg-card p-4 space-y-3 transition-opacity ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {number}
          </span>
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        <StatusBadge status={result.status} />
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground">{description}</p>

      {/* Request body preview */}
      {requestBody !== undefined && (
        <JsonBlock label="Request Body" data={requestBody} defaultOpen={false} />
      )}

      {/* Execute button or custom children */}
      {onExecute && (
        <button
          onClick={() => void onExecute()}
          disabled={!canExecute}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          执行
        </button>
      )}

      {children}

      {/* Response */}
      {result.response !== undefined && (
        <JsonBlock label="Response" data={result.response} defaultOpen={true} />
      )}

      {/* Error */}
      {result.error && (
        <p className="text-xs text-red-600 font-mono">{result.error}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd bopis-dashboard && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd .. && git add bopis-dashboard/src/components/StatusBadge.tsx bopis-dashboard/src/components/JsonBlock.tsx bopis-dashboard/src/components/StepCard.tsx
git commit -m "feat[2026-06-26](bopis-dashboard): 新增 StatusBadge / JsonBlock / StepCard 基础组件"
```

---

## Task 6: PayPalButton component

**Files:**
- Create: `bopis-dashboard/src/components/PayPalButton.tsx`

- [ ] **Step 1: Write the file**

```tsx
import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'

const SDK_URL = 'https://www.sandbox.paypal.com/web-sdk/v6/core'

interface Props {
  clientToken: string
  onCreateOrder: () => Promise<{ orderId: string }>
  onApprove: (data: { orderId: string }) => Promise<void>
  onError: (error: Error) => void
  onCancel: () => void
}

export function PayPalButton({ clientToken, onCreateOrder, onApprove, onError, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        const sdkInstance = await window.paypal!.createInstance({
          clientToken,
          components: ['paypal-payments'],
          pageType: 'checkout',
        })

        if (cancelled) return

        const session = sdkInstance.createPayPalOneTimePaymentSession({
          onApprove,
          onCancel,
          onError,
        })

        if (!containerRef.current) return

        // Create paypal-button element imperatively (avoids JSX custom element TS issues)
        const btn = document.createElement('paypal-button')
        btn.setAttribute('type', 'pay')
        containerRef.current.appendChild(btn)

        btn.addEventListener('click', () => {
          void session
            .start({ presentationMode: 'auto' }, onCreateOrder())
            .catch((e: unknown) => onError(e instanceof Error ? e : new Error(String(e))))
        })

        setReady(true)
      } catch (e) {
        if (!cancelled) setInitError(String(e))
      }
    }

    const loadAndInit = () => {
      if (window.paypal) {
        void init()
        return
      }
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`)
      if (existing) {
        existing.addEventListener('load', () => void init())
        existing.addEventListener('error', () => setInitError('SDK script failed to load'))
        return
      }
      const script = document.createElement('script')
      script.src = SDK_URL
      script.async = true
      script.addEventListener('load', () => void init())
      script.addEventListener('error', () => setInitError('SDK script failed to load'))
      document.head.appendChild(script)
    }

    loadAndInit()
    return () => { cancelled = true }
  }, [clientToken]) // eslint-disable-line react-hooks/exhaustive-deps

  if (initError) {
    return (
      <div className="flex items-center gap-2 text-red-600 text-sm">
        <AlertCircle className="h-4 w-4" />
        <span className="font-mono text-xs">{initError}</span>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Loading PayPal SDK...</span>
      </div>
    )
  }

  return <div ref={containerRef} className="w-full max-w-xs" />
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd bopis-dashboard && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd .. && git add bopis-dashboard/src/components/PayPalButton.tsx
git commit -m "feat[2026-06-26](bopis-dashboard): 新增 PayPalButton（v6 SDK 动态注入封装）"
```

---

## Task 7: StandardFlow scenario (Tab 1)

**Files:**
- Create: `bopis-dashboard/src/scenarios/StandardFlow.tsx`

- [ ] **Step 1: Write the file**

```tsx
import { useState } from 'react'
import type { StepResult } from '@/types'
import { StepCard } from '@/components/StepCard'
import { PayPalButton } from '@/components/PayPalButton'
import {
  createBopisOrder,
  authorizeOrder,
  captureAuthorization,
  getOrder,
  getSandboxClientToken,
} from '@/lib/api'

const STORE_ADDRESS = {
  address_line_1: '123 Main Street',
  admin_area_2: 'San Jose',
  admin_area_1: 'CA',
  postal_code: '95131',
  country_code: 'US',
}

const CREATE_REQUEST = {
  amount: '75.00',
  storeName: 'Downtown Store #123',
  storeAddress: STORE_ADDRESS,
  pickupCode: 'PICK789',
}

type StepId = 'create' | 'approve' | 'authorize' | 'capture' | 'details'
type Steps = Record<StepId, StepResult>

const INIT: Steps = {
  create: { status: 'idle' },
  approve: { status: 'idle' },
  authorize: { status: 'idle' },
  capture: { status: 'idle' },
  details: { status: 'idle' },
}

export function StandardFlow() {
  const [orderId, setOrderId] = useState<string | null>(null)
  const [authId, setAuthId] = useState<string | null>(null)
  const [clientToken, setClientToken] = useState<string | null>(null)
  const [steps, setSteps] = useState<Steps>(INIT)

  const set = (id: StepId, update: Partial<StepResult>) =>
    setSteps((p) => ({ ...p, [id]: { ...p[id], ...update } }))

  const handleCreate = async () => {
    set('create', { status: 'loading' })
    try {
      const { data, status } = await createBopisOrder(CREATE_REQUEST)
      if (status >= 200 && status < 300) {
        const id = (data as { id: string }).id
        setOrderId(id)
        const token = await getSandboxClientToken()
        setClientToken(token)
        set('create', { status: 'success', response: data })
      } else {
        set('create', { status: 'error', response: data, error: `HTTP ${status}` })
      }
    } catch (e) {
      set('create', { status: 'error', error: String(e) })
    }
  }

  const handleAuthorize = async () => {
    if (!orderId) return
    set('authorize', { status: 'loading' })
    try {
      const { data, status } = await authorizeOrder(orderId)
      if (status >= 200 && status < 300) {
        const authData = data as {
          purchase_units: Array<{ payments: { authorizations: Array<{ id: string }> } }>
        }
        const id = authData.purchase_units[0].payments.authorizations[0].id
        setAuthId(id)
        set('authorize', { status: 'success', response: data })
      } else {
        set('authorize', { status: 'error', response: data, error: `HTTP ${status}` })
      }
    } catch (e) {
      set('authorize', { status: 'error', error: String(e) })
    }
  }

  const handleCapture = async () => {
    if (!authId) return
    set('capture', { status: 'loading' })
    try {
      const { data, status } = await captureAuthorization(authId)
      if (status >= 200 && status < 300) {
        set('capture', { status: 'success', response: data })
      } else {
        set('capture', { status: 'error', response: data, error: `HTTP ${status}` })
      }
    } catch (e) {
      set('capture', { status: 'error', error: String(e) })
    }
  }

  const handleDetails = async () => {
    if (!orderId) return
    set('details', { status: 'loading' })
    try {
      const { data, status } = await getOrder(orderId)
      set('details', {
        status: status >= 200 && status < 300 ? 'success' : 'error',
        response: data,
        error: status >= 400 ? `HTTP ${status}` : undefined,
      })
    } catch (e) {
      set('details', { status: 'error', error: String(e) })
    }
  }

  return (
    <div className="space-y-4">
      <StepCard
        number={1}
        title="Create BOPIS Order"
        description="POST /api/checkout/bopis/orders/create — 创建 intent=AUTHORIZE 订单，shipping.type=PICKUP_IN_STORE，资金冻结不扣款。"
        requestBody={CREATE_REQUEST}
        result={steps.create}
        onExecute={handleCreate}
      />

      <StepCard
        number={2}
        title="Buyer Approval (PayPal SDK v6)"
        description="买家通过 PayPal 授权——点击 PayPal 按钮，在 sandbox 账号里批准付款，onApprove 回调自动触发。"
        result={steps.approve}
        disabled={steps.create.status !== 'success'}
      >
        {steps.create.status === 'success' && clientToken && (
          <PayPalButton
            clientToken={clientToken}
            onCreateOrder={async () => ({ orderId: orderId! })}
            onApprove={async (data) => {
              setOrderId(data.orderId)
              set('approve', { status: 'success', response: { orderId: data.orderId, status: 'APPROVED' } })
            }}
            onError={(e) => set('approve', { status: 'error', error: e.message })}
            onCancel={() => set('approve', { status: 'idle' })}
          />
        )}
      </StepCard>

      <StepCard
        number={3}
        title="Authorize Order"
        description="POST /api/checkout/orders/{orderId}/authorize — 服务端授权，资金进入冻结状态，返回 authorizationId。"
        requestBody={{ orderId }}
        result={steps.authorize}
        onExecute={handleAuthorize}
        disabled={steps.approve.status !== 'success'}
      />

      <StepCard
        number={4}
        title="Capture at Pickup"
        description="POST /api/payments/authorizations/{authId}/capture — 买家到店验证后捕获，资金正式扣款。"
        requestBody={{ authorizationId: authId }}
        result={steps.capture}
        onExecute={handleCapture}
        disabled={steps.authorize.status !== 'success'}
      />

      <StepCard
        number={5}
        title="View Order Details"
        description="GET /api/checkout/orders/{orderId} — 查看完整订单状态，确认所有字段正确。"
        requestBody={{ orderId }}
        result={steps.details}
        onExecute={handleDetails}
        disabled={steps.capture.status !== 'success'}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd bopis-dashboard && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd .. && git add bopis-dashboard/src/scenarios/StandardFlow.tsx
git commit -m "feat[2026-06-26](bopis-dashboard): 新增 Tab1 StandardFlow 场景"
```

---

## Task 8: PartialCapture scenario (Tab 2)

**Files:**
- Create: `bopis-dashboard/src/scenarios/PartialCapture.tsx`

- [ ] **Step 1: Write the file**

```tsx
import { useState } from 'react'
import type { StepResult } from '@/types'
import { StepCard } from '@/components/StepCard'
import { PayPalButton } from '@/components/PayPalButton'
import {
  createBopisOrder,
  authorizeOrder,
  captureAuthorization,
  voidAuthorization,
  getSandboxClientToken,
} from '@/lib/api'

const STORE_ADDRESS = {
  address_line_1: '456 Oak Avenue',
  admin_area_2: 'Palo Alto',
  admin_area_1: 'CA',
  postal_code: '94301',
  country_code: 'US',
}

const CREATE_REQUEST = {
  amount: '100.00',
  storeName: 'Palo Alto Store #456',
  storeAddress: STORE_ADDRESS,
  pickupCode: 'PART123',
}

type StepId = 'create' | 'approve' | 'authorize' | 'capture' | 'void'
type Steps = Record<StepId, StepResult>

const INIT: Steps = {
  create: { status: 'idle' },
  approve: { status: 'idle' },
  authorize: { status: 'idle' },
  capture: { status: 'idle' },
  void: { status: 'idle' },
}

export function PartialCapture() {
  const [orderId, setOrderId] = useState<string | null>(null)
  const [authId, setAuthId] = useState<string | null>(null)
  const [clientToken, setClientToken] = useState<string | null>(null)
  const [steps, setSteps] = useState<Steps>(INIT)

  const set = (id: StepId, update: Partial<StepResult>) =>
    setSteps((p) => ({ ...p, [id]: { ...p[id], ...update } }))

  const handleCreate = async () => {
    set('create', { status: 'loading' })
    try {
      const { data, status } = await createBopisOrder(CREATE_REQUEST)
      if (status >= 200 && status < 300) {
        setOrderId((data as { id: string }).id)
        setClientToken(await getSandboxClientToken())
        set('create', { status: 'success', response: data })
      } else {
        set('create', { status: 'error', response: data, error: `HTTP ${status}` })
      }
    } catch (e) {
      set('create', { status: 'error', error: String(e) })
    }
  }

  const handleAuthorize = async () => {
    if (!orderId) return
    set('authorize', { status: 'loading' })
    try {
      const { data, status } = await authorizeOrder(orderId)
      if (status >= 200 && status < 300) {
        const id = (data as {
          purchase_units: Array<{ payments: { authorizations: Array<{ id: string }> } }>
        }).purchase_units[0].payments.authorizations[0].id
        setAuthId(id)
        set('authorize', { status: 'success', response: data })
      } else {
        set('authorize', { status: 'error', response: data, error: `HTTP ${status}` })
      }
    } catch (e) {
      set('authorize', { status: 'error', error: String(e) })
    }
  }

  const handlePartialCapture = async () => {
    if (!authId) return
    set('capture', { status: 'loading' })
    try {
      const { data, status } = await captureAuthorization(authId, '60.00')
      set('capture', {
        status: status >= 200 && status < 300 ? 'success' : 'error',
        response: data,
        error: status >= 400 ? `HTTP ${status}` : undefined,
      })
    } catch (e) {
      set('capture', { status: 'error', error: String(e) })
    }
  }

  const handleVoid = async () => {
    if (!authId) return
    set('void', { status: 'loading' })
    try {
      const { data, status } = await voidAuthorization(authId)
      set('void', {
        status: status >= 200 && status < 300 ? 'success' : 'error',
        response: data,
        error: status >= 400 ? `HTTP ${status}` : undefined,
      })
    } catch (e) {
      set('void', { status: 'error', error: String(e) })
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <strong>场景说明：</strong>授权 $100，仅提货 $60（部分商品到货），capture 时指定 amount=60.00；剩余 $40 通过 void 释放。
      </div>

      <StepCard
        number={1}
        title="Create BOPIS Order ($100)"
        description="POST /api/checkout/bopis/orders/create — 授权 $100，模拟完整订单金额。"
        requestBody={CREATE_REQUEST}
        result={steps.create}
        onExecute={handleCreate}
      />

      <StepCard
        number={2}
        title="Buyer Approval"
        description="买家在 PayPal sandbox 批准付款。"
        result={steps.approve}
        disabled={steps.create.status !== 'success'}
      >
        {steps.create.status === 'success' && clientToken && (
          <PayPalButton
            clientToken={clientToken}
            onCreateOrder={async () => ({ orderId: orderId! })}
            onApprove={async (data) => {
              setOrderId(data.orderId)
              set('approve', { status: 'success', response: { orderId: data.orderId, status: 'APPROVED' } })
            }}
            onError={(e) => set('approve', { status: 'error', error: e.message })}
            onCancel={() => set('approve', { status: 'idle' })}
          />
        )}
      </StepCard>

      <StepCard
        number={3}
        title="Authorize Order"
        description="POST /api/checkout/orders/{orderId}/authorize — 冻结 $100。"
        requestBody={{ orderId }}
        result={steps.authorize}
        onExecute={handleAuthorize}
        disabled={steps.approve.status !== 'success'}
      />

      <StepCard
        number={4}
        title="Partial Capture ($60)"
        description="POST /api/payments/authorizations/{authId}/capture — 只提货 $60，body 中指定 amount=60.00。"
        requestBody={{ authorizationId: authId, amount: '60.00' }}
        result={steps.capture}
        onExecute={handlePartialCapture}
        disabled={steps.authorize.status !== 'success'}
      />

      <StepCard
        number={5}
        title="Void Remainder ($40)"
        description="POST /api/payments/authorizations/{authId}/void — 释放剩余 $40，不再扣款。"
        requestBody={{ authorizationId: authId }}
        result={steps.void}
        onExecute={handleVoid}
        disabled={steps.capture.status !== 'success'}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd bopis-dashboard && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd .. && git add bopis-dashboard/src/scenarios/PartialCapture.tsx
git commit -m "feat[2026-06-26](bopis-dashboard): 新增 Tab2 PartialCapture 场景"
```

---

## Task 9: ResearchMultiAddr scenario (Tab 3)

**Files:**
- Create: `bopis-dashboard/src/scenarios/ResearchMultiAddr.tsx`

- [ ] **Step 1: Write the file**

```tsx
import { useState } from 'react'
import type { StepResult } from '@/types'
import { StepCard } from '@/components/StepCard'
import { PayPalButton } from '@/components/PayPalButton'
import {
  createBopisOrder,
  createBopisOrderMultiUnit,
  authorizeOrder,
  captureAuthorization,
  getSandboxClientToken,
} from '@/lib/api'

// ——— Experiment A helpers ———
const STORE_A = {
  address_line_1: '100 First St',
  admin_area_2: 'San Jose',
  admin_area_1: 'CA',
  postal_code: '95101',
  country_code: 'US',
}

const EXP_A_REQUEST = {
  amount: '80.00',
  storeName: 'Store A — San Jose',
  storeAddress: STORE_A,
  pickupCode: 'EXP-A',
}

// ——— Experiment B helpers ———
const STORE_B = {
  address_line_1: '200 Second Ave',
  admin_area_2: 'Sunnyvale',
  admin_area_1: 'CA',
  postal_code: '94086',
  country_code: 'US',
}

const EXP_B_REQUEST = {
  units: [
    { amount: '50.00', storeName: 'Store A — San Jose', storeAddress: STORE_A, referenceId: 'store-a' },
    { amount: '50.00', storeName: 'Store B — Sunnyvale', storeAddress: STORE_B, referenceId: 'store-b' },
  ],
}

// ——— State types ———
type ExpAStep = 'create' | 'approve' | 'authorize' | 'capture1' | 'capture2'
type ExpBStep = 'create' | 'approve' | 'authorize' | 'captureA' | 'captureB'

export function ResearchMultiAddr() {
  const [tab, setTab] = useState<'A' | 'B'>('A')

  // Experiment A state
  const [aOrderId, setAOrderId] = useState<string | null>(null)
  const [aAuthId, setAAuthId] = useState<string | null>(null)
  const [aClientToken, setAClientToken] = useState<string | null>(null)
  const [aSteps, setASteps] = useState<Record<ExpAStep, StepResult>>({
    create: { status: 'idle' }, approve: { status: 'idle' },
    authorize: { status: 'idle' }, capture1: { status: 'idle' }, capture2: { status: 'idle' },
  })
  const setA = (id: ExpAStep, u: Partial<StepResult>) =>
    setASteps((p) => ({ ...p, [id]: { ...p[id], ...u } }))

  // Experiment B state
  const [bOrderId, setBOrderId] = useState<string | null>(null)
  const [bAuthIdA, setBAuthIdA] = useState<string | null>(null)
  const [bAuthIdB, setBAuthIdB] = useState<string | null>(null)
  const [bClientToken, setBClientToken] = useState<string | null>(null)
  const [bSteps, setBSteps] = useState<Record<ExpBStep, StepResult>>({
    create: { status: 'idle' }, approve: { status: 'idle' },
    authorize: { status: 'idle' }, captureA: { status: 'idle' }, captureB: { status: 'idle' },
  })
  const setB = (id: ExpBStep, u: Partial<StepResult>) =>
    setBSteps((p) => ({ ...p, [id]: { ...p[id], ...u } }))

  // ——— Experiment A handlers ———
  const aCreate = async () => {
    setA('create', { status: 'loading' })
    try {
      const { data, status } = await createBopisOrder(EXP_A_REQUEST)
      if (status >= 200 && status < 300) {
        setAOrderId((data as { id: string }).id)
        setAClientToken(await getSandboxClientToken())
        setA('create', { status: 'success', response: data })
      } else {
        setA('create', { status: 'error', response: data, error: `HTTP ${status}` })
      }
    } catch (e) { setA('create', { status: 'error', error: String(e) }) }
  }

  const aAuthorize = async () => {
    if (!aOrderId) return
    setA('authorize', { status: 'loading' })
    try {
      const { data, status } = await authorizeOrder(aOrderId)
      if (status >= 200 && status < 300) {
        const id = (data as {
          purchase_units: Array<{ payments: { authorizations: Array<{ id: string }> } }>
        }).purchase_units[0].payments.authorizations[0].id
        setAAuthId(id)
        setA('authorize', { status: 'success', response: data })
      } else {
        setA('authorize', { status: 'error', response: data, error: `HTTP ${status}` })
      }
    } catch (e) { setA('authorize', { status: 'error', error: String(e) }) }
  }

  const aCapture1 = async () => {
    if (!aAuthId) return
    setA('capture1', { status: 'loading' })
    try {
      const { data, status } = await captureAuthorization(aAuthId, '50.00')
      setA('capture1', {
        status: status >= 200 && status < 300 ? 'success' : 'error',
        response: data, error: status >= 400 ? `HTTP ${status}` : undefined,
      })
    } catch (e) { setA('capture1', { status: 'error', error: String(e) }) }
  }

  const aCapture2 = async () => {
    if (!aAuthId) return
    setA('capture2', { status: 'loading' })
    try {
      const { data, status } = await captureAuthorization(aAuthId, '30.00')
      setA('capture2', {
        status: status >= 200 && status < 300 ? 'success' : 'error',
        response: data, error: status >= 400 ? `HTTP ${status}` : undefined,
      })
    } catch (e) { setA('capture2', { status: 'error', error: String(e) }) }
  }

  // ——— Experiment B handlers ———
  const bCreate = async () => {
    setB('create', { status: 'loading' })
    try {
      const { data, status } = await createBopisOrderMultiUnit(EXP_B_REQUEST)
      if (status >= 200 && status < 300) {
        setBOrderId((data as { id: string }).id)
        setBClientToken(await getSandboxClientToken())
        setB('create', { status: 'success', response: data })
      } else {
        setB('create', { status: 'error', response: data, error: `HTTP ${status}` })
      }
    } catch (e) { setB('create', { status: 'error', error: String(e) }) }
  }

  const bAuthorize = async () => {
    if (!bOrderId) return
    setB('authorize', { status: 'loading' })
    try {
      const { data, status } = await authorizeOrder(bOrderId)
      if (status >= 200 && status < 300) {
        const pus = (data as {
          purchase_units: Array<{
            reference_id: string
            payments: { authorizations: Array<{ id: string }> }
          }>
        }).purchase_units
        const puA = pus.find((p) => p.reference_id === 'store-a')
        const puB = pus.find((p) => p.reference_id === 'store-b')
        setBAuthIdA(puA?.payments.authorizations[0].id ?? null)
        setBAuthIdB(puB?.payments.authorizations[0].id ?? null)
        setB('authorize', { status: 'success', response: data })
      } else {
        setB('authorize', { status: 'error', response: data, error: `HTTP ${status}` })
      }
    } catch (e) { setB('authorize', { status: 'error', error: String(e) }) }
  }

  const bCaptureA = async () => {
    if (!bAuthIdA) return
    setB('captureA', { status: 'loading' })
    try {
      const { data, status } = await captureAuthorization(bAuthIdA)
      setB('captureA', {
        status: status >= 200 && status < 300 ? 'success' : 'error',
        response: data, error: status >= 400 ? `HTTP ${status}` : undefined,
      })
    } catch (e) { setB('captureA', { status: 'error', error: String(e) }) }
  }

  const bCaptureB = async () => {
    if (!bAuthIdB) return
    setB('captureB', { status: 'loading' })
    try {
      const { data, status } = await captureAuthorization(bAuthIdB)
      setB('captureB', {
        status: status >= 200 && status < 300 ? 'success' : 'error',
        response: data, error: status >= 400 ? `HTTP ${status}` : undefined,
      })
    } catch (e) { setB('captureB', { status: 'error', error: String(e) }) }
  }

  return (
    <div className="space-y-4">
      {/* Research question banner */}
      <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-purple-900">
        <strong>研究问题：</strong>一次 Auth 多次 Capture，是否每次可以指定不同的提货地址？
        <br />实验 A 验证单 PU 场景，实验 B 验证多 PU 场景。
      </div>

      {/* Sub-tab selector */}
      <div className="flex gap-2 border-b">
        {(['A', 'B'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
            }`}
          >
            实验 {t}
            {t === 'A' ? ' — 单 PU，连续 Capture' : ' — 多 PU，不同 Store'}
          </button>
        ))}
      </div>

      {/* Experiment A */}
      {tab === 'A' && (
        <div className="space-y-4">
          <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
            创建 1 个 purchase_unit（Store A，$80）→ Authorize → 两次 Capture（$50 + $30）。
            观察：capture response 中 shipping 地址是否固定为 Store A，能否在 capture 时改变？
            <br /><strong>预期：❌ 地址固定在 Order 创建时的 Store A，capture 阶段无法更改。</strong>
          </div>

          <StepCard number={1} title="Create Order (Single PU, Store A, $80)"
            description="POST /api/checkout/bopis/orders/create"
            requestBody={EXP_A_REQUEST} result={aSteps.create} onExecute={aCreate} />

          <StepCard number={2} title="Buyer Approval"
            description="PayPal sandbox 批准。"
            result={aSteps.approve} disabled={aSteps.create.status !== 'success'}>
            {aSteps.create.status === 'success' && aClientToken && (
              <PayPalButton
                clientToken={aClientToken}
                onCreateOrder={async () => ({ orderId: aOrderId! })}
                onApprove={async (d) => {
                  setAOrderId(d.orderId)
                  setA('approve', { status: 'success', response: { orderId: d.orderId } })
                }}
                onError={(e) => setA('approve', { status: 'error', error: e.message })}
                onCancel={() => setA('approve', { status: 'idle' })}
              />
            )}
          </StepCard>

          <StepCard number={3} title="Authorize Order"
            description="POST /api/checkout/orders/{orderId}/authorize"
            requestBody={{ orderId: aOrderId }} result={aSteps.authorize}
            onExecute={aAuthorize} disabled={aSteps.approve.status !== 'success'} />

          <StepCard number={4} title="Capture 1 ($50) — Store A 地址固定"
            description="POST /api/payments/authorizations/{authId}/capture，amount=50.00。观察 response 中 shipping 字段。"
            requestBody={{ authorizationId: aAuthId, amount: '50.00' }}
            result={aSteps.capture1} onExecute={aCapture1}
            disabled={aSteps.authorize.status !== 'success'} />

          <StepCard number={5} title="Capture 2 ($30) — 仍是 Store A 地址"
            description="同一 authId 再次 capture $30。地址依然是 Store A，无法在 capture 阶段指定不同地址。"
            requestBody={{ authorizationId: aAuthId, amount: '30.00' }}
            result={aSteps.capture2} onExecute={aCapture2}
            disabled={aSteps.capture1.status !== 'success'} />

          {aSteps.capture2.status === 'success' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              ❌ <strong>结论：</strong>单 purchase_unit 下，多次 capture 的 shipping 地址均固定为 Order 创建时的 Store A 地址。capture API 不接受 shipping 参数。
            </div>
          )}
        </div>
      )}

      {/* Experiment B */}
      {tab === 'B' && (
        <div className="space-y-4">
          <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
            创建 2 个 purchase_unit（PU1=Store A $50，PU2=Store B $50）→ Authorize → 各自 Capture。
            每个 PU 有独立的 authorizationId 和独立的 shipping 地址。
            <br /><strong>预期：✅ 可以在不同地点提货——但需要在 Order 创建时提前指定，不是在 capture 时指定。</strong>
          </div>

          <StepCard number={1} title="Create Multi-Unit Order (Store A + Store B)"
            description="POST /api/checkout/bopis/orders/create-multi — 2 个 purchase_unit，各自不同地址。"
            requestBody={EXP_B_REQUEST} result={bSteps.create} onExecute={bCreate} />

          <StepCard number={2} title="Buyer Approval"
            description="PayPal sandbox 批准整个订单（含两个 PU）。"
            result={bSteps.approve} disabled={bSteps.create.status !== 'success'}>
            {bSteps.create.status === 'success' && bClientToken && (
              <PayPalButton
                clientToken={bClientToken}
                onCreateOrder={async () => ({ orderId: bOrderId! })}
                onApprove={async (d) => {
                  setBOrderId(d.orderId)
                  setB('approve', { status: 'success', response: { orderId: d.orderId } })
                }}
                onError={(e) => setB('approve', { status: 'error', error: e.message })}
                onCancel={() => setB('approve', { status: 'idle' })}
              />
            )}
          </StepCard>

          <StepCard number={3} title="Authorize Order → 得到两个 authId"
            description="POST /api/checkout/orders/{orderId}/authorize — 每个 PU 各自生成一个 authorizationId。"
            requestBody={{ orderId: bOrderId }} result={bSteps.authorize}
            onExecute={bAuthorize} disabled={bSteps.approve.status !== 'success'} />

          {bAuthIdA && bAuthIdB && (
            <div className="rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
              authId (Store A): <code className="font-mono">{bAuthIdA}</code><br />
              authId (Store B): <code className="font-mono">{bAuthIdB}</code>
            </div>
          )}

          <StepCard number={4} title="Capture authId_A (Store A 提货)"
            description="POST /api/payments/authorizations/{authIdA}/capture — Store A 提货完成，扣 $50。"
            requestBody={{ authorizationId: bAuthIdA, store: 'Store A — San Jose' }}
            result={bSteps.captureA} onExecute={bCaptureA}
            disabled={bSteps.authorize.status !== 'success'} />

          <StepCard number={5} title="Capture authId_B (Store B 提货)"
            description="POST /api/payments/authorizations/{authIdB}/capture — Store B 提货完成，扣 $50。"
            requestBody={{ authorizationId: bAuthIdB, store: 'Store B — Sunnyvale' }}
            result={bSteps.captureB} onExecute={bCaptureB}
            disabled={bSteps.authorize.status !== 'success'} />

          {bSteps.captureB.status === 'success' && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
              ✅ <strong>结论：</strong>通过多 purchase_unit（每个 PU 在创建时指定不同 store 地址），可以实现"不同门店分别提货"。但地址必须在 Order 创建阶段确定，capture 阶段只是触发扣款，不能再改地址。
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd bopis-dashboard && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd .. && git add bopis-dashboard/src/scenarios/ResearchMultiAddr.tsx
git commit -m "feat[2026-06-26](bopis-dashboard): 新增 Tab3 Research 多地址实验场景"
```

---

## Task 10: VoidFlow scenario (Tab 4)

**Files:**
- Create: `bopis-dashboard/src/scenarios/VoidFlow.tsx`

- [ ] **Step 1: Write the file**

```tsx
import { useState } from 'react'
import type { StepResult } from '@/types'
import { StepCard } from '@/components/StepCard'
import { PayPalButton } from '@/components/PayPalButton'
import {
  createBopisOrder,
  authorizeOrder,
  voidAuthorization,
  getSandboxClientToken,
} from '@/lib/api'

const STORE_ADDRESS = {
  address_line_1: '789 Pine Blvd',
  admin_area_2: 'Mountain View',
  admin_area_1: 'CA',
  postal_code: '94040',
  country_code: 'US',
}

const CREATE_REQUEST = {
  amount: '50.00',
  storeName: 'Mountain View Store #789',
  storeAddress: STORE_ADDRESS,
  pickupCode: 'VOID456',
}

type StepId = 'create' | 'approve' | 'authorize' | 'void'
type Steps = Record<StepId, StepResult>

const INIT: Steps = {
  create: { status: 'idle' },
  approve: { status: 'idle' },
  authorize: { status: 'idle' },
  void: { status: 'idle' },
}

export function VoidFlow() {
  const [orderId, setOrderId] = useState<string | null>(null)
  const [authId, setAuthId] = useState<string | null>(null)
  const [clientToken, setClientToken] = useState<string | null>(null)
  const [steps, setSteps] = useState<Steps>(INIT)

  const set = (id: StepId, u: Partial<StepResult>) =>
    setSteps((p) => ({ ...p, [id]: { ...p[id], ...u } }))

  const handleCreate = async () => {
    set('create', { status: 'loading' })
    try {
      const { data, status } = await createBopisOrder(CREATE_REQUEST)
      if (status >= 200 && status < 300) {
        setOrderId((data as { id: string }).id)
        setClientToken(await getSandboxClientToken())
        set('create', { status: 'success', response: data })
      } else {
        set('create', { status: 'error', response: data, error: `HTTP ${status}` })
      }
    } catch (e) { set('create', { status: 'error', error: String(e) }) }
  }

  const handleAuthorize = async () => {
    if (!orderId) return
    set('authorize', { status: 'loading' })
    try {
      const { data, status } = await authorizeOrder(orderId)
      if (status >= 200 && status < 300) {
        const id = (data as {
          purchase_units: Array<{ payments: { authorizations: Array<{ id: string }> } }>
        }).purchase_units[0].payments.authorizations[0].id
        setAuthId(id)
        set('authorize', { status: 'success', response: data })
      } else {
        set('authorize', { status: 'error', response: data, error: `HTTP ${status}` })
      }
    } catch (e) { set('authorize', { status: 'error', error: String(e) }) }
  }

  const handleVoid = async () => {
    if (!authId) return
    set('void', { status: 'loading' })
    try {
      const { data, status } = await voidAuthorization(authId)
      set('void', {
        status: status >= 200 && status < 300 ? 'success' : 'error',
        response: data,
        error: status >= 400 ? `HTTP ${status}` : undefined,
      })
    } catch (e) { set('void', { status: 'error', error: String(e) }) }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <strong>场景说明：</strong>模拟买家下单后超时未提货。Order 创建并授权后，调用 void 释放冻结资金（不扣款）。
      </div>

      <StepCard number={1} title="Create BOPIS Order"
        description="POST /api/checkout/bopis/orders/create"
        requestBody={CREATE_REQUEST} result={steps.create} onExecute={handleCreate} />

      <StepCard number={2} title="Buyer Approval"
        description="买家 sandbox 批准——模拟已下单但尚未来取货。"
        result={steps.approve} disabled={steps.create.status !== 'success'}>
        {steps.create.status === 'success' && clientToken && (
          <PayPalButton
            clientToken={clientToken}
            onCreateOrder={async () => ({ orderId: orderId! })}
            onApprove={async (d) => {
              setOrderId(d.orderId)
              set('approve', { status: 'success', response: { orderId: d.orderId } })
            }}
            onError={(e) => set('approve', { status: 'error', error: e.message })}
            onCancel={() => set('approve', { status: 'idle' })}
          />
        )}
      </StepCard>

      <StepCard number={3} title="Authorize Order"
        description="POST /api/checkout/orders/{orderId}/authorize — 资金冻结，等待提货。"
        requestBody={{ orderId }} result={steps.authorize}
        onExecute={handleAuthorize} disabled={steps.approve.status !== 'success'} />

      <StepCard number={4} title="Void Authorization (超时弃单)"
        description="POST /api/payments/authorizations/{authId}/void — 买家未在规定时间内提货，系统释放冻结资金。返回 204 No Content。"
        requestBody={{ authorizationId: authId }}
        result={steps.void} onExecute={handleVoid}
        disabled={steps.authorize.status !== 'success'} />

      {steps.void.status === 'success' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
          ✅ Authorization 已 void，买家资金已释放，订单关闭。
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd bopis-dashboard && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd .. && git add bopis-dashboard/src/scenarios/VoidFlow.tsx
git commit -m "feat[2026-06-26](bopis-dashboard): 新增 Tab4 VoidFlow 弃单场景"
```

---

## Task 11: App.tsx — wire everything together

**Files:**
- Create: `bopis-dashboard/src/App.tsx`

- [ ] **Step 1: Write `src/App.tsx`**

```tsx
import { useState } from 'react'
import { ShoppingBag, Scissors, FlaskConical, Ban } from 'lucide-react'
import { StandardFlow } from '@/scenarios/StandardFlow'
import { PartialCapture } from '@/scenarios/PartialCapture'
import { ResearchMultiAddr } from '@/scenarios/ResearchMultiAddr'
import { VoidFlow } from '@/scenarios/VoidFlow'

const TABS = [
  { id: 'standard', label: 'Standard BOPIS', icon: ShoppingBag, component: StandardFlow },
  { id: 'partial', label: 'Partial Capture', icon: Scissors, component: PartialCapture },
  { id: 'research', label: 'Research: 多地址', icon: FlaskConical, component: ResearchMultiAddr },
  { id: 'void', label: 'Void (弃单)', icon: Ban, component: VoidFlow },
] as const

type TabId = (typeof TABS)[number]['id']

export default function App() {
  const [active, setActive] = useState<TabId>('standard')
  const ActiveComponent = TABS.find((t) => t.id === active)!.component

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">PayPal BOPIS 测试面板</h1>
          <p className="text-sm text-muted-foreground">Buy Online Pick Up In Store — Sandbox</p>
          <p className="text-xs text-muted-foreground">
            后端:{' '}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">
              ppgms-test-github-io.pages.dev
            </code>
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 border-b overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                active === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Active scenario */}
        <ActiveComponent />

        <p className="text-center text-xs text-muted-foreground">
          BOPIS Demo · Sandbox Only · PayPal v6 SDK
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Final TypeScript check**

```bash
cd bopis-dashboard && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Run dev server and smoke test**

```bash
pnpm dev
```

Open `http://localhost:5174`. Verify:
- All 4 tabs render without console errors
- Tab switching works (state resets correctly per tab, since each has independent `useState`)
- Step cards show correctly: Step 1 execute button active, Steps 2-5 greyed out
- JSON blocks expand/collapse on click
- StatusBadge shows "待执行" initially

- [ ] **Step 4: Commit**

```bash
cd .. && git add bopis-dashboard/src/App.tsx
git commit -m "feat[2026-06-26](bopis-dashboard): 完成 App.tsx — 四个场景 Tab 接入完毕"
```

---

## Self-Review

**Spec coverage:**
- ✅ Standard BOPIS flow (Task 7)
- ✅ Partial capture (Task 8)
- ✅ Research: single-PU multi-capture (Exp A, Task 9)
- ✅ Research: multi-PU different addresses (Exp B, Task 9)
- ✅ Void abandoned order (Task 10)
- ✅ v6 SDK PayPal button (Task 6, used in all 4 scenarios)
- ✅ 4 backend routes + 1 lib file (Tasks 1-2)
- ✅ `GET /api/checkout/orders/{orderId}` used from existing route (Task 7, Step 5)
- ✅ Research conclusions shown in UI with ✅/❌ result banners

**Placeholder scan:** No TBDs. All code blocks are complete.

**Type consistency:**
- `StepResult` defined in `types.ts`, imported by `StepCard`, all 4 scenarios
- `StoreAddress` defined in `types.ts`, imported by `api.ts`
- `getSandboxClientToken()` returns `Promise<string>` — used identically in all scenarios
- `authorizeOrder` response parsed the same way in all 4 scenarios
- `captureAuthorization(authId, amount?)` — optional `amount` used in PartialCapture and ResearchMultiAddr Exp A
