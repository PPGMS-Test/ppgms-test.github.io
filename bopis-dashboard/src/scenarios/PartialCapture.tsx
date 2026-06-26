// ============================================================
// scenarios/PartialCapture.tsx — Tab 2: 部分 Capture + Void
// Partial Capture scenario: authorize full amount, capture only
// part of it, then void the remainder.
//
// 场景背景：
// Business scenario:
//   买家下单 $100，但到店时只有部分商品到货（$60）。
//   Buyer orders $100 but only $60 of items are available at pickup.
//   → 先 capture $60，再 void 剩余 $40 释放冻结资金。
//   → Capture $60 first, then void the remaining $40.
//
// 步骤顺序：
// Steps:
//   1. Create Order  — 授权 $100
//   2. Buyer Approval — 买家批准
//   3. Authorize     — 冻结 $100
//   4. Partial Capture $60 — 指定 amount=60.00 扣款（body 含金额）
//   5. Void $40      — void 释放剩余冻结金额（body 为空）
// ============================================================

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

// UI 展示用的原始 PayPal payload（实际在后端构造）
// Displayed in UI as reference; actual payload built in the backend.
const PAYPAL_CREATE_PAYLOAD = {
  intent: 'AUTHORIZE',
  purchase_units: [
    {
      amount: { currency_code: 'USD', value: '100.00' },
      shipping: {
        type: 'PICKUP_IN_STORE',
        name: { full_name: 'Palo Alto Store #456' },
        address: STORE_ADDRESS,
        phone_number: { national_number: '4085551234' },
      },
      custom_id: 'PICKUP-PART123',
      description: 'Pickup at Palo Alto Store #456',
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

type StepId = 'create' | 'approve' | 'authorize' | 'capture' | 'void'
type Steps = Record<StepId, StepResult>

const INIT: Steps = {
  create:    { status: 'idle' },
  approve:   { status: 'idle' },
  authorize: { status: 'idle' },
  capture:   { status: 'idle' },
  void:      { status: 'idle' },
}

export function PartialCapture() {
  const [orderId, setOrderId]         = useState<string | null>(null)
  const [authId, setAuthId]           = useState<string | null>(null)
  const [clientToken, setClientToken] = useState<string | null>(null)
  const [steps, setSteps]             = useState<Steps>(INIT)

  const set = (id: StepId, update: Partial<StepResult>) =>
    setSteps((p) => ({ ...p, [id]: { ...p[id], ...update } }))

  // Step 1
  const handleCreate = async () => {
    set('create', { status: 'loading' })
    try {
      const { data, status, debugId } = await createBopisOrder(CREATE_REQUEST)
      if (status >= 200 && status < 300) {
        setOrderId((data as { id: string }).id)
        setClientToken(await getSandboxClientToken())
        set('create', { status: 'success', response: data, debugId })
      } else {
        set('create', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) {
      set('create', { status: 'error', error: String(e) })
    }
  }

  // Step 3
  const handleAuthorize = async () => {
    if (!orderId) return
    set('authorize', { status: 'loading' })
    try {
      const { data, status, debugId } = await authorizeOrder(orderId)
      if (status >= 200 && status < 300) {
        const id = (data as {
          purchase_units: Array<{ payments: { authorizations: Array<{ id: string }> } }>
        }).purchase_units[0].payments.authorizations[0].id
        setAuthId(id)
        set('authorize', { status: 'success', response: data, debugId })
      } else {
        set('authorize', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) {
      set('authorize', { status: 'error', error: String(e) })
    }
  }

  // Step 4: 部分 Capture Partial capture
  // captureAuthorization 第二个参数传 '60.00'，
  // 后端将其构造为 body: { amount: { currency_code: 'USD', value: '60.00' } }
  // Second argument '60.00' is sent as the capture amount;
  // backend wraps it as { amount: { currency_code: 'USD', value: '60.00' } }.
  const handlePartialCapture = async () => {
    if (!authId) return
    set('capture', { status: 'loading' })
    try {
      const { data, status, debugId } = await captureAuthorization(authId, '60.00')
      set('capture', {
        status: status >= 200 && status < 300 ? 'success' : 'error',
        response: data,
        error: status >= 400 ? `HTTP ${status}` : undefined,
        debugId,
      })
    } catch (e) {
      set('capture', { status: 'error', error: String(e) })
    }
  }

  // Step 5: Void 剩余授权额
  // 注意：PayPal 返回 204 No Content，后端映射为 200 + { status: 'VOIDED' }
  // Note: PayPal returns 204; backend remaps to 200 + { status: 'VOIDED' }.
  const handleVoid = async () => {
    if (!authId) return
    set('void', { status: 'loading' })
    try {
      const { data, status, debugId } = await voidAuthorization(authId)
      set('void', {
        status: status >= 200 && status < 300 ? 'success' : 'error',
        response: data,
        error: status >= 400 ? `HTTP ${status}` : undefined,
        debugId,
      })
    } catch (e) {
      set('void', { status: 'error', error: String(e) })
    }
  }

  return (
    <div className="space-y-4">
      {/* 场景说明横幅 Scenario description banner */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <strong>场景说明：</strong>授权 $100，仅提货 $60（部分商品到货），capture 时指定 amount=60.00；剩余 $40 通过 void 释放。
      </div>

      <StepCard
        number={1}
        title="Create BOPIS Order ($100)"
        description="POST /v2/checkout/orders — 授权 $100，模拟完整订单金额。"
        requestBody={PAYPAL_CREATE_PAYLOAD}
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
        description="冻结 $100，body 为空。"
        requestUrl={`POST https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId ?? '{orderId}'}/authorize`}
        result={steps.authorize}
        onExecute={handleAuthorize}
        disabled={steps.approve.status !== 'success'}
      />

      {/* Step 4: Partial Capture — body 里带 amount */}
      <StepCard
        number={4}
        title="Partial Capture ($60)"
        badge={{ label: 'Partial Capture', variant: 'amber' }}
        description="只提货 $60，body 中显式指定 amount。剩余 $40 授权仍然冻结。"
        requestUrl={`POST https://api-m.sandbox.paypal.com/v2/payments/authorizations/${authId ?? '{authId}'}/capture`}
        requestBody={{ amount: { currency_code: 'USD', value: '60.00' } }}
        result={steps.capture}
        onExecute={handlePartialCapture}
        disabled={steps.authorize.status !== 'success'}
      />

      {/* Step 5: Void — body 为空，PayPal 返回 204 → 后端映射为 200 */}
      <StepCard
        number={5}
        title="Void Remainder ($40)"
        description="释放剩余 $40，body 为空。PayPal 返回 204，后端映射为 200 + { status: 'VOIDED' }。"
        requestUrl={`POST https://api-m.sandbox.paypal.com/v2/payments/authorizations/${authId ?? '{authId}'}/void`}
        result={steps.void}
        onExecute={handleVoid}
        disabled={steps.capture.status !== 'success'}
      />
    </div>
  )
}
