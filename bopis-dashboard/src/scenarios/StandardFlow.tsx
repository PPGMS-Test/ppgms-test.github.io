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

// Raw PayPal API payload sent to POST /v2/checkout/orders
const PAYPAL_CREATE_PAYLOAD = {
  intent: 'AUTHORIZE',
  purchase_units: [
    {
      amount: { currency_code: 'USD', value: '75.00' },
      shipping: {
        type: 'PICKUP_IN_STORE',
        name: { full_name: 'Downtown Store #123' },
        address: STORE_ADDRESS,
      },
      custom_id: 'PICKUP-PICK789',
      description: 'Pickup at Downtown Store #123',
    },
  ],
  payment_source: {
    paypal: {
      experience_context: {
        shipping_preference: 'SET_PROVIDED_ADDRESS',
        return_url: 'https://example.com/return',
        cancel_url: 'https://example.com/cancel',
      },
    },
  },
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
        description="POST /v2/checkout/orders — 创建 intent=AUTHORIZE 订单，shipping.type=PICKUP_IN_STORE，资金冻结不扣款。"
        requestBody={PAYPAL_CREATE_PAYLOAD}
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

      <StepCard
        number={3}
        title="Authorize Order"
        description="服务端授权，资金进入冻结状态，返回 authorizationId。"
        requestUrl={`POST https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId ?? '{orderId}'}/authorize`}
        result={steps.authorize}
        onExecute={handleAuthorize}
        disabled={steps.approve.status !== 'success'}
      />

      <StepCard
        number={4}
        title="Capture at Pickup"
        description="买家到店验证后捕获，资金正式扣款（full capture，body 为空）。"
        requestUrl={`POST https://api-m.sandbox.paypal.com/v2/payments/authorizations/${authId ?? '{authId}'}/capture`}
        result={steps.capture}
        onExecute={handleCapture}
        disabled={steps.authorize.status !== 'success'}
      />

      <StepCard
        number={5}
        title="View Order Details"
        description="查看完整订单状态，确认所有字段正确。"
        requestUrl={`GET https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId ?? '{orderId}'}`}
        result={steps.details}
        onExecute={handleDetails}
        disabled={steps.capture.status !== 'success'}
      />
    </div>
  )
}
