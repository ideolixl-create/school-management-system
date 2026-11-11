import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken, COOKIE_NAMES } from '@/lib/session'

export const runtime = 'nodejs' // Make sure this is here!

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

  const cookieName = COOKIE_NAMES[requiredRole]
  const token = req.cookies.get(cookieName)?.value
  const payload = verifySessionToken(token)

  console.log(`[Middleware] Path: ${pathname} | Cookie: ${cookieName} | Token exists: ${!!token} | Verified: ${!!payload}`)

  if (!payload || payload.role !== requiredRole) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}