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

const EXP_A_REQUEST = {
  amount: '80.00',
  storeName: 'Store A — San Jose',
  storeAddress: STORE_A,
  pickupCode: 'EXP-A',
}

const EXP_B_REQUEST = {
  units: [
    { amount: '50.00', storeName: 'Store A — San Jose', storeAddress: STORE_A, referenceId: 'store-a' },
    { amount: '50.00', storeName: 'Store B — Sunnyvale', storeAddress: STORE_B, referenceId: 'store-b' },
  ],
}

const EXPERIENCE_CONTEXT = {
  shipping_preference: 'SET_PROVIDED_ADDRESS',
  return_url: 'https://example.com/return',
  cancel_url: 'https://example.com/cancel',
}

// Raw PayPal API payloads
const PAYPAL_CREATE_A = {
  intent: 'AUTHORIZE',
  purchase_units: [
    {
      amount: { currency_code: 'USD', value: '80.00' },
      shipping: { type: 'PICKUP_IN_STORE', name: { full_name: 'Store A — San Jose' }, address: STORE_A },
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
      reference_id: 'store-a',
      amount: { currency_code: 'USD', value: '50.00' },
      shipping: { type: 'PICKUP_IN_STORE', name: { full_name: 'Store A — San Jose' }, address: STORE_A },
    },
    {
      reference_id: 'store-b',
      amount: { currency_code: 'USD', value: '50.00' },
      shipping: { type: 'PICKUP_IN_STORE', name: { full_name: 'Store B — Sunnyvale' }, address: STORE_B },
    },
  ],
  payment_source: { paypal: { experience_context: EXPERIENCE_CONTEXT } },
}

type ExpAStep = 'create' | 'approve' | 'authorize' | 'capture1' | 'capture2'
type ExpBStep = 'create' | 'approve' | 'authorize' | 'captureA' | 'captureB'

export function ResearchMultiAddr() {
  const [tab, setTab] = useState<'A' | 'B'>('A')

  const [aOrderId, setAOrderId] = useState<string | null>(null)
  const [aAuthId, setAAuthId] = useState<string | null>(null)
  const [aClientToken, setAClientToken] = useState<string | null>(null)
  const [aSteps, setASteps] = useState<Record<ExpAStep, StepResult>>({
    create: { status: 'idle' }, approve: { status: 'idle' },
    authorize: { status: 'idle' }, capture1: { status: 'idle' }, capture2: { status: 'idle' },
  })
  const setA = (id: ExpAStep, u: Partial<StepResult>) =>
    setASteps((p) => ({ ...p, [id]: { ...p[id], ...u } }))

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
      <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-purple-900">
        <strong>研究问题：</strong>一次 Auth 多次 Capture，是否每次可以指定不同的提货地址？
        <br />实验 A 验证单 PU 场景，实验 B 验证多 PU 场景。
      </div>

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

      {tab === 'A' && (
        <div className="space-y-4">
          <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
            创建 1 个 purchase_unit（Store A，$80）→ Authorize → 两次 Capture（$50 + $30）。
            观察：capture response 中 shipping 地址是否固定为 Store A，能否在 capture 时改变？
            <br /><strong>预期：❌ 地址固定在 Order 创建时的 Store A，capture 阶段无法更改。</strong>
          </div>

          <StepCard number={1} title="Create Order (Single PU, Store A, $80)"
            description="POST /v2/checkout/orders — 单 purchase_unit，Store A 地址固定在创建时。"
            requestBody={PAYPAL_CREATE_A} result={aSteps.create} onExecute={aCreate} />

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

          <StepCard number={3} title="Authorize Order"
            description="POST /v2/checkout/orders/{orderId}/authorize — body 为空。"
            requestBody={{}} result={aSteps.authorize}
            onExecute={aAuthorize} disabled={aSteps.approve.status !== 'success'} />

          <StepCard number={4} title="Capture 1 ($50) — Store A 地址固定"
            description="POST /v2/payments/authorizations/{authId}/capture，amount=50.00。观察 response 中 shipping 字段。"
            requestBody={{ amount: { currency_code: 'USD', value: '50.00' } }}
            result={aSteps.capture1} onExecute={aCapture1}
            disabled={aSteps.authorize.status !== 'success'} />

          <StepCard number={5} title="Capture 2 ($30) — 仍是 Store A 地址"
            description="POST /v2/payments/authorizations/{authId}/capture，amount=30.00。地址依然是 Store A，无法在 capture 阶段指定不同地址。"
            requestBody={{ amount: { currency_code: 'USD', value: '30.00' } }}
            result={aSteps.capture2} onExecute={aCapture2}
            disabled={aSteps.capture1.status !== 'success'} />

          {aSteps.capture2.status === 'success' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              ❌ <strong>结论：</strong>单 purchase_unit 下，多次 capture 的 shipping 地址均固定为 Order 创建时的 Store A 地址。capture API 不接受 shipping 参数。
            </div>
          )}
        </div>
      )}

      {tab === 'B' && (
        <div className="space-y-4">
          <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
            创建 2 个 purchase_unit（PU1=Store A $50，PU2=Store B $50）→ Authorize → 各自 Capture。
            每个 PU 有独立的 authorizationId 和独立的 shipping 地址。
            <br /><strong>预期：✅ 可以在不同地点提货——但需要在 Order 创建时提前指定，不是在 capture 时指定。</strong>
          </div>

          <StepCard number={1} title="Create Multi-Unit Order (Store A + Store B)"
            description="POST /v2/checkout/orders — 2 个 purchase_unit，各自不同地址、各自独立 authorizationId。"
            requestBody={PAYPAL_CREATE_B} result={bSteps.create} onExecute={bCreate} />

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

          <StepCard number={3} title="Authorize Order → 得到两个 authId"
            description="POST /v2/checkout/orders/{orderId}/authorize — 每个 PU 各自生成一个 authorizationId，body 为空。"
            requestBody={{}} result={bSteps.authorize}
            onExecute={bAuthorize} disabled={bSteps.approve.status !== 'success'} />

          {bAuthIdA && bAuthIdB && (
            <div className="rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
              authId (Store A): <code className="font-mono">{bAuthIdA}</code><br />
              authId (Store B): <code className="font-mono">{bAuthIdB}</code>
            </div>
          )}

          <StepCard number={4} title="Capture authId_A (Store A 提货)"
            description="POST /v2/payments/authorizations/{authIdA}/capture — Store A 提货完成，扣 $50，body 为空（full capture）。"
            requestBody={{}}
            result={bSteps.captureA} onExecute={bCaptureA}
            disabled={bSteps.authorize.status !== 'success'} />

          <StepCard number={5} title="Capture authId_B (Store B 提货)"
            description="POST /v2/payments/authorizations/{authIdB}/capture — Store B 提货完成，扣 $50，body 为空（full capture）。"
            requestBody={{}}
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
