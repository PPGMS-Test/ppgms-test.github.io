import { getSandboxCredentials } from './credentials'
import { PayPalRestResponse } from './paypal-rest'

const BASE = 'https://api-m.sandbox.paypal.com'

const EXPERIENCE_CONTEXT = {
  shipping_preference: 'SET_PROVIDED_ADDRESS',
  return_url: 'https://ppgms-test-github-io.pages.dev/bopis/return',
  cancel_url: 'https://ppgms-test-github-io.pages.dev/bopis/cancel',
}

async function getSandboxToken(): Promise<string> {
  const { clientId, clientSecret } = getSandboxCredentials()
  const auth = btoa(`${clientId}:${clientSecret}`)
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string }
  if (!res.ok || !data.access_token) {
    const detail = data.error_description ?? data.error ?? `status ${res.status}`
    throw new Error(`OAuth failed: ${detail}`)
  }
  return data.access_token
}

async function postOrder(token: string, payload: unknown): Promise<PayPalRestResponse> {
  const res = await fetch(`${BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  const debugId = res.headers.get('paypal-debug-id') ?? undefined
  return { data, status: res.status, debugId }
}

export interface StoreAddress {
  address_line_1: string
  admin_area_2: string
  admin_area_1: string
  postal_code: string
  country_code: string
}

export interface CreateBopisOrderParams {
  amount: string
  storeName: string
  storeAddress: StoreAddress
  pickupCode: string
}

export interface MultiUnitParams {
  units: Array<{
    amount: string
    storeName: string
    storeAddress: StoreAddress
    referenceId: string
  }>
}

export async function createBopisOrder(p: CreateBopisOrderParams): Promise<PayPalRestResponse> {
  const token = await getSandboxToken()
  const payload = {
    intent: 'AUTHORIZE',
    purchase_units: [
      {
        amount: { currency_code: 'USD', value: p.amount },
        shipping: {
          type: 'PICKUP_IN_STORE',
          name: { full_name: p.storeName },
          address: p.storeAddress,
          phone_number: { national_number: '4085551234' },
        },
        custom_id: `PICKUP-${p.pickupCode}`,
        description: `Pickup at ${p.storeName}`,
      },
    ],
    payment_source: {
      paypal: {
        experience_context: EXPERIENCE_CONTEXT,
      },
    },
  }
  return postOrder(token, payload)
}

export async function createBopisOrderMultiUnit(p: MultiUnitParams): Promise<PayPalRestResponse> {
  const token = await getSandboxToken()
  const payload = {
    intent: 'AUTHORIZE',
    purchase_units: p.units.map((u) => ({
      reference_id: u.referenceId,
      amount: { currency_code: 'USD', value: u.amount },
      shipping: {
        type: 'PICKUP_IN_STORE',
        name: { full_name: u.storeName },
        address: u.storeAddress,
        phone_number: { national_number: '4085551234' },
      },
      description: `Pickup at ${u.storeName}`,
    })),
    payment_source: {
      paypal: {
        experience_context: EXPERIENCE_CONTEXT,
      },
    },
  }
  return postOrder(token, payload)
}

export async function authorizeOrder(orderId: string): Promise<PayPalRestResponse> {
  const token = await getSandboxToken()
  const res = await fetch(
    `${BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
  )
  const data = await res.json().catch(() => ({}))
  const debugId = res.headers.get('paypal-debug-id') ?? undefined
  return { data, status: res.status, debugId }
}

export async function captureAuthorization(authId: string, amount?: string): Promise<PayPalRestResponse> {
  const token = await getSandboxToken()
  const body = amount ? { amount: { currency_code: 'USD', value: amount } } : {}
  const res = await fetch(
    `${BASE}/v2/payments/authorizations/${encodeURIComponent(authId)}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `${authId}-cap-${Date.now()}`,
      },
      body: JSON.stringify(body),
    },
  )
  const data = await res.json().catch(() => ({}))
  const debugId = res.headers.get('paypal-debug-id') ?? undefined
  return { data, status: res.status, debugId }
}

export async function voidAuthorization(authId: string): Promise<PayPalRestResponse> {
  const token = await getSandboxToken()
  const res = await fetch(
    `${BASE}/v2/payments/authorizations/${encodeURIComponent(authId)}/void`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
  )
  const debugId = res.headers.get('paypal-debug-id') ?? undefined
  // PayPal returns 204 No Content on success; remap to 200 so our backend
  // can include a JSON body without violating HTTP 204 no-body rule.
  if (res.status === 204) return { data: { status: 'VOIDED' }, status: 200, debugId }
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  return { data, status: res.status, debugId }
}

// ── 多门店 CAPTURE 订单（5 PU）Multi-store CAPTURE order ─────
// intent=CAPTURE：直接扣款，无需单独 authorize。
// 5 个 PU 各自对应不同城市门店，验证 PayPal 是否支持此组合。
export async function createBopisOrderMultiCapture(): Promise<PayPalRestResponse> {
  const token = await getSandboxToken()
  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: 'store-a',
        amount: { currency_code: 'USD', value: '899.00' },
        description: 'LG 门对门冰箱 (LG French Door Refrigerator) — Pickup at San Jose Store',
        shipping: {
          type: 'PICKUP_IN_STORE',
          name: { full_name: 'Best Buy San Jose' },
          address: {
            address_line_1: '1600 Saratoga Ave',
            admin_area_2: 'San Jose',
            admin_area_1: 'CA',
            postal_code: '95129',
            country_code: 'US',
          },
          phone_number: { national_number: '4085551001' },
        },
      },
      {
        reference_id: 'store-b',
        amount: { currency_code: 'USD', value: '649.00' },
        description: 'Samsung 前置滚筒洗衣机 (Samsung Front Load Washer) — Pickup at Los Angeles Store',
        shipping: {
          type: 'PICKUP_IN_STORE',
          name: { full_name: 'Best Buy Los Angeles' },
          address: {
            address_line_1: '1015 Wilshire Blvd',
            admin_area_2: 'Los Angeles',
            admin_area_1: 'CA',
            postal_code: '90017',
            country_code: 'US',
          },
          phone_number: { national_number: '2135552002' },
        },
      },
      {
        reference_id: 'store-c',
        amount: { currency_code: 'USD', value: '599.00' },
        description: 'Samsung 烘干机 (Samsung Electric Dryer) — Pickup at Seattle Store',
        shipping: {
          type: 'PICKUP_IN_STORE',
          name: { full_name: 'Best Buy Seattle' },
          address: {
            address_line_1: '400 Pine St',
            admin_area_2: 'Seattle',
            admin_area_1: 'WA',
            postal_code: '98101',
            country_code: 'US',
          },
          phone_number: { national_number: '2065553003' },
        },
      },
      {
        reference_id: 'store-d',
        amount: { currency_code: 'USD', value: '349.00' },
        description: 'Bissell CrossWave 洗地机 — Pickup at Chicago Store',
        shipping: {
          type: 'PICKUP_IN_STORE',
          name: { full_name: 'Best Buy Chicago' },
          address: {
            address_line_1: '900 N Michigan Ave',
            admin_area_2: 'Chicago',
            admin_area_1: 'IL',
            postal_code: '60611',
            country_code: 'US',
          },
          phone_number: { national_number: '3125554004' },
        },
      },
      {
        reference_id: 'store-e',
        amount: { currency_code: 'USD', value: '449.00' },
        description: 'Midea 窗式空调 (Midea Window Air Conditioner) — Pickup at New York Store',
        shipping: {
          type: 'PICKUP_IN_STORE',
          name: { full_name: 'Best Buy New York' },
          address: {
            address_line_1: '529 5th Ave',
            admin_area_2: 'New York',
            admin_area_1: 'NY',
            postal_code: '10017',
            country_code: 'US',
          },
          phone_number: { national_number: '2125555005' },
        },
      },
    ],
    payment_source: {
      paypal: {
        experience_context: EXPERIENCE_CONTEXT,
      },
    },
  }
  return postOrder(token, payload)
}
