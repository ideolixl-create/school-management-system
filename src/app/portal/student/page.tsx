'use client'

/* ============================================================================
   THE TRUSTWORTHY SCHOOLS — STUDENT PORTAL
   ============================================================================ */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ReportCard, { loadReportCardData, type ReportCardData } from '@/components/ReportCard'

/* ============================================================================
   TYPES
   ============================================================================ */

type Student = {
  id: string
  admission_number: string
  full_name: string
  class_id: string | null
  gender: 'Male' | 'Female' | null
  date_of_birth: string | null
  passport_url: string | null
}

type ClassRow = { id: string; name: string }
type SubjectRow = { id: string; name: string }

type ReportCardPub = {
  id: string
  class_id: string
  term: string
  session: string
  published_at: string
}

type CbtExam = {
  id: string
  title: string
  class_id: string
  subject_id: string
  duration_minutes: number
  session: string
  term: string
  status: 'draft' | 'published'
  start_at: string | null
  end_at: string | null
  shuffle_questions: boolean
  shuffle_options: boolean
  max_attempts: number
  instructions: string | null
  has_theory: boolean
}

type CbtQuestion = {
  id: string
  exam_id: string
  question_text: string
  option_a: string | null
  option_b: string | null
  option_c: string | null
  option_d: string | null
  correct_answer: 'A' | 'B' | 'C' | 'D' | null
  marks: number
  type: 'objective' | 'theory'
}

type Attempt = {
  id: string
  exam_id: string
  student_id: string
  started_at: string | null
  submitted_at: string | null
  answers: Record<string, 'A' | 'B' | 'C' | 'D'>
  theory_answers: Record<string, string>
  status: 'in_progress' | 'submitted' | 'auto_submitted' | 'pending_manual_marking' | 'graded'
  tab_switch_count: number
  duration_spent_seconds: number | null
  score: number | null
  total_marks: number | null
  final_score: number | null
  extended_minutes: number
}

type Announcement = {
  id: string
  title: string
  body: string
  audience: 'all' | 'students' | 'teachers' | 'class'
  class_id: string | null
  attachment_url: string | null
  attachment_name: string | null
  pinned: boolean
  published_at: string
  expires_at: string | null
}

type Toast = { id: number; msg: string; tone: 'success' | 'error' | 'info' | 'warn' }

/* ============================================================================
   HELPERS
   ============================================================================ */

const SCHOOL = {
  name: 'The Trustworthy Schools',
  motto: 'Nurture for Piety',
  logo: 'https://raw.githubusercontent.com/ideolixlearninghub/Trustworthy_schoolsexam/main/The%20trustworthy%20school%20logo.jpg',
}

