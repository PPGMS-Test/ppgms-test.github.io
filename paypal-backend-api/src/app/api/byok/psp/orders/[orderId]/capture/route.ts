export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { PayPalAuthError } from '@/lib/paypal-rest'
import { capturePspOrder, parseBearerToken } from '@/lib/psp'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  let token: string
  try {
    token = parseBearerToken(req)
  } catch (error) {
    if (error instanceof PayPalAuthError) return corsJson({ error: error.message }, 401)
    throw error
  }
  const { orderId } = await params
  const bnCode = req.headers.get('x-paypal-bn-code') ?? undefined
  const { data, status } = await capturePspOrder(token, orderId, bnCode)
  return corsJson(data, status)
}
