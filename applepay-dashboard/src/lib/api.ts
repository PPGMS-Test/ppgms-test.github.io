// Backend API client — communicates with Cloudflare-deployed paypal-backend-api
import type { ApplePayScenario } from '@/scenarios/types'

const BASE_URL = 'https://ppgms-test-github-io.pages.dev'

export interface ApplePayConfig {
  clientId: string
  environment: 'sandbox' | 'production'
}

export interface CreateOrderResponse {
  id: string
  status?: string
  [key: string]: unknown
}

export interface CaptureOrderResponse {
  id: string
  status: string
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{ id: string; status: string }>
      authorizations?: Array<{ id: string; status: string }>
    }
  }>
  [key: string]: unknown
}

export async function fetchApplePayConfig(): Promise<ApplePayConfig> {
  const res = await fetch(`${BASE_URL}/api/apple-pay/config`)
  if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`)
  return res.json() as Promise<ApplePayConfig>
}

export async function createApplePayOrder(params: {
  scenario: ApplePayScenario
  amount: string
  currencyCode?: string
  vaultId?: string
}): Promise<CreateOrderResponse> {
  const res = await fetch(`${BASE_URL}/api/apple-pay/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const data = (await res.json()) as CreateOrderResponse & { error?: string }
  if (!res.ok) throw new Error(data.error ?? `Create order failed: ${res.status}`)
  return data
}

export async function captureApplePayOrder(orderId: string): Promise<CaptureOrderResponse> {
  const res = await fetch(`${BASE_URL}/api/apple-pay/capture-order/${orderId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  const data = (await res.json()) as CaptureOrderResponse & { error?: string }
  if (!res.ok) throw new Error(data.error ?? `Capture failed: ${res.status}`)
  return data
}

export function extractTransactionId(captureResult: CaptureOrderResponse): string | null {
  const unit = captureResult.purchase_units?.[0]
  const txn =
    unit?.payments?.captures?.[0] ?? unit?.payments?.authorizations?.[0]
  return txn?.id ?? null
}
