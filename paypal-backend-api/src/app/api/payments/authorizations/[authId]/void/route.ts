export const runtime = 'edge'
import { corsJson, corsOptions } from '@/lib/cors'
import { voidAuthorization } from '@/lib/bopis'

export function OPTIONS() { return corsOptions() }

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ authId: string }> },
) {
  const { authId } = await params
  try {
    const { data, status } = await voidAuthorization(authId)
    return corsJson(data, status)
  } catch (e) {
    return corsJson({ error: 'Failed to void authorization', detail: String(e) }, 500)
  }
}
