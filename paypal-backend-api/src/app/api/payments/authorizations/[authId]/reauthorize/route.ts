export const runtime = 'edge'
import { corsJson, corsOptions } from '@/lib/cors'
import { reauthorizeAuthorization } from '@/lib/bopis'

export function OPTIONS() { return corsOptions() }

export async function POST(
  req: Request,
  { params }: { params: Promise<{ authId: string }> },
) {
  const { authId } = await params
  try {
    const body = await req.json().catch(() => ({})) as { amount?: string }
    const { data, status, debugId } = await reauthorizeAuthorization(authId, body.amount)
    return corsJson(data, status, debugId)
  } catch {
    return corsJson({ error: 'Failed to reauthorize' }, 500)
  }
}
