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
    const { data, status } = await authorizeOrder(orderId)
    return corsJson(data, status)
  } catch {
    return corsJson({ error: 'Failed to authorize order' }, 500)
  }
}
