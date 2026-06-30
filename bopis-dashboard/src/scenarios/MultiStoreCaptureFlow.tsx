// ============================================================
// scenarios/MultiStoreCaptureFlow.tsx — Tab 5: 多门店 CAPTURE 流程
// Multi-Store CAPTURE flow — research scenario.
//
// 研究目的 Research goal:
//   验证 PayPal 是否支持：一个 Order 含 5 个 Purchase Unit（各自对应
//   不同城市的 PICKUP_IN_STORE 门店），使用 intent=CAPTURE 一次性扣款。
//   Verify whether PayPal accepts a single Order with 5 PUs each mapped
//   to a different city's PICKUP_IN_STORE location, using intent=CAPTURE.
//
// 背景 Background:
//   ResearchMultiAddr 实验 B 已证明 intent=AUTHORIZE + 多 PU 被 PayPal
//   拒绝（HTTP 422 UNSUPPORTED_INTENT）。本场景改用 intent=CAPTURE。
//   Experiment B showed PayPal rejects intent=AUTHORIZE + multi-PU (HTTP 422).
//   This scenario tests the CAPTURE alternative.
//
// 步骤 Steps（必须按顺序执行）：
//   1. Create Order  — 创建 5 PU + intent=CAPTURE 订单
//   2. Buyer Approval — PayPal SDK v6 按钮，买家授权
//   3. Capture All   — POST /orders/{orderId}/capture，一次扣款全部 PU
//   4. View Details  — GET /orders/{orderId}，查看每个 PU 的 capture 结果
// ============================================================

import { useState } from 'react'
import type { StepResult } from '@/types'
import { StepCard } from '@/components/StepCard'
import { PayPalButton } from '@/components/PayPalButton'
import {
  createBopisOrderMultiCapture,
  captureOrder,
  getOrder,
  getSandboxClientToken,
} from '@/lib/api'

