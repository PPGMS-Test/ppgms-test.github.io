export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { PayPalAuthError, getAccessToken, parseBasicAuth, PAYPAL_SANDBOX_BASE } from '@/lib/paypal-rest'
import { buildPartnerReferralBody } from '@/lib/psp'

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
  let trackingId: string | undefined
  let returnUrl: string | undefined
  try {
    const body = (await req.json()) as { trackingId?: string; returnUrl?: string }
    trackingId = body.trackingId
    returnUrl = body.returnUrl
  } catch {
    return corsJson({ error: 'Request body must be valid JSON' }, 400)
  }

  if (!trackingId || !returnUrl) {
    return corsJson({ error: 'trackingId and returnUrl are required' }, 400)
  }

  try {
    // 3. 换 access token
    const token = await getAccessToken(creds.clientId, creds.clientSecret)

    // 4. 生成 body
    const paypalBody = buildPartnerReferralBody(trackingId, returnUrl)

    // 5. 调 PayPal API
    const response = await fetch(`${PAYPAL_SANDBOX_BASE}/v2/customer/partner-referrals`, {
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
