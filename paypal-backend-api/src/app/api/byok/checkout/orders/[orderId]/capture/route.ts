export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { PayPalAuthError, captureOrder, parseBasicAuth } from '@/lib/paypal-rest'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  let creds: { clientId: string; clientSecret: string }
  try {
    creds = parseBasicAuth(req)
  } catch (error) {
    if (error instanceof PayPalAuthError) {
      return corsJson({ error: error.message }, 401)
    }
    throw error
  }

  const { orderId } = await params

  try {
    const { data, status } = await captureOrder(creds.clientId, creds.clientSecret, orderId)
    return corsJson(data, status)
  } catch (error) {
    if (error instanceof PayPalAuthError) {
      return corsJson({ error: error.message }, 401)
    }
    return corsJson({ error: 'Failed to capture order' }, 500)
  }
}
