/**
 * GET  /api/events?after=<id>&limit=<n> — incremental polling
 * DELETE /api/events — clear all events
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDB, getEvents, clearEvents } from '@/lib/db'
import { requireUser } from '@/lib/auth'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireUser()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDB()
  const { searchParams } = new URL(request.url)
  const after = parseInt(searchParams.get('after') || '0', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)

  const events = await getEvents(db, after, limit)
  return NextResponse.json({ events })
}

export async function DELETE(): Promise<NextResponse> {
  try {
    await requireUser()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDB()
  await clearEvents(db)
  return NextResponse.json({ ok: true })
}