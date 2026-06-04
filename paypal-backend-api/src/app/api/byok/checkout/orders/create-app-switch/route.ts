export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { buildAppSwitchOrderBodyRest } from '@/lib/order-scenarios'
import { PayPalAuthError, createOrder, parseBasicAuth } from '@/lib/paypal-rest'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request) {
  let creds: { clientId: string; clientSecret: string }
  try {
    creds = parseBasicAuth(req)
  } catch (error) {
    if (error instanceof PayPalAuthError) {
      return corsJson({ error: error.message }, 401)
    }
    throw error
  }

  let returnUrl: string | undefined
  let cancelUrl: string | undefined
  try {
    const body = (await req.json()) as { returnUrl?: string; cancelUrl?: string }
    returnUrl = body.returnUrl
    cancelUrl = body.cancelUrl
  } catch {
    return corsJson({ error: 'Request body must be valid JSON' }, 400)
  }

  if (!returnUrl || !cancelUrl) {
    return corsJson({ error: 'returnUrl and cancelUrl are required' }, 400)
  }

  try {
    const body = buildAppSwitchOrderBodyRest(returnUrl, cancelUrl)
    const { data, status } = await createOrder(creds.clientId, creds.clientSecret, body)
    return corsJson(data, status)
  } catch (error) {
    if (error instanceof PayPalAuthError) {
      return corsJson({ error: error.message }, 401)
    }
    return corsJson({ error: 'Failed to create order' }, 500)
  }
}
