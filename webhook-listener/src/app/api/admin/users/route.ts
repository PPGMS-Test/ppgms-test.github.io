/**
 * GET    /api/admin/users — list all users (admin only)
 * POST   /api/admin/users — create a new user (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, listUsers, createUser } from '@/lib/auth'

export const runtime = 'edge'

export async function GET(): Promise<NextResponse> {
  try {
    const admin = await requireAdmin()
    const users = await listUsers()
    return NextResponse.json({ users })
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const admin = await requireAdmin()
    const body = await request.json() as { email?: string; password?: string; role?: 'admin' | 'user' }
    const { email, password, role } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = await createUser(
      email.toLowerCase().trim(),
      password,
      role === 'admin' ? 'admin' : 'user',
      admin.email
    )

    return NextResponse.json({ user }, { status: 201 })
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