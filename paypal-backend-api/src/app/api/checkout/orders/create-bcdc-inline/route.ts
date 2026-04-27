import { corsJson, corsOptions } from '@/lib/cors'
import { createOrderBCDCInline } from '@/lib/order-scenarios'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const returnUrl: string | undefined = body?.returnUrl
    const { jsonResponse, httpStatusCode } = await createOrderBCDCInline(returnUrl)
    return corsJson(jsonResponse, httpStatusCode)
  } catch {
    return corsJson({ error: 'Failed to create order' }, 500)
  }
}
