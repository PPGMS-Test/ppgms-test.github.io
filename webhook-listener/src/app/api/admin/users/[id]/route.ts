/**
 * DELETE /api/admin/users/[id] — delete a user (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, deleteUser } from '@/lib/auth'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const userId = parseInt(id, 10)

    // Cannot delete yourself
    if (admin.id === userId) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
    }

    await deleteUser(userId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
    }
    throw err
  }
}