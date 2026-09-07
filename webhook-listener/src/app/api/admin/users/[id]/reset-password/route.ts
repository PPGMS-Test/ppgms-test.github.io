/**
 * POST /api/admin/users/[id]/reset-password — reset a user's password (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, resetUserPassword } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireAdmin()

    const { id } = await params
    const body = await request.json() as { password?: string }
    const { password } = body

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 })
    }

    await resetUserPassword(parseInt(id, 10), password)
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