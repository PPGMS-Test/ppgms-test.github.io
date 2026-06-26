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
