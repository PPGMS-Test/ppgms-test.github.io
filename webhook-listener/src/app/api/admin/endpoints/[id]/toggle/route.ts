/**
 * POST /api/admin/endpoints/[id]/toggle — toggle enabled/disabled (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDB, toggleEndpoint } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireAdmin()
    const { id } = await params
    const db = getDB()
    const endpoint = await toggleEndpoint(db, parseInt(id, 10))

    if (!endpoint) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ endpoint })
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