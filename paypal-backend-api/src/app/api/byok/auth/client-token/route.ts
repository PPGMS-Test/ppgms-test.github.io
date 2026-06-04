export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { PayPalAuthError, getClientToken, parseBasicAuth } from '@/lib/paypal-rest'

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

  try {
    const { data, status } = await getClientToken(creds.clientId, creds.clientSecret)
    return corsJson(data, status)
  } catch (error) {
    if (error instanceof PayPalAuthError) {
      return corsJson({ error: error.message }, 401)
    }
    return corsJson({ error: 'Failed to issue client token' }, 500)
  }
}
