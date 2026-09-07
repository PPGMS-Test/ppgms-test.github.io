/**
 * Lightweight middleware: redirects unauthenticated users to /login.
 * This is UX only — authoritative auth checks live in the API helpers.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_ROUTES = ['/', '/admin']
const PUBLIC_ROUTES = ['/login', '/api/webhook']
const STATIC_EXTS = /\.(ico|png|svg|jpg|jpeg|gif|css|js|woff2?|ttf|eot)$/i

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  // Allow public routes, static files, API webhook receiver without redirect
  if (
    PUBLIC_ROUTES.some((r) => pathname.startsWith(r)) ||
    STATIC_EXTS.test(pathname)
  ) {
    return NextResponse.next()
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get('wl_session')

  if (!sessionCookie?.value) {
    // API routes under auth/admin/events should return 401, not redirect
    if (pathname.startsWith('/api/')) {
      // For API calls without cookie, let the route handler return 401
      return NextResponse.next()
    }

    // Redirect pages to /login
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|favicon).*)'],
}