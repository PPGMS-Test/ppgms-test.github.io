/**
 * GET    /api/admin/endpoints — list all endpoints (admin only)
 * POST   /api/admin/endpoints — create endpoint (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDB, getEndpoints, createEndpoint } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import type { EndpointInput } from '@/lib/db'

export const runtime = 'edge'

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin()
    const db = getDB()
    const endpoints = await getEndpoints(db)
    return NextResponse.json({ endpoints })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    throw err
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin()
    const body = await request.json() as EndpointInput

    if (!body.label || !body.slug) {
      return NextResponse.json({ error: 'label and slug are required' }, { status: 400 })
    }

    const db = getDB()
    const endpoint = await createEndpoint(db, {
      label: body.label,
      slug: body.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      description: body.description || '',
      enabled: body.enabled ?? 1,
      paypal_env: body.paypal_env || 'sandbox',
      paypal_client_id: body.paypal_client_id || '',
      paypal_client_secret: body.paypal_client_secret || '',
      paypal_webhook_id: body.paypal_webhook_id || '',
    })

    return NextResponse.json({ endpoint }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    throw err
  }
}