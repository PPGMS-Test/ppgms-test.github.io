import { corsJson, corsOptions } from '@/lib/cors'
import { createOrder } from '@/lib/order-scenarios'
import type { OrderRequest } from '@paypal/paypal-server-sdk'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request) {
  try {
    const paypalRequestId = req.headers.get('paypal-request-id') ?? undefined
    const orderRequestBody: OrderRequest = await req.json()
    const { jsonResponse, httpStatusCode } = await createOrder({ orderRequestBody, paypalRequestId })
    return corsJson(jsonResponse, httpStatusCode)
  } catch {
    return corsJson({ error: 'Failed to create order' }, 500)
  }
}
