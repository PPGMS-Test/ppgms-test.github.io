// Backend API client — communicates with Cloudflare-deployed paypal-backend-api
import type { ApplePayScenario } from '@/scenarios/types'
import { useCredentialsStore, getActiveCredentials } from '@/store/credentials'
import { generatePayPalAuthAssertion } from '@/lib/auth-assertion'

const BASE_URL = 'https://ppgms-test-github-io.pages.dev'

function credentialHeaders(): Record<string, string> {
  const { mode, environment, partnerMerchantId } = useCredentialsStore.getState()
  const { clientId, clientSecret } = getActiveCredentials()

  const headers: Record<string, string> = {
    'x-paypal-client-id': clientId,
    'x-paypal-client-secret': clientSecret,
    'x-paypal-environment': environment,
  }

  if (mode === 'partner' && partnerMerchantId) {
    headers['x-paypal-auth-assertion'] = generatePayPalAuthAssertion(clientId, partnerMerchantId)
  }

  return headers
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

type PayPalErrorBody = { error?: string; message?: string; name?: string; details?: unknown[] }

function extractPayPalError(data: PayPalErrorBody, fallback: string): string {
  return data.error ?? data.message ?? data.name ?? fallback
}

export async function createApplePayOrder(params: {
  scenario: ApplePayScenario
  amount: string
  currencyCode?: string
  vaultId?: string
}): Promise<CreateOrderResponse> {
  const res = await fetch(`${BASE_URL}/api/apple-pay/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...credentialHeaders() },
    body: JSON.stringify(params),
  })
  const data = (await res.json()) as CreateOrderResponse & PayPalErrorBody
  if (!res.ok) throw new Error(extractPayPalError(data, `Create order failed: ${res.status}`))
  return data
}

export async function captureApplePayOrder(orderId: string): Promise<CaptureOrderResponse> {
  const res = await fetch(`${BASE_URL}/api/apple-pay/capture-order/${orderId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...credentialHeaders() },
  })
  const data = (await res.json()) as CaptureOrderResponse & PayPalErrorBody
  if (!res.ok) throw new Error(extractPayPalError(data, `Capture failed: ${res.status}`))
  return data
}

export function extractTransactionId(captureResult: CaptureOrderResponse): string | null {
  const unit = captureResult.purchase_units?.[0]
  const txn = unit?.payments?.captures?.[0] ?? unit?.payments?.authorizations?.[0]
  return txn?.id ?? null
}
