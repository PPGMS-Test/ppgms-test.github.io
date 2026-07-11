export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { PayPalAuthError, getAccessToken, parseBasicAuth, PAYPAL_SANDBOX_BASE } from '@/lib/paypal-rest'
import { buildReferencedPayoutsItemsBody, type ReferencedPayoutsItemsParams } from '@/lib/psp'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request) {
  // 1. 提取 Basic auth
  let creds: { clientId: string; clientSecret: string }
  try {
    creds = parseBasicAuth(req)
  } catch (error) {
    if (error instanceof PayPalAuthError) return corsJson({ error: error.message }, 401)
    throw error
  }

  // 2. 解析请求体
  let captureId: string | undefined
  let merchantId: string | undefined
  let amount: string | undefined
  let currency: string | undefined
  let disbursalDate: string | undefined
  try {
    const body = (await req.json()) as {
      captureId?: string
      merchantId?: string
      amount?: string
      currency?: string
      disbursalDate?: string
    }
    captureId = body.captureId
    merchantId = body.merchantId
    amount = body.amount
    currency = body.currency
    disbursalDate = body.disbursalDate
  } catch {
    return corsJson({ error: 'Request body must be valid JSON' }, 400)
  }

  if (!captureId || !merchantId || !amount || !currency) {
    return corsJson(
      { error: 'captureId, merchantId, amount, and currency are required' },
      400
    )
  }

  try {
    // 3. 换 access token
    const token = await getAccessToken(creds.clientId, creds.clientSecret)

    // 4. 生成 body
    const params: ReferencedPayoutsItemsParams = {
      captureId,
      merchantId,
      amount,
      currency,
      disbursalDate,
    }
    const paypalBody = buildReferencedPayoutsItemsBody(params)

    // 5. 调 PayPal API
    const response = await fetch(`${PAYPAL_SANDBOX_BASE}/v1/payments/referenced-payouts-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(paypalBody),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return corsJson({ success: false, error: data }, response.status)
    }

    return corsJson({ success: true, data }, response.status)
  } catch (error) {
    if (error instanceof PayPalAuthError) return corsJson({ error: error.message }, 401)
    return corsJson({ success: false, error: (error as Error).message }, 500)
  }
}
