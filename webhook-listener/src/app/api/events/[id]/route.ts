/**
 * DELETE /api/events/[id] — delete a single webhook event
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDB, deleteEvent } from '@/lib/db'
import { requireUser } from '@/lib/auth'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireUser()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const db = getDB()
  await deleteEvent(db, parseInt(id, 10))
  return NextResponse.json({ ok: true })
}