import { NextResponse } from 'next/server'
import { createSessionToken, COOKIE_NAMES } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: { password?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }

  const password = typeof body.password === 'string' ? body.password : ''
  const expected = process.env.ADMIN_PASSWORD

  if (!expected) return NextResponse.json({ error: 'Server not configured. ADMIN_PASSWORD missing.' }, { status: 500 })

  const ok = password.length === expected.length && password.split('').reduce((acc, c, i) => acc | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0

  if (!ok) return NextResponse.json({ error: 'Incorrect admin password.' }, { status: 401 })

  const token = createSessionToken('admin', 'admin')
  
  // Manually set the cookie header to bypass any Next.js 16 response quirks
  const res = NextResponse.json({ ok: true })
  const maxAge = 30 * 60 // 30 minutes
  const isProd = process.env.NODE_ENV === 'production'
  const cookieString = `${COOKIE_NAMES.admin}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${isProd ? '; Secure' : ''}`
  
  res.headers.set('Set-Cookie', cookieString)
  
  return res
}