// ============================================================
// scenarios/AS2Flow.tsx — Reauthorize vs AS2 对比 Tab
//
// Path A — Reauthorize（honor-period 刷新，标准 AS1 流程）
//   intent=AUTHORIZE 订单 → authorize → reauthorize（刷新到期时间）
//   → 两次部分 capture。
//   reauthorize 只允许在原始 auth 创建后的 Day 4–Day 29 之间
//   调用一次，早于 Day 4 会返回 REAUTHORIZATION_TOO_SOON。
//
// Path B — AS2（intent=AUTHORIZE + processing_instruction=ORDER_SAVED_ON_SUCCESS）
//   同一 order 下多次独立 authorize + 各自 capture，用于分批
//   发货、B2B 多阶段结算等场景。若账号未开启 AS2，Step 1 或
//   Step 4（第二次 authorize）会报错。
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
      name: { full_name: 'Reauth Test Store' },
      address: { address_line_1: '123 Main Street', admin_area_2: 'San Jose',
                 admin_area_1: 'CA', postal_code: '95131', country_code: 'US' },
      phone_number: { national_number: '4085551234' },
    },
    custom_id: 'PICKUP-REAUTH-001',
    description: 'Pickup at Reauth Test Store',
  }],
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

const PATH_B_CREATE_PAYLOAD = {
  intent: 'AUTHORIZE',
  processing_instruction: 'ORDER_SAVED_ON_SUCCESS',
  purchase_units: [{
    amount: { currency_code: 'USD', value: '200.00' },
    shipping: {
      type: 'PICKUP_IN_STORE',
      name: { full_name: 'AS2 Test Store (Path B)' },
      address: { address_line_1: '123 Main Street', admin_area_2: 'San Jose',
                 admin_area_1: 'CA', postal_code: '95131', country_code: 'US' },
      phone_number: { national_number: '4085551234' },
    },
    custom_id: 'AS2-TEST-001',
    description: 'AS2 Multi-Auth Test Order (Path B)',
  }],
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

export function AS2Flow() {
  const [path, setPath] = useState<'A' | 'B'>(() => {
    const saved = localStorage.getItem('bopis-as2-active-path')
    return saved === 'B' ? 'B' : 'A'
  })

  const switchPath = (p: 'A' | 'B') => {
    setPath(p)
    localStorage.setItem('bopis-as2-active-path', p)
  }

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
        storeName: 'Reauth Test Store',
        storeAddress: { address_line_1: '123 Main Street', admin_area_2: 'San Jose',
                        admin_area_1: 'CA', postal_code: '95131', country_code: 'US' },
        pickupCode: 'REAUTH-001',
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
      return { ok: false, msg: '❌ ORDER_SAVED_ON_SUCCESS 被 PayPal 拒绝（账号未开启 AS2），详见 Step 1 响应' }
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
              onClick={() => switchPath(p)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                path === p
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p === 'A' ? 'Path A · reauthorize' : 'Path B · AS2 (ORDER_SAVED)'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Path A ────────────────────────────────────────── */}
      <div className={path === 'A' ? 'space-y-4' : 'hidden'}>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
          <strong>Path A · Reauthorize 流程</strong>：标准 AS1（intent=AUTHORIZE）+ honor-period 刷新。
          Step 4 的
          <code className="mx-1 px-1 bg-blue-100 rounded">reauthorize</code>
          需等 auth 创建满 4 天后才能调用，早于此会返回
          <code className="mx-1 px-1 bg-blue-100 rounded">REAUTHORIZATION_TOO_SOON</code>。
          Step 5/6 在 reauthorize 成功后执行（Day 4–29 之间测试）。
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
          badge={{ label: 'Day 4–29', variant: 'slate' }}
          description="正常情况下会返回 REAUTHORIZATION_TOO_SOON：reauthorization is only allowed once from Day 4 to Day 29 since the date of the original authorization。需等 auth#1 创建满 4 天后再调用。"
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
          <strong>Path B · AS2</strong>：
          <code className="mx-1 px-1 bg-amber-100 rounded">intent=AUTHORIZE</code>
          +
          <code className="mx-1 px-1 bg-amber-100 rounded">processing_instruction=ORDER_SAVED_ON_SUCCESS</code>
          。若账号未开启 AS2，Step 1 或 Step 4（第二次 authorize）会报错。
        </div>

        <StepCard
          number={1}
          title="Create Order (AS2: AUTHORIZE + ORDER_SAVED_ON_SUCCESS, $200)"
          badge={{ label: '★ 实验点', variant: 'amber' }}
          description="POST /v2/checkout/orders — intent=AUTHORIZE + processing_instruction=ORDER_SAVED_ON_SUCCESS。若账号未开启 AS2，PayPal 此处报错。"
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
