export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { createBopisOrderMultiCapture } from '@/lib/bopis'

export function OPTIONS() {
  return corsOptions()
}

export async function POST() {
  try {
    const { data, status, debugId } = await createBopisOrderMultiCapture()
    return corsJson(data, status, debugId)
  } catch {
    return corsJson({ error: 'Failed to create multi-store CAPTURE order' }, 500)
  }
}
