import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url)
  url.pathname = '/api/webhook/default'
  return NextResponse.redirect(url, 308)
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { message: 'Webhook endpoints are at /api/webhook/:slug. Register endpoints in the Admin panel.' },
    { status: 200 }
  )
}