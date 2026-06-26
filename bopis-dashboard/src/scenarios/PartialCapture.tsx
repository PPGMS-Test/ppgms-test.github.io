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
