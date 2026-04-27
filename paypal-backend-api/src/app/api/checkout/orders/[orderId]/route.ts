import { corsJson, corsOptions } from '@/lib/cors'
import { captureOrder, getOrder } from '@/lib/paypal-client'

export function OPTIONS() {
  return corsOptions()
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params
  try {
    const { jsonResponse, httpStatusCode } = await getOrder(orderId)
    return corsJson(jsonResponse, httpStatusCode)
  } catch {
    return corsJson({ error: 'Failed to get order' }, 500)
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params
  try {
    const { jsonResponse, httpStatusCode } = await captureOrder(orderId)
    return corsJson(jsonResponse, httpStatusCode)
  } catch {
    return corsJson({ error: 'Failed to capture order' }, 500)
  }
}
