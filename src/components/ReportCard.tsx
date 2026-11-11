'use client'

/* ============================================================================
   THE TRUSTWORTHY SCHOOLS — REPORT CARD COMPONENT
   ============================================================================ */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/* ============================================================================
   CONFIG
   ============================================================================ */

const PROPRIETOR_NAME = 'M.B. Bello'
const PROPRIETOR_SIGNATURE_URL = '/proprietor-signature.png'
const SCHOOL_STAMP_URL = '/school-stamp.png'

export const SCHOOL = {
  name: 'The Trustworthy Schools',
  motto: 'Nurture for Piety',
  address: '1, CTCS Avenue, Coca Cola Junction, Unity Estate, Orimerunmu Mowe, Ogun State',
  phones: ['08037376160', '08037173526', '08156320986'],
  email: 'trustworthysch16@gmail.com',
  website: 'www.thetrustworthyschools.com',
  logo: 'https://raw.githubusercontent.com/ideolixlearninghub/Trustworthy_schoolsexam/main/The%20trustworthy%20school%20logo.jpg',
}

/* ============================================================================
   TYPES
   ============================================================================ */

export type ReportStudent = {
  id: string
  admission_number: string
  full_name: string
  class_id: string | null
  gender: 'Male' | 'Female' | null
  date_of_birth: string | null
  passport_url: string | null
}

export type ReportSubject = { id: string; name: string }

export type ReportScore = {
  id: string
  student_id: string
  subject_id: string
  test_score: number | null
  exam_score: number | null
  term: string
  session: string
}

export type ReportBehavioural = {
  affective: Record<string, number>
  psychomotor: Record<string, number>
  teacher_comment: string | null
}

export type ReportAttendanceSummary = {
  days_present: number
  total_days: number
  remark: string | null
}

export type ReportAttendanceRow = {
  status: 'Present' | 'Absent' | 'Late'
}

export type ReportCardData = {
  student: ReportStudent
  className: string
  term: string
  session: string
  subjects: ReportSubject[]
  scores: ReportScore[]
  behavioural: ReportBehavioural | null
  attendanceSummary: ReportAttendanceSummary | null
  attendanceRows: ReportAttendanceRow[]
  classRanks: Record<string, number>
  overallRank: number | null
  totalStudentsInClass: number
}

/* ============================================================================
   HELPERS
   ============================================================================ */

const AFFECTIVE_TRAITS = [
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'neatness', label: 'Neatness' },
  { key: 'politeness', label: 'Politeness' },
  { key: 'honesty', label: 'Honesty' },
  { key: 'cooperation', label: 'Cooperation with Others' },
  { key: 'attentiveness', label: 'Attentiveness' },
  { key: 'obedience', label: 'Obedience' },
  { key: 'self_control', label: 'Self Control' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'attitude_to_work', label: 'Attitude to Work' },
]

const PSYCHOMOTOR_SKILLS = [
  { key: 'handwriting', label: 'Handwriting' },
  { key: 'verbal_fluency', label: 'Verbal Fluency' },
  { key: 'sports_games', label: 'Sports & Games' },
  { key: 'drawing_painting', label: 'Drawing & Painting' },
  { key: 'handling_tools', label: 'Handling Tools' },
  { key: 'musical_skills', label: 'Musical Skills' },
]

const RATING_LABELS: Record<number, string> = {
  5: 'Excellent',
  4: 'Very Good',
  3: 'Good',
  2: 'Fair',
  1: 'Poor',
}

