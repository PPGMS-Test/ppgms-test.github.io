// /api/common 通用转发的纯逻辑：把调用方给的 PayPal API path 拼成 sandbox 完整 URL，
// 并从入站请求里挑出可透传给 PayPal 的头。控制头（x-target-*）与 host 等不转发。
import { PAYPAL_SANDBOX_BASE } from './paypal-rest'

export const FORWARD_HEADERS = [
  'authorization',
  'content-type',
  'prefer',
  'paypal-partner-attribution-id',
  'paypal-auth-assertion',
  'paypal-request-id',
] as const

// 只接受以单个 / 开头、且不含协议/host 的 path，后端拼 sandbox base，防止被当开放代理(SSRF)。
export function resolveTargetUrl(targetPath: string | null): { url: string } | { error: string } {
  if (
    !targetPath ||
    !targetPath.startsWith('/') ||
    targetPath.startsWith('//') ||
    targetPath.includes('://')
  ) {
    return { error: 'x-target-path must be a sandbox API path starting with a single /' }
  }
  return { url: `${PAYPAL_SANDBOX_BASE}${targetPath}` }
}

export function pickForwardHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of FORWARD_HEADERS) {
    const v = headers.get(name)
    if (v) out[name] = v
  }
  return out
}
