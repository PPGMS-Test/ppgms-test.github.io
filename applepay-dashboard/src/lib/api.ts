/**
 * 后端 API 客户端 — 与部署在 Cloudflare Pages 上的 paypal-backend-api 通信。
 *
 * 作用：
 *   封装所有对后端的 HTTP 请求，负责：
 *   1. 从 credentials store 读取凭据并注入请求头
 *   2. 在三方（Partner）模式下自动附加 Auth Assertion 请求头
 *   3. 统一处理错误响应，将 PayPal 错误体转换为 JS Error
 *
 * 被使用处：
 *   - src/lib/apple-pay.ts — onpaymentauthorized 回调中调用 createApplePayOrder / captureApplePayOrder
 *   - src/hooks/usePaymentFlow.ts — startRecurringPayment() 中动态 import 并调用上述两个函数
 *
 * 后端地址：https://ppgms-test-github-io.pages.dev
 */
import type { ApplePayScenario } from '@/scenarios/types'
import { useCredentialsStore, getActiveCredentials } from '@/store/credentials'
import { generatePayPalAuthAssertion } from '@/lib/auth-assertion'

/** Cloudflare Pages 后端根地址，所有 API 路径基于此拼接 */
const BASE_URL = 'https://ppgms-test-github-io.pages.dev'

/**
 * 构造每次请求都需要携带的凭据请求头。
 * 从 credentials store 读取当前环境、模式和凭据，
 * partner 模式下额外附加 PayPal-Auth-Assertion 请求头。
 */
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

/** 创建订单接口的响应结构，id 为 PayPal 订单号 */
export interface CreateOrderResponse {
  id: string
  status?: string
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
  [key: string]: unknown
}

/** PayPal 错误响应体的可能字段，用于统一提取错误信息 */
type PayPalErrorBody = { error?: string; message?: string; name?: string; details?: unknown[] }

/** 从 PayPal 错误响应体中提取可读错误信息，找不到时返回 fallback */
function extractPayPalError(data: PayPalErrorBody, fallback: string): string {
  return data.error ?? data.message ?? data.name ?? fallback
}

/**
 * 调用后端 /api/apple-pay/create-order 创建 PayPal 订单。
 * 根据 scenario 不同，后端会创建不同类型的订单（单次/vault/recurring）。
 */
export async function createApplePayOrder(params: {
  scenario: ApplePayScenario
  amount: string
  currencyCode?: string
  vaultId?: string
}): Promise<CreateOrderResponse> {
  console.log('[API] POST create-order — params:', JSON.stringify(params))
  const res = await fetch(`${BASE_URL}/api/apple-pay/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...credentialHeaders() },
    body: JSON.stringify(params),
  })
  const data = (await res.json()) as CreateOrderResponse & PayPalErrorBody
  if (!res.ok) {
    console.error('[API] create-order failed —', res.status, JSON.stringify(data))
    throw new Error(extractPayPalError(data, `Create order failed: ${res.status}`))
  }
  console.log('[API] create-order success — orderId:', data.id, '| status:', data.status)
  return data
}

/**
 * 调用后端 /api/apple-pay/capture-order/:orderId 捕获（完成结算）已授权的订单。
 * HTTP 200 但 capture.status !== 'COMPLETED' 时仍视为失败，由调用方检查。
 */
export async function captureApplePayOrder(orderId: string): Promise<CaptureOrderResponse> {
  console.log('[API] POST capture-order — orderId:', orderId)
  const res = await fetch(`${BASE_URL}/api/apple-pay/capture-order/${orderId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...credentialHeaders() },
  })
  const data = (await res.json()) as CaptureOrderResponse & PayPalErrorBody
  if (!res.ok) {
    console.error('[API] capture-order failed —', res.status, JSON.stringify(data))
    throw new Error(extractPayPalError(data, `Capture failed: ${res.status}`))
  }
  console.log('[API] capture-order success — status:', data.status)
  return data
}

/**
 * 从 capture 响应中提取第一个 capture 或 authorization 的交易 ID。
 * 成功时返回 transaction ID 字符串，找不到时返回 null。
 */
export function extractTransactionId(captureResult: CaptureOrderResponse): string | null {
  const unit = captureResult.purchase_units?.[0]
  const txn = unit?.payments?.captures?.[0] ?? unit?.payments?.authorizations?.[0]
  return txn?.id ?? null
}
