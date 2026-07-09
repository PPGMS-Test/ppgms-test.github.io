export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { PayPalAuthError } from '@/lib/paypal-rest'
import { createPartnerReferral, parseBearerToken } from '@/lib/psp'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request) {
  let token: string
  try {
    token = parseBearerToken(req)
  } catch (error) {
    if (error instanceof PayPalAuthError) return corsJson({ error: error.message }, 401)
    throw error
  }
  let trackingId: string | undefined
  let returnUrl: string | undefined
  try {
    const body = (await req.json()) as { trackingId?: string; returnUrl?: string }
    trackingId = body.trackingId
    returnUrl = body.returnUrl
  } catch {
    return corsJson({ error: 'Request body must be valid JSON' }, 400)
  }
  if (!trackingId || !returnUrl) return corsJson({ error: 'trackingId and returnUrl are required' }, 400)
  const { data, status } = await createPartnerReferral(token, trackingId, returnUrl)
  return corsJson(data, status)
}
