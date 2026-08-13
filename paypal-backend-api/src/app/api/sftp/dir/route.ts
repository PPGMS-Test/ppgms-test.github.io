export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { isSafeSegment, listBranchDir } from '@/lib/github-contents'

export function OPTIONS() {
  return corsOptions()
}

// 列出某凭证已下载到 sftp-data 分支的文件名（排除 listing.json），供前端标「已缓存/可秒开」蓝点。
export async function GET(req: Request) {
  const credentialId = new URL(req.url).searchParams.get('credentialId')

  if (!credentialId) {
    return corsJson({ error: 'credentialId is required' }, 400)
  }
  if (!isSafeSegment(credentialId)) {
    return corsJson({ error: 'invalid credentialId' }, 400)
  }

  const pat = process.env.GITHUB_PAT
  if (!pat) {
    return corsJson({ error: 'GITHUB_PAT is not configured' }, 500)
  }

  try {
    const files = await listBranchDir(pat, credentialId)
    return corsJson({ files })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list cached files'
    return corsJson({ error: message }, 502)
  }
}
