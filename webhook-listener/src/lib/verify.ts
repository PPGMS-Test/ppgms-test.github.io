/**
 * PayPal webhook signature verification.
 *
 * Calls PayPal's verify-webhook-signature API to confirm the webhook
 * payload authenticity. Gracefully degrades when credentials are missing.
 */

export type VerificationStatus = 'verified' | 'failed' | 'skipped' | 'error'

interface VerifyEnv {
  PAYPAL_ENV?: string
  PAYPAL_CLIENT_ID?: string
  PAYPAL_CLIENT_SECRET?: string
  PAYPAL_WEBHOOK_ID?: string
}

interface PayPalHeaders {
  'paypal-auth-algo'?: string
  'paypal-cert-url'?: string
  'paypal-transmission-id'?: string
  'paypal-transmission-sig'?: string
  'paypal-transmission-time'?: string
}

function getBaseUrl(env: VerifyEnv): string {
  const paypalEnv = env.PAYPAL_ENV || 'sandbox'
  return paypalEnv === 'live'
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
  env: VerifyEnv
): Promise<VerificationStatus> {
  const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID } = env

  // All required credentials must be present
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET || !PAYPAL_WEBHOOK_ID) {
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
    const baseUrl = getBaseUrl(env)
    const accessToken = await getOAuthToken(baseUrl, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)

    // Parse raw body as object for the webhook_event field
    let webhookEvent: unknown
    try {
      webhookEvent = JSON.parse(rawBody)
    } catch {
      return 'error' // can't verify if body isn't parseable JSON
    }

    const verifyBody = {
      auth_algo,
      cert_url,
      transmission_id,
      transmission_sig,
      transmission_time,
      webhook_id: PAYPAL_WEBHOOK_ID,
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