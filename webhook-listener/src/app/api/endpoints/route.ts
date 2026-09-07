/**
 * GET /api/endpoints — list all endpoints (requires login, for dashboard)
 */

import { NextResponse } from 'next/server'
import { getDB, getEndpoints } from '@/lib/db'
import { requireUser } from '@/lib/auth'

export const runtime = 'edge'

export async function GET(): Promise<NextResponse> {
  try {
    await requireUser()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDB()
  const endpoints = await getEndpoints(db)
  return NextResponse.json({ endpoints })
}