// Step 1 Auth 用 BYOK Basic auth 换 access_token（走保留的 byok/psp/access-token）。
// 其余步骤前端拼完整 body + headers，走通用转发路由 /api/common（x-target-path 指定 PayPal path）。
import { useCredentialsStore } from '@/store/credentials'

const PROXY_BASE = import.meta.env.VITE_PROXY_BASE || 'https://ppgms-test-github-io.pages.dev'

export interface ApiResult<T = unknown> {
  ok: boolean
  status: number
  data: T
  /** PayPal 响应的 paypal-debug-id 头，用于跟 PayPal 支持排查问题 */
  debugId?: string
}

/** Step 1：BYOK Basic auth → access_token */
export async function fetchAccessToken(): Promise<ApiResult<{ accessToken?: string; error?: string }>> {
  const auth = useCredentialsStore.getState().basicAuth()
  const res = await fetch(`${PROXY_BASE}/api/byok/psp/access-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
  })
  const data = (await res.json().catch(() => ({}))) as { accessToken?: string; error?: string }
  return { ok: res.ok, status: res.status, data }
}

export interface CommonOpts {
  method?: string
  /** 原始 JSON body 字符串（所见即所发）；无 body 的步骤省略 */
  rawBody?: string
  token: string
}

/** 通用转发：把完整请求发给 /api/common，由它转给 PayPal */
export async function callCommon(targetPath: string, opts: CommonOpts): Promise<ApiResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-target-path': targetPath,
    'x-target-method': opts.method ?? 'POST',
    Authorization: `Bearer ${opts.token}`,
    Prefer: 'return=representation',
  }

  const res = await fetch(`${PROXY_BASE}/api/common`, {
    method: 'POST',
    headers,
    ...(opts.rawBody !== undefined ? { body: opts.rawBody } : {}),
  })
  const data = await res.json().catch(() => ({}))
  const debugId = res.headers.get('x-paypal-debug-id') ?? undefined
  return { ok: res.ok, status: res.status, data, debugId }
}