// ── 展示用 Payload（实际构造在后端）Display-only payload ─────
// 仅用于 UI 中展示"发给 PayPal 的原始请求体"，实际字段以后端为准。
// For display in the UI only — actual construction is in the backend.
const PAYPAL_CREATE_PAYLOAD = {
  intent: 'CAPTURE',
  purchase_units: [
    {
      reference_id: 'store-a',
      amount: { currency_code: 'USD', value: '899.00' },
      description: 'LG 门对门冰箱 (LG French Door Refrigerator) — Pickup at San Jose Store',
      shipping: {
        type: 'PICKUP_IN_STORE',
        name: { full_name: 'Best Buy San Jose' },
        address: { address_line_1: '1600 Saratoga Ave', admin_area_2: 'San Jose', admin_area_1: 'CA', postal_code: '95129', country_code: 'US' },
        phone_number: { national_number: '4085551001' },
      },
    },
    {
      reference_id: 'store-b',
      amount: { currency_code: 'USD', value: '649.00' },
      description: 'Samsung 前置滚筒洗衣机 (Samsung Front Load Washer) — Pickup at Los Angeles Store',
      shipping: {
        type: 'PICKUP_IN_STORE',
        name: { full_name: 'Best Buy Los Angeles' },
        address: { address_line_1: '1015 Wilshire Blvd', admin_area_2: 'Los Angeles', admin_area_1: 'CA', postal_code: '90017', country_code: 'US' },
        phone_number: { national_number: '2135552002' },
      },
    },
    {
      reference_id: 'store-c',
      amount: { currency_code: 'USD', value: '599.00' },
      description: 'Samsung 烘干机 (Samsung Electric Dryer) — Pickup at Seattle Store',
      shipping: {
        type: 'PICKUP_IN_STORE',
        name: { full_name: 'Best Buy Seattle' },
        address: { address_line_1: '400 Pine St', admin_area_2: 'Seattle', admin_area_1: 'WA', postal_code: '98101', country_code: 'US' },
        phone_number: { national_number: '2065553003' },
      },
    },
    {
      reference_id: 'store-d',
      amount: { currency_code: 'USD', value: '349.00' },
      description: 'Bissell CrossWave 洗地机 — Pickup at Chicago Store',
      shipping: {
        type: 'PICKUP_IN_STORE',
        name: { full_name: 'Best Buy Chicago' },
        address: { address_line_1: '900 N Michigan Ave', admin_area_2: 'Chicago', admin_area_1: 'IL', postal_code: '60611', country_code: 'US' },
        phone_number: { national_number: '3125554004' },
      },
    },
    {
      reference_id: 'store-e',
      amount: { currency_code: 'USD', value: '449.00' },
      description: 'Midea 窗式空调 (Midea Window Air Conditioner) — Pickup at New York Store',
      shipping: {
        type: 'PICKUP_IN_STORE',
        name: { full_name: 'Best Buy New York' },
        address: { address_line_1: '529 5th Ave', admin_area_2: 'New York', admin_area_1: 'NY', postal_code: '10017', country_code: 'US' },
        phone_number: { national_number: '2125555005' },
      },
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

// ── 步骤 ID 和初始状态 ───────────────────────────────────────
type StepId = 'create' | 'approve' | 'capture' | 'details'
type Steps = Record<StepId, StepResult>

const INIT: Steps = {
  create:  { status: 'idle' },
  approve: { status: 'idle' },
  capture: { status: 'idle' },
  details: { status: 'idle' },
}

export function MultiStoreCaptureFlow() {
  const [orderId, setOrderId]         = useState<string | null>(null)
  const [clientToken, setClientToken] = useState<string | null>(null)
  const [steps, setSteps]             = useState<Steps>(INIT)

  const set = (id: StepId, update: Partial<StepResult>) =>
    setSteps((p) => ({ ...p, [id]: { ...p[id], ...update } }))

  // ── Step 1: 创建订单 ─────────────────────────────────────
  const handleCreate = async () => {
    set('create', { status: 'loading' })
    try {
      const { data, status, debugId } = await createBopisOrderMultiCapture()
      if (status >= 200 && status < 300) {
        const id = (data as { id: string }).id
        setOrderId(id)
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

  // ── Step 3: 捕获所有 PU ──────────────────────────────────
  const handleCapture = async () => {
    if (!orderId) return
    set('capture', { status: 'loading' })
    try {
      const { data, status, debugId } = await captureOrder(orderId)
      if (status >= 200 && status < 300) {
        set('capture', { status: 'success', response: data, debugId })
      } else {
        set('capture', { status: 'error', response: data, error: `HTTP ${status}`, debugId })
      }
    } catch (e) {
      set('capture', { status: 'error', error: String(e) })
    }
  }

  // ── Step 4: 查询订单详情 ─────────────────────────────────
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

  // ── 研究结论（动态）Research conclusion ──────────────────
  const showFailConclusion = steps.create.status === 'error'
  const showSuccessConclusion = steps.capture.status === 'success'

  return (
    <div className="space-y-4">

      {/* 场景说明 */}
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">研究目标</p>
        <p>
          一个 Order 含 <strong>5 个 Purchase Unit</strong>，每个 PU 绑定不同城市的 PICKUP_IN_STORE 门店。
          使用 <code className="font-mono bg-muted px-1 rounded">intent=CAPTURE</code> 直接扣款（无 Authorize 步骤）。
        </p>
        <p className="text-xs">
          背景：ResearchMultiAddr 实验 B 已证明 intent=AUTHORIZE + 多 PU 被 PayPal 拒绝（HTTP 422）。
          本场景测试 CAPTURE 是否可行。
        </p>
        <p className="text-xs font-mono">总金额：$2,945.00（冰箱 $899 + 洗衣机 $649 + 烘干机 $599 + 洗地机 $349 + 空调 $449）</p>
      </div>

      {/* Step 1 — 创建订单 */}
      <StepCard
        number={1}
        title="Create Multi-Store Order (5 PU)"
        description="POST /v2/checkout/orders — intent=CAPTURE，5 个 purchase_unit，各自对应不同城市门店（PICKUP_IN_STORE）。"
        requestBody={PAYPAL_CREATE_PAYLOAD}
        result={steps.create}
        onExecute={handleCreate}
      />

      {/* Step 2 — 买家批准 */}
      <StepCard
        number={2}
        title="Buyer Approval (PayPal SDK v6)"
        description="买家通过 PayPal 批准付款。intent=CAPTURE 下买家批准即锁定扣款意图，下一步 capture 时正式扣款。"
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

      {/* Step 3 — Capture 全部 PU */}
      <StepCard
        number={3}
        title="Capture All Stores"
        badge={{ label: 'Capture × 5 PU', variant: 'green' }}
        description="一次调用捕获全部 5 个 PU，PayPal 同时扣款 $2,945.00。body 为空。"
        requestUrl={`POST https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId ?? '{orderId}'}/capture`}
        result={steps.capture}
        onExecute={handleCapture}
        disabled={steps.approve.status !== 'success'}
      />

      {/* Step 4 — 查询订单详情 */}
      <StepCard
        number={4}
        title="View Order Details"
        description="查看完整订单，重点关注 purchase_units[].payments.captures[0] 确认每个门店的扣款结果与地址。"
        requestUrl={`GET https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId ?? '{orderId}'}`}
        result={steps.details}
        onExecute={handleDetails}
        disabled={steps.capture.status !== 'success'}
      />

      {/* 动态研究结论 */}
      {showFailConclusion && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">📌 研究结论：Step 1 失败</p>
          <p>
            PayPal 拒绝了此请求，错误详见 Step 1 响应中的 JSON。
            若错误名为 <code className="font-mono">UNSUPPORTED_INTENT</code>，
            说明 PayPal 同样不支持 intent=CAPTURE + 多 PU 的 BOPIS 场景。
          </p>
        </div>
      )}
      {showSuccessConclusion && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="font-semibold">
            ✅ 结论：PayPal 支持 5 PU + intent=CAPTURE 多门店 BOPIS 提货
          </p>
          <p>
            5 个 Purchase Unit 各自绑定不同城市门店，一次 Capture 调用同时完成扣款。
            在 Step 4 的响应中可确认每个 PU 的 <code className="font-mono">payments.captures[0]</code> 状态。
          </p>
        </div>
      )}

    </div>
  )
}
