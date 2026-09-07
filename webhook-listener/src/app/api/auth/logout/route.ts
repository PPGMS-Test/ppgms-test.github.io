/**
 * POST /api/auth/logout — destroy current session
 */

import { NextResponse } from 'next/server'
import { clearSessionCookie, destroySession, getSessionCookie } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(): Promise<NextResponse> {
  const token = await getSessionCookie()
  if (token) {
    await destroySession(token)
  }
  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}