function gradeFromTotal(total: number): { grade: string; tone: string } {
  if (total >= 70) return { grade: 'A1', tone: 'text-emerald-700' }
  if (total >= 65) return { grade: 'B2', tone: 'text-emerald-700' }
  if (total >= 60) return { grade: 'B3', tone: 'text-emerald-700' }
  if (total >= 55) return { grade: 'C4', tone: 'text-blue-700' }
  if (total >= 50) return { grade: 'C5', tone: 'text-blue-700' }
  if (total >= 45) return { grade: 'C6', tone: 'text-blue-700' }
  if (total >= 40) return { grade: 'D7', tone: 'text-amber-700' }
  if (total >= 35) return { grade: 'E8', tone: 'text-amber-700' }
  return { grade: 'F9', tone: 'text-red-700' }
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

/* ============================================================================
   DATA LOADER
   ============================================================================ */

export async function loadReportCardData(
  student: ReportStudent,
  term: string,
  session: string
): Promise<ReportCardData | null> {
  if (!student.class_id) return null

  const [clsRes, subjRes, scRes, behRes, attSumRes, attRowsRes, classmatesRes] = await Promise.all([
    supabase.from('classes').select('name').eq('id', student.class_id).maybeSingle(),
    supabase.from('subjects').select('*').order('name'),
    supabase.from('scores').select('*').eq('student_id', student.id).eq('term', term).eq('session', session),
    supabase.from('behavioural_ratings').select('*').eq('student_id', student.id).eq('term', term).eq('session', session).maybeSingle(),
    supabase.from('attendance_summary').select('*').eq('student_id', student.id).eq('term', term).eq('session', session).maybeSingle(),
    supabase.from('attendance').select('*').eq('student_id', student.id),
    supabase.from('students').select('id').eq('class_id', student.class_id),
  ])

  const classmates = (classmatesRes.data || []) as { id: string }[]
  const classmateIds = classmates.map((s) => s.id)

  let classRanks: Record<string, number> = {}
  let overallRank: number | null = null

  if (classmateIds.length > 0) {
    const { data: allScores } = await supabase
      .from('scores')
      .select('*')
      .in('student_id', classmateIds)
      .eq('term', term)
      .eq('session', session)

    const rows = (allScores || []) as (ReportScore & { class_id: string | null })[]
    const subjectIds = Array.from(new Set(rows.map((r) => r.subject_id)))

    subjectIds.forEach((sid) => {
      const ranked = rows
        .filter((r) => r.subject_id === sid)
        .map((r) => ({ student_id: r.student_id, total: (r.test_score || 0) + (r.exam_score || 0) }))
        .sort((a, b) => b.total - a.total)
      const idx = ranked.findIndex((r) => r.student_id === student.id)
      if (idx >= 0) classRanks[sid] = idx + 1
    })

    const totals = new Map<string, number>()
    rows.forEach((r) => {
      totals.set(r.student_id, (totals.get(r.student_id) || 0) + (r.test_score || 0) + (r.exam_score || 0))
    })
    const overallRanked = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])
    const pos = overallRanked.findIndex(([id]) => id === student.id)
    if (pos >= 0) overallRank = pos + 1
  }

  const beh = behRes.data as any
  const summary = attSumRes.data as any

  return {
    student,
    className: (clsRes.data as any)?.name || '—',
    term,
    session,
    subjects: (subjRes.data || []) as ReportSubject[],
    scores: (scRes.data || []) as ReportScore[],
    behavioural: beh ? { affective: beh.affective || {}, psychomotor: beh.psychomotor || {}, teacher_comment: beh.teacher_comment || null } : null,
    attendanceSummary: summary ? { days_present: summary.days_present, total_days: summary.total_days, remark: summary.remark || null } : null,
    attendanceRows: (attRowsRes.data || []) as ReportAttendanceRow[],
    classRanks,
    overallRank,
    totalStudentsInClass: classmates.length,
  }
}

/* ============================================================================
   COMPONENT
   ============================================================================ */

