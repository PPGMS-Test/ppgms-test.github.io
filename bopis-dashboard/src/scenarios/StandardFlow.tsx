// ============================================================
// scenarios/StandardFlow.tsx — Tab 1: 标准 BOPIS 流程
// Standard Buy Online Pick Up In Store flow.
//
// 步骤顺序（必须按顺序执行，前一步成功才能进行下一步）：
// Steps (must be executed in order):
//   1. Create Order  — 创建 intent=AUTHORIZE 订单（冻结资金不扣款）
//   2. Buyer Approval — 买家在 PayPal 页面批准（PayPal SDK v6 按钮）
//   3. Authorize     — 服务端授权，返回 authorizationId
//   4. Capture       — 买家到店取货后全额扣款（Full Capture，body 为空）
//   5. View Details  — GET Order 查看完整订单状态
// ============================================================

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

// ── 门店信息常量 Store constants ─────────────────────────────
// 修改测试门店时只需改这里，PAYPAL_CREATE_PAYLOAD 会自动引用。
// Edit these constants to change the test store — PAYPAL_CREATE_PAYLOAD references them.
const STORE_ADDRESS = {
  address_line_1: '123 Main Street',
  admin_area_2: 'San Jose',
  admin_area_1: 'CA',
  postal_code: '95131',
  country_code: 'US',
}

// 发给后端 /api/checkout/bopis/orders/create 的参数（后端会组装成 PayPal API 格式）
// Parameters sent to /api/checkout/bopis/orders/create (backend builds the PayPal payload).
const CREATE_REQUEST = {
  amount: '75.00',
  storeName: 'Downtown Store #123',
  storeAddress: STORE_ADDRESS,
  pickupCode: 'PICK789',     // 存入 PayPal Order 的 custom_id 字段，供核对用
}

// 用于 UI 展示的"原始 PayPal API payload"（仅展示用，实际构造在后端）。
// Displayed as the "raw PayPal API payload" in the UI — for reference only.
// Actual payload is constructed in the backend (paypal-backend-api/.../bopis.ts).
// 如果后端字段有变化，记得同步更新这里的展示内容。
// Keep in sync with the backend if fields change.
const PAYPAL_CREATE_PAYLOAD = {
  intent: 'AUTHORIZE',
  purchase_units: [
    {
      amount: { currency_code: 'USD', value: '75.00' },
      shipping: {
        type: 'PICKUP_IN_STORE',            // BOPIS 必须字段
        name: { full_name: 'Downtown Store #123' },
        address: STORE_ADDRESS,
        phone_number: { national_number: '4085551234' }, // Wiki 要求的字段
      },
      custom_id: 'PICKUP-PICK789',           // 内部提货码
      description: 'Pickup at Downtown Store #123',
    },
  ],
  payment_source: {
    paypal: {
      experience_context: {
        shipping_preference: 'SET_PROVIDED_ADDRESS', // 锁定地址，买家无法修改
        return_url: 'https://example.com/return',
        cancel_url: 'https://example.com/cancel',
      },
    },
  },
}

// ── 步骤 ID 类型和初始状态 ───────────────────────────────────
type StepId = 'create' | 'approve' | 'authorize' | 'capture' | 'details'
type Steps = Record<StepId, StepResult>

const INIT: Steps = {
  create:    { status: 'idle' },
  approve:   { status: 'idle' },
  authorize: { status: 'idle' },
  capture:   { status: 'idle' },
  details:   { status: 'idle' },
}

