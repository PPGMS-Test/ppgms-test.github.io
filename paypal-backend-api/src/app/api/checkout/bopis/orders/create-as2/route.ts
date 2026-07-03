export const runtime = 'edge'
import { corsJson, corsOptions } from '@/lib/cors'
import { createBopisOrderAS2 } from '@/lib/bopis'

export function OPTIONS() { return corsOptions() }

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as { amount?: string }
    const { data, status, debugId } = await createBopisOrderAS2(body.amount ?? '200.00')
    return corsJson(data, status, debugId)
  } catch {
    return corsJson({ error: 'Failed to create AS2 order' }, 500)
  }
}
