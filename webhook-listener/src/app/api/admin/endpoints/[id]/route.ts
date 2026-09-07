/**
 * PUT    /api/admin/endpoints/[id] — update endpoint (admin only)
 * DELETE /api/admin/endpoints/[id] — delete endpoint (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDB, getEndpointById, updateEndpoint, deleteEndpoint } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import type { EndpointInput } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await request.json() as EndpointInput

    if (!body.label || !body.slug) {
      return NextResponse.json({ error: 'label and slug are required' }, { status: 400 })
    }

    const db = getDB()
    await updateEndpoint(db, parseInt(id, 10), {
      label: body.label,
      slug: body.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      description: body.description || '',
      enabled: body.enabled ?? 1,
      paypal_env: body.paypal_env || 'sandbox',
      paypal_client_id: body.paypal_client_id || '',
      paypal_client_secret: body.paypal_client_secret || '',
      paypal_webhook_id: body.paypal_webhook_id || '',
    })

    return NextResponse.json({ ok: true })
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireAdmin()
    const { id } = await params
    const db = getDB()
    await deleteEndpoint(db, parseInt(id, 10))
    return NextResponse.json({ ok: true })
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