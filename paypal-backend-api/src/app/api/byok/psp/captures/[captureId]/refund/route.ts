export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { PayPalAuthError, getAccessToken, parseBasicAuth, PAYPAL_SANDBOX_BASE } from '@/lib/paypal-rest'
import { buildRefundBody, type RefundParams } from '@/lib/psp'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request, { params }: { params: Promise<{ captureId: string }> }) {
  // 1. 提取 Basic auth
  let creds: { clientId: string; clientSecret: string }
  try {
    creds = parseBasicAuth(req)
  } catch (error) {
    if (error instanceof PayPalAuthError) return corsJson({ error: error.message }, 401)
    throw error
  }

  // 2. 获取 captureId 参数
  const { captureId } = await params

  // 3. 解析请求体
  let amount: string | undefined
  let currency: string | undefined
  let reason: string | undefined
  let noteToPayer: string | undefined
  try {
    const body = (await req.json()) as {
      amount?: string
      currency?: string
      reason?: string
      noteToPayer?: string
    }
    amount = body.amount
    currency = body.currency
    reason = body.reason
    noteToPayer = body.noteToPayer
  } catch {
    return corsJson({ error: 'Request body must be valid JSON' }, 400)
  }

  try {
    // 4. 换 access token
    const token = await getAccessToken(creds.clientId, creds.clientSecret)

    // 5. 生成 body
    const refundParams: RefundParams = {
      amount,
      currency,
      reason,
      noteToPayer,
    }
    const paypalBody = buildRefundBody(refundParams)

    // 6. 调 PayPal API
    const response = await fetch(
      `${PAYPAL_SANDBOX_BASE}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(paypalBody),
      }
    )

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
