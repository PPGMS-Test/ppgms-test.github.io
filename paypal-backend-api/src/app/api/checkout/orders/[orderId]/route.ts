export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { getOrder, patchOrder } from '@/lib/paypal-client'

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params
  try {
    const patchBody = await req.json()
    const { jsonResponse, httpStatusCode, debugId } = await patchOrder(orderId, patchBody)
    return corsJson(jsonResponse, httpStatusCode, debugId)
  } catch {
    return corsJson({ error: 'Failed to patch order' }, 500)
  }
}
