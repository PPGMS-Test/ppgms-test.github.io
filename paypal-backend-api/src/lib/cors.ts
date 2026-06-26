import { NextResponse } from 'next/server'

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Expose-Headers': 'X-PayPal-Debug-Id',
}

export function corsOptions() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS })
}

export function corsJson(data: unknown, status = 200, debugId?: string) {
  const headers: Record<string, string> = { ...CORS_HEADERS }
  if (debugId) headers['X-PayPal-Debug-Id'] = debugId
  return NextResponse.json(data, { status, headers })
}
