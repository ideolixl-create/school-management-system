import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'
import { verifySessionToken, COOKIE_NAMES } from '@/lib/session'

export const runtime = 'nodejs'
const STUDENT_COLUMNS = 'id, admission_number, full_name, class_id, gender, date_of_birth, parent_phone, passport_url, created_at'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAMES.student)?.value
  const payload = verifySessionToken(token)
  if (!payload || payload.role !== 'student') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.from('students').select(STUDENT_COLUMNS).eq('id', payload.sub).single()
  if (error || !data) return NextResponse.json({ error: 'Profile not found' }, { status: 401 })
  return NextResponse.json({ ok: true, student: data })
}
