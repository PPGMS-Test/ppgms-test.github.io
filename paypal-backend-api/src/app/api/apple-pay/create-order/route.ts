export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { createApplePayPayPalOrder } from '@/lib/apple-pay-scenarios'
import { buildOrdersController } from '@/lib/paypal-client'
import type { ApplePayOrderParams } from '@/lib/apple-pay-scenarios'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request) {
  try {
    const body: Omit<ApplePayOrderParams, 'controller'> = await req.json()
    const { scenario, amount, currencyCode, vaultId } = body

    if (!scenario || !amount) {
      return corsJson({ error: 'scenario and amount are required' }, 400)
    }

    const clientId = req.headers.get('x-paypal-client-id')
    const clientSecret = req.headers.get('x-paypal-client-secret')
    const environment = req.headers.get('x-paypal-environment')
    const paypalAuthAssertion = req.headers.get('x-paypal-auth-assertion') ?? undefined
    const controller = buildOrdersController(clientId, clientSecret, environment)

    const { jsonResponse, httpStatusCode } = await createApplePayPayPalOrder({
      scenario,
      amount,
      currencyCode,
      vaultId,
      controller,
      paypalAuthAssertion,
    })
    return corsJson(jsonResponse, httpStatusCode)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create Apple Pay order'
    return corsJson({ error: message }, 500)
  }
}
