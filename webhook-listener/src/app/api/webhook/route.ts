/**
 * POST /api/webhook — PayPal webhook receiver (PUBLIC — no auth).
 *
 * 1. Reads all headers and raw body
 * 2. Best-effort parses event_type / resource_type from JSON body
 * 3. Runs PayPal signature verification (skipped if credentials are missing)
 * 4. Persists to D1
 * 5. Returns 200 immediately
 *
 * Errors in parsing or verification never block persistence — the webhook
 * always gets stored so it appears on the dashboard.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDB, insertEvent } from '@/lib/db'
import { parseWebhookBody } from '@/lib/parse'
import { verifyWebhookSignature } from '@/lib/verify'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const db = getDB()
  const receivedAt = Date.now()

  // Read raw body as text (must be read before anything else)
  const rawBody = await request.text()

  // Collect all headers
  const headersMap: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headersMap[key.toLowerCase()] = value
  })

  // Extract metadata
  const method = request.method
  const query = new URL(request.url).search
  const sourceIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    ''
  const contentType = request.headers.get('content-type') || ''

  // Best-effort parse event metadata
  const parsed = parseWebhookBody(rawBody)

  // Signature verification (best-effort, never blocks storage)
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
      {
        PAYPAL_ENV: process.env.PAYPAL_ENV,
        PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
        PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
        PAYPAL_WEBHOOK_ID: process.env.PAYPAL_WEBHOOK_ID,
      }
    )
  } catch {
    verification = 'error'
  }

  // Always persist — this is the primary function
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
    })
  } catch (err) {
    console.error('Failed to persist webhook event:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// Reject other methods
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { message: 'Send a POST request to this endpoint with your PayPal webhook payload.' },
    { status: 200 }
  )
}