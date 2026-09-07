/**
 * PayPal webhook signature verification.
 *
 * Calls PayPal's verify-webhook-signature API to confirm the webhook
 * payload authenticity. Credentials are passed in explicitly (per-endpoint),
 * not read from environment variables.
 */

export type VerificationStatus = 'verified' | 'failed' | 'skipped' | 'error'

export interface VerificationCredentials {
  env: 'sandbox' | 'live'
  clientId: string
  clientSecret: string
  webhookId: string
}

interface PayPalHeaders {
  'paypal-auth-algo'?: string
  'paypal-cert-url'?: string
  'paypal-transmission-id'?: string
  'paypal-transmission-sig'?: string
  'paypal-transmission-time'?: string
}

function getBaseUrl(env: 'sandbox' | 'live'): string {
  return env === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'
}

async function getOAuthToken(
  baseUrl: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    throw new Error(`OAuth token request failed: ${response.status}`)
  }

  const json = await response.json() as { access_token: string }
  if (!json.access_token) {
    throw new Error('OAuth token response missing access_token')
  }

  return json.access_token
}

export async function verifyWebhookSignature(
  headers: PayPalHeaders,
  rawBody: string,
  credentials: VerificationCredentials | null
): Promise<VerificationStatus> {
  // No credentials → skip
  if (!credentials || !credentials.clientId || !credentials.clientSecret || !credentials.webhookId) {
    return 'skipped'
  }

  const {
    'paypal-auth-algo': auth_algo,
    'paypal-cert-url': cert_url,
    'paypal-transmission-id': transmission_id,
    'paypal-transmission-sig': transmission_sig,
    'paypal-transmission-time': transmission_time,
  } = headers

  // All PayPal verification headers must be present
  if (!auth_algo || !cert_url || !transmission_id || !transmission_sig || !transmission_time) {
    return 'skipped'
  }

  try {
    const baseUrl = getBaseUrl(credentials.env)
    const accessToken = await getOAuthToken(baseUrl, credentials.clientId, credentials.clientSecret)

    let webhookEvent: unknown
    try {
      webhookEvent = JSON.parse(rawBody)
    } catch {
      return 'error'
    }

    const verifyBody = {
      auth_algo,
      cert_url,
      transmission_id,
      transmission_sig,
      transmission_time,
      webhook_id: credentials.webhookId,
      webhook_event: webhookEvent,
    }

    const response = await fetch(
      `${baseUrl}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(verifyBody),
      }
    )

    if (!response.ok) {
      return 'failed'
    }

    const result = await response.json() as { verification_status?: string }
    return result.verification_status === 'SUCCESS' ? 'verified' : 'failed'
  } catch {
    return 'error'
  }
}