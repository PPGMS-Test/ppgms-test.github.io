/**
 * PayPal 订单 API 门面（facade）。
 *
 * 作用：
 *   对外暴露 createApplePayPayPalOrder / captureApplePayOrder 两个函数，
 *   底层实现委托给 paypal-utils.ts 直接调用 PayPal REST API。
 *
 *   绕过后端代理的原因：Apple Pay session 活跃期间，Safari 只允许向当前页面
 *   同域（ppgms-test.github.io）发起请求，跨域调 Cloudflare Pages 后端会被 block。
 *
 * 被使用处：
 *   - src/lib/apple-pay.ts — onpaymentauthorized 回调中调用 createApplePayPayPalOrder / captureApplePayOrder
 *   - src/hooks/usePaymentFlow.ts — startRecurringPayment() 中动态 import 并调用上述两个函数
 */

import type { ApplePayScenario } from '@/scenarios/types'
import { directCreateOrder, directCaptureOrder } from '@/lib/paypal-utils'

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

/**
 * 创建 Apple Pay 专用的 PayPal 订单。
 * 根据 scenario 构造不同的 payment_source.apple_pay 配置。
 */
export async function createApplePayPayPalOrder(params: {
  scenario: ApplePayScenario
  amount: string
  currencyCode?: string
  vaultId?: string
}): Promise<CreateOrderResponse> {
  console.log('[API] createApplePayPayPalOrder — params:', JSON.stringify(params))
  const result = await directCreateOrder(params)
  console.log('[API] createApplePayPayPalOrder — orderId:', result.id, '| status:', result.status)
  return result
}

/**
 * 捕获（完成结算）已通过 Apple Pay 授权的 PayPal 订单。
 * HTTP 200 但 capture.status !== 'COMPLETED' 时仍视为失败，由调用方检查。
 */
export async function captureApplePayOrder(orderId: string): Promise<CaptureOrderResponse> {
  console.log('[API] captureApplePayOrder — orderId:', orderId)
  const result = await directCaptureOrder(orderId)
  console.log('[API] captureApplePayOrder — status:', result.status)
  return result
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
