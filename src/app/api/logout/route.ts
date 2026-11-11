import { NextResponse } from 'next/server'
import { COOKIE_NAMES } from '@/lib/session'

export const runtime = 'nodejs'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  Object.values(COOKIE_NAMES).forEach((name) => {
    res.cookies.set(name, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 })
  })
  return res
}
