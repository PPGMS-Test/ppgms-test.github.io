import { corsJson, corsOptions } from '@/lib/cors'
import { getBrowserSafeClientToken } from '@/lib/paypal-client'

export function OPTIONS() {
  return corsOptions()
}

export async function GET() {
  try {
    const { jsonResponse, httpStatusCode } = await getBrowserSafeClientToken()
    return corsJson(jsonResponse, httpStatusCode)
  } catch {
    return corsJson({ error: 'Failed to create client token' }, 500)
  }
}
