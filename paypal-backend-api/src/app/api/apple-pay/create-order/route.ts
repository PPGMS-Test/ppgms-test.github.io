export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { createApplePayOrder } from '@/lib/apple-pay-scenarios'
import type { ApplePayOrderParams } from '@/lib/apple-pay-scenarios'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request) {
  try {
    const body: ApplePayOrderParams = await req.json()
    const { scenario, amount, currencyCode, vaultId } = body

    if (!scenario || !amount) {
      return corsJson({ error: 'scenario and amount are required' }, 400)
    }

    const { jsonResponse, httpStatusCode } = await createApplePayOrder({
      scenario,
      amount,
      currencyCode,
      vaultId,
    })
    return corsJson(jsonResponse, httpStatusCode)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create Apple Pay order'
    return corsJson({ error: message }, 500)
  }
}
