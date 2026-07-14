export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { pickForwardHeaders, resolveTargetUrl } from '@/lib/common-forward'

export function OPTIONS() {
  return corsOptions()
}

// PayPal-Auth-Assertion 是 base64({"alg":"none"}).base64({"iss":clientId,"payer_id":payerId}). 无签名，
// 本地调试时把它解出来打印，方便直接看到实际发出去的 iss/payer_id 是不是预期值。
function decodeAuthAssertion(value: string): unknown {
  try {
    const payloadB64 = value.split('.')[1]
    return JSON.parse(atob(payloadB64))
  } catch {
    return { error: 'failed to decode auth-assertion payload' }
  }
}

// 通用转发：x-target-path 指定 PayPal API path（只限 sandbox），x-target-method 指定方法（默认 POST），
// 请求 body 原样转发，白名单头透传，PayPal 响应原样返回。
export async function POST(req: Request) {
  const resolved = resolveTargetUrl(req.headers.get('x-target-path'))
  if ('error' in resolved) {
    console.error('[api/common] bad x-target-path:', resolved.error)
    return corsJson({ error: resolved.error }, 400)
  }

  const method = (req.headers.get('x-target-method') ?? 'POST').toUpperCase()
  const headers = pickForwardHeaders(req.headers)
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const rawBody = hasBody ? await req.text() : undefined

  console.log(`[api/common] → ${method} ${resolved.url}`)
  console.log('[api/common] → headers:', JSON.stringify(headers, null, 2))
  if (headers['paypal-auth-assertion']) {
    console.log(
      '[api/common] → auth-assertion decoded:',
      JSON.stringify(decodeAuthAssertion(headers['paypal-auth-assertion'])),
    )
  }
  if (rawBody) {
    console.log('[api/common] → body:', rawBody)
  }

  try {
    const res = await fetch(resolved.url, {
      method,
      headers,
      ...(rawBody ? { body: rawBody } : {}),
    })
    const data = await res.json().catch(() => ({}))
    console.log(`[api/common] ← status ${res.status}`)
    console.log('[api/common] ← body:', JSON.stringify(data, null, 2))
    return corsJson(data, res.status)
  } catch (error) {
    console.error('[api/common] fetch to PayPal failed:', error)
    return corsJson({ error: 'Failed to forward request to PayPal' }, 502)
  }
}
