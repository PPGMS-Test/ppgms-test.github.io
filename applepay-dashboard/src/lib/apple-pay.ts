// Apple Pay session orchestration logic
// Pure functions — no React, no side effects beyond ApplePaySession

import { createApplePayOrder, captureApplePayOrder } from '@/lib/api'
import type { ApplePayScenario } from '@/scenarios/types'
import { buildApplePayRequest } from '@/scenarios'
import type { CaptureOrderResponse } from '@/lib/api'

export interface ApplePaySessionCallbacks {
  onSuccess: (transactionId: string, captureResult: unknown) => void
  onFailure: (error: unknown) => void
  onCancel: () => void
}

export interface ApplePaySessionParams {
  scenario: ApplePayScenario
  amount: string
  vaultId?: string
  sdkConfig: PayPalApplepayConfig
}

function assertCaptureCompleted(captureResult: CaptureOrderResponse): string {
  const capture = captureResult.purchase_units?.[0]?.payments?.captures?.[0]
  if (!capture) throw new Error('Capture response missing purchase_unit/captures')
  if (capture.status !== 'COMPLETED') {
    throw new Error(`Capture not completed — PayPal status: ${capture.status}`)
  }
  return capture.id
}

export function createApplePaySession(
  params: ApplePaySessionParams,
  callbacks: ApplePaySessionCallbacks,
): ApplePaySession {
  const { scenario, amount, vaultId, sdkConfig } = params
  const { onSuccess, onFailure, onCancel } = callbacks

  const paymentRequest = buildApplePayRequest({ scenario, amount, sdkConfig })
  const session = new window.ApplePaySession(4, paymentRequest)
  const applepay = window.paypal.Applepay()

  session.onvalidatemerchant = (event) => {
    applepay
      .validateMerchant({ validationUrl: event.validationURL })
      .then((payload) => session.completeMerchantValidation(payload.merchantSession))
      .catch((err) => {
        console.error('[ApplePay] validateMerchant error', err)
        session.abort()
      })
  }

  session.onpaymentmethodselected = () => {
    session.completePaymentMethodSelection({ newTotal: paymentRequest.total })
  }

  session.onpaymentauthorized = async (event) => {
    try {
      const order = await createApplePayOrder({ scenario, amount, vaultId })
      const orderId = order.id

      await applepay.confirmOrder({
        orderId,
        token: event.payment.token,
        billingContact: event.payment.billingContact,
        shippingContact: event.payment.shippingContact,
        email: event.payment.shippingContact?.emailAddress,
      })

      const captureResult = await captureApplePayOrder(orderId)
      // Verify PayPal actually settled — HTTP 200 can still carry status DECLINED
      const captureId = assertCaptureCompleted(captureResult)

      session.completePayment({ status: window.ApplePaySession.STATUS_SUCCESS })
      onSuccess(captureId, captureResult)
    } catch (err) {
      console.error('[ApplePay] payment authorization error', err)
      session.completePayment({ status: window.ApplePaySession.STATUS_FAILURE })
      onFailure(err)
    }
  }

  session.oncancel = () => {
    console.log('[ApplePay] session cancelled')
    onCancel()
  }

  return session
}
