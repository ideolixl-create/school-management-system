import { NextResponse } from 'next/server'
import { createSessionToken, COOKIE_NAMES, sessionCookieOptions } from '@/lib/session'
import { checkRateLimit, clearRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = checkRateLimit(`admin:${ip}`)
  if (!rl.allowed) {
    return NextResponse.json({ error: `Too many attempts. Try again in ${Math.ceil(rl.retryAfterSeconds / 60)} minute(s).` }, { status: 429 })
  }

  let body: { password?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }

  const password = typeof body.password === 'string' ? body.password : ''
  const expected = process.env.ADMIN_PASSWORD

  if (!expected) return NextResponse.json({ error: 'Server not configured. ADMIN_PASSWORD missing.' }, { status: 500 })

  const ok = password.length === expected.length && password.split('').reduce((acc, c, i) => acc | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0

  if (!ok) return NextResponse.json({ error: 'Incorrect admin password.' }, { status: 401 })

  clearRateLimit(`admin:${ip}`)
  const token = createSessionToken('admin', 'admin')
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAMES.admin, token, sessionCookieOptions())
  return res
}
