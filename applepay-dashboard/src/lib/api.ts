/**
 * PayPal 订单 API 门面（facade）。
 *
 * 支持两种请求模式，由 credentials store 的 apiRequestMode 控制：
 *   - direct：前端直调 PayPal REST API（绕过后端代理）
 *             Apple Pay session 活跃期间 Safari 限制只能同域请求，必须用此模式
 *   - proxy： 经由 Cloudflare Pages 后端代理（ppgms-test-github-io.pages.dev）
 *             Apple Pay session 外的场景可用，便于对比排查
 *
 * 被使用处：
 *   - src/lib/apple-pay.ts — onpaymentauthorized 回调
 *   - src/hooks/usePaymentFlow.ts — startRecurringPayment()
 */

import type { ApplePayScenario } from '@/scenarios/types'
import { useCredentialsStore, getActiveCredentials } from '@/store/credentials'
import { generatePayPalAuthAssertion } from '@/lib/auth-assertion'
import { directCreateOrder, directCaptureOrder } from '@/lib/paypal-utils'

// ── Shared types ────────────────────────────────────────────────────────────

/** 创建订单接口的响应结构，id 为 PayPal 订单号 */
export interface CreateOrderResponse {
  id: string
  status?: string
  /** MIT recurring-vault 场景下 create order 响应中直接包含交易结果 */
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{ id: string; status: string }>
      authorizations?: Array<{ id: string; status: string }>
    }
  }>
  [key: string]: unknown
}

/** 捕获订单接口的响应结构，包含支付单元及 capture/authorization 列表 */
export interface CaptureOrderResponse {
  id: string
  status: string
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{ id: string; status: string }>
      authorizations?: Array<{ id: string; status: string }>
    }
  }>
  /** one-time-vault 场景下 PayPal 会在此返回 vault ID 和 customer ID */
  payment_source?: {
    apple_pay?: {
      attributes?: {
        vault?: {
          id?: string
          status?: string
          customer?: { id?: string }
        }
      }
    }
  }
  [key: string]: unknown
}

/** 从 capture 响应中提取 vault 信息，仅 one-time-vault 场景有值 */
export function extractVaultInfo(res: CaptureOrderResponse): { vaultId: string; customerId: string } | null {
  const vault = res.payment_source?.apple_pay?.attributes?.vault
  if (!vault?.id) return null
  return { vaultId: vault.id, customerId: vault.customer?.id ?? '' }
}

// ── Proxy mode (backend at Cloudflare Pages) ────────────────────────────────

const PROXY_BASE_URL = 'https://ppgms-test-github-io.pages.dev'

type PayPalErrorBody = { error?: string; message?: string; name?: string; details?: unknown[] }

function extractPayPalError(data: PayPalErrorBody, fallback: string): string {
  return data.error ?? data.message ?? data.name ?? fallback
}

function credentialHeaders(): Record<string, string> {
  const { mode, environment, partnerMerchantId } = useCredentialsStore.getState()
  const { clientId, clientSecret } = getActiveCredentials()

  const headers: Record<string, string> = {
    'x-paypal-client-id': clientId,
    'x-paypal-client-secret': clientSecret,
    'x-paypal-environment': environment,
  }

  if (mode === 'partner' && partnerMerchantId) {
    headers['x-paypal-auth-assertion'] = generatePayPalAuthAssertion(clientId, partnerMerchantId)
  }

  return headers
}

async function proxyCreateOrder(params: {
  scenario: ApplePayScenario
  amount: string
  currencyCode?: string
  vaultId?: string
}): Promise<CreateOrderResponse> {
  const extraHeaders: Record<string, string> = {}
  if (params.scenario === 'recurring-vault') {
    const requestId = crypto.randomUUID()
    extraHeaders['x-paypal-request-id'] = requestId
    console.log('[API][proxy] PayPal-Request-Id (MIT):', requestId)
  }

  console.log('[API][proxy][1] POST create-order — headers:', JSON.stringify({ ...credentialHeaders(), ...extraHeaders }, null, 2))
  console.log('[API][proxy][2] POST create-order — body:', JSON.stringify(params, null, 2))

  const res = await fetch(`${PROXY_BASE_URL}/api/apple-pay/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...credentialHeaders(), ...extraHeaders },
    body: JSON.stringify(params),
  })
  console.log('[API][proxy][3] POST create-order — HTTP status:', res.status)

  const data = (await res.json()) as CreateOrderResponse & PayPalErrorBody
  if (!res.ok) {
    console.error('[API][proxy][4] create-order failed —', res.status, JSON.stringify(data, null, 2))
    throw new Error(extractPayPalError(data, `Create order failed: ${res.status}`))
  }
  console.log('[API][proxy][4] create-order success — orderId:', data.id, '| status:', data.status)
  return data
}

async function proxyCaptureOrder(orderId: string): Promise<CaptureOrderResponse> {
  console.log('[API][proxy][1] POST capture-order — orderId:', orderId)
  const res = await fetch(`${PROXY_BASE_URL}/api/apple-pay/capture-order/${orderId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...credentialHeaders() },
  })
  const data = (await res.json()) as CaptureOrderResponse & PayPalErrorBody
  if (!res.ok) {
    console.error('[API][proxy][2] capture-order failed —', res.status, JSON.stringify(data))
    throw new Error(extractPayPalError(data, `Capture failed: ${res.status}`))
  }
  console.log('[API][proxy][2] capture-order success — status:', data.status)
  return data
}

// ── Public facade ───────────────────────────────────────────────────────────

export async function createApplePayPayPalOrder(params: {
  scenario: ApplePayScenario
  amount: string
  currencyCode?: string
  vaultId?: string
}): Promise<CreateOrderResponse> {
  const { apiRequestMode } = useCredentialsStore.getState()
  console.log('[API] createApplePayPayPalOrder — mode:', apiRequestMode)
  return apiRequestMode === 'direct' ? directCreateOrder(params) : proxyCreateOrder(params)
}

export async function captureApplePayOrder(orderId: string): Promise<CaptureOrderResponse> {
  const { apiRequestMode } = useCredentialsStore.getState()
  console.log('[API] captureApplePayOrder — mode:', apiRequestMode)
  return apiRequestMode === 'direct' ? directCaptureOrder(orderId) : proxyCaptureOrder(orderId)
}

export function extractTransactionId(captureResult: CaptureOrderResponse): string | null {
  const unit = captureResult.purchase_units?.[0]
  const txn = unit?.payments?.captures?.[0] ?? unit?.payments?.authorizations?.[0]
  return txn?.id ?? null
}
