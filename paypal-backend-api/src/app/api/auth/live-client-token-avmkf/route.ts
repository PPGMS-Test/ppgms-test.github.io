import { corsJson, corsOptions } from '@/lib/cors'
import { getLiveBrowserSafeClientToken } from '@/lib/paypal-client'
import { getLiveAvmkfCredentials } from '@/lib/credentials'

export function OPTIONS() {
  return corsOptions()
}

export async function GET() {
  const { clientId, clientSecret } = getLiveAvmkfCredentials()
  try {
    const { jsonResponse, httpStatusCode } = await getLiveBrowserSafeClientToken(clientId, clientSecret)
    return corsJson(jsonResponse, httpStatusCode)
  } catch {
    return corsJson({ error: 'Failed to create live client token' }, 500)
  }
}
