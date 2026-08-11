export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { findRunByName } from '@/lib/github-actions'

export function OPTIONS() {
  return corsOptions()
}

export async function GET(req: Request) {
  const requestId = new URL(req.url).searchParams.get('requestId')
  if (!requestId) {
    return corsJson({ error: 'requestId query param is required' }, 400)
  }

  const pat = process.env.GITHUB_PAT
  if (!pat) {
    return corsJson({ error: 'GITHUB_PAT is not configured' }, 500)
  }

  try {
    const run = await findRunByName(pat, `sftp-sync-${requestId}`)
    if (!run) {
      return corsJson({ status: 'pending' })
    }
    return corsJson({ status: run.status, conclusion: run.conclusion })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to query sftp sync status'
    return corsJson({ error: message }, 502)
  }
}
