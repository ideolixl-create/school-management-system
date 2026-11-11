/* ============================================================================
   THE TRUSTWORTHY SCHOOLS — SESSION TOKEN UTILITIES
   ============================================================================ */

import { createHmac, timingSafeEqual, randomBytes } from 'crypto'

export type Role = 'admin' | 'teacher' | 'student'

export type SessionPayload = {
  role: Role
  sub: string
  iat: number
  exp: number
}

const SECRET = process.env.SESSION_SECRET

if (!SECRET || SECRET.length < 16) {
  throw new Error('SESSION_SECRET missing or too short. Set a 32+ char random string in .env.local and Vercel.')
}

function b64urlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

function sign(data: string): string {
  return b64urlEncode(createHmac('sha256', SECRET!).update(data).digest())
}

export function createSessionToken(role: Role, sub: string, ttlSeconds = 30 * 60): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = { role, sub, iat: now, exp: now + ttlSeconds }
  const body = b64urlEncode(JSON.stringify(payload))
  const sig = sign(body)
  return `${body}.${sig}`
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  const expected = sign(body)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  if (!timingSafeEqual(a, b)) return null
  let payload: SessionPayload
  try {
    payload = JSON.parse(b64urlDecode(body).toString('utf8'))
  } catch {
    return null
  }
  if (!payload || typeof payload.role !== 'string' || typeof payload.sub !== 'string' || typeof payload.exp !== 'number') {
    return null
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload
}

export const COOKIE_NAMES: Record<Role, string> = {
  admin: 'tts-admin-session',
  teacher: 'tts-teacher-session',
  student: 'tts-student-session',
}

export const COOKIE_MAX_AGE = 30 * 60

export function sessionCookieOptions(maxAge = COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  }
}

export function generateSecret(): string {
  return randomBytes(32).toString('hex')
}
