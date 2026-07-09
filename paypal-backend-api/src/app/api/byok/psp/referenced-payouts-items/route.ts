export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { PayPalAuthError } from '@/lib/paypal-rest'
import { createReferencedPayout, parseBearerToken } from '@/lib/psp'

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
  let captureId: string | undefined
  try {
    const body = (await req.json()) as { captureId?: string }
    captureId = body.captureId
  } catch {
    return corsJson({ error: 'Request body must be valid JSON' }, 400)
  }
  if (!captureId) return corsJson({ error: 'captureId is required' }, 400)
  const { data, status } = await createReferencedPayout(token, captureId)
  return corsJson(data, status)
}
