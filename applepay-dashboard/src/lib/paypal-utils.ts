/**
 * PayPal REST API 直连工具（前端直调，绕过后端代理）。
 *
 * 背景：Apple Pay session 活跃期间，Safari 限制只能向当前页面同域发起请求。
 * 测试站部署在 ppgms-test.github.io，后端在 ppgms-test-github-io.pages.dev，
 * 跨域 fetch 在 onpaymentauthorized 里会被直接 block，因此改为前端直调 PayPal API。
 *
 * 被使用处：
 *   - src/lib/api.ts — createApplePayPayPalOrder / captureApplePayOrder 的底层实现
 */

import { getActiveCredentials, useCredentialsStore } from '@/store/credentials'
import { generatePayPalAuthAssertion } from '@/lib/auth-assertion'
import type { ApplePayScenario } from '@/scenarios/types'
import type { CreateOrderResponse, CaptureOrderResponse } from '@/lib/api'

const PAYPAL_API_BASE: Record<string, string> = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  production: 'https://api-m.paypal.com',
}

// ── Access token cache ──────────────────────────────────────────────────────
// 30s 缓冲确保 token 在使用前不会刚好过期

interface TokenCache {
  token: string
  expiresAt: number
  environment: string
  clientId: string
}

let tokenCache: TokenCache | null = null

async function getAccessToken(): Promise<string> {
  const { environment } = useCredentialsStore.getState()
  const { clientId, clientSecret } = getActiveCredentials()
  const now = Date.now()

  if (
    tokenCache &&
    tokenCache.environment === environment &&
    tokenCache.clientId === clientId &&
    tokenCache.expiresAt > now + 30_000
  ) {
    console.log('[PayPal] access token (cached)')
    return tokenCache.token
  }

  console.log('[PayPal] fetching new access token — env:', environment)
  const base = PAYPAL_API_BASE[environment] ?? PAYPAL_API_BASE.sandbox
  const credentials = btoa(`${clientId}:${clientSecret}`)

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  const data = await res.json() as { access_token: string; expires_in: number; error_description?: string }
  if (!res.ok) throw new Error(`PayPal auth failed: ${data.error_description ?? res.status}`)

  tokenCache = { token: data.access_token, expiresAt: now + data.expires_in * 1000, environment, clientId }
  console.log('[PayPal] access token obtained ✓ (expires in', data.expires_in, 's)')
  return tokenCache.token
}

// ── Auth headers builder ────────────────────────────────────────────────────

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const { mode, partnerMerchantId } = useCredentialsStore.getState()
  const { clientId } = getActiveCredentials()
  const token = await getAccessToken()

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  }

  if (mode === 'partner' && partnerMerchantId) {
    headers['PayPal-Auth-Assertion'] = generatePayPalAuthAssertion(clientId, partnerMerchantId)
  }

  return headers
}

// ── Order request body builder ──────────────────────────────────────────────
// 镜像后端 paypal-backend-api/src/lib/apple-pay-scenarios.ts 的逻辑

function buildOrderBody(params: {
  scenario: ApplePayScenario
  amount: string
  currencyCode?: string
  vaultId?: string
}): Record<string, unknown> {
  const { scenario, amount, currencyCode = 'USD', vaultId } = params

  const base = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        description: 'Apple Pay Test Purchase',
        amount: { currency_code: currencyCode, value: amount },
      },
    ],
  }

  if (scenario === 'one-time-basic') {
    return {
      ...base,
      payment_source: {
        apple_pay: {
          experience_context: {
            return_url: 'https://ppgms-test.github.io',
            cancel_url: 'https://ppgms-test.github.io',
          },
        },
      },
    }
  }

  if (scenario === 'one-time-vault') {
    return {
      ...base,
      payment_source: {
        apple_pay: {
          attributes: {
            vault: { store_in_vault: 'ON_SUCCESS' },
            stored_credential: {
              payment_initiator: 'MERCHANT',
              payment_type: 'RECURRING',
              usage: 'SUBSEQUENT',
            },
          },
        },
      },
    }
  }

  // recurring-vault (MIT)
  if (!vaultId) throw new Error('vaultId is required for recurring-vault scenario')
  return {
    ...base,
    payment_source: {
      apple_pay: {
        vault_id: vaultId,
        stored_credential: {
          payment_initiator: 'MERCHANT',
          payment_type: 'RECURRING',
          usage: 'SUBSEQUENT',
        },
      },
    },
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function directCreateOrder(params: {
  scenario: ApplePayScenario
  amount: string
  currencyCode?: string
  vaultId?: string
}): Promise<CreateOrderResponse> {
  const { environment } = useCredentialsStore.getState()
  const base = PAYPAL_API_BASE[environment] ?? PAYPAL_API_BASE.sandbox
  const headers = await buildAuthHeaders()
  const body = buildOrderBody(params)

  console.log('[PayPal] POST /v2/checkout/orders — body:', JSON.stringify(body, null, 2))
  const res = await fetch(`${base}/v2/checkout/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const data = await res.json() as CreateOrderResponse & { message?: string; name?: string }
  console.log('[PayPal] POST /v2/checkout/orders — response:', JSON.stringify(data, null, 2))
  
  if (!res.ok) throw new Error(data.message ?? data.name ?? `Create order failed: ${res.status}`)
  return data
}

export async function directCaptureOrder(orderId: string): Promise<CaptureOrderResponse> {
  const { environment } = useCredentialsStore.getState()
  const base = PAYPAL_API_BASE[environment] ?? PAYPAL_API_BASE.sandbox
  const headers = await buildAuthHeaders()

  console.log('[PayPal] POST /v2/checkout/orders/:id/capture — orderId:', orderId)
  const res = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers,
  })

  const data = await res.json() as CaptureOrderResponse & { message?: string; name?: string }
  if (!res.ok) throw new Error(data.message ?? data.name ?? `Capture failed: ${res.status}`)
  return data
}
