export const runtime = 'edge'
import { corsJson, corsOptions } from '@/lib/cors'
import { authorizeOrderAmount } from '@/lib/bopis'

export function OPTIONS() { return corsOptions() }

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params
  try {
    const body = await req.json().catch(() => ({})) as { amount?: string }
    const { data, status, debugId } = await authorizeOrderAmount(orderId, body.amount)
    return corsJson(data, status, debugId)
  } catch {
    return corsJson({ error: 'Failed to authorize order' }, 500)
  }
}
