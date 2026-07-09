// PSP Path 专属 REST 封装。所有调用带 caller 传入的 OAuth Bearer token（来自 access-token 步骤），
// 忠实还原 Postman collection「PSP PATH Collection - HK」的请求。仅 sandbox。
import { PAYPAL_SANDBOX_BASE, PayPalAuthError, type PayPalRestResponse } from './paypal-rest'

export function parseBearerToken(req: Request): string {
  const header = req.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) throw new PayPalAuthError('Missing or malformed Authorization: Bearer header')
  return match[1].trim()
}

async function pspFetch(
  token: string,
  path: string,
  method: 'POST',
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<PayPalRestResponse> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...extraHeaders,
  }
  const res = await fetch(`${PAYPAL_SANDBOX_BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  return { data, status: res.status }
}

// ── Body 模板（取自 Postman collection）──────────────────────────────────────

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

export interface PspOrderInput {
  amount: string
  currency: string
  payeeEmail: string
  referenceId: string
  bnCode?: string
}

export function buildPspOrderBody(input: PspOrderInput) {
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

// ── 各步骤封装 ───────────────────────────────────────────────────────────────

export function createPartnerReferral(token: string, trackingId: string, returnUrl: string) {
  return pspFetch(token, '/v2/customer/partner-referrals', 'POST', buildPartnerReferralBody(trackingId, returnUrl))
}

function bnHeader(bnCode?: string): Record<string, string> {
  return bnCode ? { 'PayPal-Partner-Attribution-Id': bnCode } : {}
}

export function createPspOrder(token: string, input: PspOrderInput) {
  return pspFetch(token, '/v2/checkout/orders', 'POST', buildPspOrderBody(input), bnHeader(input.bnCode))
}

export function capturePspOrder(token: string, orderId: string, bnCode?: string) {
  return pspFetch(token, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, 'POST', undefined, bnHeader(bnCode))
}

export function createReferencedPayout(token: string, captureId: string) {
  return pspFetch(token, '/v1/payments/referenced-payouts-items', 'POST', {
    reference_type: 'TRANSACTION_ID',
    reference_id: captureId,
  })
}

export function refundCapture(token: string, captureId: string) {
  return pspFetch(token, `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, 'POST', {})
}
