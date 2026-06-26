export const runtime = 'edge'
import { corsJson, corsOptions } from '@/lib/cors'
import { createBopisOrder } from '@/lib/bopis'
import type { CreateBopisOrderParams } from '@/lib/bopis'

export function OPTIONS() { return corsOptions() }

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateBopisOrderParams
    const { data, status, debugId } = await createBopisOrder(body)
    return corsJson(data, status, debugId)
  } catch {
    return corsJson({ error: 'Failed to create BOPIS order' }, 500)
  }
}
