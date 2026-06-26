import type { StoreAddress } from '@/types'

const BASE = 'https://ppgms-test-github-io.pages.dev'

async function req(
  path: string,
  init?: RequestInit,
): Promise<{ data: unknown; status: number; debugId?: string }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  const data = await res.json().catch(() => ({ _raw: `${res.status} ${res.statusText}` }))
  const debugId = res.headers.get('x-paypal-debug-id') ?? undefined
  return { data, status: res.status, debugId }
}

export async function createBopisOrder(params: {
  amount: string
  storeName: string
  storeAddress: StoreAddress
  pickupCode: string
}) {
  return req('/api/checkout/bopis/orders/create', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function createBopisOrderMultiUnit(params: {
  units: Array<{
    amount: string
    storeName: string
    storeAddress: StoreAddress
    referenceId: string
  }>
}) {
  return req('/api/checkout/bopis/orders/create-multi', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function authorizeOrder(orderId: string) {
  return req(`/api/checkout/orders/${orderId}/authorize`, { method: 'POST' })
}

export async function captureAuthorization(authId: string, amount?: string) {
  return req(`/api/payments/authorizations/${authId}/capture`, {
    method: 'POST',
    body: JSON.stringify(amount ? { amount } : {}),
  })
}

export async function voidAuthorization(authId: string) {
  return req(`/api/payments/authorizations/${authId}/void`, { method: 'POST' })
}

export async function getOrder(orderId: string) {
  return req(`/api/checkout/orders/${orderId}`, { method: 'GET' })
}

export async function getSandboxClientToken(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/sandbox-client-token`, {
    headers: { 'Content-Type': 'application/json' },
  })
  const data = (await res.json()) as { accessToken?: string }
  if (!data.accessToken) throw new Error('Failed to get client token')
  return data.accessToken
}
