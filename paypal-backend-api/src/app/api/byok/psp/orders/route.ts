export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { PayPalAuthError } from '@/lib/paypal-rest'
import { createPspOrder, parseBearerToken, type PspOrderInput } from '@/lib/psp'

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
  let input: PspOrderInput
  try {
    input = (await req.json()) as PspOrderInput
  } catch {
    return corsJson({ error: 'Request body must be valid JSON' }, 400)
  }
  if (!input.amount || !input.currency || !input.payeeEmail || !input.referenceId) {
    return corsJson({ error: 'amount, currency, payeeEmail, referenceId are required' }, 400)
  }
  const { data, status } = await createPspOrder(token, input)
  return corsJson(data, status)
}
