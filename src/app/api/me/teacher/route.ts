import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'
import { verifySessionToken, COOKIE_NAMES } from '@/lib/session'

export const runtime = 'nodejs'
const TEACHER_COLUMNS = 'id, staff_id, full_name, email, phone, role_type, assigned_class_id, assigned_subjects, created_at'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAMES.teacher)?.value
  const payload = verifySessionToken(token)
  if (!payload || payload.role !== 'teacher') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.from('teachers').select(TEACHER_COLUMNS).eq('id', payload.sub).single()
  if (error || !data) return NextResponse.json({ error: 'Profile not found' }, { status: 401 })
  return NextResponse.json({ ok: true, teacher: data })
}
