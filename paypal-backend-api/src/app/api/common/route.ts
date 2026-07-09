export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { pickForwardHeaders, resolveTargetUrl } from '@/lib/common-forward'

export function OPTIONS() {
  return corsOptions()
}

// 通用转发：x-target-path 指定 PayPal API path（只限 sandbox），x-target-method 指定方法（默认 POST），
// 请求 body 原样转发，白名单头透传，PayPal 响应原样返回。
export async function POST(req: Request) {
  const resolved = resolveTargetUrl(req.headers.get('x-target-path'))
  if ('error' in resolved) {
    return corsJson({ error: resolved.error }, 400)
  }

  const method = (req.headers.get('x-target-method') ?? 'POST').toUpperCase()
  const headers = pickForwardHeaders(req.headers)
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const rawBody = hasBody ? await req.text() : undefined

  try {
    const res = await fetch(resolved.url, {
      method,
      headers,
      ...(rawBody ? { body: rawBody } : {}),
    })
    const data = await res.json().catch(() => ({}))
    return corsJson(data, res.status)
  } catch {
    return corsJson({ error: 'Failed to forward request to PayPal' }, 502)
  }
}
