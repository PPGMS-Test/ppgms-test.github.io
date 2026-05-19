export const runtime = 'edge'

import { ApiError } from '@paypal/paypal-server-sdk'
import type { CustomError } from '@paypal/paypal-server-sdk'
import { corsJson, corsOptions } from '@/lib/cors'
import { captureOrder, buildOrdersController } from '@/lib/paypal-client'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params
  try {
    const clientId = req.headers.get('x-paypal-client-id')
    const clientSecret = req.headers.get('x-paypal-client-secret')

    if (clientId && clientSecret) {
      const ctrl = buildOrdersController(clientId, clientSecret)
      try {
        const { result, statusCode } = await ctrl.captureOrder({
          id: orderId,
          prefer: 'return=minimal',
        })
        return corsJson(result, statusCode)
      } catch (error) {
        if (error instanceof ApiError) {
          return corsJson(error.result as CustomError, error.statusCode)
        }
        throw error
      }
    }

    const { jsonResponse, httpStatusCode } = await captureOrder(orderId)
    return corsJson(jsonResponse, httpStatusCode)
  } catch {
    return corsJson({ error: 'Failed to capture Apple Pay order' }, 500)
  }
}
