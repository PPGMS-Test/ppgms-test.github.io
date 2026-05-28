/**
 * scenarios/index.ts
 *
 * 作用：根据场景和 SDK 返回的配置，构建传给 ApplePaySession 的 PaymentRequest 对象。
 *       这个对象决定了 Apple Pay 原生弹窗里显示的内容（金额、支持的网络、账单字段等）。
 *       注意：这里只影响弹窗 UI，不影响后端实际创建的 Order body。
 *       Order body 在 paypal-backend-api/src/lib/apple-pay-scenarios.ts 中构建。
 *
 * 使用方：
 *   - src/lib/apple-pay.ts — createApplePaySession() 调用此函数构建 payment request
 */

import type { ApplePayScenario } from './types'
import { PAYMENT_CURRENCY } from './types'

interface BuildRequestParams {
  scenario: ApplePayScenario
  /** 支付金额，字符串格式（如 "10.00"） */
  amount: string
  /** PayPal Applepay().config() 返回的配置，包含 countryCode、supportedNetworks 等 */
  sdkConfig: PayPalApplepayConfig
}

/**
 * 构建 ApplePayPaymentRequest。
 * - one-time-basic / one-time-vault：使用基础结构，弹窗显示单次金额
 * - recurring-vault：额外加入 lineItems 和 recurringPaymentRequest，
 *   弹窗会显示订阅周期和账单协议
 */
export function buildApplePayRequest(params: BuildRequestParams): ApplePayPaymentRequest {
  const { scenario, amount, sdkConfig } = params
  const { countryCode, merchantCapabilities, supportedNetworks } = sdkConfig

  const baseRequest: ApplePayPaymentRequest = {
    countryCode,
    currencyCode: PAYMENT_CURRENCY,
    merchantCapabilities,
    supportedNetworks,
    requiredBillingContactFields: ['name', 'phone', 'email', 'postalAddress'],
    requiredShippingContactFields: ['name', 'phone', 'email', 'postalAddress'],
    total: {
      label: 'Demo (Card is not charged)',
      amount,
      type: 'final',
    },
  }

  if (scenario === 'one-time-basic') {
    return baseRequest
  } else {
    // scenario === one-time-vault：显示订阅弹窗让用户授权保存卡


    /**
     * Apple Pay 文档/Doc [2026-05]
      [1] ApplePayRecurringPaymentRequest
        https://developer.apple.com/documentation/applepayontheweb/applepayrecurringpaymentrequest

      [2] regularBilling
        https://developer.apple.com/documentation/applepayontheweb/applepayrecurringpaymentrequest/regularbilling

      [3] ApplePayLineItem（含完整示例）
        https://developer.apple.com/documentation/applepayontheweb/applepaylineitem
     */
  
    return {
      ...baseRequest,
      total: { ...baseRequest.total, paymentTiming: 'recurring' },
      lineItems: [
        {
          label: 'Recurring Subscription',
          amount,
          type: 'final',
          paymentTiming: 'recurring',
          recurringPaymentIntervalUnit: 'month',
          recurringPaymentIntervalCount: 1,
        },
      ],
      recurringPaymentRequest: {
        paymentDescription: 'Monthly subscription via Apple Pay',
        regularBilling: {
          label: 'Monthly Plan',
          amount,
          type: 'final',
          paymentTiming: 'recurring',              // Apple 要求必须设置为 'recurring'
          recurringPaymentStartDate: new Date(),
          recurringPaymentIntervalUnit: 'month',   // 正确字段名（非 calendarUnit）
          recurringPaymentIntervalCount: 1,        // 正确字段名（非 calendarUnitCount）
        },
        billingAgreement: 'You authorize recurring charges until you cancel.',
        managementURL: 'https://ppgms-test.github.io',
      },
    }
  }

  // recurring-vault：为MIT, 不需要Apple Pay Session.

}
