// 调 paypal-backend-api 的 PSP 路由。第 1 步用 Basic auth 换 access_token；
// 后续步骤带 Bearer access_token。代理地址由 VITE_PROXY_BASE 决定，默认本地后端端口 30041。
import { useCredentialsStore } from '@/store/credentials'

const PROXY_BASE = import.meta.env.VITE_PROXY_BASE ?? 'http://localhost:30041'

export interface ApiResult<T = unknown> {
  ok: boolean
  status: number
  data: T
}

async function postJson<T>(path: string, headers: Record<string, string>, body?: unknown): Promise<ApiResult<T>> {
  const res = await fetch(`${PROXY_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const data = (await res.json().catch(() => ({}))) as T
  return { ok: res.ok, status: res.status, data }
}

/** 第 1 步：BYOK Basic auth → access_token */
export function fetchAccessToken() {
  const auth = useCredentialsStore.getState().basicAuth()
  return postJson<{ accessToken?: string; error?: string }>('/api/byok/psp/access-token', {
    Authorization: `Basic ${auth}`,
  })
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export function createPartnerReferral(token: string, trackingId: string, returnUrl: string) {
  return postJson('/api/byok/psp/partner-referrals', bearer(token), { trackingId, returnUrl })
}

export function createOrder(
  token: string,
  input: { amount: string; currency: string; payeeEmail: string; referenceId: string },
) {
  const bnCode = useCredentialsStore.getState().bnCode
  return postJson('/api/byok/psp/orders', bearer(token), { ...input, bnCode })
}

export function captureOrder(token: string, orderId: string) {
  const bnCode = useCredentialsStore.getState().bnCode
  return postJson(`/api/byok/psp/orders/${encodeURIComponent(orderId)}/capture`, {
    ...bearer(token),
    'x-paypal-bn-code': bnCode,
  })
}

export function disburse(token: string, captureId: string) {
  return postJson('/api/byok/psp/referenced-payouts-items', bearer(token), { captureId })
}

export function refund(token: string, captureId: string) {
  return postJson(`/api/byok/psp/captures/${encodeURIComponent(captureId)}/refund`, bearer(token))
}
