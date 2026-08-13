export const runtime = 'edge'

import { CORS_HEADERS, corsJson, corsOptions } from '@/lib/cors'
import { fetchBranchFile, isSafeSegment } from '@/lib/github-contents'

export function OPTIONS() {
  return corsOptions()
}

// 读取 sftp-data 分支里某凭证目录下的单个文件（listing.json 或某个 CSV）。
// 走 GitHub Contents API（强一致），替代 raw.githubusercontent.com，消除同步后首读的传播延迟。
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const credentialId = params.get('credentialId')
  const fileName = params.get('fileName')

  if (!credentialId || !fileName) {
    return corsJson({ error: 'credentialId and fileName are required' }, 400)
  }
  if (!isSafeSegment(credentialId) || !isSafeSegment(fileName)) {
    return corsJson({ error: 'invalid credentialId or fileName' }, 400)
  }

  const pat = process.env.GITHUB_PAT
  if (!pat) {
    return corsJson({ error: 'GITHUB_PAT is not configured' }, 500)
  }

  try {
    const result = await fetchBranchFile(pat, credentialId, fileName)
    if (!result.ok) {
      return corsJson({ error: 'file not found' }, result.status)
    }
    return new Response(result.content, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch file'
    return corsJson({ error: message }, 502)
  }
}
