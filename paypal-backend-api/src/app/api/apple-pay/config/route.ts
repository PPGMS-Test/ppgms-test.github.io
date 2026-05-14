export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { getSandboxCredentials } from '@/lib/credentials'

export function OPTIONS() {
  return corsOptions()
}

export async function GET() {
  const { clientId } = getSandboxCredentials()
  return corsJson({ clientId, environment: 'sandbox' })
}
