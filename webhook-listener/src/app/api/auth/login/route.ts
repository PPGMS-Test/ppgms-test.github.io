/**
 * POST /api/auth/login — authenticate with email + password
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { bootstrapAdminIfNeeded, createSession, setSessionCookie, verifyPassword } from '@/lib/auth'
import type { UserRow } from '@/lib/auth'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Bootstrap the first admin if the users table is empty
  await bootstrapAdminIfNeeded()

  const body = await request.json() as { email?: string; password?: string }
  const { email, password } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const db = getDB()
  const user = await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email.toLowerCase().trim())
    .first<UserRow>()

  if (!user) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const valid = await verifyPassword(password, user.password_hash, user.password_salt)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const { token, expiresAt } = await createSession(user.id)
  await setSessionCookie(token, expiresAt)

  return NextResponse.json({
    user: { id: user.id, email: user.email, role: user.role },
  })
}