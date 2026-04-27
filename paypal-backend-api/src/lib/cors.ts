import { NextResponse } from 'next/server'

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export function corsOptions() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS })
}

export function corsJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS })
}
