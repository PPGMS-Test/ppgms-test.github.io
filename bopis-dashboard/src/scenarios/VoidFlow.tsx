// ============================================================
// scenarios/VoidFlow.tsx — Tab 4: Void 弃单流程
// Void (order abandonment) scenario.
//
// 场景背景：
// Business scenario:
//   买家下单并完成 PayPal 授权，但超时未到店取货（或取消订单）。
//   Buyer places order and authorizes payment, but never picks up
//   (timeout or cancellation).
//   → 商家调用 void 释放冻结资金，买家不会被扣款。
//   → Merchant calls void to release frozen funds; buyer is not charged.
//
// 步骤顺序：
// Steps:
//   1. Create Order  — 创建 intent=AUTHORIZE 订单
//   2. Buyer Approval — 买家批准（模拟已下单，等待取货）
//   3. Authorize     — 冻结资金
//   4. Void          — 超时未取货，释放冻结资金（body 为空，PayPal 返回 204）
// ============================================================

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

// UI 展示用的原始 PayPal payload（实际在后端构造）
const PAYPAL_CREATE_PAYLOAD = {
  intent: 'AUTHORIZE',
  purchase_units: [
    {
      amount: { currency_code: 'USD', value: '50.00' },
      shipping: {
        type: 'PICKUP_IN_STORE',
        name: { full_name: 'Mountain View Store #789' },
        address: STORE_ADDRESS,
        phone_number: { national_number: '4085551234' },
      },
      custom_id: 'PICKUP-VOID456',
      description: 'Pickup at Mountain View Store #789',
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

type StepId = 'create' | 'approve' | 'authorize' | 'void'
type Steps = Record<StepId, StepResult>

const INIT: Steps = {
  create:    { status: 'idle' },
  approve:   { status: 'idle' },
  authorize: { status: 'idle' },
  void:      { status: 'idle' },
}

export function VoidFlow() {
  const [orderId, setOrderId]         = useState<string | null>(null)
  const [authId, setAuthId]           = useState<string | null>(null)
  const [clientToken, setClientToken] = useState<string | null>(null)
  const [steps, setSteps]             = useState<Steps>(INIT)

  const set = (id: StepId, u: Partial<StepResult>) =>
    setSteps((p) => ({ ...p, [id]: { ...p[id], ...u } }))

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
    } catch (e) { set('create', { status: 'error', error: String(e) }) }
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
    } catch (e) { set('authorize', { status: 'error', error: String(e) }) }
  }

  // Step 4: Void
  // ⚠️ PayPal 返回 HTTP 204 No Content（无 body）。
  //    后端（paypal-backend-api/.../void/route.ts）将 204 映射为 200 + { status: 'VOIDED' }，
  //    原因：Edge Runtime 有时会丢失 204 响应，导致前端 fetch 无法正确处理。
  //    PayPal returns HTTP 204 No Content. Backend remaps to 200 + { status: 'VOIDED' }
  //    because Edge Runtime sometimes drops 204 responses.
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
    } catch (e) { set('void', { status: 'error', error: String(e) }) }
  }

  return (
    <div className="space-y-4">
      {/* 场景说明横幅 */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <strong>场景说明：</strong>模拟买家下单后超时未提货。Order 创建并授权后，调用 void 释放冻结资金（不扣款）。
      </div>

      <StepCard
        number={1}
        title="Create BOPIS Order"
        description="POST /v2/checkout/orders — 创建 intent=AUTHORIZE 订单，shipping.type=PICKUP_IN_STORE。"
        requestBody={PAYPAL_CREATE_PAYLOAD}
        result={steps.create}
        onExecute={handleCreate}
      />

      <StepCard
        number={2}
        title="Buyer Approval"
        description="买家 sandbox 批准——模拟已下单但尚未来取货。"
        result={steps.approve}
        disabled={steps.create.status !== 'success'}
      >
        {steps.create.status === 'success' && clientToken && orderId && (
          <PayPalButton
            clientToken={clientToken}
            orderId={orderId}
            onApprove={async (d) => {
              setOrderId(d.orderId)
              set('approve', { status: 'success', response: { orderId: d.orderId } })
            }}
            onError={(e) => set('approve', { status: 'error', error: e.message })}
            onCancel={() => set('approve', { status: 'idle' })}
          />
        )}
      </StepCard>

      <StepCard
        number={3}
        title="Authorize Order"
        description="资金冻结，等待提货，body 为空。"
        requestUrl={`POST https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId ?? '{orderId}'}/authorize`}
        result={steps.authorize}
        onExecute={handleAuthorize}
        disabled={steps.approve.status !== 'success'}
      />

      <StepCard
        number={4}
        title="Void Authorization (超时弃单)"
        description="买家未在规定时间内提货，系统释放冻结资金。body 为空，PayPal 返回 204，后端映射为 200 + { status: 'VOIDED' }。"
        requestUrl={`POST https://api-m.sandbox.paypal.com/v2/payments/authorizations/${authId ?? '{authId}'}/void`}
        result={steps.void}
        onExecute={handleVoid}
        disabled={steps.authorize.status !== 'success'}
      />

      {/* 成功结论横幅 Success conclusion banner */}
      {steps.void.status === 'success' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
          ✅ Authorization 已 void，买家资金已释放，订单关闭。
        </div>
      )}
    </div>
  )
}