function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  const rand = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function fmtTime(seconds: number): string {
  if (seconds <= 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function isWithinWindow(exam: CbtExam): boolean {
  const now = Date.now()
  if (exam.start_at && new Date(exam.start_at).getTime() > now) return false
  if (exam.end_at && new Date(exam.end_at).getTime() < now) return false
  return true
}

function StudentAvatar({
  student,
  size = 40,
  height,
  ring = 'ring-white/40',
  shape = 'circle',
}: {
  student: Pick<Student, 'full_name' | 'passport_url'>
  size?: number
  height?: number
  ring?: string
  shape?: 'circle' | 'square'
}) {
  const initials = student.full_name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-lg'
  const w = size
  const h = height ?? size

  if (student.passport_url) {
    return (
      <img
        src={student.passport_url}
        alt={student.full_name}
        className={`${radius} object-cover bg-white shrink-0 ring-2 ${ring}`}
        style={{ width: w, height: h }}
        onError={(e) => {
          const img = e.currentTarget as HTMLImageElement
          img.style.display = 'none'
          const fallback = img.nextElementSibling as HTMLElement | null
          if (fallback) fallback.style.display = 'flex'
        }}
      />
    )
  }

  return (
    <div
      className={`${radius} bg-pink-500 text-white font-black flex items-center justify-center shrink-0 ring-2 ${ring}`}
      style={{ width: w, height: h, fontSize: Math.min(w, h) * 0.4 }}
    >
      {initials || '👤'}
    </div>
  )
}

function GlobalStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          input, select, textarea, option {
            color: #1A2332 !important;
            background-color: #ffffff;
          }
          input::placeholder, textarea::placeholder {
            color: #94a3b8 !important;
            opacity: 1;
          }
          select option { color: #1A2332; background-color: #ffffff; }
          input:-webkit-autofill {
            -webkit-text-fill-color: #1A2332 !important;
          }
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; }
            @page { size: A4 portrait; margin: 12mm; }
          }
        `,
      }}
    />
  )
}

/* ============================================================================
   MAIN COMPONENT
   ============================================================================ */

export default function StudentPortal() {
  const router = useRouter()
  const [student, setStudent] = useState<Student | null>(null)
  const [klass, setKlass] = useState<ClassRow | null>(null)
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [booting, setBooting] = useState(true)

  const [view, setView] = useState<'report' | 'exams' | 'exam-take' | 'news'>('report')
  const [activeExam, setActiveExam] = useState<CbtExam | null>(null)

  const [toasts, setToasts] = useState<Toast[]>([])
  const showToast = useCallback((msg: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/me/student', { cache: 'no-store' })
        if (cancelled) return

        if (!res.ok) {
          router.replace('/login')
          return
        }

        const data = await res.json()
        setStudent(data.student)

        if (data.student.class_id) {
          const { data: c } = await supabase.from('classes').select('*').eq('id', data.student.class_id).maybeSingle()
          setKlass(c as ClassRow)
        }
        const { data: s } = await supabase.from('subjects').select('*').order('name')
        setSubjects((s || []) as SubjectRow[])
        setBooting(false)
      } catch {
        router.replace('/login')
      }
    })()
    return () => { cancelled = true }
  }, [router])

  async function handleLogout() {
    try {
      await fetch('/api/logout', { method: 'POST' })
    } catch {}
    router.push('/login')
  }

  if (booting) return <div className="min-h-screen flex items-center justify-center text-sm italic text-gray-500">Verifying session...</div>
  if (!student) return null

  if (view === 'exam-take' && activeExam) {
    return (
      <>
        <GlobalStyles />
        <ExamRunner
          exam={activeExam}
          student={student}
          onFinish={() => {
            setActiveExam(null)
            setView('exams')
          }}
          showToast={showToast}
          toasts={toasts}
        />
      </>
    )
  }

  return (
    <>
      <GlobalStyles />
      <div className="min-h-screen bg-slate-50 flex flex-col text-gray-800">
        {/* HEADER */}
        <header className="bg-[#4A2E1B] text-white shadow-md border-b-2 border-pink-500 sticky top-0 z-30 no-print">
          <div className="border-b border-white/10">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={SCHOOL.logo}
                  alt={SCHOOL.name}
                  className="w-9 h-9 rounded-full bg-white p-0.5 object-contain shrink-0 ring-1 ring-pink-300/50"
                />
                <div className="min-w-0 leading-tight">
                  <p className="text-xs sm:text-sm font-black tracking-wide truncate">
                    {SCHOOL.name.toUpperCase()}
                  </p>
                  <p className="text-[10px] text-pink-300 italic truncate">
                    Motto: {SCHOOL.motto}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-red-500 shrink-0"
              >
                Log Out
              </button>
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
            <div className="relative shrink-0">
              <StudentAvatar
                student={student}
                size={60}
                height={76}
                shape="square"
                ring="ring-pink-400/60"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-[#4A2E1B]" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-pink-300 font-bold">Welcome back</p>
              <h2 className="font-black text-base sm:text-lg truncate">{student.full_name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 ring-1 ring-white/20">
                  {student.admission_number}
                </span>
                {klass?.name && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-200 ring-1 ring-pink-400/40">
                    {klass.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* TABS */}
        <div className="bg-white border-b border-slate-200 no-print">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="flex gap-1 overflow-x-auto">
              <TabBtn id="report" current={view} onClick={setView} label="📋 My Report Card" />
              <TabBtn id="exams" current={view} onClick={setView} label="🎯 My Exams" />
              <TabBtn id="news" current={view} onClick={setView} label="📢 News" />
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <main className="flex-1">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
            {view === 'report' && (
              <ReportCardTab student={student} klass={klass} subjects={subjects} showToast={showToast} />
            )}
            {view === 'exams' && (
              <ExamsListTab
                student={student}
                subjects={subjects}
                showToast={showToast}
                onStart={(exam) => { setActiveExam(exam); setView('exam-take') }}
              />
            )}
            {view === 'news' && (
              <NewsTab student={student} showToast={showToast} />
            )}
          </div>
        </main>

        {/* TOASTS */}
        <div className="fixed bottom-6 right-6 z-[100] space-y-3 pointer-events-none no-print">
          {toasts.map((t) => (
            <div key={t.id} className={`pointer-events-auto px-4 py-3 rounded-xl shadow-2xl text-white text-xs font-semibold max-w-sm border-l-4 ${
              t.tone === 'success' ? 'bg-emerald-600 border-emerald-300' :
              t.tone === 'error' ? 'bg-red-600 border-red-300' :
              t.tone === 'warn' ? 'bg-amber-600 border-amber-300' :
              'bg-[#4A2E1B] border-pink-400'
            }`}>{t.msg}</div>
          ))}
        </div>

        <footer className="bg-[#2D1B0F] text-white py-4 px-6 text-center text-[11px] border-t border-pink-500/30 no-print">
          {SCHOOL.name} · Student Portal · {new Date().getFullYear()}
        </footer>
      </div>
    </>
  )
}

function TabBtn({
  id, current, onClick, label,
}: {
  id: 'report' | 'exams' | 'exam-take' | 'news'
  current: string
  onClick: (v: 'report' | 'exams' | 'exam-take' | 'news') => void
  label: string
}) {
  const active = current === id
  return (
    <button
      onClick={() => onClick(id)}
      className={`whitespace-nowrap px-4 py-3.5 text-xs font-bold border-b-2 transition ${
        active ? 'border-pink-600 text-[#4A2E1B]' : 'border-transparent text-gray-500 hover:text-[#4A2E1B]'
      }`}
    >
      {label}
    </button>
  )
}

/* ============================================================================
   TAB: REPORT CARD (Uses new shared component)
   ============================================================================ */

function ReportCardTab({
  student, klass, subjects, showToast,
}: {
  student: Student
  klass: ClassRow | null
  subjects: SubjectRow[]
  showToast: (m: string, t?: Toast['tone']) => void
}) {
  const [publications, setPublications] = useState<ReportCardPub[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ReportCardPub | null>(null)
  const [reportData, setReportData] = useState<ReportCardData | null>(null)
  const [loadingCard, setLoadingCard] = useState(false)

  useEffect(() => {
    if (!student.class_id) { setLoading(false); return }
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('report_card_publications')
        .select('*')
        .eq('class_id', student.class_id)
        .order('published_at', { ascending: false })
      if (error) showToast('Failed to load report cards.', 'error')
      setPublications((data || []) as ReportCardPub[])
      setLoading(false)
    })()
  }, [student.class_id, showToast])

  useEffect(() => {
    if (!selected || !student.class_id) return
    ;(async () => {
      setLoadingCard(true)
      // Use the shared loader from ReportCard.tsx
      const data = await loadReportCardData(student, selected.term, selected.session)
      setReportData(data)
      setLoadingCard(false)
    })()
  }, [selected, student])

  if (loading) return <div className="text-center py-20 text-sm text-gray-500 italic">Loading…</div>

  if (publications.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-12 text-center">
        <p className="text-4xl mb-3">📭</p>
        <h2 className="text-base font-bold text-[#4A2E1B]">No Report Cards Available</h2>
        <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto">
          Your report cards will appear here once the school publishes them. Please check back later.
        </p>
      </div>
    )
  }

  if (selected) {
    return (
      <>
        <div className="no-print mb-4 flex justify-between items-center">
          <button
            onClick={() => { setSelected(null); setReportData(null) }}
            className="text-xs font-bold text-gray-600 hover:text-[#4A2E1B]"
          >
            ← Back to Report Cards
          </button>
          <button
            onClick={() => window.print()}
            className="text-xs font-bold bg-[#4A2E1B] text-white px-4 py-2.5 rounded-xl hover:bg-[#382213]"
          >
            🖨️ Print / Save as PDF
          </button>
        </div>

        {loadingCard ? (
          <div className="text-center py-20 text-sm text-gray-500 italic">Loading report card…</div>
        ) : reportData ? (
          <ReportCard data={reportData} />
        ) : (
          <div className="text-center py-20 text-sm text-gray-500 italic">Failed to load report card data.</div>
        )}
      </>
    )
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5">
        <h2 className="text-sm font-bold text-[#4A2E1B]">Published Report Cards</h2>
        <p className="text-xs text-gray-500 mt-0.5">{publications.length} available</p>
      </div>
      {publications.map((p) => (
        <button
          key={p.id}
          onClick={() => setSelected(p)}
          className="w-full bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5 hover:ring-pink-300 hover:bg-pink-50/30 transition text-left flex items-center justify-between gap-3"
        >
          <div>
            <p className="text-sm font-bold text-[#4A2E1B]">{p.term} Report Card</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {p.session} · Published {new Date(p.published_at).toLocaleDateString()}
            </p>
          </div>
          <span className="text-xs font-bold text-pink-600">View →</span>
        </button>
      ))}
    </div>
  )
}

/* ============================================================================
   TAB: EXAMS LIST
   ============================================================================ */

function ExamsListTab({
  student, subjects, showToast, onStart,
}: {
  student: Student
  subjects: SubjectRow[]
  showToast: (m: string, t?: Toast['tone']) => void
  onStart: (exam: CbtExam) => void
}) {
  const [exams, setExams] = useState<CbtExam[]>([])
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)
  const [rulesFor, setRulesFor] = useState<CbtExam | null>(null)

  const subjectById = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s.name])), [subjects])
  const attemptByExam = useMemo(() => Object.fromEntries(attempts.map((a) => [a.exam_id, a])), [attempts])

  useEffect(() => {
    if (!student.class_id) { setLoading(false); return }
    ;(async () => {
      setLoading(true)

      const [ex, att] = await Promise.all([
        supabase.from('cbt_exams').select('*')
          .eq('class_id', student.class_id)
          .eq('status', 'published')
          .order('created_at', { ascending: false }),
        supabase.from('cbt_attempts').select('*')
          .eq('student_id', student.id),
      ])

      const list = (ex.data || []) as CbtExam[]
      setExams(list)
      setAttempts((att.data || []) as Attempt[])

      if (list.length > 0) {
        const ids = list.map((e) => e.id)
        const { data: qs } = await supabase.from('cbt_questions').select('exam_id, type').in('exam_id', ids)
        const counts: Record<string, number> = {}
        ;(qs || []).forEach((q: any) => {
          if (q.type === 'objective') counts[q.exam_id] = (counts[q.exam_id] || 0) + 1
        })
        setQuestionCounts(counts)
      }

      setLoading(false)
    })()
  }, [student.class_id, student.id])

  async function beginExam(exam: CbtExam) {
    setStarting(exam.id)

    const existing = attempts.find((a) => a.exam_id === exam.id)

    if (existing && existing.status !== 'in_progress') {
      showToast('You have already taken this exam.', 'warn')
      setStarting(null)
      return
    }

    if (existing && existing.status === 'in_progress') {
      showToast('Resuming your attempt…', 'info')
      setTimeout(() => { onStart(exam); setStarting(null) }, 400)
      return
    }

    const { error } = await supabase.from('cbt_attempts').insert([{
      exam_id: exam.id,
      student_id: student.id,
      status: 'in_progress',
      answers: {},
      theory_answers: {},
      tab_switch_count: 0,
      extended_minutes: 0,
    }])

    if (error) {
      showToast(`Could not start: ${error.message}`, 'error')
      setStarting(null)
      return
    }

    setStarting(null)
    onStart(exam)
  }

  if (loading) {
    return <div className="text-center py-20 text-sm text-gray-500 italic">Loading exams…</div>
  }

  if (exams.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-12 text-center">
        <p className="text-4xl mb-3">📭</p>
        <h2 className="text-base font-bold text-[#4A2E1B]">No Exams Available</h2>
        <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto">
          There are no published exams for your class right now. Check back later.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5">
          <h2 className="text-sm font-bold text-[#4A2E1B]">Your Exams</h2>
          <p className="text-xs text-gray-500 mt-0.5">{exams.length} available</p>
        </div>

        {exams.map((ex) => {
          const att = attemptByExam[ex.id]
          const submitted = att && att.status !== 'in_progress'
          const inProgress = att && att.status === 'in_progress'
          const withinWindow = isWithinWindow(ex)
          const qCount = questionCounts[ex.id] || 0

          const statusLabel = submitted ? 'Submitted' : inProgress ? 'In Progress' : withinWindow ? 'Available' : 'Not Open Yet'
          const statusTone =
            submitted ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
            inProgress ? 'bg-amber-50 text-amber-700 ring-amber-200' :
            withinWindow ? 'bg-pink-50 text-pink-700 ring-pink-200' :
            'bg-slate-100 text-gray-600 ring-slate-200'

          return (
            <div key={ex.id} className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-[#4A2E1B]">{ex.title}</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {subjectById[ex.subject_id]} · {ex.term} · {ex.session}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ring-1 uppercase ${statusTone}`}>
                  {statusLabel}
                </span>
              </div>

              <div className="flex flex-wrap gap-3 text-[11px] text-gray-600">
                <span>📝 {qCount} questions</span>
                <span>⏱ {ex.duration_minutes} min</span>
                {ex.start_at && <span>🕐 Opens {new Date(ex.start_at).toLocaleString()}</span>}
                {ex.end_at && <span>🕐 Closes {new Date(ex.end_at).toLocaleString()}</span>}
              </div>

              {submitted && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-[11px] text-emerald-800 font-medium">
                  ✅ Submitted on {new Date(att.submitted_at || '').toLocaleString()}. Your score will be released by the admin.
                </div>
              )}

              {!submitted && withinWindow && (
                <button
                  onClick={() => setRulesFor(ex)}
                  disabled={starting === ex.id}
                  className="w-full bg-pink-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-pink-700 disabled:opacity-50"
                >
                  {starting === ex.id ? 'Starting…' : inProgress ? 'Resume Exam →' : 'Start Exam →'}
                </button>
              )}

              {!submitted && !withinWindow && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[11px] text-gray-500 text-center">
                  This exam is not currently open.
                </div>
              )}
            </div>
          )
        })}
      </div>

      {rulesFor && (
        <RulesModal
          exam={rulesFor}
          questionCount={questionCounts[rulesFor.id] || 0}
          onCancel={() => setRulesFor(null)}
          onBegin={() => { const e = rulesFor; setRulesFor(null); beginExam(e) }}
        />
      )}
    </>
  )
}

