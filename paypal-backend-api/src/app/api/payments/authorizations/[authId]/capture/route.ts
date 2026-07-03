export const runtime = 'edge'
import { corsJson, corsOptions } from '@/lib/cors'
import { captureAuthorization } from '@/lib/bopis'

export function OPTIONS() { return corsOptions() }

export async function POST(
  req: Request,
  { params }: { params: Promise<{ authId: string }> },
) {
  const { authId } = await params
  try {
    const body = await req.json().catch(() => ({})) as { amount?: string; final_capture?: boolean }
    const { data, status, debugId } = await captureAuthorization(authId, body.amount, body.final_capture)
    return corsJson(data, status, debugId)
  } catch {
    return corsJson({ error: 'Failed to capture authorization' }, 500)
  }
}
