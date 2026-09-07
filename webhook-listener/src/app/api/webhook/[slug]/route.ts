/**
 * POST /api/webhook/[slug] — PayPal webhook receiver (PUBLIC — no auth).
 *
 * Looks up the endpoint by slug, uses its credentials for signature
 * verification. Falls back to 'skipped' if endpoint not found or disabled.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDB, insertEvent, getEndpointBySlug } from '@/lib/db'
import { parseWebhookBody } from '@/lib/parse'
import { verifyWebhookSignature } from '@/lib/verify'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const db = getDB()
  const { slug } = await params
  const receivedAt = Date.now()

  // Look up endpoint
  const endpoint = await getEndpointBySlug(db, slug)

  // Endpoint not found or disabled
  if (!endpoint) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!endpoint.enabled) {
    return NextResponse.json({ error: 'Endpoint disabled' }, { status: 404 })
  }

  // Read raw body
  const rawBody = await request.text()

  // Collect all headers
  const headersMap: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headersMap[key.toLowerCase()] = value
  })

  const method = request.method
  const query = new URL(request.url).search
  const sourceIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    ''
  const contentType = request.headers.get('content-type') || ''

  // Parse event metadata
  const parsed = parseWebhookBody(rawBody)

  // Signature verification with endpoint credentials
  let verification = 'skipped'
  try {
    verification = await verifyWebhookSignature(
      {
        'paypal-auth-algo': headersMap['paypal-auth-algo'],
        'paypal-cert-url': headersMap['paypal-cert-url'],
        'paypal-transmission-id': headersMap['paypal-transmission-id'],
        'paypal-transmission-sig': headersMap['paypal-transmission-sig'],
        'paypal-transmission-time': headersMap['paypal-transmission-time'],
      },
      rawBody,
      endpoint.paypal_client_id && endpoint.paypal_client_secret && endpoint.paypal_webhook_id
        ? {
            env: (endpoint.paypal_env as 'sandbox' | 'live') || 'sandbox',
            clientId: endpoint.paypal_client_id,
            clientSecret: endpoint.paypal_client_secret,
            webhookId: endpoint.paypal_webhook_id,
          }
        : null
    )
  } catch {
    verification = 'error'
  }

  // Always persist
  try {
    await insertEvent(db, {
      received_at: receivedAt,
      method,
      query,
      source_ip: sourceIp,
      content_type: contentType,
      headers: JSON.stringify(headersMap),
      raw_body: rawBody,
      event_type: parsed.event_type,
      resource_type: parsed.resource_type,
      verification,
      endpoint_id: endpoint.id,
      endpoint_slug: endpoint.slug,
    })
  } catch (err) {
    console.error('Failed to persist webhook event:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params
  const db = getDB()
  const endpoint = await getEndpointBySlug(db, slug)
  return NextResponse.json({
    message: `Send a POST request to this endpoint with your PayPal webhook payload.`,
    endpoint: endpoint ? { label: endpoint.label, slug: endpoint.slug, enabled: !!endpoint.enabled } : null,
  })
}