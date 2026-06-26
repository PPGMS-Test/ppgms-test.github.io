// ============================================================
// scenarios/ResearchMultiAddr.tsx — Tab 3: 多地址研究
// Research scenario: can a single authorization support multiple
// capture addresses (different pickup stores)?
//
// 研究问题：一次 Auth 多次 Capture，是否每次可以指定不同的提货地址？
// Research question: in a single-auth multi-capture flow, can each
// capture specify a different pickup address?
//
// 两个实验：
// Two experiments:
//
//   实验 A — 单 PU，连续两次 Capture（$50 + $30）
//   Experiment A — Single PU, two partial captures ($50 + $30)
//   结论 / Finding:
//     地址固定在 Order 创建时，capture 无法修改。
//     Shipping address is locked at order creation; captures cannot change it.
//     Sandbox 沙盒里两次 capture 的 finalCapture 都是 true（包括第一次 $50），
//     这是沙盒的已知行为，生产环境只有最后一次 capture 才会 finalCapture=true。
//
//   实验 B — 多 PU，两个门店各自独立授权 ID
//   Experiment B — Multi-PU, each PU has its own authorization ID
//   结论 / Finding:
//     ❌ PayPal 不支持多 purchase_unit 订单使用 intent=AUTHORIZE，
//        只支持 intent=CAPTURE（HTTP 422 UNSUPPORTED_INTENT）。
//        PayPal rejects intent=AUTHORIZE for multi-PU orders — only CAPTURE allowed.
//        如需多门店分别提货，只能拆成多个独立订单各自走完整流程。
//        For multi-store BOPIS, split into separate orders.
// ============================================================

import { useState } from 'react'
import type { StepResult } from '@/types'
import { StepCard } from '@/components/StepCard'
import { PayPalButton } from '@/components/PayPalButton'
import {
  createBopisOrder,
  createBopisOrderMultiUnit,
  authorizeOrder,
  captureAuthorization,
  getOrder,
  getSandboxClientToken,
} from '@/lib/api'

// ── 门店地址常量 Store address constants ─────────────────────
const STORE_A = {
  address_line_1: '100 First St',
  admin_area_2: 'San Jose',
  admin_area_1: 'CA',
  postal_code: '95101',
  country_code: 'US',
}

const STORE_B = {
  address_line_1: '200 Second Ave',
  admin_area_2: 'Sunnyvale',
  admin_area_1: 'CA',
  postal_code: '94086',
  country_code: 'US',
}

// ── 实验 A 请求参数（单 PU）Experiment A request params ──────
const EXP_A_REQUEST = {
  amount: '80.00',
  storeName: 'Store A — San Jose',
  storeAddress: STORE_A,
  pickupCode: 'EXP-A',
}

// ── 实验 B 请求参数（多 PU）Experiment B request params ──────
const EXP_B_REQUEST = {
  units: [
    { amount: '50.00', storeName: 'Store A — San Jose', storeAddress: STORE_A, referenceId: 'store-a' },
    { amount: '50.00', storeName: 'Store B — Sunnyvale', storeAddress: STORE_B, referenceId: 'store-b' },
  ],
}

// PayPal experience_context 共用配置
// Shared experience context for payment source.
const EXPERIENCE_CONTEXT = {
  shipping_preference: 'SET_PROVIDED_ADDRESS',
  return_url: 'https://example.com/return',
  cancel_url: 'https://example.com/cancel',
}

// ── UI 展示用的 PayPal API payload（仅参考，后端实际构造）───────
// Display-only PayPal API payloads — actual construction happens in the backend.

const PAYPAL_CREATE_A = {
  intent: 'AUTHORIZE',
  purchase_units: [
    {
      amount: { currency_code: 'USD', value: '80.00' },
      shipping: {
        type: 'PICKUP_IN_STORE',
        name: { full_name: 'Store A — San Jose' },
        address: STORE_A,
        phone_number: { national_number: '4085551234' },
      },
      custom_id: 'PICKUP-EXP-A',
      description: 'Pickup at Store A — San Jose',
    },
  ],
  payment_source: { paypal: { experience_context: EXPERIENCE_CONTEXT } },
}

