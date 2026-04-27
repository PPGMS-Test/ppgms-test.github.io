import { corsJson, corsOptions } from '@/lib/cors'
import { createOrderWithSampleData } from '@/lib/order-scenarios'

export function OPTIONS() {
  return corsOptions()
}

export async function POST() {
  try {
    const { jsonResponse, httpStatusCode } = await createOrderWithSampleData()
    return corsJson(jsonResponse, httpStatusCode)
  } catch {
    return corsJson({ error: 'Failed to create order' }, 500)
  }
}
