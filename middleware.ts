/* ============================================================================
   THE TRUSTWORTHY SCHOOLS — ROUTE PROTECTION
   Guards /portal/admin, /portal/teacher, /portal/student
   Next.js 16.3.6 — Node runtime middleware (stable in 15.2+)
   ============================================================================ */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken, COOKIE_NAMES } from '@/lib/session'

export const runtime = 'nodejs'

export const config = {
  matcher: ['/portal/:path*'],
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const requiredRole: 'admin' | 'teacher' | 'student' | null =
    pathname.startsWith('/portal/admin')   ? 'admin' :
    pathname.startsWith('/portal/teacher') ? 'teacher' :
    pathname.startsWith('/portal/student') ? 'student' :
    null

  if (!requiredRole) return NextResponse.next()

  const token = req.cookies.get(COOKIE_NAMES[requiredRole])?.value
  const payload = verifySessionToken(token)

  if (!payload || payload.role !== requiredRole) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}