export default function ReportCard({ data }: { data: ReportCardData }) {
  const { student, className, term, session, subjects, scores, behavioural } = data

  const subjectById = Object.fromEntries(subjects.map((s) => [s.id, s.name]))

  const rows = scores
    .map((sc) => {
      const total = (sc.test_score || 0) + (sc.exam_score || 0)
      const g = gradeFromTotal(total)
      return {
        subject_id: sc.subject_id,
        subject_name: subjectById[sc.subject_id] || '—',
        ca: sc.test_score ?? 0,
        exam: sc.exam_score ?? 0,
        total,
        grade: g.grade,
        tone: g.tone,
        position: data.classRanks[sc.subject_id] ?? null,
      }
    })
    .sort((a, b) => a.subject_name.localeCompare(b.subject_name))

  const sum = rows.reduce((a, r) => a + r.total, 0)
  const avg = rows.length > 0 ? (sum / (rows.length * 100)) * 100 : 0
  const avgStr = avg.toFixed(2)

  const attDisplay = (() => {
    if (data.attendanceSummary) {
      const { days_present, total_days } = data.attendanceSummary
      const pct = total_days > 0 ? Math.round((days_present / total_days) * 100) : 0
      return `${days_present} / ${total_days} (${pct}%)`
    }
    const rows = data.attendanceRows
    if (rows.length === 0) return '—'
    const present = rows.filter((r) => r.status === 'Present').length
    const late = rows.filter((r) => r.status === 'Late').length
    const pct = Math.round(((present + late) / rows.length) * 100)
    return `${present + late} / ${rows.length} (${pct}%)`
  })()

  return (
    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 sm:p-8 print:shadow-none print:ring-0 print:rounded-none report-card-root">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden !important; }
          .report-card-root, .report-card-root * { visibility: visible !important; }
          .report-card-root { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; padding: 0 !important; }
          .report-card-no-print { display: none !important; }
          @page { size: A4 portrait; margin: 12mm; }
        }
        .signature-img, .stamp-img { mix-blend-mode: multiply; }
      `}} />

      {/* HEADER */}
      <div className="relative pb-4 border-b-2 border-[#4A2E1B]">
        <div className="absolute top-0 right-0 z-10">
          <div className="relative">
            {student.passport_url ? (
              <img src={student.passport_url} alt={student.full_name} className="w-20 h-24 sm:w-24 sm:h-28 rounded-md object-cover ring-2 ring-[#4A2E1B]/30 bg-slate-100 shadow-sm" onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.style.display = 'none'; const fb = img.nextElementSibling as HTMLElement | null; if (fb) fb.style.display = 'flex'; }} />
            ) : null}
            {!student.passport_url && (
              <div className="w-20 h-24 sm:w-24 sm:h-28 rounded-md ring-2 ring-[#4A2E1B]/30 bg-slate-50 flex flex-col items-center justify-center text-gray-400 text-[9px] font-bold text-center px-1">
                <span className="text-lg mb-1">👤</span>PASSPORT
              </div>
            )}
          </div>
        </div>

        <div className="text-center px-24 sm:px-28">
          <img src={SCHOOL.logo} alt="Logo" className="w-16 h-16 mx-auto mb-2" />
          <h1 className="text-lg sm:text-xl font-black text-[#4A2E1B] tracking-tight">{SCHOOL.name.toUpperCase()}</h1>
          <p className="text-xs italic mt-0.5">Motto: {SCHOOL.motto}</p>
          <p className="text-[11px] text-gray-600 mt-0.5">{SCHOOL.address}</p>
          <p className="text-[11px] text-gray-600">{SCHOOL.phones.join(' · ')} · {SCHOOL.email}</p>
        </div>
      </div>

      <div className="text-center py-3">
        <h2 className="text-base font-black text-[#4A2E1B] uppercase tracking-wide">{term} Report Card</h2>
        <p className="text-[11px] text-gray-500">Academic Session: {session}</p>
      </div>

      {/* STUDENT INFO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4 border-y border-slate-200 text-xs">
        <InfoRow label="Name" value={student.full_name} />
        <InfoRow label="Admission Number" value={student.admission_number} />
        <InfoRow label="Class" value={className} />
        <InfoRow label="Age" value={String(ageFromDob(student.date_of_birth) ?? '—')} />
        <InfoRow label="Gender" value={student.gender || '—'} />
        <InfoRow label="Attendance" value={attDisplay} />
      </div>

      {/* SUBJECTS */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs border border-slate-300">
          <thead className="bg-[#4A2E1B] text-white">
            <tr>
              <th className="p-2 border border-slate-300 text-left">Subject</th>
              <th className="p-2 border border-slate-300 text-center w-16">CA (40)</th>
              <th className="p-2 border border-slate-300 text-center w-16">Exam (60)</th>
              <th className="p-2 border border-slate-300 text-center w-16">Total</th>
              <th className="p-2 border border-slate-300 text-center w-16">Grade</th>
              <th className="p-2 border border-slate-300 text-center w-20">Position</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.subject_id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="p-2 border border-slate-300 font-semibold text-[#4A2E1B]">{r.subject_name}</td>
                <td className="p-2 border border-slate-300 text-center">{r.ca}</td>
                <td className="p-2 border border-slate-300 text-center">{r.exam}</td>
                <td className="p-2 border border-slate-300 text-center font-bold">{r.total}</td>
                <td className={`p-2 border border-slate-300 text-center font-bold ${r.tone}`}>{r.grade}</td>
                <td className="p-2 border border-slate-300 text-center font-bold text-gray-700">
                  {r.position ? ordinal(r.position) : '—'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-400 italic text-xs">No scores recorded for this term.</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-slate-100">
              <tr>
                <td className="p-2 border border-slate-300 font-bold">TOTAL</td>
                <td className="p-2 border border-slate-300" colSpan={2}></td>
                <td className="p-2 border border-slate-300 text-center font-black text-pink-700">{sum}</td>
                <td className="p-2 border border-slate-300" colSpan={2}></td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 font-bold">AVERAGE</td>
                <td className="p-2 border border-slate-300" colSpan={2}></td>
                <td className="p-2 border border-slate-300 text-center font-bold text-emerald-700">{avgStr}%</td>
                <td className="p-2 border border-slate-300" colSpan={2}></td>
              </tr>
              {data.overallRank && (
                <tr>
                  <td className="p-2 border border-slate-300 font-bold">POSITION IN CLASS</td>
                  <td className="p-2 border border-slate-300 text-center font-bold text-[#4A2E1B]" colSpan={5}>
                    {ordinal(data.overallRank)} out of {data.totalStudentsInClass}
                  </td>
                </tr>
              )}
            </tfoot>
          )}
        </table>
      </div>

      {/* BEHAVIOURAL RATINGS */}
      {behavioural && (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-[#4A2E1B] mb-2 border-b border-slate-200 pb-1">Affective Traits</h3>
            <table className="w-full text-[11px]">
              <tbody>
                {AFFECTIVE_TRAITS.map((t) => (
                  <tr key={t.key} className="border-b border-slate-100">
                    <td className="py-1 text-gray-700">{t.label}</td>
                    <td className="py-1 text-right font-bold text-[#4A2E1B]">
                      {behavioural.affective?.[t.key] ?? '—'}
                      {behavioural.affective?.[t.key] ? <span className="text-gray-400 font-normal ml-1">({RATING_LABELS[behavioural.affective[t.key]]})</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-[#4A2E1B] mb-2 border-b border-slate-200 pb-1">Psychomotor Skills</h3>
            <table className="w-full text-[11px]">
              <tbody>
                {PSYCHOMOTOR_SKILLS.map((t) => (
                  <tr key={t.key} className="border-b border-slate-100">
                    <td className="py-1 text-gray-700">{t.label}</td>
                    <td className="py-1 text-right font-bold text-[#4A2E1B]">
                      {behavioural.psychomotor?.[t.key] ?? '—'}
                      {behavioural.psychomotor?.[t.key] ? <span className="text-gray-400 font-normal ml-1">({RATING_LABELS[behavioural.psychomotor[t.key]]})</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TEACHER'S COMMENT */}
      {behavioural?.teacher_comment && (
        <div className="mt-5">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#4A2E1B] mb-2 border-b border-slate-200 pb-1">Class Teacher's Comment</h3>
          <p className="text-xs italic text-gray-700 bg-slate-50 border border-slate-200 rounded-lg p-3">"{behavioural.teacher_comment}"</p>
        </div>
      )}

      {/* FOOTER — Name on left, Stamp with Signature inside on right */}
      <div className="mt-10 pt-6 border-t-2 border-dashed border-slate-300 flex items-end justify-between px-4 sm:px-12">
        
        {/* Left Side: Name then Title */}
        <div className="text-center w-56 pb-2">
          <p className="text-sm font-black text-gray-900 border-b border-black pb-1 mb-1">{PROPRIETOR_NAME}</p>
          <p className="text-xs font-bold text-[#4A2E1B] uppercase tracking-wider">Proprietress</p>
        </div>

        {/* Right Side: Stamp with Signature inside */}
        <div className="relative w-36 h-36 flex items-center justify-center">
          {/* The Stamp (Background) */}
          <img
            src={SCHOOL_STAMP_URL}
            alt="School Stamp"
            className="stamp-img absolute inset-0 w-full h-full object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
          {/* The Signature (Foreground) */}
          <img
            src={PROPRIETOR_SIGNATURE_URL}
            alt="Proprietor's Signature"
            className="signature-img relative z-10 max-h-20 max-w-[120px] object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>

      </div>

      <p className="text-[10px] text-center text-gray-400 mt-6 italic">
        Generated by The Trustworthy Schools Portal · {new Date().toLocaleDateString()}
      </p>
    </div>
  )
}

/* ============================================================================
   SMALL HELPERS
   ============================================================================ */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500">{label}:</span>
      <span className="font-bold text-[#4A2E1B] text-right">{value}</span>
    </div>
  )
}