function RulesModal({
  exam, questionCount, onCancel, onBegin,
}: {
  exam: CbtExam
  questionCount: number
  onCancel: () => void
  onBegin: () => void
}) {
  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-8">
        <div className="bg-[#4A2E1B] text-white p-5 border-b-4 border-pink-500">
          <h3 className="font-black text-base">{exam.title}</h3>
          <p className="text-xs text-pink-300 mt-1">Read carefully before you begin</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase text-gray-500">Questions</p>
              <p className="text-xl font-black text-[#4A2E1B] mt-1">{questionCount}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase text-gray-500">Duration</p>
              <p className="text-xl font-black text-[#4A2E1B] mt-1">{exam.duration_minutes}m</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase text-gray-500">Attempts</p>
              <p className="text-xl font-black text-[#4A2E1B] mt-1">{exam.max_attempts}</p>
            </div>
          </div>

          {exam.instructions && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
              <p className="font-bold mb-1">Instructions:</p>
              <p className="italic">{exam.instructions}</p>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs text-gray-700">
            <p className="font-bold text-[#4A2E1B]">Please note:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                You have <strong>{exam.max_attempts} attempt{exam.max_attempts === 1 ? '' : 's'}</strong>.
                The timer starts when you click Begin.
              </li>
              <li>Your answers are <strong>saved automatically</strong> — you can safely close the tab and resume.</li>
              <li>If your time runs out, the exam submits automatically.</li>
              <li>Do not leave this page during the exam. Leaving multiple times will be logged.</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button onClick={onCancel} className="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-slate-100">
              Cancel
            </button>
            <button onClick={onBegin} className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-700">
              Begin Exam →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
   EXAM RUNNER (FULLSCREEN)
   ============================================================================ */

function ExamRunner({
  exam, student, onFinish, showToast, toasts,
}: {
  exam: CbtExam
  student: Student
  onFinish: () => void
  showToast: (m: string, t?: Toast['tone']) => void
  toasts: Toast[]
}) {
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [questions, setQuestions] = useState<CbtQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState<number>(exam.duration_minutes * 60)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const tabSwitchRef = useRef(0)
  const submittedRef = useRef(false)
  const autoSubmittedRef = useRef(false)

  useEffect(() => {
    ;(async () => {
      setLoading(true)

      let { data: att } = await supabase
        .from('cbt_attempts').select('*')
        .eq('exam_id', exam.id)
        .eq('student_id', student.id)
        .maybeSingle()

      if (!att) {
        const { data: created, error } = await supabase.from('cbt_attempts').insert([{
          exam_id: exam.id,
          student_id: student.id,
          status: 'in_progress',
          answers: {},
          theory_answers: {},
          tab_switch_count: 0,
          extended_minutes: 0,
        }]).select().single()
        if (error) { showToast(`Could not start attempt: ${error.message}`, 'error'); setLoading(false); return }
        att = created
      }

      setAttempt(att as Attempt)
      setAnswers((att as any).answers || {})
      tabSwitchRef.current = (att as any).tab_switch_count || 0

      const { data: qs } = await supabase
        .from('cbt_questions').select('*')
        .eq('exam_id', exam.id)
        .eq('type', 'objective')
        .order('created_at')

      const rawList = (qs || []) as CbtQuestion[]
      const ordered = exam.shuffle_questions
        ? seededShuffle(rawList, `q-${exam.id}-${student.id}`)
        : rawList
      setQuestions(ordered)

      const startedAt = new Date((att as any).started_at || Date.now()).getTime()
      const totalMs = (exam.duration_minutes + ((att as any).extended_minutes || 0)) * 60 * 1000
      const elapsed = Date.now() - startedAt
      const remaining = Math.max(0, Math.floor((totalMs - elapsed) / 1000))
      setSecondsLeft(remaining)

      setLoading(false)
    })()
  }, [exam.id, student.id, exam.duration_minutes, exam.shuffle_questions, showToast])

  useEffect(() => {
    if (submittedRef.current) return
    const onVis = () => {
      if (document.hidden) {
        tabSwitchRef.current += 1
        if (attempt) {
          supabase.from('cbt_attempts').update({ tab_switch_count: tabSwitchRef.current }).eq('id', attempt.id).then(() => {})
        }
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [attempt])

  useEffect(() => {
    if (submittedRef.current || loading) return
    if (secondsLeft <= 0) {
      if (!autoSubmittedRef.current) {
        autoSubmittedRef.current = true
        void doSubmit(true)
      }
      return
    }
    const i = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => clearInterval(i)
  }, [loading, secondsLeft])

  async function pickAnswer(questionId: string, choice: 'A' | 'B' | 'C' | 'D') {
    if (!attempt) return
    const next = { ...answers, [questionId]: choice }
    setAnswers(next)
    const { error } = await supabase.from('cbt_attempts').update({ answers: next }).eq('id', attempt.id)
    if (error) showToast('Could not save answer — check your connection.', 'error')
  }

  async function doSubmit(auto = false) {
    if (submittedRef.current || !attempt) return
    submittedRef.current = true
    setSubmitting(true)

    let score = 0
    let totalMarks = 0
    questions.forEach((q) => {
      totalMarks += q.marks || 1
      if (answers[q.id] && answers[q.id] === q.correct_answer) score += q.marks || 1
    })

    const startedAt = new Date(attempt.started_at || Date.now()).getTime()
    const duration = Math.floor((Date.now() - startedAt) / 1000)

    const { error } = await supabase.from('cbt_attempts').update({
      status: auto ? 'auto_submitted' : 'submitted',
      submitted_at: new Date().toISOString(),
      score,
      total_marks: totalMarks,
      final_score: exam.has_theory ? null : score,
      duration_spent_seconds: duration,
    }).eq('id', attempt.id)

    setSubmitting(false)

    if (error) {
      showToast(`Submit failed: ${error.message}`, 'error')
      submittedRef.current = false
      return
    }

    setSubmitted(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-gray-500 italic">Loading exam…</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 max-w-md w-full p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-50 ring-1 ring-emerald-200 mx-auto flex items-center justify-center text-3xl">✅</div>
          <h1 className="text-xl font-black text-[#4A2E1B]">Submitted Successfully</h1>
          <p className="text-sm text-gray-600">
            Your answers have been recorded. Your score will be released by the admin.
          </p>
          <button
            onClick={onFinish}
            className="w-full bg-[#4A2E1B] text-white py-3 rounded-xl text-sm font-bold hover:bg-[#382213]"
          >
            Back to My Exams
          </button>
        </div>
        <div className="fixed bottom-6 right-6 space-y-3 pointer-events-none">
          {toasts.map((t) => (
            <div key={t.id} className={`pointer-events-auto px-4 py-3 rounded-xl shadow-2xl text-white text-xs font-semibold max-w-sm border-l-4 ${
              t.tone === 'success' ? 'bg-emerald-600 border-emerald-300' :
              t.tone === 'error' ? 'bg-red-600 border-red-300' :
              t.tone === 'warn' ? 'bg-amber-600 border-amber-300' :
              'bg-[#4A2E1B] border-pink-400'
            }`}>{t.msg}</div>
          ))}
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 max-w-md w-full p-8 text-center space-y-4">
          <h1 className="text-lg font-black text-[#4A2E1B]">No Questions Available</h1>
          <p className="text-sm text-gray-600">
            This exam has no objective questions yet. Please contact your school administrator.
          </p>
          <button onClick={onFinish} className="w-full bg-[#4A2E1B] text-white py-3 rounded-xl text-sm font-bold hover:bg-[#382213]">
            Back to My Exams
          </button>
        </div>
      </div>
    )
  }

  const q = questions[currentIdx]
  const answeredCount = Object.keys(answers).length
  const answeredPct = (answeredCount / questions.length) * 100
  const isLowTime = secondsLeft <= 60

  const displayOptions = (() => {
    const opts = ([
      { key: 'A', text: q.option_a },
      { key: 'B', text: q.option_b },
      { key: 'C', text: q.option_c },
      { key: 'D', text: q.option_d },
    ] as const).filter((o) => o.text)
    if (!exam.shuffle_options) return opts
    return seededShuffle(opts, `o-${exam.id}-${student.id}-${q.id}`)
  })()

  return (
    <>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className={`sticky top-0 z-30 text-white shadow-md border-b-4 ${isLowTime ? 'bg-red-700 border-red-900 animate-pulse' : 'bg-[#4A2E1B] border-pink-500'}`}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-black truncate">{exam.title}</h1>
              <p className="text-[10px] text-pink-200 truncate">
                {student.full_name} · {student.admission_number}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase opacity-80">Time Left</p>
              <p className={`text-xl sm:text-2xl font-black tabular-nums ${isLowTime ? 'text-white' : 'text-pink-300'}`}>
                {fmtTime(secondsLeft)}
              </p>
            </div>
          </div>
          <div className="h-1 bg-black/20">
            <div className="h-full bg-pink-400 transition-all" style={{ width: `${answeredPct}%` }} />
          </div>
        </header>

        <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p className="text-xs font-bold text-[#4A2E1B]">
              Question {currentIdx + 1} of {questions.length} · {answeredCount} answered
            </p>
            <div className="flex flex-wrap gap-1 max-w-full overflow-x-auto">
              {questions.map((qq, i) => {
                const isCurrent = i === currentIdx
                const isAnswered = !!answers[qq.id]
                return (
                  <button
                    key={qq.id}
                    onClick={() => setCurrentIdx(i)}
                    className={`w-7 h-7 rounded-md text-[10px] font-bold transition ${
                      isCurrent ? 'bg-[#4A2E1B] text-white' :
                      isAnswered ? 'bg-emerald-500 text-white' :
                      'bg-slate-200 text-gray-700 hover:bg-slate-300'
                    }`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 sm:p-8 select-none">
            <div className="flex items-start gap-3 mb-5">
              <span className="shrink-0 w-8 h-8 rounded-lg bg-[#4A2E1B] text-white text-xs font-bold flex items-center justify-center">
                {currentIdx + 1}
              </span>
              <p className="text-sm sm:text-base font-medium text-[#4A2E1B] flex-1 leading-relaxed">{q.question_text}</p>
              <span className="text-[10px] font-bold text-gray-500 shrink-0">{q.marks} mark{q.marks === 1 ? '' : 's'}</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {displayOptions.map((opt) => {
                const chosen = answers[q.id] === opt.key
                return (
                  <button
                    key={opt.key}
                    onClick={() => pickAnswer(q.id, opt.key)}
                    className={`text-left px-4 py-3.5 rounded-xl border-2 transition flex items-center gap-3 ${
                      chosen
                        ? 'bg-pink-50 border-pink-500 ring-2 ring-pink-200'
                        : 'bg-white border-slate-200 hover:border-pink-300 hover:bg-pink-50/40'
                    }`}
                  >
                    <span className={`shrink-0 w-8 h-8 rounded-lg font-bold text-sm flex items-center justify-center ${
                      chosen ? 'bg-pink-600 text-white' : 'bg-slate-100 text-gray-700'
                    }`}>
                      {opt.key}
                    </span>
                    <span className="text-sm text-gray-800 flex-1">{opt.text}</span>
                    {chosen && <span className="text-pink-600 font-bold">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex justify-between items-center gap-3 mt-5">
            <button
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="bg-white ring-1 ring-slate-200 text-gray-700 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 disabled:opacity-40"
            >
              ← Previous
            </button>

            {currentIdx < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                className="bg-[#4A2E1B] text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-[#382213]"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => setConfirmSubmit(true)}
                className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-700"
              >
                Submit Exam
              </button>
            )}
          </div>

          <div className="text-center mt-4">
            <button
              onClick={() => setConfirmSubmit(true)}
              className="text-[11px] font-bold text-gray-500 hover:text-pink-600 underline"
            >
              Submit early
            </button>
          </div>
        </main>

        <div className="fixed bottom-6 right-6 z-[100] space-y-3 pointer-events-none">
          {toasts.map((t) => (
            <div key={t.id} className={`pointer-events-auto px-4 py-3 rounded-xl shadow-2xl text-white text-xs font-semibold max-w-sm border-l-4 ${
              t.tone === 'success' ? 'bg-emerald-600 border-emerald-300' :
              t.tone === 'error' ? 'bg-red-600 border-red-300' :
              t.tone === 'warn' ? 'bg-amber-600 border-amber-300' :
              'bg-[#4A2E1B] border-pink-400'
            }`}>{t.msg}</div>
          ))}
        </div>

        {confirmSubmit && (
          <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
              <h3 className="font-bold text-[#4A2E1B] text-base">Submit Exam?</h3>
              <p className="text-sm text-gray-600 mt-1">
                You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
                {answeredCount < questions.length && <> Unanswered questions will be marked as blank.</>}
                {' '}This cannot be undone.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setConfirmSubmit(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setConfirmSubmit(false); void doSubmit(false) }}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Submit Now'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/* ============================================================================
   TAB: NEWS & ANNOUNCEMENTS
   ============================================================================ */

function NewsTab({
  student, showToast,
}: {
  student: Student
  showToast: (m: string, t?: Toast['tone']) => void
}) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)

      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .in('audience', ['all', 'students', 'class'])
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false })

      if (error) {
        showToast('Could not load news.', 'error')
        setLoading(false)
        return
      }

      if (cancelled) return

      const now = Date.now()
      const filtered = (data || []).filter((a: any) => {
        if (a.audience === 'class') {
          if (!student.class_id || a.class_id !== student.class_id) return false
        }
        if (a.expires_at && new Date(a.expires_at).getTime() < now) return false
        return true
      })

      setAnnouncements(filtered as Announcement[])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [student.class_id, showToast])

  if (loading) {
    return <div className="text-center py-20 text-sm text-gray-500 italic">Loading news…</div>
  }

  if (announcements.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-12 text-center">
        <p className="text-4xl mb-3">📭</p>
        <h2 className="text-base font-bold text-[#4A2E1B]">No News Yet</h2>
        <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto">
          There are no announcements for you right now. Check back later.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5">
        <h2 className="text-sm font-bold text-[#4A2E1B]">News &amp; Announcements</h2>
        <p className="text-xs text-gray-500 mt-0.5">{announcements.length} item(s)</p>
      </div>

      {announcements.map((a) => (
        <div key={a.id} className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              {a.pinned && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                  📌 Pinned
                </span>
              )}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 ring-1 ring-pink-200 uppercase">
                {a.audience === 'class' ? 'Your Class' : a.audience === 'students' ? 'Students' : 'General'}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 whitespace-nowrap shrink-0">
              {new Date(a.published_at).toLocaleDateString()}
            </p>
          </div>

          <h3 className="text-sm font-bold text-[#4A2E1B]">{a.title}</h3>
          <p className="text-xs text-gray-700 mt-2 whitespace-pre-wrap leading-relaxed">{a.body}</p>

          {a.attachment_url && (
            <a
              href={a.attachment_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 mt-3 bg-pink-50 text-pink-700 ring-1 ring-pink-200 px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-pink-100"
            >
              📎 {a.attachment_name || 'Download attachment'}
            </a>
          )}

          {a.expires_at && (
            <p className="text-[10px] text-gray-400 mt-2 italic">
              Expires {new Date(a.expires_at).toLocaleDateString()}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}