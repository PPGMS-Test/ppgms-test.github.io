export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { PayPalAuthError } from '@/lib/paypal-rest'
import { parseBearerToken, refundCapture } from '@/lib/psp'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request, { params }: { params: Promise<{ captureId: string }> }) {
  let token: string
  try {
    token = parseBearerToken(req)
  } catch (error) {
    if (error instanceof PayPalAuthError) return corsJson({ error: error.message }, 401)
    throw error
  }
  const { captureId } = await params
  const { data, status } = await refundCapture(token, captureId)
  return corsJson(data, status)
}