const PAYPAL_CREATE_B = {
  intent: 'AUTHORIZE',
  purchase_units: [
    {
      reference_id: 'store-a',  // 用于在 authorize 响应里区分各 PU / Used to identify PU in authorize response
      amount: { currency_code: 'USD', value: '50.00' },
      shipping: { type: 'PICKUP_IN_STORE', name: { full_name: 'Store A — San Jose' }, address: STORE_A, phone_number: { national_number: '4085551234' } },
    },
    {
      reference_id: 'store-b',
      amount: { currency_code: 'USD', value: '50.00' },
      shipping: { type: 'PICKUP_IN_STORE', name: { full_name: 'Store B — Sunnyvale' }, address: STORE_B, phone_number: { national_number: '4085551234' } },
    },
  ],
  payment_source: { paypal: { experience_context: EXPERIENCE_CONTEXT } },
}

// ── 类型定义 Type definitions ────────────────────────────────
// 'details' = Step 6（GET Order，验证 shipping 地址）
type ExpAStep = 'create' | 'approve' | 'authorize' | 'capture1' | 'capture2' | 'details'
type ExpBStep = 'create' | 'approve' | 'authorize' | 'captureA' | 'captureB' | 'details'

export function ResearchMultiAddr() {
  // 当前激活的实验 tab（A 或 B）
  const [tab, setTab] = useState<'A' | 'B'>('A')

  // ── 实验 A 状态 Experiment A state ─────────────────────────
  const [aOrderId, setAOrderId]       = useState<string | null>(null)
  const [aAuthId, setAAuthId]         = useState<string | null>(null)     // 单 PU 的授权 ID
  const [aClientToken, setAClientToken] = useState<string | null>(null)
  const [aSteps, setASteps] = useState<Record<ExpAStep, StepResult>>({
    create: { status: 'idle' }, approve: { status: 'idle' },
    authorize: { status: 'idle' }, capture1: { status: 'idle' },
    capture2: { status: 'idle' }, details: { status: 'idle' },
  })
  const setA = (id: ExpAStep, u: Partial<StepResult>) =>
    setASteps((p) => ({ ...p, [id]: { ...p[id], ...u } }))

  // ── 实验 B 状态 Experiment B state ─────────────────────────
  const [bOrderId, setBOrderId]         = useState<string | null>(null)
  // 多 PU 场景：每个 PU 有独立的 authorizationId
  // Multi-PU: each PU gets its own authorizationId after authorize call.
  const [bAuthIdA, setBAuthIdA]         = useState<string | null>(null)  // Store A 的 authId
  const [bAuthIdB, setBAuthIdB]         = useState<string | null>(null)  // Store B 的 authId
  const [bClientToken, setBClientToken] = useState<string | null>(null)
  const [bSteps, setBSteps] = useState<Record<ExpBStep, StepResult>>({
    create: { status: 'idle' }, approve: { status: 'idle' },
    authorize: { status: 'idle' }, captureA: { status: 'idle' },
    captureB: { status: 'idle' }, details: { status: 'idle' },
  })
  const setB = (id: ExpBStep, u: Partial<StepResult>) =>
    setBSteps((p) => ({ ...p, [id]: { ...p[id], ...u } }))

  // ── 实验 A 处理函数 Experiment A handlers ──────────────────

  // Step A-1: 创建单 PU 订单
  const aCreate = async () => {
    setA('create', { status: 'loading' })
    try {
      const { data, status, debugId } = await createBopisOrder(EXP_A_REQUEST)
      if (status >= 200 && status < 300) {
        setAOrderId((data as { id: string }).id)
        setAClientToken(await getSandboxClientToken())
        setA('create', { status: 'success', response: data, debugId })
      } else {
        setA('create', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) { setA('create', { status: 'error', error: String(e) }) }
  }

  // Step A-3: 授权，提取单 PU 的 authorizationId
  const aAuthorize = async () => {
    if (!aOrderId) return
    setA('authorize', { status: 'loading' })
    try {
      const { data, status, debugId } = await authorizeOrder(aOrderId)
      if (status >= 200 && status < 300) {
        const id = (data as {
          purchase_units: Array<{ payments: { authorizations: Array<{ id: string }> } }>
        }).purchase_units[0].payments.authorizations[0].id
        setAAuthId(id)
        setA('authorize', { status: 'success', response: data, debugId })
      } else {
        setA('authorize', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) { setA('authorize', { status: 'error', error: String(e) }) }
  }

  // Step A-4: 第一次 Partial Capture $50
  const aCapture1 = async () => {
    if (!aAuthId) return
    setA('capture1', { status: 'loading' })
    try {
      const { data, status, debugId } = await captureAuthorization(aAuthId, '50.00')
      setA('capture1', {
        status: status >= 200 && status < 300 ? 'success' : 'error',
        response: data, error: status >= 400 ? `HTTP ${status}` : undefined, debugId,
      })
    } catch (e) { setA('capture1', { status: 'error', error: String(e) }) }
  }

  // Step A-5: 第二次 Partial Capture $30（同一个 authId）
  const aCapture2 = async () => {
    if (!aAuthId) return
    setA('capture2', { status: 'loading' })
    try {
      const { data, status, debugId } = await captureAuthorization(aAuthId, '30.00')
      setA('capture2', {
        status: status >= 200 && status < 300 ? 'success' : 'error',
        response: data, error: status >= 400 ? `HTTP ${status}` : undefined, debugId,
      })
    } catch (e) { setA('capture2', { status: 'error', error: String(e) }) }
  }

  // Step A-6: GET Order 验证 shipping 地址（capture response 不含地址，需单独 GET）
  // GET Order to verify shipping address — capture responses don't include address fields.
  const aDetails = async () => {
    if (!aOrderId) return
    setA('details', { status: 'loading' })
    try {
      const { data, status, debugId } = await getOrder(aOrderId)
      setA('details', {
        status: status >= 200 && status < 300 ? 'success' : 'error',
        response: data, error: status >= 400 ? `HTTP ${status}` : undefined, debugId,
      })
    } catch (e) { setA('details', { status: 'error', error: String(e) }) }
  }

  // ── 实验 B 处理函数 Experiment B handlers ──────────────────

  // Step B-1: 创建多 PU 订单（注意：PayPal 不支持多 PU + AUTHORIZE，会返回 422）
  // Creates multi-PU order. Note: PayPal rejects intent=AUTHORIZE for multi-PU — returns HTTP 422.
  const bCreate = async () => {
    setB('create', { status: 'loading' })
    try {
      const { data, status, debugId } = await createBopisOrderMultiUnit(EXP_B_REQUEST)
      if (status >= 200 && status < 300) {
        setBOrderId((data as { id: string }).id)
        setBClientToken(await getSandboxClientToken())
        setB('create', { status: 'success', response: data, debugId })
      } else {
        setB('create', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) { setB('create', { status: 'error', error: String(e) }) }
  }

  // Step B-3: 授权多 PU 订单，按 reference_id 提取各 PU 的 authorizationId
  // Authorize multi-PU order; extract each PU's authorizationId by reference_id.
  const bAuthorize = async () => {
    if (!bOrderId) return
    setB('authorize', { status: 'loading' })
    try {
      const { data, status, debugId } = await authorizeOrder(bOrderId)
      if (status >= 200 && status < 300) {
        const pus = (data as {
          purchase_units: Array<{
            reference_id: string
            payments: { authorizations: Array<{ id: string }> }
          }>
        }).purchase_units
        // 通过 reference_id 找到对应 PU 的 authorizationId
        // Find each PU's authorizationId by matching reference_id.
        const puA = pus.find((p) => p.reference_id === 'store-a')
        const puB = pus.find((p) => p.reference_id === 'store-b')
        setBAuthIdA(puA?.payments.authorizations[0].id ?? null)
        setBAuthIdB(puB?.payments.authorizations[0].id ?? null)
        setB('authorize', { status: 'success', response: data, debugId })
      } else {
        setB('authorize', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) { setB('authorize', { status: 'error', error: String(e) }) }
  }

  // Step B-4: Capture Store A（使用 Store A 的 authId，全额）
  const bCaptureA = async () => {
    if (!bAuthIdA) return
    setB('captureA', { status: 'loading' })
    try {
      const { data, status, debugId } = await captureAuthorization(bAuthIdA)
      setB('captureA', {
        status: status >= 200 && status < 300 ? 'success' : 'error',
        response: data, error: status >= 400 ? `HTTP ${status}` : undefined, debugId,
      })
    } catch (e) { setB('captureA', { status: 'error', error: String(e) }) }
  }

  // Step B-5: Capture Store B（使用 Store B 的 authId，全额）
  const bCaptureB = async () => {
    if (!bAuthIdB) return
    setB('captureB', { status: 'loading' })
    try {
      const { data, status, debugId } = await captureAuthorization(bAuthIdB)
      setB('captureB', {
        status: status >= 200 && status < 300 ? 'success' : 'error',
        response: data, error: status >= 400 ? `HTTP ${status}` : undefined, debugId,
      })
    } catch (e) { setB('captureB', { status: 'error', error: String(e) }) }
  }

  // Step B-6: GET Order 验证两个 PU 的 shipping 地址
  const bDetails = async () => {
    if (!bOrderId) return
    setB('details', { status: 'loading' })
    try {
      const { data, status, debugId } = await getOrder(bOrderId)
      setB('details', {
        status: status >= 200 && status < 300 ? 'success' : 'error',
        response: data, error: status >= 400 ? `HTTP ${status}` : undefined, debugId,
      })
    } catch (e) { setB('details', { status: 'error', error: String(e) }) }
  }

  // ── 渲染 Render ─────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* 研究说明横幅 Research description banner */}
      <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-purple-900">
        <strong>研究问题：</strong>一次 Auth 多次 Capture，是否每次可以指定不同的提货地址？
        <br />实验 A 验证单 PU 场景，实验 B 验证多 PU 场景。
      </div>

      {/* ── 实验选择 Tab Experiment selector ─────────────── */}
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

      {/* ══════════════════════════════════════════════════════
          实验 A — 单 PU，连续两次 Capture
          Experiment A — Single PU, two consecutive partial captures
          ══════════════════════════════════════════════════════ */}
      {tab === 'A' && (
        <div className="space-y-4">
          <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
            创建 1 个 purchase_unit（Store A，$80）→ Authorize → 两次 Capture（$50 + $30）→ GET Order。
            观察：GET Order response 中 purchase_units[0].shipping 地址是否固定为 Store A。
            <br /><strong>预期：❌ 地址固定在 Order 创建时的 Store A，capture 阶段无法更改。</strong>
          </div>

          {/* Step A-1 */}
          <StepCard number={1} title="Create Order (Single PU, Store A, $80)"
            description="POST /v2/checkout/orders — 单 purchase_unit，Store A 地址固定在创建时。"
            requestBody={PAYPAL_CREATE_A} result={aSteps.create} onExecute={aCreate} />

          {/* Step A-2 — PayPal SDK v6 按钮 */}
          <StepCard number={2} title="Buyer Approval"
            description="PayPal sandbox 批准。"
            result={aSteps.approve} disabled={aSteps.create.status !== 'success'}>
            {aSteps.create.status === 'success' && aClientToken && aOrderId && (
              <PayPalButton
                clientToken={aClientToken}
                orderId={aOrderId}
                onApprove={async (d) => {
                  setAOrderId(d.orderId)
                  setA('approve', { status: 'success', response: { orderId: d.orderId } })
                }}
                onError={(e) => setA('approve', { status: 'error', error: e.message })}
                onCancel={() => setA('approve', { status: 'idle' })}
              />
            )}
          </StepCard>

          {/* Step A-3 */}
          <StepCard number={3} title="Authorize Order"
            description="body 为空。"
            requestUrl={`POST https://api-m.sandbox.paypal.com/v2/checkout/orders/${aOrderId ?? '{orderId}'}/authorize`}
            result={aSteps.authorize}
            onExecute={aAuthorize} disabled={aSteps.approve.status !== 'success'} />

          {/* Step A-4: 第一次 Partial Capture $50 */}
          <StepCard number={4} title="Capture 1 ($50)"
            badge={{ label: 'Partial Capture', variant: 'amber' }}
            description="amount=50.00。capture response 只含 id/status/links，无 shipping 信息。"
            requestUrl={`POST https://api-m.sandbox.paypal.com/v2/payments/authorizations/${aAuthId ?? '{authId}'}/capture`}
            requestBody={{ amount: { currency_code: 'USD', value: '50.00' } }}
            result={aSteps.capture1} onExecute={aCapture1}
            disabled={aSteps.authorize.status !== 'success'} />

          {/* Step A-5: 第二次 Partial Capture $30 */}
          <StepCard number={5} title="Capture 2 ($30)"
            badge={{ label: 'Partial Capture', variant: 'amber' }}
            description="amount=30.00。同上，response 无 shipping 信息。"
            requestUrl={`POST https://api-m.sandbox.paypal.com/v2/payments/authorizations/${aAuthId ?? '{authId}'}/capture`}
            requestBody={{ amount: { currency_code: 'USD', value: '30.00' } }}
            result={aSteps.capture2} onExecute={aCapture2}
            disabled={aSteps.capture1.status !== 'success'} />

          {/* Step A-6: GET Order 验证地址 */}
          <StepCard number={6} title="View Order Details — 验证 shipping 地址"
            description="GET Order — 在 purchase_units[0].shipping 中查看实际地址，确认两次 capture 均绑定 Store A。"
            requestUrl={`GET https://api-m.sandbox.paypal.com/v2/checkout/orders/${aOrderId ?? '{orderId}'}`}
            result={aSteps.details} onExecute={aDetails}
            disabled={aSteps.capture2.status !== 'success'} />

          {/* 实验 A 结论：Step 6 成功后显示 */}
          {/* Experiment A conclusion — shown after Step 6 succeeds */}
          {aSteps.details.status === 'success' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
              <p className="font-semibold">📌 观察要点</p>
              <p>① <code className="font-mono">purchaseUnits[0].shipping.address</code> — 两次 capture 均绑定同一个 PU，地址固定为创建时的 Store A，capture 阶段无法修改。</p>
              <p>② <code className="font-mono">payments.captures[*].finalCapture</code> — 两次 capture 的响应里都是 <code className="font-mono">true</code>，包括第一次只扣了 $50 的时候。生产环境做多次 partial capture 时，建议只在最后一次 request body 里显式传 <code className="font-mono">final_capture: true</code>，前几次不传。</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          实验 B — 多 PU（两个门店）
          Experiment B — Multi-PU (two stores)
          ══════════════════════════════════════════════════════ */}
      {tab === 'B' && (
        <div className="space-y-4">
          <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
            创建 2 个 purchase_unit（PU1=Store A $50，PU2=Store B $50），intent=AUTHORIZE → Authorize → 各自 Capture → GET Order。
            <br /><strong>预期（待验证）：多 PU 是否支持 AUTHORIZE intent？</strong>
          </div>

          {/* Step B-1 */}
          <StepCard number={1} title="Create Multi-Unit Order (Store A + Store B)"
            description="POST /v2/checkout/orders — 2 个 purchase_unit，各自不同地址、各自独立 authorizationId。"
            requestBody={PAYPAL_CREATE_B} result={bSteps.create} onExecute={bCreate} />

          {/* Step B-2 — PayPal SDK v6 按钮 */}
          <StepCard number={2} title="Buyer Approval"
            description="PayPal sandbox 批准整个订单（含两个 PU）。"
            result={bSteps.approve} disabled={bSteps.create.status !== 'success'}>
            {bSteps.create.status === 'success' && bClientToken && bOrderId && (
              <PayPalButton
                clientToken={bClientToken}
                orderId={bOrderId}
                onApprove={async (d) => {
                  setBOrderId(d.orderId)
                  setB('approve', { status: 'success', response: { orderId: d.orderId } })
                }}
                onError={(e) => setB('approve', { status: 'error', error: e.message })}
                onCancel={() => setB('approve', { status: 'idle' })}
              />
            )}
          </StepCard>

          {/* Step B-3: 授权（多 PU 各自得到独立 authId）*/}
          <StepCard number={3} title="Authorize Order → 得到两个 authId"
            description="每个 PU 各自生成一个 authorizationId，body 为空。"
            requestUrl={`POST https://api-m.sandbox.paypal.com/v2/checkout/orders/${bOrderId ?? '{orderId}'}/authorize`}
            result={bSteps.authorize}
            onExecute={bAuthorize} disabled={bSteps.approve.status !== 'success'} />

          {/* 授权成功后显示两个 authId 供参考 */}
          {/* Show both authIds after Step 3 succeeds for reference */}
          {bAuthIdA && bAuthIdB && (
            <div className="rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
              authId (Store A): <code className="font-mono">{bAuthIdA}</code><br />
              authId (Store B): <code className="font-mono">{bAuthIdB}</code>
            </div>
          )}

          {/* Step B-4: Capture Store A */}
          <StepCard number={4} title="Capture authId_A (Store A 提货)"
            badge={{ label: 'Full Capture', variant: 'green' }}
            description="Store A 提货完成，扣 $50，body 为空。"
            requestUrl={`POST https://api-m.sandbox.paypal.com/v2/payments/authorizations/${bAuthIdA ?? '{authIdA}'}/capture`}
            result={bSteps.captureA} onExecute={bCaptureA}
            disabled={bSteps.authorize.status !== 'success'} />

          {/* Step B-5: Capture Store B（可与 Step B-4 独立执行，顺序不限）*/}
          {/* Step B-5 can be executed independently of B-4 in any order */}
          <StepCard number={5} title="Capture authId_B (Store B 提货)"
            badge={{ label: 'Full Capture', variant: 'green' }}
            description="Store B 提货完成，扣 $50，body 为空。"
            requestUrl={`POST https://api-m.sandbox.paypal.com/v2/payments/authorizations/${bAuthIdB ?? '{authIdB}'}/capture`}
            result={bSteps.captureB} onExecute={bCaptureB}
            disabled={bSteps.authorize.status !== 'success'} />

          {/* Step B-6: GET Order 验证两个 PU 的地址 */}
          <StepCard number={6} title="View Order Details — 验证两个 PU 的 shipping 地址"
            description="GET Order — 在 purchase_units[].shipping 中确认 Store A / Store B 各自独立的地址。"
            requestUrl={`GET https://api-m.sandbox.paypal.com/v2/checkout/orders/${bOrderId ?? '{orderId}'}`}
            result={bSteps.details} onExecute={bDetails}
            disabled={bSteps.captureB.status !== 'success'} />

          {/* 实验 B 结论 A：Step 1 报错时显示（多 PU + AUTHORIZE 不支持）*/}
          {/* Experiment B conclusion when Step 1 fails with UNSUPPORTED_INTENT */}
          {bSteps.create.status === 'error' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
              <p className="font-semibold">📌 研究结论：多 PU 不支持 AUTHORIZE intent</p>
              <p>PayPal 返回 <code className="font-mono">UNSUPPORTED_INTENT</code>：多 purchase_unit 订单只支持 <code className="font-mono">intent=CAPTURE</code>，不支持 <code className="font-mono">intent=AUTHORIZE</code>。</p>
              <p>这意味着：<strong>无法对多门店 BOPIS 订单使用"先授权、等提货再扣款"的流程</strong>。如果需要多个门店分别提货，只能拆成多个独立订单（每个订单一个 PU），各自走完整的 Create → Authorize → Capture 流程。</p>
            </div>
          )}

          {/* 实验 B 结论 B：所有步骤成功时（理论上不会触发，因为 Step 1 会 422）*/}
          {/* Experiment B success conclusion (theoretically unreachable since Step 1 returns 422) */}
          {bSteps.details.status === 'success' && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
              ✅ <strong>结论：</strong>通过多 purchase_unit（每个 PU 在创建时指定不同 store 地址），可以实现"不同门店分别提货"。但地址必须在 Order 创建阶段确定，capture 阶段只是触发扣款，不能再改地址。
            </div>
          )}
        </div>
      )}
    </div>
  )
}
