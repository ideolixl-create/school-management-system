import { NextResponse } from 'next/server'
import { verifySessionToken, COOKIE_NAMES } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // Parse cookies directly from the request headers. 
  // This is the most bulletproof way in Next.js 16.
  const cookieHeader = req.headers.get('cookie') || ''
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [key, ...v] = c.trim().split('=')
      return [key, v.join('=')]
    })
  )

  const token = cookies[COOKIE_NAMES.admin]
  
  console.log('[API /api/me/admin] Token from cookie:', token ? 'EXISTS' : 'MISSING')

  const payload = verifySessionToken(token)
  
  console.log('[API /api/me/admin] Payload verified:', payload ? 'VALID' : 'INVALID')

  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  return NextResponse.json({ ok: true, role: 'admin', exp: payload.exp })
}