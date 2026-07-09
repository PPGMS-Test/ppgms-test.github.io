export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { PayPalAuthError, getAccessToken, parseBasicAuth } from '@/lib/paypal-rest'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request) {
  let creds: { clientId: string; clientSecret: string }
  try {
    creds = parseBasicAuth(req)
  } catch (error) {
    if (error instanceof PayPalAuthError) return corsJson({ error: error.message }, 401)
    throw error
  }
  try {
    const accessToken = await getAccessToken(creds.clientId, creds.clientSecret)
    return corsJson({ accessToken })
  } catch (error) {
    if (error instanceof PayPalAuthError) return corsJson({ error: error.message }, 401)
    return corsJson({ error: 'Failed to issue access token' }, 500)
  }
}
