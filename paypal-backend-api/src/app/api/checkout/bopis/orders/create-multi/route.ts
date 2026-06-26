export const runtime = 'edge'
import { corsJson, corsOptions } from '@/lib/cors'
import { createBopisOrderMultiUnit } from '@/lib/bopis'
import type { MultiUnitParams } from '@/lib/bopis'

export function OPTIONS() { return corsOptions() }

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MultiUnitParams
    const { data, status, debugId } = await createBopisOrderMultiUnit(body)
    return corsJson(data, status, debugId)
  } catch {
    return corsJson({ error: 'Failed to create multi-unit BOPIS order' }, 500)
  }
}
