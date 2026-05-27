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

import { createApplePayPayPalOrder, captureApplePayOrder } from '@/lib/api'
import type { ApplePayScenario } from '@/scenarios/types'
import { buildApplePayRequest } from '@/scenarios'
import type { CaptureOrderResponse } from '@/lib/api'
import { useCredentialsStore } from '@/store/credentials'

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

/** 截断 merchantSession 中过长的 signature，仅保留前 20 字符作参考 */
function previewMerchantSession(ms: unknown): unknown {
  if (!ms || typeof ms !== 'object') return ms
  const preview = { ...(ms as Record<string, unknown>) }
  if (typeof preview.signature === 'string') {
    preview.signature = `x--x${preview.signature.slice(0, 20)}...x--x`
  }
  return preview
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
        console.log('[ApplePay] validateMerchant success — merchantSession:', JSON.stringify(previewMerchantSession(payload.merchantSession)))
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

  // 注意：此处故意使用普通函数而非 async 函数。
  // async handler 会返回一个 Promise，Safari 可能追踪该 Promise 并在其 resolve 前
  // 维持 session 的跨域限制。普通函数同步返回后限制立即解除，post-session 模式依赖此行为。
  session.onpaymentauthorized = (event) => {
    console.log('[ApplePay](onpaymentauthorized) — event:', JSON.stringify(event, null, 2))

    const { apiRequestMode, proxyPostSession } = useCredentialsStore.getState()
    const isPostSession = apiRequestMode === 'proxy' && proxyPostSession

    if (isPostSession) {
      // ── Post-session 模式 ──────────────────────────────────────────────
      // 1. completePayment → Apple Pay 面板关闭
      // 2. 同步 return，handler 完全退出（无悬挂 Promise），Safari 解除跨域限制
      // 3. setTimeout 里的 async IIFE 在新的 macrotask 中执行后端请求
      const savedPayment = event.payment
      console.log('[ApplePay][post-session] completing session synchronously, API calls in next macrotask')
      session.completePayment({ status: window.ApplePaySession.STATUS_SUCCESS })

      setTimeout(() => {
        ;(async () => {
          try {
            console.log('[ApplePay][post-session] creating order — scenario:', scenario, '| amount:', amount, '| vaultId:', vaultId)
            const order = await createApplePayPayPalOrder({ scenario, amount, vaultId })
            const orderId = order.id
            console.log('[ApplePay][post-session] order created — orderId:', orderId, '| status:', order.status)

            console.log('[ApplePay][post-session] confirming order — orderId:', orderId)
            await applepay.confirmOrder({
              orderId,
              token: savedPayment.token,
              billingContact: savedPayment.billingContact,
              shippingContact: savedPayment.shippingContact,
              email: savedPayment.shippingContact?.emailAddress,
            })
            console.log('[ApplePay][post-session] confirmOrder success')

            console.log('[ApplePay][post-session] capturing order — orderId:', orderId)
            const captureResult = await captureApplePayOrder(orderId)
            console.log('[ApplePay][post-session] captureOrder response:', JSON.stringify(captureResult))
            const captureId = assertCaptureCompleted(captureResult)

            console.log('[ApplePay][post-session] ✓ payment SUCCESS — captureId:', captureId)
            onSuccess(captureId, captureResult)
          } catch (err) {
            console.error('[ApplePay][post-session] payment failed after session closed', err)
            onFailure(err)
          }
        })()
      }, 0)

      return  // 同步退出，handler 无悬挂 Promise
    }

    // ── 标准模式 ──────────────────────────────────────────────────────
    // 用内部 async IIFE 处理，handler 本身不是 async，不向 Safari 暴露 Promise。
    ;(async () => {
      try {
        console.log('[ApplePay](creating PayPal order) — scenario:', scenario, '| amount:', amount, '| vaultId:', vaultId)
        const order = await createApplePayPayPalOrder({ scenario, amount, vaultId })
        const orderId = order.id
        console.log('[ApplePay](order created) — orderId:', orderId, '| status:', order.status)

        console.log('[ApplePay](confirming order) — orderId:', orderId, '| email:', event.payment.shippingContact?.emailAddress)
        await applepay.confirmOrder({
          orderId,
          token: event.payment.token,
          billingContact: event.payment.billingContact,
          shippingContact: event.payment.shippingContact,
          email: event.payment.shippingContact?.emailAddress,
        })
        console.log('[ApplePay] confirmOrder success')

        console.log('[ApplePay](capturing order) — orderId:', orderId)
        const captureResult = await captureApplePayOrder(orderId)
        console.log('[ApplePay](captureOrder) response:', JSON.stringify(captureResult,null,2))
        const captureId = assertCaptureCompleted(captureResult)

        session.completePayment({ status: window.ApplePaySession.STATUS_SUCCESS })
        console.log('[ApplePay] ✓ payment SUCCESS — captureId:', captureId)
        onSuccess(captureId, captureResult)
      } catch (err) {
        console.error('[ApplePay] payment authorization error', err)
        session.completePayment({ status: window.ApplePaySession.STATUS_FAILURE })
        onFailure(err)
      }
    })()
  }

  session.oncancel = () => {
    console.log('[ApplePay] session cancelled by user')
    onCancel()
  }

  return session
}