export function StandardFlow() {
  // 跨步骤共享的 ID（后一步依赖前一步返回的 ID）
  // IDs shared across steps — each step depends on the previous step's returned ID.
  const [orderId, setOrderId]     = useState<string | null>(null)
  const [authId, setAuthId]       = useState<string | null>(null)
  const [clientToken, setClientToken] = useState<string | null>(null)
  const [steps, setSteps]         = useState<Steps>(INIT)

  // 辅助函数：局部更新某个步骤的状态，其他步骤保持不变
  // Helper: partially update one step's state without touching others.
  const set = (id: StepId, update: Partial<StepResult>) =>
    setSteps((p) => ({ ...p, [id]: { ...p[id], ...update } }))

  // ── Step 1: 创建订单 Create order ───────────────────────
  const handleCreate = async () => {
    set('create', { status: 'loading' })
    try {
      const { data, status, debugId } = await createBopisOrder(CREATE_REQUEST)
      if (status >= 200 && status < 300) {
        const id = (data as { id: string }).id
        setOrderId(id)
        // 同时获取 Client Token，用于初始化 PayPal SDK 按钮（Step 2 需要）
        // Also fetch the client token needed to initialize the SDK button in Step 2.
        const token = await getSandboxClientToken()
        setClientToken(token)
        set('create', { status: 'success', response: data, debugId })
      } else {
        set('create', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) {
      set('create', { status: 'error', error: String(e) })
    }
  }

  // ── Step 3: 服务端授权 Authorize ─────────────────────────
  // 注意：Step 2（买家批准）由 PayPalButton 的 onApprove 回调直接更新状态，
  // 没有单独的 handleApprove 函数。
  // Note: Step 2 (buyer approval) is handled by PayPalButton's onApprove callback directly.
  const handleAuthorize = async () => {
    if (!orderId) return
    set('authorize', { status: 'loading' })
    try {
      const { data, status, debugId } = await authorizeOrder(orderId)
      if (status >= 200 && status < 300) {
        // 从 authorize 响应中提取 authorizationId，供 Step 4 capture 使用
        // Extract authorizationId from response — needed for Step 4 capture.
        const authData = data as {
          purchase_units: Array<{ payments: { authorizations: Array<{ id: string }> } }>
        }
        const id = authData.purchase_units[0].payments.authorizations[0].id
        setAuthId(id)
        set('authorize', { status: 'success', response: data, debugId })
      } else {
        set('authorize', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) {
      set('authorize', { status: 'error', error: String(e) })
    }
  }

  // ── Step 4: Capture（全额）Full capture ──────────────────
  // body 为空 → PayPal 自动扣全额授权金额
  // Empty body → PayPal charges the full authorized amount.
  const handleCapture = async () => {
    if (!authId) return
    set('capture', { status: 'loading' })
    try {
      const { data, status, debugId } = await captureAuthorization(authId) // amount 不传 = 全额
      if (status >= 200 && status < 300) {
        set('capture', { status: 'success', response: data, debugId })
      } else {
        set('capture', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) {
      set('capture', { status: 'error', error: String(e) })
    }
  }

  // ── Step 5: 查询订单详情 View order details ──────────────
  const handleDetails = async () => {
    if (!orderId) return
    set('details', { status: 'loading' })
    try {
      const { data, status, debugId } = await getOrder(orderId)
      set('details', {
        status: status >= 200 && status < 300 ? 'success' : 'error',
        response: data,
        error: status >= 400 ? `HTTP ${status}` : undefined,
        debugId,
      })
    } catch (e) {
      set('details', { status: 'error', error: String(e) })
    }
  }

  return (
    <div className="space-y-4">

      {/* Step 1 — 创建订单 */}
      <StepCard
        number={1}
        title="Create BOPIS Order"
        description="POST /v2/checkout/orders — 创建 intent=AUTHORIZE 订单，shipping.type=PICKUP_IN_STORE，资金冻结不扣款。"
        requestBody={PAYPAL_CREATE_PAYLOAD}
        result={steps.create}
        onExecute={handleCreate}
      />

      {/* Step 2 — 买家批准（PayPal SDK v6 按钮） */}
      <StepCard
        number={2}
        title="Buyer Approval (PayPal SDK v6)"
        description="买家通过 PayPal 授权——点击 PayPal 按钮，在 sandbox 账号里批准付款，onApprove 回调自动触发。"
        result={steps.approve}
        disabled={steps.create.status !== 'success'}
      >
        {/* PayPalButton 只在 Step 1 成功且 clientToken/orderId 就绪时渲染 */}
        {/* Only render PayPalButton when Step 1 succeeded and tokens are ready */}
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

      {/* Step 3 — 服务端授权 */}
      <StepCard
        number={3}
        title="Authorize Order"
        description="服务端授权，资金进入冻结状态，返回 authorizationId。"
        requestUrl={`POST https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId ?? '{orderId}'}/authorize`}
        result={steps.authorize}
        onExecute={handleAuthorize}
        disabled={steps.approve.status !== 'success'}
      />

      {/* Step 4 — 全额 Capture */}
      <StepCard
        number={4}
        title="Capture at Pickup"
        badge={{ label: 'Full Capture', variant: 'green' }}
        description="买家到店验证后捕获，资金正式扣款。body 为空 = 自动 capture 全额授权金额。"
        requestUrl={`POST https://api-m.sandbox.paypal.com/v2/payments/authorizations/${authId ?? '{authId}'}/capture`}
        result={steps.capture}
        onExecute={handleCapture}
        disabled={steps.authorize.status !== 'success'}
      />

      {/* Step 5 — GET Order 查看完整状态 */}
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
