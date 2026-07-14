// PSP Path 各步真实 PayPal request body 模板（前端构建，所见即所发）。
// 内容与后端 psp.ts 的 build 函数一致；后端 psp.ts 仍供保留的 byok 路由使用。

export function buildPartnerReferralBody(trackingId: string, returnUrl: string) {
  return {
    tracking_id: trackingId,
    operations: [
      {
        operation: 'API_INTEGRATION',
        api_integration_preference: {
          rest_api_integration: {
            integration_method: 'PAYPAL',
            integration_type: 'THIRD_PARTY',
            third_party_details: {
              features: [
                'PAYMENT',
                'REFUND',
                'ACCESS_MERCHANT_INFORMATION',
                'DELAY_FUNDS_DISBURSEMENT',
                'UPDATE_SELLER_DISPUTE',
                'READ_SELLER_DISPUTE',
              ],
            },
          },
        },
      },
    ],
    partner_configuration_override: { return_url: returnUrl, action_renewal_url: returnUrl },
    legal_consents: [{ type: 'SHARE_DATA_CONSENT', granted: true }],
    products: ['EXPRESS_CHECKOUT'],
  }
}

export interface OrderInput {
  amount: string
  currency: string
  payeeEmail: string
  referenceId: string
  /** 不填=PayPal 默认 INSTANT（capture 即结算）；'DELAYED' 才会真正对应 referenced-payouts-items 的放款场景 */
  disbursementMode?: 'INSTANT' | 'DELAYED'
}

export function buildOrderBody(input: OrderInput) {
  return {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: input.referenceId,
        description: 'PSP Path Playground',
        amount: {
          currency_code: input.currency,
          value: input.amount,
          breakdown: {
            item_total: { currency_code: input.currency, value: input.amount },
          },
        },
        payee: { email_address: input.payeeEmail },
        ...(input.disbursementMode
          ? { payment_instruction: { disbursement_mode: input.disbursementMode } }
          : {}),
        items: [
          {
            name: 'Playground Item',
            quantity: '1',
            unit_amount: { currency_code: input.currency, value: input.amount },
          },
        ],
      },
    ],
  }
}

export function buildReferencedPayoutBody(captureId: string) {
  return { reference_type: 'TRANSACTION_ID', reference_id: captureId }
}

export function buildRefundBody() {
  return {}
}
