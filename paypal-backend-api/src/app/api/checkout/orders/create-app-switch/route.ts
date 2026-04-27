import { corsJson, corsOptions } from '@/lib/cors'
import { createOrderAppSwitch } from '@/lib/order-scenarios'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request) {
  try {
    const { returnUrl, cancelUrl } = await req.json()
    if (!returnUrl || !cancelUrl) {
      return corsJson({ error: 'returnUrl and cancelUrl are required' }, 400)
    }
    const { jsonResponse, httpStatusCode } = await createOrderAppSwitch(returnUrl, cancelUrl)
    return corsJson(jsonResponse, httpStatusCode)
  } catch {
    return corsJson({ error: 'Failed to create order' }, 500)
  }
}
