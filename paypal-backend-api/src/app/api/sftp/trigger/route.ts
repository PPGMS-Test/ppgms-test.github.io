export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { dispatchSftpWorkflow } from '@/lib/github-actions'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { action?: string; remotePath?: string }
  const { action, remotePath } = body

  if (action !== 'list' && action !== 'download') {
    return corsJson({ error: 'action must be "list" or "download"' }, 400)
  }
  if (action === 'download' && !remotePath) {
    return corsJson({ error: 'remotePath is required for download action' }, 400)
  }

  const pat = process.env.GITHUB_PAT
  if (!pat) {
    return corsJson({ error: 'GITHUB_PAT is not configured' }, 500)
  }

  const clientRequestId = crypto.randomUUID()

  try {
    await dispatchSftpWorkflow({ pat, action, remotePath, clientRequestId })
    return corsJson({ requestId: clientRequestId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to trigger sftp sync'
    return corsJson({ error: message }, 502)
  }
}
