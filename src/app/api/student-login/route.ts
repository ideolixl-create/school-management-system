import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createSessionToken, COOKIE_NAMES, sessionCookieOptions } from '@/lib/session'
import { checkRateLimit, clearRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
const STUDENT_COLUMNS = 'id, admission_number, full_name, class_id, gender, date_of_birth, parent_phone, passport_url, created_at'

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = checkRateLimit(`student:${ip}`)
  if (!rl.allowed) return NextResponse.json({ error: `Too many attempts. Try again in ${Math.ceil(rl.retryAfterSeconds / 60)} minute(s).` }, { status: 429 })

  let body: { admissionNumber?: string; password?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }

  const admissionNumber = (body.admissionNumber || '').trim().toLowerCase()
  const password = (body.password || '').trim().toLowerCase()

  if (!admissionNumber || !password) return NextResponse.json({ error: 'Admission number and password required.' }, { status: 400 })

  const { data: row, error: dbError } = await supabase.from('students').select('id, password').ilike('admission_number', admissionNumber).maybeSingle()
  if (dbError) return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'Admission number not found. Please confirm with the school office.' }, { status: 401 })

  const stored = (row.password || '').trim().toLowerCase()
  if (!stored || stored !== password) return NextResponse.json({ error: 'Incorrect password. Please check and try again.' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase.from('students').select(STUDENT_COLUMNS).eq('id', row.id).single()
  if (profileError || !profile) return NextResponse.json({ error: 'Server error loading profile.' }, { status: 500 })

  clearRateLimit(`student:${ip}`)
  const token = createSessionToken('student', profile.id)
  const res = NextResponse.json({ ok: true, student: profile })
  res.cookies.set(COOKIE_NAMES.student, token, sessionCookieOptions())
  return res
}
