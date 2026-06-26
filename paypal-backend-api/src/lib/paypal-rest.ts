// Hand-written PayPal REST client (sandbox-only) for BYOK ("bring your own key") routes.
// Each call carries its own clientId/clientSecret — does NOT touch the SDK singleton
// or the hardcoded creds in config.ts.

export const PAYPAL_SANDBOX_BASE = 'https://api-m.sandbox.paypal.com'

export class PayPalAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PayPalAuthError'
  }
}

export interface PayPalRestResponse {
  data: unknown
  status: number
  debugId?: string
}

export function parseBasicAuth(req: Request): { clientId: string; clientSecret: string } {
  const header = req.headers.get('authorization') ?? ''
  const match = /^Basic\s+(.+)$/i.exec(header)
  if (!match) {
    throw new PayPalAuthError('Missing or malformed Authorization: Basic header')
  }

  let decoded: string
  try {
    decoded = atob(match[1].trim())
  } catch {
    throw new PayPalAuthError('Authorization header is not valid base64')
  }

  const idx = decoded.indexOf(':')
  if (idx === -1) {
    throw new PayPalAuthError('Authorization payload must be in the form clientId:clientSecret')
  }

  const clientId = decoded.slice(0, idx)
  const clientSecret = decoded.slice(idx + 1)
  if (!clientId || !clientSecret) {
    throw new PayPalAuthError('clientId and clientSecret must both be non-empty')
  }

  return { clientId, clientSecret }
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const auth = btoa(`${clientId}:${clientSecret}`)
  const res = await fetch(`${PAYPAL_SANDBOX_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string
    error_description?: string
    error?: string
  }

  if (!res.ok || !data.access_token) {
    const detail = data.error_description ?? data.error ?? `status ${res.status}`
    throw new PayPalAuthError(`PayPal OAuth failed: ${detail}`)
  }

  return data.access_token
}

export async function createOrder(
  clientId: string,
  clientSecret: string,
  body: unknown,
): Promise<PayPalRestResponse> {
  const token = await getAccessToken(clientId, clientSecret)
  const res = await fetch(`${PAYPAL_SANDBOX_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { data, status: res.status }
}

// Browser-safe client token — used by the JS SDK v6 to initialize createInstance().
// PayPal returns the same OAuth shape but the token has restricted scopes safe for
// browser exposure. Output is camelCased to match /api/auth/sandbox-client-token.
export async function getClientToken(
  clientId: string,
  clientSecret: string,
): Promise<PayPalRestResponse> {
  const auth = btoa(`${clientId}:${clientSecret}`)
  const res = await fetch(`${PAYPAL_SANDBOX_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&response_type=client_token',
  })

  const raw = (await res.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    scope?: string
    token_type?: string
    error?: string
    error_description?: string
  }

  if (!res.ok || !raw.access_token) {
    return { data: raw, status: res.status }
  }

  return {
    data: {
      accessToken: raw.access_token,
      expiresIn: raw.expires_in,
      scope: raw.scope,
      tokenType: raw.token_type,
    },
    status: res.status,
  }
}

export async function captureOrder(
  clientId: string,
  clientSecret: string,
  orderId: string,
): Promise<PayPalRestResponse> {
  const token = await getAccessToken(clientId, clientSecret)
  const res = await fetch(
    `${PAYPAL_SANDBOX_BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
    },
  )
  const data = await res.json().catch(() => ({}))
  return { data, status: res.status }
}
