export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { getOrder } from '@/lib/paypal-client'

export function OPTIONS() {
  return corsOptions()
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params
  try {
    const { jsonResponse, httpStatusCode, debugId } = await getOrder(orderId)
    return corsJson(jsonResponse, httpStatusCode, debugId)
  } catch {
    return corsJson({ error: 'Failed to get order' }, 500)
  }
}
