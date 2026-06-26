export const runtime = 'edge'
import { corsJson, corsOptions } from '@/lib/cors'
import { authorizeOrder } from '@/lib/bopis'

export function OPTIONS() { return corsOptions() }

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params
  try {
    const { data, status, debugId } = await authorizeOrder(orderId)
    return corsJson(data, status, debugId)
  } catch (e) {
    return corsJson({ error: 'Failed to authorize order', detail: String(e) }, 500)
  }
}
