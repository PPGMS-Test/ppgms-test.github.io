/**
 * Apple Pay session 编排逻辑（纯函数，无 React 依赖）。
 *
 * 作用：
 *   创建并配置 ApplePaySession，将 PayPal 后端 API 与 Apple Pay 原生流程串联起来：
 *   onvalidatemerchant → PayPal validateMerchant
 *   onpaymentauthorized → createOrder → confirmOrder → captureOrder → 校验结果
 *
 * 被使用处：
 *   - src/hooks/usePaymentFlow.ts — startPayment() 调用 createApplePaySession()
 *     获得 session 实例后调用 session.begin() 触发 Apple Pay 弹窗
 *
 * 注意：不支持 recurring-vault 场景（该场景不需要 Apple Pay session，直接调后端）。
 */

import { createApplePayOrder, captureApplePayOrder } from '@/lib/api'
import type { ApplePayScenario } from '@/scenarios/types'
import { buildApplePayRequest } from '@/scenarios'
import type { CaptureOrderResponse } from '@/lib/api'

/** session 结果回调接口，由 usePaymentFlow 提供实现以更新 React 状态 */
export interface ApplePaySessionCallbacks {
  /** 支付并捕获成功时调用，返回 transactionId 和完整 captureResult */
  onSuccess: (transactionId: string, captureResult: unknown) => void
  /** 任何步骤抛错时调用（包括 validateMerchant、createOrder、captureOrder） */
  onFailure: (error: unknown) => void
  /** 用户在 Apple Pay 弹窗中点击取消时调用 */
  onCancel: () => void
}

/** 创建 session 所需的参数，由 usePaymentFlow 组装后传入 */
export interface ApplePaySessionParams {
  scenario: ApplePayScenario
  amount: string
  /** 仅 one-time-vault / recurring-vault 场景需要 */
  vaultId?: string
  /** 来自 getApplePaySDKConfig() 的 PayPal Apple Pay 配置 */
  sdkConfig: PayPalApplepayConfig
}

/**
 * 断言捕获结果已完成（status === 'COMPLETED'），并返回 capture ID。
 * PayPal 在 HTTP 200 时也可能返回 DECLINED 等失败状态，因此必须显式校验。
 */
function assertCaptureCompleted(captureResult: CaptureOrderResponse): string {
  const capture = captureResult.purchase_units?.[0]?.payments?.captures?.[0]
  if (!capture) throw new Error('Capture response missing purchase_unit/captures')
  if (capture.status !== 'COMPLETED') {
    throw new Error(`Capture not completed — PayPal status: ${capture.status}`)
  }
  return capture.id
}

/**
 * 构造并返回一个配置好所有事件回调的 ApplePaySession 实例。
 * 调用方在拿到返回值后执行 session.begin() 即可弹出 Apple Pay 支付面板。
 */
export function createApplePaySession(
  params: ApplePaySessionParams,
  callbacks: ApplePaySessionCallbacks,
): ApplePaySession {
  const { scenario, amount, vaultId, sdkConfig } = params
  const { onSuccess, onFailure, onCancel } = callbacks

  const paymentRequest = buildApplePayRequest({ scenario, amount, sdkConfig })
  console.log('[ApplePay] building payment request body:', JSON.stringify(paymentRequest,null,2))
  
  const session = new window.ApplePaySession(4, paymentRequest)
  const applepay = window.paypal.Applepay()

  console.log('[ApplePay] session created — scenario:', scenario, '| amount:', amount)

  session.onvalidatemerchant = (event) => {
    console.log('[ApplePay] onvalidatemerchant — validationURL:', event.validationURL)
    applepay
      .validateMerchant({ validationUrl: event.validationURL })
      .then((payload) => {
        const ms = payload.merchantSession as Record<string, unknown>
        const preview = { ...ms }
        if (typeof preview.signature === 'string') {
          preview.signature = `x--x${preview.signature.slice(0, 20)}...x--x`
        }
        console.log('[ApplePay] validateMerchant success — merchantSession:', JSON.stringify(preview))
        session.completeMerchantValidation(payload.merchantSession)
      })
      .catch((err) => {
        console.error('[ApplePay] validateMerchant error', err)
        session.abort()
      })
  }

  session.onpaymentmethodselected = () => {
    console.log('[ApplePay] onpaymentmethodselected — total:', JSON.stringify(paymentRequest.total))
    session.completePaymentMethodSelection({ newTotal: paymentRequest.total })
  }

  session.onpaymentauthorized = async (event) => {
    console.log('[ApplePay] onpaymentauthorized — token type:', event.payment.token?.paymentMethod?.type)
    try {
      console.log('[ApplePay] creating order — scenario:', scenario, '| amount:', amount, '| vaultId:', vaultId)
      const order = await createApplePayOrder({ scenario, amount, vaultId })
      const orderId = order.id
      console.log('[ApplePay] order created — orderId:', orderId, '| status:', order.status)

      console.log('[ApplePay] confirming order — orderId:', orderId, '| email:', event.payment.shippingContact?.emailAddress)
      await applepay.confirmOrder({
        orderId,
        token: event.payment.token,
        billingContact: event.payment.billingContact,
        shippingContact: event.payment.shippingContact,
        email: event.payment.shippingContact?.emailAddress,
      })
      console.log('[ApplePay] confirmOrder success')

      console.log('[ApplePay] capturing order — orderId:', orderId)
      const captureResult = await captureApplePayOrder(orderId)
      console.log('[ApplePay] captureOrder response:', JSON.stringify(captureResult))
      const captureId = assertCaptureCompleted(captureResult)

      session.completePayment({ status: window.ApplePaySession.STATUS_SUCCESS })
      console.log('[ApplePay] ✓ payment SUCCESS — captureId:', captureId)
      onSuccess(captureId, captureResult)
    } catch (err) {
      console.error('[ApplePay] payment authorization error', err)
      session.completePayment({ status: window.ApplePaySession.STATUS_FAILURE })
      onFailure(err)
    }
  }

  session.oncancel = () => {
    console.log('[ApplePay] session cancelled by user')
    onCancel()
  }

  return session
}
