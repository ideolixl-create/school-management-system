import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createSessionToken, COOKIE_NAMES, sessionCookieOptions } from '@/lib/session'
import { checkRateLimit, clearRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
const TEACHER_COLUMNS = 'id, staff_id, full_name, email, phone, role_type, assigned_class_id, assigned_subjects, created_at'

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = checkRateLimit(`teacher:${ip}`)
  if (!rl.allowed) return NextResponse.json({ error: `Too many attempts. Try again in ${Math.ceil(rl.retryAfterSeconds / 60)} minute(s).` }, { status: 429 })

  let body: { email?: string; password?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }

  const email = (body.email || '').trim().toLowerCase()
  const password = (body.password || '').trim().toLowerCase()

  if (!email || !password) return NextResponse.json({ error: 'Email and password required.' }, { status: 400 })

  const { data: row, error: dbError } = await supabase.from('teachers').select('id, password').ilike('email', email).maybeSingle()
  if (dbError) return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'No teacher account found with that email.' }, { status: 401 })

  const stored = (row.password || '').trim().toLowerCase()
  if (!stored || stored !== password) return NextResponse.json({ error: 'Incorrect password. Please check and try again.' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase.from('teachers').select(TEACHER_COLUMNS).eq('id', row.id).single()
  if (profileError || !profile) return NextResponse.json({ error: 'Server error loading profile.' }, { status: 500 })

  clearRateLimit(`teacher:${ip}`)
  const token = createSessionToken('teacher', profile.id)
  const res = NextResponse.json({ ok: true, teacher: profile })
  res.cookies.set(COOKIE_NAMES.teacher, token, sessionCookieOptions())
  return res
}
