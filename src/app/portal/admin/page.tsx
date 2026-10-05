'use client'

/* ============================================================================
   THE TRUSTWORTHY SCHOOLS — ADMIN CONTROL CENTER
   v5.0 — News/Announcements with PDF + Clear Broadsheet
   ============================================================================ */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

/* ============================================================================
   CONFIG
   ============================================================================ */

const ADMIN_PASSWORD = 'f09b302c@2TS'
const SESSION_KEY = 'tts.admin.session'
const SESSION_MINUTES = 30
const LIVE_REFRESH_MS = 10000

const SCHOOL = {
  name: 'The Trustworthy Schools',
  motto: 'Nurture for Piety',
  address: '1, CTCS Avenue, Coca Cola Junction, Unity Estate, Orimerunmu Mowe, Ogun State',
  phones: ['08037376160', '08037173526', '08156320986'],
  email: 'trustworthysch16@gmail.com',
  website: 'www.thetrustworthyschools.com',
  logo: 'https://raw.githubusercontent.com/ideolixlearninghub/Trustworthy_schoolsexam/main/The%20trustworthy%20school%20logo.jpg',
  session: '2025/2026',
  version: '5.0',
}

const TERMS = ['First Term', 'Second Term', 'Third Term'] as const
type Term = typeof TERMS[number]

const GRADE_SCALE = [
  { g: 'A1', min: 70 }, { g: 'B2', min: 65 }, { g: 'B3', min: 60 },
  { g: 'C4', min: 55 }, { g: 'C5', min: 50 }, { g: 'C6', min: 45 },
  { g: 'D7', min: 40 }, { g: 'E8', min: 35 }, { g: 'F9', min: 0 },
]

/* ============================================================================
   TYPES
   ============================================================================ */

type ClassRow = { id: string; name: string }
type SubjectRow = { id: string; name: string }

type Teacher = {
  id: string
  staff_id: string
  full_name: string
  email: string
  password: string | null
  phone: string | null
  role_type: 'subject' | 'class' | 'both'
  assigned_class_id: string | null
  assigned_subjects: string | null
  created_at?: string
}

type Student = {
  id: string
  admission_number: string
  full_name: string
  password: string | null
  class_id: string | null
  gender: 'Male' | 'Female' | null
  date_of_birth: string | null
  parent_phone: string | null
  created_at?: string
}

type Question = {
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
  theory_answer_guide: string | null
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
  total_marks: number | null
  published_by: string | null
  published_at: string | null
  created_at: string
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
  graded_by: string | null
  graded_at: string | null
}

type ScoreRow = {
  id: string
  student_id: string
  subject_id: string
  class_id: string | null
  test_score: number | null
  exam_score: number | null
  total_score: number
  term: string
  session: string
}

type ReportCardPub = {
  id: string
  class_id: string
  term: string
  session: string
  published_at: string
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
  created_by: string | null
  created_at: string
}

type AuditEntry = { ts: number; action: string; detail: string }
type Toast = { id: number; msg: string; tone: 'success' | 'error' | 'info' | 'warn' }

/* ============================================================================
   HELPERS
   ============================================================================ */

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

function normalizeHeader(h: string): string {
  return String(h).trim().toLowerCase().replace(/\s+/g, '_')
}

function normalizeName(s: string): string {
  return String(s).trim().toLowerCase().replace(/\s+/g, ' ')
}

function toTitleCase(s: string): string {
  return String(s)
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ')
    .replace(/\bAl-([a-z])/gi, (_, c: string) => `Al-${c.toUpperCase()}`)
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

function isValidDate(s: string): boolean {
  if (!s) return false
  const d = new Date(s)
  return !isNaN(d.getTime()) && d <= new Date()
}

function randomPassword(len = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let p = ''
  for (let i = 0; i < len; i++) p += chars[Math.floor(Math.random() * chars.length)]
  return p
}

function todayIso(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mn = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${mn}`
}

function fromLocalDatetimeInput(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

function parseDobAny(raw: any): string | null {
  if (raw === '' || raw == null) return null
  if (typeof raw === 'number' && raw > 0 && raw < 100000) {
    const d = XLSX.SSF.parse_date_code(raw)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return null
}

function examDerivedStatus(exam: CbtExam): 'draft' | 'scheduled' | 'live' | 'closed' {
  if (exam.status === 'draft') return 'draft'
  const now = Date.now()
  if (exam.start_at && new Date(exam.start_at).getTime() > now) return 'scheduled'
  if (exam.end_at && new Date(exam.end_at).getTime() < now) return 'closed'
  return 'live'
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${String(s).padStart(2, '0')}s`
}

function computeObjectiveScore(
  answers: Record<string, 'A' | 'B' | 'C' | 'D'>,
  objectiveQuestions: Question[]
): number {
  let score = 0
  objectiveQuestions.forEach((q) => {
    if (answers[q.id] && answers[q.id] === q.correct_answer) score += q.marks
  })
  return score
}

/* ============================================================================
   GLOBAL STYLES
   ============================================================================ */

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
        `,
      }}
    />
  )
}

/* ============================================================================
   ROOT
   ============================================================================ */

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false)
  const [bootChecked, setBootChecked] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) {
      try {
        const s = JSON.parse(raw)
        if (s.expiresAt > Date.now()) setAuthed(true)
        else sessionStorage.removeItem(SESSION_KEY)
      } catch {}
    }
    setBootChecked(true)
  }, [])

  if (!bootChecked) return null
  if (!authed) return <PasswordGate onUnlock={() => setAuthed(true)} />
  return <Console onLogout={() => setAuthed(false)} />
}

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pass === ADMIN_PASSWORD) {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ expiresAt: Date.now() + SESSION_MINUTES * 60 * 1000 })
      )
      onUnlock()
    } else {
      setError('Incorrect admin password.')
      setPass('')
    }
  }

  return (
    <>
      <GlobalStyles />
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white shadow-2xl rounded-2xl border border-pink-200 overflow-hidden">
          <div className="bg-[#4A2E1B] text-white p-6 text-center border-b-4 border-pink-500 relative">
            <button
              onClick={() => (window.location.href = '/login')}
              className="absolute left-4 top-4 bg-[#331E12] text-pink-300 px-3 py-1.5 rounded text-xs font-bold"
            >
              ← Login
            </button>
            <img src={SCHOOL.logo} alt="Logo" className="w-14 h-14 mx-auto rounded-full bg-white p-1 mb-2" />
            <h1 className="text-lg font-extrabold">Admin Control Center</h1>
            <p className="text-xs text-pink-300 mt-1 tracking-widest font-semibold">{SCHOOL.name.toUpperCase()}</p>
          </div>
          <form onSubmit={submit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#4A2E1B] mb-1">Admin Password</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={pass}
                  onChange={(e) => { setPass(e.target.value); setError('') }}
                  autoFocus required placeholder="Enter admin password"
                  className="w-full border p-3 pr-14 rounded-lg text-sm bg-white border-pink-300 focus:ring-2 focus:ring-pink-400 outline-none"
                />
                <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#4A2E1B]">
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-lg px-4 py-3">{error}</div>}
            <button type="submit" className="w-full bg-[#4A2E1B] text-white py-3 rounded-lg font-extrabold text-sm">Unlock Dashboard</button>
          </form>
        </div>
      </div>
    </>
  )
}

/* ============================================================================
   CONSOLE
   ============================================================================ */

type Tab =
  | 'dashboard' | 'students' | 'teachers'
  | 'questions' | 'exams' | 'live' | 'submissions'
  | 'broadsheet' | 'news' | 'audit' | 'settings'

const TAB_TITLES: Record<Tab, string> = {
  dashboard: 'Dashboard',
  students: 'Students Management',
  teachers: 'Teachers Management',
  questions: 'Question Bank',
  exams: 'CBT Exams',
  live: 'Live Monitor',
  submissions: 'Submissions',
  broadsheet: 'Broadsheets & Report Cards',
  news: 'News & Announcements',
  audit: 'Audit Log',
  settings: 'Settings',
}

function Console({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const [classes, setClasses] = useState<ClassRow[]>([])
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [exams, setExams] = useState<CbtExam[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [scores, setScores] = useState<ScoreRow[]>([])
  const [reportCardPub, setReportCardPub] = useState<ReportCardPub[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  const showToast = useCallback((msg: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800)
  }, [])

  const logAction = useCallback((action: string, detail = '') => {
    setAudit((prev) => [{ ts: Date.now(), action, detail }, ...prev].slice(0, 300))
  }, [])

  const askConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmState({ title, message, onConfirm })
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [c, s, st, t, ex, q, rp, an] = await Promise.all([
      supabase.from('classes').select('*').order('name'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('students').select('*').order('full_name'),
      supabase.from('teachers').select('*').order('full_name'),
      supabase.from('cbt_exams').select('*').order('created_at', { ascending: false }),
      supabase.from('cbt_questions').select('*').order('created_at'),
      supabase.from('report_card_publications').select('*'),
      supabase.from('announcements').select('*').order('pinned', { ascending: false }).order('published_at', { ascending: false }),
    ])
    if (c.error) showToast('Failed to load classes.', 'error')
    if (st.error) showToast('Failed to load students.', 'error')
    if (t.error) showToast('Failed to load teachers.', 'error')
    setClasses(c.data || [])
    setSubjects(s.data || [])
    setStudents(st.data || [])
    setTeachers(t.data || [])
    setExams(ex.data || [])
    setQuestions(q.data || [])
    setReportCardPub((rp.data || []) as ReportCardPub[])
    setAnnouncements((an.data || []) as Announcement[])
    setLoading(false)
  }, [showToast])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    if (tab !== 'broadsheet') return
    ;(async () => {
      const { data } = await supabase.from('scores').select('*')
      setScores(data || [])
    })()
  }, [tab])

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY)
    logAction('Admin signed out')
    onLogout()
  }

  return (
    <>
      <GlobalStyles />
      <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
        <aside className={`${mobileNavOpen ? 'block' : 'hidden'} lg:block lg:w-64 shrink-0 bg-[#2D1B0F] text-white border-r border-black/20 lg:sticky lg:top-0 lg:h-screen overflow-y-auto`}>
          <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
            <img src={SCHOOL.logo} alt="Logo" className="w-10 h-10 rounded-xl bg-white p-1 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-pink-400">TTS</p>
              <p className="text-xs font-semibold truncate">Admin Console</p>
            </div>
          </div>
          <nav className="p-3 space-y-0.5 text-sm">
            <NavGroup label="Overview" />
            <NavBtn tab="dashboard" current={tab} onClick={setTab} icon="grid" label="Dashboard" />
            <NavGroup label="People" />
            <NavBtn tab="students" current={tab} onClick={setTab} icon="users" label="Students" />
            <NavBtn tab="teachers" current={tab} onClick={setTab} icon="teach" label="Teachers" />
            <NavGroup label="CBT" />
            <NavBtn tab="questions" current={tab} onClick={setTab} icon="question" label="Question Bank" />
            <NavBtn tab="exams" current={tab} onClick={setTab} icon="clock" label="Exams" />
            <NavBtn tab="live" current={tab} onClick={setTab} icon="activity" label="Live Monitor" />
            <NavBtn tab="submissions" current={tab} onClick={setTab} icon="check" label="Submissions" />
            <NavGroup label="Results" />
            <NavBtn tab="broadsheet" current={tab} onClick={setTab} icon="table" label="Broadsheets" />
            <NavGroup label="Communication" />
            <NavBtn tab="news" current={tab} onClick={setTab} icon="activity" label="News & Announcements" />
            <NavGroup label="System" />
            <NavBtn tab="audit" current={tab} onClick={setTab} icon="clock" label="Audit Log" />
            <NavBtn tab="settings" current={tab} onClick={setTab} icon="settings" label="Settings" />
          </nav>
          <div className="p-3 border-t border-white/10 space-y-1 mt-4">
            <div className="px-3 py-1 text-[10px] text-white/40">Signed in as Master Admin</div>
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-300/80 hover:bg-red-500/10 text-sm">
              <Icon name="logout" /> Sign Out
            </button>
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-slate-200">
            <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => setMobileNavOpen((v) => !v)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100">
                  <Icon name="menu" />
                </button>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Session · {SCHOOL.session}</p>
                  <h1 className="text-sm sm:text-base font-semibold text-[#4A2E1B] truncate">{TAB_TITLES[tab]}</h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={loadAll} className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-[11px] font-medium text-gray-700 hover:bg-slate-200">
                  <Icon name="refresh" /> Refresh
                </button>
                <div className="hidden md:flex items-center gap-3 pl-3 border-l border-slate-200">
                  <div className="text-right leading-tight">
                    <p className="text-xs font-semibold text-[#4A2E1B]">Master Administrator</p>
                    <p className="text-[10px] text-gray-500">Full System Access</p>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-[#4A2E1B] text-white flex items-center justify-center text-xs font-bold">MA</div>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] w-full mx-auto">
            {loading ? (
              <div className="text-center py-20 text-sm text-gray-500 italic">Loading data from Supabase…</div>
            ) : (
              <>
                {tab === 'dashboard' && <DashboardTab students={students} teachers={teachers} exams={exams} switchTab={setTab} />}
                {tab === 'students' && <StudentsTab students={students} classes={classes} refresh={loadAll} showToast={showToast} logAction={logAction} askConfirm={askConfirm} />}
                {tab === 'teachers' && <TeachersTab teachers={teachers} classes={classes} refresh={loadAll} showToast={showToast} logAction={logAction} askConfirm={askConfirm} />}
                {tab === 'questions' && <QuestionsTab exams={exams} questions={questions} subjects={subjects} refresh={loadAll} showToast={showToast} askConfirm={askConfirm} />}
                {tab === 'exams' && <ExamsTab exams={exams} classes={classes} subjects={subjects} questions={questions} refresh={loadAll} showToast={showToast} logAction={logAction} askConfirm={askConfirm} />}
                {tab === 'live' && <LiveMonitorTab exams={exams} students={students} classes={classes} subjects={subjects} questions={questions} showToast={showToast} logAction={logAction} askConfirm={askConfirm} />}
                {tab === 'submissions' && <SubmissionsTab exams={exams} students={students} showToast={showToast} />}
                {tab === 'broadsheet' && (
                  <BroadsheetTab
                    classes={classes}
                    subjects={subjects}
                    students={students}
                    scores={scores}
                    setScores={setScores}
                    reportCardPub={reportCardPub}
                    refresh={loadAll}
                    showToast={showToast}
                    logAction={logAction}
                    askConfirm={askConfirm}
                  />
                )}
                {tab === 'news' && (
                  <NewsTab
                    announcements={announcements}
                    classes={classes}
                    refresh={loadAll}
                    showToast={showToast}
                    logAction={logAction}
                    askConfirm={askConfirm}
                  />
                )}
                {tab === 'audit' && <AuditTab audit={audit} setAudit={setAudit} showToast={showToast} askConfirm={askConfirm} />}
                {tab === 'settings' && <SettingsTab />}
              </>
            )}
          </main>

          <footer className="px-6 lg:px-8 py-4 text-center text-[11px] text-gray-500 border-t border-slate-200 bg-white/50">
            {SCHOOL.name} · Admin Console v{SCHOOL.version} · {new Date().getFullYear()}
          </footer>
        </div>

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

        {confirmState && (
          <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
              <h3 className="font-bold text-[#4A2E1B] text-base">{confirmState.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{confirmState.message}</p>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setConfirmState(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-slate-100">Cancel</button>
                <button onClick={() => { confirmState.onConfirm(); setConfirmState(null) }} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700">Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/* ============================================================================
   NAV
   ============================================================================ */

function NavGroup({ label }: { label: string }) {
  return <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
}

function NavBtn({ tab, current, onClick, icon, label }: { tab: Tab; current: Tab; onClick: (t: Tab) => void; icon: string; label: string }) {
  const active = current === tab
  return (
    <button onClick={() => onClick(tab)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${active ? 'bg-white/10 text-white font-semibold' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
      <Icon name={icon} /> {label}
    </button>
  )
}

function Icon({ name }: { name: string }) {
  const c = { className: 'w-4 h-4', fill: 'none', stroke: 'currentColor', strokeWidth: 2, viewBox: '0 0 24 24' }
  switch (name) {
    case 'grid': return <svg {...c}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
    case 'users': return <svg {...c}><path d="M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87M16 3.13a4 4 0 0 1 0 7.75M12 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"/></svg>
    case 'teach': return <svg {...c}><path d="M12 14l9-5-9-5-9 5 9 5z"/><path d="M12 14v7"/></svg>
    case 'question': return <svg {...c}><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 1 1 5.83 1c0 2-3 2-3 4"/><path d="M12 17h.01"/></svg>
    case 'clock': return <svg {...c}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
    case 'activity': return <svg {...c}><path d="M3 12h4l3 9 4-18 3 9h4"/></svg>
    case 'check': return <svg {...c}><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>
    case 'table': return <svg {...c}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
    case 'settings': return <svg {...c}><circle cx="12" cy="12" r="3"/></svg>
    case 'logout': return <svg {...c}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
    case 'menu': return <svg {...c}><path d="M4 6h16M4 12h16M4 18h16"/></svg>
    case 'search': return <svg {...c}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
    case 'download': return <svg {...c}><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>
    case 'upload': return <svg {...c}><path d="M12 21V9m0 0l-4 4m4-4l4 4M5 3h14"/></svg>
    case 'refresh': return <svg {...c}><path d="M4 4v6h6M20 20v-6h-6M20 8a8 8 0 0 0-14.9-4M4 16a8 8 0 0 0 14.9 4"/></svg>
    default: return null
  }
}

/* ============================================================================
   TAB: DASHBOARD
   ============================================================================ */

function DashboardTab({ students, teachers, exams, switchTab }: {
  students: Student[]; teachers: Teacher[]; exams: CbtExam[]; switchTab: (t: Tab) => void
}) {
  const live = exams.filter((e) => examDerivedStatus(e) === 'live').length
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Students" value={students.length} sub="Enrolled" />
        <StatCard label="Teachers" value={teachers.length} sub="Active staff" />
        <StatCard label="Exams" value={exams.length} sub={`${live} live now`} />
        <StatCard label="Classes" value={new Set(students.map((s) => s.class_id).filter(Boolean)).size} sub="With students" />
      </div>
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="font-semibold text-[#4A2E1B]">Quick Actions</h2>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction label="Register Students" onClick={() => switchTab('students')} />
          <QuickAction label="Register Teachers" onClick={() => switchTab('teachers')} />
          <QuickAction label="Create Exam" onClick={() => switchTab('exams')} />
          <QuickAction label="Live Monitor" onClick={() => switchTab('live')} />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1 text-[#4A2E1B]">{value}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>
    </div>
  )
}

function QuickAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left p-4 rounded-xl ring-1 ring-slate-200 hover:ring-pink-300 hover:bg-pink-50/40 transition">
      <p className="text-xs font-bold text-[#4A2E1B]">{label}</p>
      <p className="text-[10px] text-gray-500 mt-1">→</p>
    </button>
  )
}

/* ============================================================================
   TAB: STUDENTS
   ============================================================================ */

function StudentsTab({
  students, classes, refresh, showToast, logAction, askConfirm,
}: {
  students: Student[]; classes: ClassRow[]; refresh: () => void
  showToast: (m: string, t?: Toast['tone']) => void
  logAction: (a: string, d?: string) => void
  askConfirm: (t: string, m: string, cb: () => void) => void
}) {
  const [form, setForm] = useState({
    admission_number: '', full_name: '', password: '',
    class_id: '', gender: 'Male' as 'Male' | 'Female', date_of_birth: '', parent_phone: '',
  })
  const [q, setQ] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [saving, setSaving] = useState(false)
  const [editTarget, setEditTarget] = useState<Student | null>(null)
  const [bulkPreview, setBulkPreview] = useState<{
    valid: any[]; duplicates: string[]; errors: string[]; unmatchedClasses: string[]
  } | null>(null)

  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c.name])), [classes])

  async function addStudent(e: React.FormEvent) {
    e.preventDefault()
    if (!form.class_id) { showToast('Pick a class.', 'error'); return }
    if (form.date_of_birth && !isValidDate(form.date_of_birth)) { showToast('Invalid date of birth.', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('students').insert([{
      admission_number: form.admission_number.trim(),
      full_name: toTitleCase(form.full_name.trim()),
      password: form.password.trim() || form.admission_number.replace(/[^A-Za-z0-9]/g, ''),
      class_id: form.class_id,
      gender: form.gender,
      date_of_birth: form.date_of_birth || null,
      parent_phone: form.parent_phone.trim() || null,
    }])
    setSaving(false)
    if (error) { showToast(`Save failed: ${error.message}`, 'error'); return }
    showToast(`Student ${form.full_name} registered.`)
    logAction('Student registered', `${form.full_name} · ${form.admission_number}`)
    setForm({ admission_number: '', full_name: '', password: '', class_id: '', gender: 'Male', date_of_birth: '', parent_phone: '' })
    refresh()
  }

  async function saveEdit(updated: Student) {
    const { error } = await supabase.from('students').update({
      full_name: updated.full_name,
      class_id: updated.class_id,
      gender: updated.gender,
      date_of_birth: updated.date_of_birth,
      parent_phone: updated.parent_phone,
      password: updated.password,
    }).eq('id', updated.id)
    if (error) { showToast(`Update failed: ${error.message}`, 'error'); return false }
    showToast(`Student ${updated.full_name} updated.`)
    logAction('Student updated', `${updated.full_name} (${updated.admission_number})`)
    refresh()
    return true
  }

  function resetPassword(s: Student) {
    const np = randomPassword(10)
    askConfirm('Reset Password?', `Set new password for ${s.full_name}? New password: ${np}`, async () => {
      const { error } = await supabase.from('students').update({ password: np }).eq('id', s.id)
      if (error) { showToast(`Reset failed: ${error.message}`, 'error'); return }
      showToast(`New password for ${s.full_name}: ${np}`, 'warn')
      logAction('Student password reset', `${s.full_name}`)
      refresh()
    })
  }

  function removeStudent(s: Student) {
    askConfirm('Remove Student?', `Permanently remove ${s.full_name} (${s.admission_number})?`, async () => {
      const { error } = await supabase.from('students').delete().eq('id', s.id)
      if (error) { showToast(`Delete failed: ${error.message}`, 'error'); return }
      showToast('Student removed.', 'warn')
      logAction('Student removed', `${s.full_name}`)
      refresh()
    })
  }

  function downloadSample() {
    const rows: any[][] = [
      ['Admission No', 'Full Name', 'Class', 'Gender', 'Date of Birth', 'Parent Phone', 'Password'],
      ['TTS/2026/050', 'Yusuf Amina Bello', 'JSS 1', 'Female', '2014-08-22', '08031234567', 'YUSUF2026'],
      ['TTS/2026/051', 'Okafor Chinedu', 'SS 1 Humanities', 'Male', '2010-03-15', '08059876543', 'OKAFOR2026'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 18 }, { wch: 26 }, { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Students')
    XLSX.writeFile(wb, 'TTS_Students_Sample.xlsx')
    showToast('Sample downloaded.', 'info')
  }

  async function handleBulkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: '' })
        if (rows.length < 2) { showToast('File is empty.', 'error'); return }

        const header = (rows[0] as string[]).map(normalizeHeader)
        const idx = (name: string) => header.indexOf(name)
        const iAdm = idx('admission_no')
        const iName = idx('full_name')
        const iClass = idx('class')
        const iGender = idx('gender')
        const iDob = idx('date_of_birth')
        const iPhone = idx('parent_phone')
        const iPass = idx('password')

        if (iAdm === -1 || iName === -1 || iClass === -1) {
          showToast('Missing required columns: Admission No, Full Name, Class.', 'error')
          return
        }

        const classNameToId = new Map<string, string>()
        classes.forEach((c) => classNameToId.set(normalizeName(c.name), c.id))

        const { data: existingRows } = await supabase.from('students').select('admission_number')
        const existingSet = new Set<string>((existingRows || []).map((r: any) => String(r.admission_number).toLowerCase()))

        const valid: any[] = []
        const duplicates: string[] = []
        const errors: string[] = []
        const unmatchedClasses: string[] = []
        const seen = new Set<string>()

        rows.slice(1).forEach((r, i) => {
          const rowNum = i + 2
          const adm = String(r[iAdm] ?? '').trim()
          const name = String(r[iName] ?? '').trim()
          const cls = String(r[iClass] ?? '').trim()
          const gender = iGender !== -1 ? String(r[iGender] ?? '').trim() : ''
          const dobRaw = iDob !== -1 ? r[iDob] : ''
          const phone = iPhone !== -1 ? String(r[iPhone] ?? '').trim() : ''
          const pass = iPass !== -1 ? String(r[iPass] ?? '').trim() : ''

          if (!adm && !name && !cls) return
          if (!adm) { errors.push(`Row ${rowNum}: missing Admission No`); return }
          if (!name) { errors.push(`Row ${rowNum}: missing Full Name`); return }
          if (!cls) { errors.push(`Row ${rowNum}: missing Class`); return }

          const classId = classNameToId.get(normalizeName(cls))
          if (!classId) { unmatchedClasses.push(`Row ${rowNum}: ${cls}`); return }

          let dob: string | null = null
          if (dobRaw !== '' && dobRaw != null) {
            const parsed = parseDobAny(dobRaw)
            if (!parsed) { errors.push(`Row ${rowNum}: invalid Date of Birth`); return }
            dob = parsed
          }

          const lower = adm.toLowerCase()
          if (existingSet.has(lower)) { duplicates.push(adm); return }
          if (seen.has(lower)) { duplicates.push(adm); return }
          seen.add(lower)

          valid.push({
            admission_number: adm,
            full_name: toTitleCase(name),
            password: pass || adm.replace(/[^A-Za-z0-9]/g, ''),
            class_id: classId,
            gender: gender === 'Female' ? 'Female' : 'Male',
            date_of_birth: dob,
            parent_phone: phone || null,
          })
        })

        setBulkPreview({ valid, duplicates, errors, unmatchedClasses })
      } catch {
        showToast('Could not read the Excel file.', 'error')
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  async function confirmBulk() {
    if (!bulkPreview || bulkPreview.valid.length === 0) return
    const { error } = await supabase.from('students').insert(bulkPreview.valid)
    if (error) { showToast(`Insert failed: ${error.message}`, 'error'); return }
    showToast(`${bulkPreview.valid.length} student(s) added. ${bulkPreview.duplicates.length} skipped.`)
    logAction('Bulk student upload', `${bulkPreview.valid.length} added`)
    setBulkPreview(null)
    refresh()
  }

  const filtered = useMemo(() => {
    return students.filter(
      (s) =>
        (!q || s.full_name.toLowerCase().includes(q.toLowerCase()) || s.admission_number.toLowerCase().includes(q.toLowerCase())) &&
        (!filterClass || s.class_id === filterClass)
    )
  }, [students, q, filterClass])

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[#4A2E1B]">Bulk Student Upload</h2>
            <p className="text-xs text-gray-500 mt-0.5">Sample includes Date of Birth column.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={downloadSample} className="inline-flex items-center gap-2 text-xs font-semibold bg-[#4A2E1B] text-white px-3.5 py-2 rounded-lg hover:bg-black">
              <Icon name="download" /> Sample Excel
            </button>
            <label className="inline-flex items-center gap-2 text-xs font-semibold bg-pink-600 text-white px-3.5 py-2 rounded-lg hover:bg-pink-700 cursor-pointer">
              <Icon name="upload" /> Upload Excel
              <input type="file" accept=".xlsx,.xls" onChange={handleBulkUpload} className="hidden" />
            </label>
          </div>
        </div>

        {bulkPreview && (
          <div className="p-5 bg-slate-50 border-b border-slate-100 space-y-3">
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 font-semibold">{bulkPreview.valid.length} ready</span>
              {bulkPreview.duplicates.length > 0 && <span className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 font-semibold">{bulkPreview.duplicates.length} duplicate(s)</span>}
              {bulkPreview.errors.length > 0 && <span className="px-3 py-1.5 rounded-full bg-red-50 text-red-700 ring-1 ring-red-200 font-semibold">{bulkPreview.errors.length} error(s)</span>}
              {bulkPreview.unmatchedClasses.length > 0 && <span className="px-3 py-1.5 rounded-full bg-red-50 text-red-700 ring-1 ring-red-200 font-semibold">{bulkPreview.unmatchedClasses.length} unknown class(es)</span>}
            </div>
            {bulkPreview.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 space-y-1">
                {bulkPreview.errors.slice(0, 5).map((e, i) => <div key={i}>• {e}</div>)}
              </div>
            )}
            {bulkPreview.unmatchedClasses.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                Unknown classes: {bulkPreview.unmatchedClasses.slice(0, 5).join(' · ')}
              </div>
            )}
            {bulkPreview.duplicates.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                Skipping: {bulkPreview.duplicates.slice(0, 10).join(', ')}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setBulkPreview(null)} className="text-xs font-semibold px-4 py-2 rounded-lg text-gray-700 hover:bg-red-50">Cancel</button>
              <button onClick={confirmBulk} disabled={bulkPreview.valid.length === 0} className="text-xs font-semibold px-4 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-50">
                Confirm Import ({bulkPreview.valid.length})
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="font-semibold text-[#4A2E1B]">Register Single Student</h2>
          </div>
          <form onSubmit={addStudent} className="p-5 space-y-3.5">
            <FormField label="Admission Number" required>
              <input required value={form.admission_number} onChange={(e) => setForm({ ...form, admission_number: e.target.value })} placeholder="TTS/2026/050" className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl font-mono outline-none" />
            </FormField>
            <FormField label="Full Name" required>
              <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Yusuf Amina Bello" className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
            </FormField>
            <FormField label="Class" required>
              <select required value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none">
                <option value="">-- Choose Class --</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Gender" required>
                <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as 'Male' | 'Female' })} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none">
                  <option>Male</option><option>Female</option>
                </select>
              </FormField>
              <FormField label="Date of Birth" required>
                <input type="date" max={todayIso()} required value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
              </FormField>
            </div>
            <FormField label="Portal Password" required>
              <input required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="e.g. YUSUF2026" className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
            </FormField>
            <FormField label="Parent Phone">
              <input value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} placeholder="08030000000" className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
            </FormField>
            <button type="submit" disabled={saving} className="w-full bg-pink-600 hover:bg-pink-700 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50">
              {saving ? 'Saving…' : 'Register Student'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="font-semibold text-[#4A2E1B]">Student Directory</h2>
            <p className="text-xs text-gray-500 mt-0.5">Total: {filtered.length} of {students.length}</p>
          </div>
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-grow">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Icon name="search" /></span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-full text-sm pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl outline-none" />
            </div>
            <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="text-sm px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none">
              <option value="">All Classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto max-h-[520px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-gray-700 text-[11px] uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="px-4 py-3">Adm No</th>
                  <th className="px-4 py-3">Full Name</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3 text-center">Age</th>
                  <th className="px-4 py-3">Gender</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-pink-50/50">
                    <td className="px-4 py-3 font-mono text-pink-700">{s.admission_number}</td>
                    <td className="px-4 py-3 font-medium text-[#4A2E1B]">{s.full_name}</td>
                    <td className="px-4 py-3">{classById[s.class_id || ''] || '—'}</td>
                    <td className="px-4 py-3 text-center">{ageFromDob(s.date_of_birth) ?? '—'}</td>
                    <td className="px-4 py-3">{s.gender || '—'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setEditTarget(s)} className="text-blue-600 hover:text-blue-700 font-semibold text-[11px] mr-3">Edit</button>
                      <button onClick={() => resetPassword(s)} className="text-amber-600 hover:text-amber-700 font-semibold text-[11px] mr-3">Reset PW</button>
                      <button onClick={() => removeStudent(s)} className="text-red-600 hover:text-red-700 font-semibold text-[11px]">Remove</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-xs text-gray-400 italic">No students found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editTarget && (
        <EditStudentModal student={editTarget} classes={classes} onClose={() => setEditTarget(null)} onSave={saveEdit} />
      )}
    </div>
  )
}

/* ============================================================================
   EDIT STUDENT MODAL
   ============================================================================ */

function EditStudentModal({
  student, classes, onClose, onSave,
}: {
  student: Student; classes: ClassRow[]
  onClose: () => void
  onSave: (s: Student) => Promise<boolean>
}) {
  const [draft, setDraft] = useState<Student>({ ...student })
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.full_name.trim() || !draft.class_id) return
    if (draft.date_of_birth && !isValidDate(draft.date_of_birth)) return
    setSaving(true)
    const ok = await onSave({ ...draft, full_name: toTitleCase(draft.full_name.trim()) })
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-8">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[#4A2E1B] text-base">Edit Student</h3>
            <p className="text-[11px] text-gray-500 font-mono mt-0.5">{student.admission_number} (locked)</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-gray-500">✕</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <FormField label="Full Name" required>
            <input required value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Class" required>
              <select value={draft.class_id || ''} onChange={(e) => setDraft({ ...draft, class_id: e.target.value })} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none">
                <option value="">-- Choose --</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Gender" required>
              <select value={draft.gender || 'Male'} onChange={(e) => setDraft({ ...draft, gender: e.target.value as 'Male' | 'Female' })} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none">
                <option>Male</option><option>Female</option>
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date of Birth" required>
              <input type="date" max={todayIso()} required value={draft.date_of_birth || ''} onChange={(e) => setDraft({ ...draft, date_of_birth: e.target.value })} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
            </FormField>
            <FormField label="Computed Age">
              <input value={ageFromDob(draft.date_of_birth) ?? '—'} disabled className="w-full text-sm px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-gray-600" />
            </FormField>
          </div>
          <FormField label="Parent Phone">
            <input value={draft.parent_phone || ''} onChange={(e) => setDraft({ ...draft, parent_phone: e.target.value })} className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
          </FormField>
          <FormField label="Password" required>
            <input required value={draft.password || ''} onChange={(e) => setDraft({ ...draft, password: e.target.value })} className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none font-mono" />
          </FormField>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-slate-100">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


/* ============================================================================
   TAB: TEACHERS
   ============================================================================ */

function TeachersTab({
  teachers, classes, refresh, showToast, logAction, askConfirm,
}: {
  teachers: Teacher[]; classes: ClassRow[]; refresh: () => void
  showToast: (m: string, t?: Toast['tone']) => void
  logAction: (a: string, d?: string) => void
  askConfirm: (t: string, m: string, cb: () => void) => void
}) {
  const [form, setForm] = useState({
    staff_id: '', full_name: '', email: '', password: '', phone: '',
    role_type: 'subject' as 'subject' | 'class' | 'both',
    assigned_class_id: '', assigned_subjects: '',
  })
  const [saving, setSaving] = useState(false)
  const [editTarget, setEditTarget] = useState<Teacher | null>(null)

  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c.name])), [classes])

  async function addTeacher(e: React.FormEvent) {
    e.preventDefault()
    if ((form.role_type === 'class' || form.role_type === 'both') && !form.assigned_class_id) {
      showToast('Pick an assigned class.', 'error'); return
    }
    setSaving(true)
    const { error } = await supabase.from('teachers').insert([{
      staff_id: form.staff_id.trim(),
      full_name: toTitleCase(form.full_name.trim()),
      email: form.email.trim(),
      password: form.password.trim(),
      phone: form.phone.trim() || null,
      role_type: form.role_type,
      assigned_class_id: form.role_type === 'subject' ? null : form.assigned_class_id,
      assigned_subjects: form.assigned_subjects.trim() || null,
    }])
    setSaving(false)
    if (error) { showToast(`Save failed: ${error.message}`, 'error'); return }
    showToast(`Teacher ${form.full_name} registered.`)
    logAction('Teacher registered', `${form.full_name} · ${form.staff_id}`)
    setForm({ staff_id: '', full_name: '', email: '', password: '', phone: '', role_type: 'subject', assigned_class_id: '', assigned_subjects: '' })
    refresh()
  }

  async function saveEdit(updated: Teacher): Promise<boolean> {
    const assigned_class_id = (updated.role_type === 'subject') ? null : updated.assigned_class_id
    const { error } = await supabase.from('teachers').update({
      full_name: updated.full_name,
      email: updated.email,
      phone: updated.phone,
      password: updated.password,
      role_type: updated.role_type,
      assigned_class_id,
      assigned_subjects: updated.assigned_subjects,
    }).eq('id', updated.id)
    if (error) { showToast(`Update failed: ${error.message}`, 'error'); return false }
    showToast(`Teacher ${updated.full_name} updated.`)
    logAction('Teacher updated', `${updated.full_name}`)
    refresh()
    return true
  }

  function resetPassword(t: Teacher) {
    const np = randomPassword(10)
    askConfirm('Reset Password?', `Set new password for ${t.full_name}? New password: ${np}`, async () => {
      const { error } = await supabase.from('teachers').update({ password: np }).eq('id', t.id)
      if (error) { showToast(`Reset failed: ${error.message}`, 'error'); return }
      showToast(`New password for ${t.full_name}: ${np}`, 'warn')
      logAction('Teacher password reset', `${t.full_name}`)
      refresh()
    })
  }

  function removeTeacher(t: Teacher) {
    askConfirm('Remove Teacher?', `Remove ${t.full_name} from staff register?`, async () => {
      const { error } = await supabase.from('teachers').delete().eq('id', t.id)
      if (error) { showToast(`Delete failed: ${error.message}`, 'error'); return }
      showToast('Teacher removed.', 'warn')
      logAction('Teacher removed', t.full_name)
      refresh()
    })
  }

  const ROLE_LABEL: Record<Teacher['role_type'], string> = {
    subject: 'Subject Teacher',
    class: 'Class Teacher',
    both: 'Class & Subject Teacher',
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="font-semibold text-[#4A2E1B]">Register Single Teacher</h2>
        </div>
        <form onSubmit={addTeacher} className="p-5 space-y-3.5">
          <FormField label="Staff ID" required>
            <input required value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })} placeholder="TTS/TCH/009" className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl font-mono outline-none" />
          </FormField>
          <FormField label="Full Name" required>
            <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Dr. Aliyu Ibrahim" className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
          </FormField>
          <FormField label="Email" required>
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
          </FormField>
          <FormField label="Password" required>
            <input required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
          </FormField>
          <FormField label="Phone">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
          </FormField>
          <FormField label="Role Type" required>
            <select value={form.role_type} onChange={(e) => setForm({ ...form, role_type: e.target.value as any })} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none">
              <option value="subject">Subject Teacher</option>
              <option value="class">Class Teacher</option>
              <option value="both">Class &amp; Subject Teacher</option>
            </select>
          </FormField>
          {form.role_type !== 'subject' && (
            <FormField label="Assigned Class" required>
              <select value={form.assigned_class_id} onChange={(e) => setForm({ ...form, assigned_class_id: e.target.value })} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none">
                <option value="">-- Choose Class --</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
          )}
          {form.role_type !== 'class' && (
            <FormField label="Assigned Subjects (comma-separated)">
              <input value={form.assigned_subjects} onChange={(e) => setForm({ ...form, assigned_subjects: e.target.value })} placeholder="Mathematics, Physics" className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
            </FormField>
          )}
          <button type="submit" disabled={saving} className="w-full bg-pink-600 hover:bg-pink-700 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50">
            {saving ? 'Saving…' : 'Register Teacher'}
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="font-semibold text-[#4A2E1B]">Teacher Directory</h2>
          <p className="text-xs text-gray-500 mt-0.5">Total: {teachers.length}</p>
        </div>
        <div className="overflow-x-auto max-h-[620px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-gray-700 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Staff ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Subjects</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teachers.map((t) => (
                <tr key={t.id} className="hover:bg-pink-50/50">
                  <td className="px-4 py-3 font-mono text-pink-700">{t.staff_id}</td>
                  <td className="px-4 py-3 font-medium text-[#4A2E1B]">{t.full_name}</td>
                  <td className="px-4 py-3"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 ring-1 ring-pink-200 uppercase">{ROLE_LABEL[t.role_type]}</span></td>
                  <td className="px-4 py-3 text-gray-700">{t.assigned_class_id ? classById[t.assigned_class_id] || '—' : '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{t.assigned_subjects || '—'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setEditTarget(t)} className="text-blue-600 hover:text-blue-700 font-semibold text-[11px] mr-3">Edit</button>
                    <button onClick={() => resetPassword(t)} className="text-amber-600 hover:text-amber-700 font-semibold text-[11px] mr-3">Reset PW</button>
                    <button onClick={() => removeTeacher(t)} className="text-red-600 hover:text-red-700 font-semibold text-[11px]">Remove</button>
                  </td>
                </tr>
              ))}
              {teachers.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-xs text-gray-400 italic">No teachers registered yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {editTarget && (
        <EditTeacherModal teacher={editTarget} classes={classes} onClose={() => setEditTarget(null)} onSave={saveEdit} />
      )}
    </div>
  )
}

/* ============================================================================
   EDIT TEACHER MODAL
   ============================================================================ */

function EditTeacherModal({
  teacher, classes, onClose, onSave,
}: {
  teacher: Teacher; classes: ClassRow[]
  onClose: () => void
  onSave: (t: Teacher) => Promise<boolean>
}) {
  const [draft, setDraft] = useState<Teacher>({ ...teacher })
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.full_name.trim() || !draft.email.trim()) return
    if ((draft.role_type === 'class' || draft.role_type === 'both') && !draft.assigned_class_id) return
    setSaving(true)
    const ok = await onSave({ ...draft, full_name: toTitleCase(draft.full_name.trim()), email: draft.email.trim() })
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-8">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[#4A2E1B] text-base">Edit Teacher</h3>
            <p className="text-[11px] text-gray-500 font-mono mt-0.5">{teacher.staff_id} (locked)</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-gray-500">✕</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <FormField label="Full Name" required>
            <input required value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
          </FormField>
          <FormField label="Email" required>
            <input type="email" required value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
          </FormField>
          <FormField label="Phone">
            <input value={draft.phone || ''} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
          </FormField>
          <FormField label="Password" required>
            <input required value={draft.password || ''} onChange={(e) => setDraft({ ...draft, password: e.target.value })} className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none font-mono" />
          </FormField>
          <FormField label="Role Type" required>
            <select
              value={draft.role_type}
              onChange={(e) => {
                const role_type = e.target.value as Teacher['role_type']
                setDraft({ ...draft, role_type, assigned_class_id: role_type === 'subject' ? null : draft.assigned_class_id })
              }}
              className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none"
            >
              <option value="subject">Subject Teacher</option>
              <option value="class">Class Teacher</option>
              <option value="both">Class &amp; Subject Teacher</option>
            </select>
          </FormField>
          {draft.role_type !== 'subject' && (
            <FormField label="Assigned Class" required>
              <select value={draft.assigned_class_id || ''} onChange={(e) => setDraft({ ...draft, assigned_class_id: e.target.value })} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none">
                <option value="">-- Choose Class --</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
          )}
          {draft.role_type !== 'class' && (
            <FormField label="Assigned Subjects (comma-separated)">
              <input value={draft.assigned_subjects || ''} onChange={(e) => setDraft({ ...draft, assigned_subjects: e.target.value })} className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
            </FormField>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-slate-100">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ============================================================================
   TAB: QUESTION BANK
   ============================================================================ */

function QuestionsTab({
  exams, questions, subjects, refresh, showToast, askConfirm,
}: {
  exams: CbtExam[]; questions: Question[]; subjects: SubjectRow[]
  refresh: () => void
  showToast: (m: string, t?: Toast['tone']) => void
  askConfirm: (t: string, m: string, cb: () => void) => void
}) {
  const examById = useMemo(() => Object.fromEntries(exams.map((e) => [e.id, e])), [exams])

  function removeQuestion(q: Question) {
    askConfirm('Delete Question?', 'Remove this question?', async () => {
      const { error } = await supabase.from('cbt_questions').delete().eq('id', q.id)
      if (error) { showToast(`Delete failed: ${error.message}`, 'error'); return }
      showToast('Question removed.', 'warn')
      refresh()
    })
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100">
        <h2 className="font-semibold text-[#4A2E1B]">Question Bank</h2>
        <p className="text-xs text-gray-500 mt-0.5">{questions.length} question(s) across {exams.length} exam(s)</p>
      </div>
      <div className="p-5 space-y-3 max-h-[700px] overflow-y-auto">
        {questions.length === 0 && <div className="text-center py-12 text-xs text-gray-400 italic">No questions yet. Add them from the Exams tab.</div>}
        {questions.slice(0, 200).map((q) => {
          const ex = examById[q.exam_id]
          return (
            <div key={q.id} className="p-4 rounded-xl ring-1 ring-slate-200 bg-white">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {ex && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 ring-1 ring-pink-200 uppercase">{ex.title}</span>}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${q.type === 'theory' ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-200' : 'bg-slate-100 text-gray-700 ring-1 ring-slate-200'}`}>
                    {q.type}
                  </span>
                  <span className="text-[10px] text-gray-500">{q.marks} mark{q.marks === 1 ? '' : 's'}</span>
                </div>
                <button onClick={() => removeQuestion(q)} className="text-red-500 hover:text-red-700 text-[11px] font-semibold">Delete</button>
              </div>
              <p className="text-xs text-[#4A2E1B] font-medium mb-2">{q.question_text}</p>
              {q.type === 'objective' && (
                <ul className="grid grid-cols-2 gap-1.5 text-[11px]">
                  {(['A', 'B', 'C', 'D'] as const).map((k) => {
                    const txt = (q as any)[`option_${k.toLowerCase()}`]
                    if (!txt) return null
                    const isCorrect = q.correct_answer === k
                    return (
                      <li key={k} className={`px-2.5 py-1.5 rounded-lg ${isCorrect ? 'bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800 font-semibold' : 'bg-slate-50 ring-1 ring-slate-200 text-gray-600'}`}>
                        {k}. {txt} {isCorrect ? '✓' : ''}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ============================================================================
   TAB: EXAMS
   ============================================================================ */

function ExamsTab({
  exams, classes, subjects, questions, refresh, showToast, logAction, askConfirm,
}: {
  exams: CbtExam[]; classes: ClassRow[]; subjects: SubjectRow[]; questions: Question[]
  refresh: () => void
  showToast: (m: string, t?: Toast['tone']) => void
  logAction: (a: string, d?: string) => void
  askConfirm: (t: string, m: string, cb: () => void) => void
}) {
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null)
  const selectedExam = useMemo(
    () => exams.find((e) => e.id === selectedExamId) || null,
    [exams, selectedExamId]
  )

  if (selectedExam) {
    return (
      <ExamDetail
        exam={selectedExam}
        classes={classes}
        subjects={subjects}
        questions={questions.filter((q) => q.exam_id === selectedExam.id)}
        onBack={() => setSelectedExamId(null)}
        refresh={refresh}
        showToast={showToast}
        logAction={logAction}
        askConfirm={askConfirm}
      />
    )
  }

  return (
    <ExamList
      exams={exams}
      classes={classes}
      subjects={subjects}
      questions={questions}
      onOpen={setSelectedExamId}
      refresh={refresh}
      showToast={showToast}
      logAction={logAction}
      askConfirm={askConfirm}
    />
  )
}

/* -------------------- EXAM LIST -------------------- */

function ExamList({
  exams, classes, subjects, questions, onOpen, refresh, showToast, logAction, askConfirm,
}: {
  exams: CbtExam[]; classes: ClassRow[]; subjects: SubjectRow[]; questions: Question[]
  onOpen: (id: string) => void
  refresh: () => void
  showToast: (m: string, t?: Toast['tone']) => void
  logAction: (a: string, d?: string) => void
  askConfirm: (t: string, m: string, cb: () => void) => void
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    title: '', class_id: '', subject_id: '',
    duration_minutes: 30, session: SCHOOL.session, term: 'First Term' as Term, status: 'draft' as 'draft' | 'published',
  })
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c.name])), [classes])
  const subjectById = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s.name])), [subjects])
  const questionCount = useMemo(() => {
    const m = new Map<string, number>()
    questions.forEach((q) => m.set(q.exam_id, (m.get(q.exam_id) || 0) + 1))
    return m
  }, [questions])
  const marksByExam = useMemo(() => {
    const m = new Map<string, number>()
    questions.forEach((q) => m.set(q.exam_id, (m.get(q.exam_id) || 0) + q.marks))
    return m
  }, [questions])

  async function createExam(e: React.FormEvent) {
    e.preventDefault()
    if (!form.class_id || !form.subject_id) { showToast('Pick class and subject.', 'error'); return }
    setSaving(true)

    if (form.status === 'published') {
      const { data: existing } = await supabase
        .from('cbt_exams').select('id')
        .eq('class_id', form.class_id).eq('subject_id', form.subject_id)
        .eq('term', form.term).eq('session', form.session)
        .eq('status', 'published').maybeSingle()
      if (existing) {
        showToast(`${classById[form.class_id]} · ${subjectById[form.subject_id]} already has a published exam for ${form.term}.`, 'error')
        setSaving(false)
        return
      }
    }

    const { data, error } = await supabase
      .from('cbt_exams')
      .insert([{
        ...form,
        published_at: form.status === 'published' ? new Date().toISOString() : null,
      }])
      .select()
      .single()

    setSaving(false)
    if (error) { showToast(`Save failed: ${error.message}`, 'error'); return }

    showToast(`Exam "${form.title}" created.`)
    logAction('Exam created', `${form.title} · ${form.status}`)
    setForm({ title: '', class_id: '', subject_id: '', duration_minutes: 30, session: SCHOOL.session, term: 'First Term', status: 'draft' })
    setShowCreate(false)
    refresh()
    if (data?.id) onOpen(data.id)
  }

  function removeExam(ex: CbtExam) {
    askConfirm('Delete Exam?', `Remove "${ex.title}" and all its questions?`, async () => {
      const { error } = await supabase.from('cbt_exams').delete().eq('id', ex.id)
      if (error) { showToast(`Delete failed: ${error.message}`, 'error'); return }
      showToast('Exam removed.', 'warn')
      logAction('Exam deleted', ex.title)
      refresh()
    })
  }

  const filtered = useMemo(() => {
    return exams.filter((ex) => {
      if (q && !ex.title.toLowerCase().includes(q.toLowerCase())) return false
      if (filterClass && ex.class_id !== filterClass) return false
      if (filterStatus && examDerivedStatus(ex) !== filterStatus) return false
      return true
    })
  }, [exams, q, filterClass, filterStatus])

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[#4A2E1B]">CBT Exams</h2>
            <p className="text-xs text-gray-500 mt-0.5">{exams.length} exam(s) · {exams.filter((e) => examDerivedStatus(e) === 'live').length} live now</p>
          </div>
          <button onClick={() => setShowCreate((v) => !v)} className="text-xs font-bold bg-pink-600 text-white px-4 py-2.5 rounded-xl hover:bg-pink-700">
            {showCreate ? 'Close' : '+ New Exam'}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={createExam} className="p-5 bg-slate-50 border-b border-slate-100 space-y-4">
            <FormField label="Title" required>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Mid-Term Chemistry Test" className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Class" required>
                <select required value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none">
                  <option value="">-- Choose --</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FormField>
              <FormField label="Subject" required>
                <select required value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none">
                  <option value="">-- Choose --</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Duration (min)">
                <input type="number" min={1} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
              </FormField>
              <FormField label="Term">
                <select value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value as Term })} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none">
                  {TERMS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="Session">
                <input value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
              </FormField>
            </div>
            <FormField label="Initial Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none">
                <option value="draft">Save as Draft</option>
                <option value="published">Publish Immediately</option>
              </select>
            </FormField>
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="bg-pink-600 hover:bg-pink-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm disabled:opacity-50">
                {saving ? 'Creating…' : 'Create Exam'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Icon name="search" /></span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title…" className="w-full text-sm pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl outline-none" />
          </div>
          <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="text-sm px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none">
            <option value="">All Classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-sm px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none">
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="live">Live</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="overflow-x-auto max-h-[640px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-gray-700 text-[11px] uppercase tracking-wider sticky top-0">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3 text-center">Qs</th>
                <th className="px-4 py-3 text-center">Marks</th>
                <th className="px-4 py-3 text-center">Duration</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-xs text-gray-400 italic">No exams match your filters.</td></tr>}
              {filtered.map((ex) => {
                const status = examDerivedStatus(ex)
                const tone =
                  status === 'live' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
                  status === 'scheduled' ? 'bg-blue-50 text-blue-700 ring-blue-200' :
                  status === 'closed' ? 'bg-slate-100 text-gray-700 ring-slate-200' :
                  'bg-amber-50 text-amber-700 ring-amber-200'
                return (
                  <tr key={ex.id} className="hover:bg-pink-50/50">
                    <td className="px-4 py-3 font-medium text-[#4A2E1B]">
                      <button onClick={() => onOpen(ex.id)} className="text-left hover:text-pink-600 hover:underline">
                        {ex.title}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{classById[ex.class_id] || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{subjectById[ex.subject_id] || '—'}</td>
                    <td className="px-4 py-3 text-center font-bold">{questionCount.get(ex.id) || 0}</td>
                    <td className="px-4 py-3 text-center font-bold">{marksByExam.get(ex.id) || 0}</td>
                    <td className="px-4 py-3 text-center">{ex.duration_minutes} min</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 uppercase ${tone}`}>{status}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => onOpen(ex.id)} className="text-blue-600 hover:text-blue-700 font-semibold text-[11px] mr-3">Open</button>
                      <button onClick={() => removeExam(ex)} className="text-red-600 hover:text-red-700 font-semibold text-[11px]">Delete</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* -------------------- EXAM DETAIL -------------------- */

function ExamDetail({
  exam, classes, subjects, questions, onBack, refresh, showToast, logAction, askConfirm,
}: {
  exam: CbtExam
  classes: ClassRow[]
  subjects: SubjectRow[]
  questions: Question[]
  onBack: () => void
  refresh: () => void
  showToast: (m: string, t?: Toast['tone']) => void
  logAction: (a: string, d?: string) => void
  askConfirm: (t: string, m: string, cb: () => void) => void
}) {
  const [tab, setTab] = useState<'setup' | 'questions' | 'preview'>('setup')
  const cls = useMemo(() => classes.find((c) => c.id === exam.class_id), [classes, exam.class_id])
  const subj = useMemo(() => subjects.find((s) => s.id === exam.subject_id), [subjects, exam.subject_id])

  const totalMarks = useMemo(() => questions.reduce((a, q) => a + q.marks, 0), [questions])
  const objectiveCount = questions.filter((q) => q.type === 'objective').length
  const theoryCount = questions.filter((q) => q.type === 'theory').length
  const derivedStatus = examDerivedStatus(exam)

  async function updateExam(patch: Partial<CbtExam>) {
    const { error } = await supabase.from('cbt_exams').update(patch).eq('id', exam.id)
    if (error) { showToast(`Update failed: ${error.message}`, 'error'); return false }
    return true
  }

  async function togglePublish() {
    if (exam.status === 'draft') {
      const { data: existing } = await supabase
        .from('cbt_exams').select('id, title')
        .eq('class_id', exam.class_id).eq('subject_id', exam.subject_id)
        .eq('term', exam.term).eq('session', exam.session)
        .eq('status', 'published').neq('id', exam.id).maybeSingle()

      if (existing) { showToast(`Another published exam already exists for ${cls?.name} · ${subj?.name} · ${exam.term}.`, 'error'); return }
      if (questions.length === 0) { showToast('Add at least one question before publishing.', 'error'); return }

      askConfirm('Publish Exam?', `Students in ${cls?.name} will see this exam (subject to availability window). Continue?`, async () => {
        const ok = await updateExam({ status: 'published', published_at: new Date().toISOString() })
        if (ok) { showToast('Exam published.'); logAction('Exam published', exam.title); refresh() }
      })
    } else {
      askConfirm('Unpublish Exam?', 'Students will no longer see this exam. In-progress attempts remain.', async () => {
        const ok = await updateExam({ status: 'draft' })
        if (ok) { showToast('Exam unpublished.', 'warn'); logAction('Exam unpublished', exam.title); refresh() }
      })
    }
  }

  function deleteExam() {
    askConfirm('Delete Exam?', `Permanently delete "${exam.title}" and all its questions?`, async () => {
      const { error } = await supabase.from('cbt_exams').delete().eq('id', exam.id)
      if (error) { showToast(`Delete failed: ${error.message}`, 'error'); return }
      showToast('Exam deleted.', 'warn')
      logAction('Exam deleted', exam.title)
      onBack()
      refresh()
    })
  }

  function deleteQuestion(q: Question) {
    askConfirm('Delete Question?', 'Remove this question?', async () => {
      const { error } = await supabase.from('cbt_questions').delete().eq('id', q.id)
      if (error) { showToast(`Delete failed: ${error.message}`, 'error'); return }
      showToast('Question removed.', 'warn')
      refresh()
    })
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5">
        <button onClick={onBack} className="text-xs font-bold text-gray-500 hover:text-[#4A2E1B] mb-3 inline-flex items-center gap-1">
          ← Back to Exams
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-[#4A2E1B] truncate">{exam.title}</h1>
            <p className="text-xs text-gray-500 mt-1">
              {cls?.name || '—'} · {subj?.name || '—'} · {exam.term} · {exam.session}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ring-1 uppercase ${
                derivedStatus === 'live' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
                derivedStatus === 'scheduled' ? 'bg-blue-50 text-blue-700 ring-blue-200' :
                derivedStatus === 'closed' ? 'bg-slate-100 text-gray-700 ring-slate-200' :
                'bg-amber-50 text-amber-700 ring-amber-200'
              }`}>{derivedStatus}</span>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-gray-700 ring-1 ring-slate-200">{questions.length} questions</span>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-gray-700 ring-1 ring-slate-200">{totalMarks} marks</span>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-gray-700 ring-1 ring-slate-200">{exam.duration_minutes} min</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={togglePublish}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white ${exam.status === 'published' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            >
              {exam.status === 'published' ? 'Unpublish' : '🚀 Publish'}
            </button>
            <button onClick={deleteExam} className="px-4 py-2.5 rounded-xl text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100">Delete</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 flex">
          {(['setup', 'questions', 'preview'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3.5 text-xs font-bold border-b-2 transition ${
                tab === t ? 'border-pink-600 text-[#4A2E1B]' : 'border-transparent text-gray-500 hover:text-[#4A2E1B]'
              }`}
            >
              {t === 'setup' && 'Setup'}
              {t === 'questions' && `Questions (${questions.length})`}
              {t === 'preview' && 'Preview'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'setup' && (
            <SetupSection exam={exam} totalMarks={totalMarks} objectiveCount={objectiveCount} theoryCount={theoryCount} onSave={updateExam} showToast={showToast} />
          )}
          {tab === 'questions' && (
            <QuestionsSection examId={exam.id} exam={exam} questions={questions} onReload={refresh} showToast={showToast} onDelete={deleteQuestion} />
          )}
          {tab === 'preview' && (
            <PreviewSection exam={exam} questions={questions} />
          )}
        </div>
      </div>
    </div>
  )
}

/* -------------------- SETUP SECTION -------------------- */

function SetupSection({
  exam, totalMarks, objectiveCount, theoryCount, onSave, showToast,
}: {
  exam: CbtExam; totalMarks: number; objectiveCount: number; theoryCount: number
  onSave: (patch: Partial<CbtExam>) => Promise<boolean>
  showToast: (m: string, t?: Toast['tone']) => void
}) {
  const [draft, setDraft] = useState({
    title: exam.title,
    duration_minutes: exam.duration_minutes,
    instructions: exam.instructions || '',
    start_at: toLocalDatetimeInput(exam.start_at),
    end_at: toLocalDatetimeInput(exam.end_at),
    shuffle_questions: exam.shuffle_questions,
    shuffle_options: exam.shuffle_options,
    max_attempts: exam.max_attempts,
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!draft.title.trim()) { showToast('Title is required.', 'error'); return }
    if (draft.duration_minutes <= 0) { showToast('Duration must be positive.', 'error'); return }
    const startIso = fromLocalDatetimeInput(draft.start_at)
    const endIso = fromLocalDatetimeInput(draft.end_at)
    if (startIso && endIso && new Date(startIso) >= new Date(endIso)) {
      showToast('End time must be after start time.', 'error'); return
    }
    setSaving(true)
    const ok = await onSave({
      title: draft.title.trim(),
      duration_minutes: draft.duration_minutes,
      instructions: draft.instructions.trim() || null,
      start_at: startIso,
      end_at: endIso,
      shuffle_questions: draft.shuffle_questions,
      shuffle_options: draft.shuffle_options,
      max_attempts: draft.max_attempts,
    })
    setSaving(false)
    if (ok) showToast('Setup saved.')
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h3 className="font-semibold text-[#4A2E1B] mb-3">Exam Setup</h3>
        <div className="space-y-4">
          <FormField label="Title" required>
            <input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Duration (minutes)" required>
              <input type="number" min={1} value={draft.duration_minutes} onChange={(e) => setDraft({ ...draft, duration_minutes: Number(e.target.value) })} className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
            </FormField>
            <FormField label="Max Attempts">
              <input type="number" min={1} value={draft.max_attempts} onChange={(e) => setDraft({ ...draft, max_attempts: Number(e.target.value) })} className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
            </FormField>
          </div>
          <FormField label="Instructions for Students">
            <textarea rows={3} value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} placeholder="e.g. No calculators. Read each question carefully." className="w-full text-sm p-3 bg-white border border-pink-200 rounded-xl outline-none resize-none" />
          </FormField>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-[#4A2E1B] mb-3">Availability Window</h3>
        <p className="text-xs text-gray-500 mb-3">Leave blank = available immediately when published.</p>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start (optional)">
            <input type="datetime-local" value={draft.start_at} onChange={(e) => setDraft({ ...draft, start_at: e.target.value })} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
          </FormField>
          <FormField label="End (optional)">
            <input type="datetime-local" value={draft.end_at} onChange={(e) => setDraft({ ...draft, end_at: e.target.value })} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
          </FormField>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-[#4A2E1B] mb-3">Randomization</h3>
        <div className="space-y-2">
          <Toggle checked={draft.shuffle_questions} onChange={(v) => setDraft({ ...draft, shuffle_questions: v })} label="Shuffle question order per student" />
          <Toggle checked={draft.shuffle_options} onChange={(v) => setDraft({ ...draft, shuffle_options: v })} label="Shuffle A/B/C/D option order per student" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center bg-slate-50 rounded-xl p-4 border border-slate-200">
        <div>
          <p className="text-[10px] font-bold uppercase text-gray-500">Objective</p>
          <p className="text-xl font-black text-[#4A2E1B] mt-0.5">{objectiveCount}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-gray-500">Theory</p>
          <p className="text-xl font-black text-[#4A2E1B] mt-0.5">{theoryCount}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-gray-500">Total Marks</p>
          <p className="text-xl font-black text-pink-600 mt-0.5">{totalMarks}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="bg-[#4A2E1B] text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-[#382213] disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Setup'}
        </button>
      </div>
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 rounded border-pink-300 text-pink-600 focus:ring-pink-500" />
      <span className="text-sm font-medium text-[#4A2E1B]">{label}</span>
    </label>
  )
}

/* -------------------- QUESTIONS SECTION -------------------- */

function QuestionsSection({
  examId, exam, questions, onReload, showToast, onDelete,
}: {
  examId: string
  exam: CbtExam
  questions: Question[]
  onReload: () => void
  showToast: (m: string, t?: Toast['tone']) => void
  onDelete: (q: Question) => void
}) {
  const [preview, setPreview] = useState<{ rows: any[]; errors: string[] } | null>(null)
  const [importing, setImporting] = useState(false)

  function downloadSample() {
    const rows: any[][] = [
      ['type', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'marks', 'theory_answer_guide'],
      ['objective', 'What is 2 + 2?', '3', '4', '5', '6', 'B', 1, ''],
      ['objective', 'Capital of Nigeria?', 'Lagos', 'Abuja', 'Kano', 'Ibadan', 'B', 1, ''],
      ['theory', 'Explain the process of photosynthesis.', '', '', '', '', '', 5, 'Chlorophyll absorbs light energy...'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 12 }, { wch: 44 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 44 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Questions')
    XLSX.writeFile(wb, 'TTS_CBT_Questions_Sample.xlsx')
    showToast('Sample downloaded.', 'info')
  }

  function processRows(rows: any[][]) {
    const parsed: any[] = []
    const errors: string[] = []
    if (rows.length < 2) return { rows: parsed, errors: ['File is empty'] }

    const header = (rows[0] as string[]).map(normalizeHeader)
    const idx = (name: string) => header.indexOf(name)
    const iType = idx('type')
    const iQ = idx('question')
    const iA = idx('option_a'), iB = idx('option_b'), iC = idx('option_c'), iD = idx('option_d')
    const iCorrect = idx('correct_answer')
    const iMarks = idx('marks')
    const iGuide = idx('theory_answer_guide')

    if (iQ === -1) { errors.push('Missing "question" column'); return { rows: parsed, errors } }

    rows.slice(1).forEach((r, i) => {
      const rowNum = i + 2
      const typeRaw = String(iType !== -1 ? r[iType] : 'objective').trim().toLowerCase()
      const type = typeRaw === 'theory' ? 'theory' : 'objective'
      const question = String(r[iQ] ?? '').trim()
      const a = iA !== -1 ? String(r[iA] ?? '').trim() : ''
      const b = iB !== -1 ? String(r[iB] ?? '').trim() : ''
      const c = iC !== -1 ? String(r[iC] ?? '').trim() : ''
      const d = iD !== -1 ? String(r[iD] ?? '').trim() : ''
      const correct = (iCorrect !== -1 ? String(r[iCorrect] ?? '').trim().toUpperCase() : '')
      const marksRaw = iMarks !== -1 ? r[iMarks] : 1
      const guide = iGuide !== -1 ? String(r[iGuide] ?? '').trim() : ''

      if (!question) return
      const errs: string[] = []
      if (type === 'objective') {
        if (![a, b, c, d].every((x) => x)) errs.push('needs 4 options')
        if (!/^[A-D]$/.test(correct)) errs.push('correct must be A/B/C/D')
      }
      const marksNum = Number(marksRaw)
      if (isNaN(marksNum) || marksNum <= 0) errs.push('marks must be > 0')
      if (errs.length) errors.push(`Row ${rowNum}: ${errs.join(' · ')}`)

      parsed.push({
        rowNum, type, question_text: question,
        option_a: a, option_b: b, option_c: c, option_d: d,
        correct_answer: type === 'objective' ? correct : null,
        marks: isNaN(marksNum) ? 1 : marksNum,
        theory_answer_guide: type === 'theory' ? (guide || null) : null,
        errors: errs,
      })
    })

    return { rows: parsed, errors }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: '' })
        setPreview(processRows(raw))
      } catch { showToast('Could not read the file.', 'error') }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  async function confirmImport() {
    if (!preview) return
    const valid = preview.rows.filter((r) => r.errors.length === 0)
    if (valid.length === 0) return
    setImporting(true)
    const payload = valid.map((r) => ({
      exam_id: examId, type: r.type, question_text: r.question_text,
      option_a: r.option_a || null, option_b: r.option_b || null, option_c: r.option_c || null, option_d: r.option_d || null,
      correct_answer: r.correct_answer, marks: r.marks, theory_answer_guide: r.theory_answer_guide,
    }))
    const { error } = await supabase.from('cbt_questions').insert(payload)
    setImporting(false)
    if (error) { showToast(`Insert failed: ${error.message}`, 'error'); return }
    const hasTheory = valid.some((r) => r.type === 'theory')
    if (hasTheory && !exam.has_theory) {
      await supabase.from('cbt_exams').update({ has_theory: true }).eq('id', examId)
    }
    showToast(`${valid.length} question(s) imported.`)
    setPreview(null)
    onReload()
  }

  const validCount = preview?.rows.filter((r) => r.errors.length === 0).length ?? 0
  const errorCount = preview?.errors.length ?? 0

  return (
    <div className="space-y-5">
      <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[#4A2E1B]">Bulk Question Upload</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Columns: <span className="font-mono">type, question, option_a..d, correct_answer, marks, theory_answer_guide</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={downloadSample} className="text-xs font-semibold bg-[#4A2E1B] text-white px-3.5 py-2 rounded-lg hover:bg-black">📥 Sample Excel</button>
            <label className="text-xs font-semibold bg-pink-600 text-white px-3.5 py-2 rounded-lg hover:bg-pink-700 cursor-pointer">
              📤 Upload Excel
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="hidden" />
            </label>
          </div>
        </div>

        {preview && (
          <div className="p-5 space-y-3">
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 font-semibold">{validCount} ready</span>
              {errorCount > 0 && <span className="px-3 py-1.5 rounded-full bg-red-50 text-red-700 ring-1 ring-red-200 font-semibold">{errorCount} error(s)</span>}
            </div>
            {errorCount > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 space-y-1 max-h-32 overflow-y-auto">
                {preview.errors.slice(0, 8).map((e, i) => <div key={i}>• {e}</div>)}
              </div>
            )}
            {validCount > 0 && (
              <div className="overflow-x-auto max-h-60 rounded-xl ring-1 ring-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-gray-700 text-[10px] uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Question</th>
                      <th className="px-3 py-2 text-center">Marks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.slice(0, 60).map((r, i) => (
                      <tr key={i} className={r.errors.length ? 'bg-red-50/40' : ''}>
                        <td className="px-3 py-2 font-mono text-gray-500">{r.rowNum}</td>
                        <td className="px-3 py-2 uppercase text-[10px] font-bold">{r.type}</td>
                        <td className="px-3 py-2 max-w-md truncate">{r.question_text}</td>
                        <td className="px-3 py-2 text-center font-bold">{r.marks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setPreview(null)} className="text-xs font-semibold px-4 py-2 rounded-lg text-gray-700 hover:bg-red-50">Cancel</button>
              <button onClick={confirmImport} disabled={validCount === 0 || importing} className="text-xs font-semibold px-4 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-50">
                {importing ? 'Importing…' : `Confirm Import (${validCount})`}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
          <p className="text-xs font-bold text-[#4A2E1B]">Existing Questions ({questions.length})</p>
          <p className="text-[11px] text-gray-500">
            {questions.filter((q) => q.type === 'objective').length} objective · {questions.filter((q) => q.type === 'theory').length} theory · {questions.reduce((a, b) => a + b.marks, 0)} marks
          </p>
        </div>
        {questions.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-400 italic">No questions yet. Upload above.</div>
        ) : (
          <div className="overflow-x-auto max-h-[560px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-gray-700 text-[11px] uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Question</th>
                  <th className="px-4 py-3 text-center">Correct</th>
                  <th className="px-4 py-3 text-center">Marks</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {questions.map((q, i) => (
                  <tr key={q.id} className="hover:bg-pink-50/50">
                    <td className="px-4 py-3 font-mono text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${q.type === 'theory' ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-200' : 'bg-pink-50 text-pink-700 ring-1 ring-pink-200'}`}>{q.type}</span>
                    </td>
                    <td className="px-4 py-3 max-w-md text-gray-800">{q.question_text}</td>
                    <td className="px-4 py-3 text-center font-mono font-bold">{q.type === 'objective' ? q.correct_answer : '—'}</td>
                    <td className="px-4 py-3 text-center font-bold">{q.marks}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => onDelete(q)} className="text-red-600 hover:text-red-700 font-semibold text-[11px]">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* -------------------- PREVIEW SECTION -------------------- */

function PreviewSection({ exam, questions }: { exam: CbtExam; questions: Question[] }) {
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="bg-[#4A2E1B] text-white rounded-2xl p-6">
        <h1 className="text-xl font-black">{exam.title}</h1>
        <div className="flex flex-wrap gap-4 mt-3 text-xs">
          <span>⏱ {exam.duration_minutes} minutes</span>
          <span>📝 {questions.length} questions</span>
          <span>💯 {questions.reduce((a, b) => a + b.marks, 0)} marks</span>
        </div>
        {exam.instructions && <p className="text-xs mt-3 italic opacity-90">{exam.instructions}</p>}
      </div>

      {questions.map((q, i) => (
        <div key={q.id} className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5">
          <div className="flex items-start gap-3 mb-3">
            <span className="shrink-0 w-7 h-7 rounded-lg bg-[#4A2E1B] text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
            <p className="font-medium text-sm text-[#4A2E1B] flex-1">{q.question_text}</p>
            <span className="text-[10px] font-bold text-gray-500 shrink-0">{q.marks} mark{q.marks === 1 ? '' : 's'}</span>
          </div>
          {q.type === 'objective' ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-10">
              {(['A', 'B', 'C', 'D'] as const).map((k) => {
                const txt = (q as any)[`option_${k.toLowerCase()}`]
                const isCorrect = q.correct_answer === k
                return (
                  <li key={k} className={`px-3 py-2 rounded-lg text-xs ${isCorrect ? 'bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800 font-semibold' : 'bg-slate-50 ring-1 ring-slate-200 text-gray-700'}`}>
                    <span className="font-bold mr-2">{k}.</span>{txt} {isCorrect && '✓'}
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="ml-10">
              <textarea disabled placeholder="Students type their answer here." rows={3} className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg resize-none" />
              {q.theory_answer_guide && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Show answer guide (admin only)</summary>
                  <p className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 italic">{q.theory_answer_guide}</p>
                </details>
              )}
            </div>
          )}
        </div>
      ))}

      {questions.length === 0 && (
        <div className="text-center py-12 text-xs text-gray-400 italic border-2 border-dashed border-slate-200 rounded-2xl">No questions to preview yet.</div>
      )}
    </div>
  )
}

/* ============================================================================
   TAB: SUBMISSIONS
   ============================================================================ */

function SubmissionsTab({
  exams, students, showToast,
}: {
  exams: CbtExam[]; students: Student[]
  showToast: (m: string, t?: Toast['tone']) => void
}) {
  const [examId, setExamId] = useState('')
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [loading, setLoading] = useState(false)

  const studentById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students])

  useEffect(() => {
    if (!examId) { setAttempts([]); return }
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('cbt_attempts').select('*')
        .eq('exam_id', examId)
        .order('submitted_at', { ascending: false })
      if (error) showToast(`Failed: ${error.message}`, 'error')
      setAttempts((data || []) as Attempt[])
      setLoading(false)
    })()
  }, [examId, showToast])

  return (
    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100">
        <h2 className="font-semibold text-[#4A2E1B]">Submissions</h2>
        <p className="text-xs text-gray-500 mt-0.5">Student attempts per exam.</p>
      </div>
      <div className="p-5 border-b border-slate-100">
        <label className="block text-xs font-bold text-[#4A2E1B] mb-1">Exam</label>
        <select value={examId} onChange={(e) => setExamId(e.target.value)} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none">
          <option value="">-- Choose Exam --</option>
          {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-gray-700 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">Student</th>
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-center">Score</th>
              <th className="px-5 py-3 text-center">Time Spent</th>
              <th className="px-5 py-3 text-center">Switches</th>
              <th className="px-5 py-3 text-center">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={6} className="px-5 py-12 text-center text-xs text-gray-400 italic">Loading…</td></tr>}
            {!loading && !examId && <tr><td colSpan={6} className="px-5 py-12 text-center text-xs text-gray-400 italic">Pick an exam above.</td></tr>}
            {!loading && examId && attempts.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-xs text-gray-400 italic">No submissions yet.</td></tr>}
            {!loading && attempts.map((a) => {
              const s = studentById[a.student_id]
              const pct = a.total_marks ? Math.round(((a.score || 0) / a.total_marks) * 100) : 0
              return (
                <tr key={a.id}>
                  <td className="px-5 py-3 font-medium text-[#4A2E1B]">{s?.full_name || '—'} <span className="text-gray-500 font-mono text-[10px]">{s?.admission_number}</span></td>
                  <td className="px-5 py-3 text-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 uppercase ${
                      a.status === 'submitted' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
                      a.status === 'in_progress' ? 'bg-blue-50 text-blue-700 ring-blue-200' :
                      a.status === 'graded' ? 'bg-purple-50 text-purple-700 ring-purple-200' :
                      'bg-amber-50 text-amber-700 ring-amber-200'
                    }`}>{a.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-5 py-3 text-center font-bold">{a.score ?? '—'} / {a.total_marks ?? '—'} <span className="text-gray-500">({pct}%)</span></td>
                  <td className="px-5 py-3 text-center text-gray-600">{formatDuration(a.duration_spent_seconds)}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`font-bold ${a.tab_switch_count > 0 ? 'text-red-600' : 'text-gray-500'}`}>{a.tab_switch_count}</span>
                  </td>
                  <td className="px-5 py-3 text-center text-gray-500">{a.submitted_at ? new Date(a.submitted_at).toLocaleString() : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============================================================================
   TAB: LIVE MONITOR
   ============================================================================ */

function LiveMonitorTab({
  exams, students, classes, subjects, questions, showToast, logAction, askConfirm,
}: {
  exams: CbtExam[]; students: Student[]; classes: ClassRow[]; subjects: SubjectRow[]
  questions: Question[]
  showToast: (m: string, t?: Toast['tone']) => void
  logAction: (a: string, d?: string) => void
  askConfirm: (t: string, m: string, cb: () => void) => void
}) {
  const [selectedExamId, setSelectedExamId] = useState('')
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [subTab, setSubTab] = useState<'live' | 'theory'>('live')

  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c.name])), [classes])
  const subjectById = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s.name])), [subjects])
  const studentById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students])

  const selectedExam = useMemo(
    () => exams.find((e) => e.id === selectedExamId) || null,
    [exams, selectedExamId]
  )

  const classStudents = useMemo(() => {
    if (!selectedExam) return []
    return students
      .filter((s) => s.class_id === selectedExam.class_id)
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [students, selectedExam])

  const examQuestions = useMemo(() => {
    if (!selectedExam) return []
    return questions.filter((q) => q.exam_id === selectedExam.id)
  }, [questions, selectedExam])

  const objectiveQuestions = useMemo(() => examQuestions.filter((q) => q.type === 'objective'), [examQuestions])
  const theoryQuestions = useMemo(() => examQuestions.filter((q) => q.type === 'theory'), [examQuestions])

  const loadAttempts = useCallback(async () => {
    if (!selectedExamId) { setAttempts([]); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('cbt_attempts').select('*')
      .eq('exam_id', selectedExamId)
    if (error) showToast(`Failed to load attempts: ${error.message}`, 'error')
    setAttempts((data || []) as Attempt[])
    setLastRefresh(new Date())
    setLoading(false)
  }, [selectedExamId, showToast])

  useEffect(() => { loadAttempts() }, [loadAttempts])

  useEffect(() => {
    if (!autoRefresh || !selectedExamId) return
    const i = setInterval(() => { loadAttempts() }, LIVE_REFRESH_MS)
    return () => clearInterval(i)
  }, [autoRefresh, selectedExamId, loadAttempts])

  const stats = useMemo(() => {
    const total = classStudents.length
    const started = attempts.length
    const submitted = attempts.filter((a) => a.status !== 'in_progress').length
    const inProgress = attempts.filter((a) => a.status === 'in_progress').length
    const notStarted = total - started
    const durations = attempts.filter((a) => a.duration_spent_seconds).map((a) => a.duration_spent_seconds || 0)
    const avgSeconds = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0
    return { total, started, submitted, inProgress, notStarted, avgSeconds }
  }, [classStudents, attempts])

  async function forceSubmit(attempt: Attempt) {
    const student = studentById[attempt.student_id]
    askConfirm('Force Submit?', `Force submit ${student?.full_name}'s attempt? Score will be calculated from current answers.`, async () => {
      const score = computeObjectiveScore(attempt.answers, objectiveQuestions)
      const total = objectiveQuestions.reduce((a, q) => a + q.marks, 0)
      const needsManual = theoryQuestions.length > 0
      const { error } = await supabase
        .from('cbt_attempts')
        .update({
          status: needsManual ? 'pending_manual_marking' : 'submitted',
          submitted_at: new Date().toISOString(),
          score,
          total_marks: total,
          final_score: needsManual ? null : score,
        })
        .eq('id', attempt.id)
      if (error) { showToast(`Force submit failed: ${error.message}`, 'error'); return }
      showToast(`${student?.full_name}'s attempt force-submitted.`, 'warn')
      logAction('Force submit', `${student?.full_name} · ${selectedExam?.title}`)
      loadAttempts()
    })
  }

  function cancelAttempt(attempt: Attempt) {
    const student = studentById[attempt.student_id]
    askConfirm('Cancel Attempt?', `Delete ${student?.full_name}'s attempt? They can start fresh.`, async () => {
      const { error } = await supabase.from('cbt_attempts').delete().eq('id', attempt.id)
      if (error) { showToast(`Cancel failed: ${error.message}`, 'error'); return }
      showToast(`Attempt cancelled for ${student?.full_name}.`, 'warn')
      logAction('Attempt cancelled', `${student?.full_name}`)
      loadAttempts()
    })
  }

  function extendOne(attempt: Attempt, minutes: number) {
    const student = studentById[attempt.student_id]
    askConfirm('Extend Time?', `Add +${minutes} minutes to ${student?.full_name}'s attempt?`, async () => {
      const { error } = await supabase
        .from('cbt_attempts')
        .update({ extended_minutes: (attempt.extended_minutes || 0) + minutes })
        .eq('id', attempt.id)
      if (error) { showToast(`Extend failed: ${error.message}`, 'error'); return }
      showToast(`+${minutes} min added for ${student?.full_name}.`, 'info')
      logAction('Extended time', `${student?.full_name} · +${minutes}m`)
      loadAttempts()
    })
  }

  function extendAll(minutes: number) {
    if (!selectedExam) return
    const active = attempts.filter((a) => a.status === 'in_progress')
    if (active.length === 0) { showToast('No active attempts to extend.', 'warn'); return }
    askConfirm('Extend Everyone?', `Add +${minutes} minutes to all ${active.length} in-progress attempts?`, async () => {
      for (const a of active) {
        await supabase
          .from('cbt_attempts')
          .update({ extended_minutes: (a.extended_minutes || 0) + minutes })
          .eq('id', a.id)
      }
      showToast(`+${minutes} min added to ${active.length} student(s).`, 'info')
      logAction('Extended all', `${selectedExam.title} · +${minutes}m`)
      loadAttempts()
    })
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-[#4A2E1B] mb-1">Live Exam</label>
            <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none">
              <option value="">-- Choose Exam --</option>
              {exams.filter((e) => e.status === 'published').map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} · {classById[ex.class_id]} · {subjectById[ex.subject_id]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`flex-1 text-xs font-bold py-2.5 rounded-xl border ${autoRefresh ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-gray-700 border-slate-200'}`}
            >
              {autoRefresh ? '● Auto-refresh ON' : '○ Auto-refresh OFF'}
            </button>
            <button onClick={loadAttempts} className="text-xs font-bold bg-[#4A2E1B] text-white px-4 py-2.5 rounded-xl hover:bg-black inline-flex items-center gap-2">
              <Icon name="refresh" /> Refresh
            </button>
          </div>
        </div>

        {selectedExam && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
            <span className="text-[11px] text-gray-500">
              {lastRefresh ? `Last refresh: ${lastRefresh.toLocaleTimeString()}` : 'Loading…'}
            </span>
            <div className="flex-1" />
            <button onClick={() => extendAll(5)} className="text-xs font-bold bg-amber-100 text-amber-800 px-3.5 py-2 rounded-xl hover:bg-amber-200">
              +5 min (all)
            </button>
            <button onClick={() => extendAll(10)} className="text-xs font-bold bg-amber-100 text-amber-800 px-3.5 py-2 rounded-xl hover:bg-amber-200">
              +10 min (all)
            </button>
          </div>
        )}
      </div>

      {!selectedExam && (
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-12 text-center text-xs text-gray-400 italic">
          Choose a published exam above to monitor attempts.
        </div>
      )}

      {selectedExam && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <LiveStat label="Enrolled" value={stats.total} tone="neutral" />
            <LiveStat label="Started" value={stats.started} tone="blue" />
            <LiveStat label="In Progress" value={stats.inProgress} tone="amber" />
            <LiveStat label="Submitted" value={stats.submitted} tone="emerald" />
            <LiveStat label="Not Started" value={stats.notStarted} tone="neutral" />
            <LiveStat label="Avg Time" value={stats.avgSeconds > 0 ? formatDuration(stats.avgSeconds) : '—'} tone="neutral" isText />
          </div>

          {theoryQuestions.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
              <div className="border-b border-slate-100 flex">
                <button
                  onClick={() => setSubTab('live')}
                  className={`px-5 py-3.5 text-xs font-bold border-b-2 ${subTab === 'live' ? 'border-pink-600 text-[#4A2E1B]' : 'border-transparent text-gray-500'}`}
                >
                  Live Status
                </button>
                <button
                  onClick={() => setSubTab('theory')}
                  className={`px-5 py-3.5 text-xs font-bold border-b-2 ${subTab === 'theory' ? 'border-pink-600 text-[#4A2E1B]' : 'border-transparent text-gray-500'}`}
                >
                  Mark Theory ({theoryQuestions.length})
                </button>
              </div>
            </div>
          )}

          {subTab === 'live' && (
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-[#4A2E1B]">{selectedExam.title} · Live Status</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {classStudents.length} students · {objectiveQuestions.length} objective · {theoryQuestions.length} theory
                </p>
              </div>
              <div className="overflow-x-auto max-h-[640px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-gray-700 text-[11px] uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Adm No</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Progress</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3 text-center">Switches</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classStudents.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-xs text-gray-400 italic">No students in this class.</td></tr>
                    )}
                    {classStudents.map((student) => {
                      const att = attempts.find((a) => a.student_id === student.id)
                      const objAnswered = att ? Object.keys(att.answers || {}).length : 0
                      const objScore = att ? computeObjectiveScore(att.answers, objectiveQuestions) : 0
                      const totalObj = objectiveQuestions.reduce((a, q) => a + q.marks, 0)
                      const statusLabel = !att ? 'Not Started' :
                        att.status === 'in_progress' ? 'In Progress' :
                        att.status === 'submitted' ? 'Submitted' :
                        att.status === 'auto_submitted' ? 'Auto Submitted' :
                        att.status === 'pending_manual_marking' ? 'Pending Marking' :
                        att.status === 'graded' ? 'Graded' : att.status
                      const tone =
                        !att ? 'bg-slate-100 text-gray-700 ring-slate-200' :
                        att.status === 'in_progress' ? 'bg-blue-50 text-blue-700 ring-blue-200' :
                        att.status === 'pending_manual_marking' ? 'bg-amber-50 text-amber-700 ring-amber-200' :
                        att.status === 'graded' ? 'bg-purple-50 text-purple-700 ring-purple-200' :
                        'bg-emerald-50 text-emerald-700 ring-emerald-200'
                      return (
                        <tr key={student.id} className="hover:bg-pink-50/50">
                          <td className="px-4 py-3 font-medium text-[#4A2E1B]">{student.full_name}</td>
                          <td className="px-4 py-3 font-mono text-pink-700">{student.admission_number}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 uppercase ${tone}`}>{statusLabel}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {att ? <span className="text-gray-700 font-mono">{objAnswered}/{objectiveQuestions.length}</span> : '—'}
                          </td>
                          <td className="px-4 py-3 text-center font-bold">
                            {att && att.status !== 'in_progress'
                              ? <>{objScore}/{totalObj}</>
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {att ? <span className={`font-bold ${att.tab_switch_count > 0 ? 'text-red-600' : 'text-gray-500'}`}>{att.tab_switch_count}</span> : '—'}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {att ? (
                              <>
                                {att.status === 'in_progress' && (
                                  <>
                                    <button onClick={() => extendOne(att, 5)} className="text-amber-600 hover:text-amber-700 font-semibold text-[11px] mr-2">+5m</button>
                                    <button onClick={() => forceSubmit(att)} className="text-emerald-600 hover:text-emerald-700 font-semibold text-[11px] mr-2">Force</button>
                                  </>
                                )}
                                <button onClick={() => cancelAttempt(att)} className="text-red-600 hover:text-red-700 font-semibold text-[11px]">Cancel</button>
                              </>
                            ) : (
                              <span className="text-[11px] text-gray-400 italic">Waiting…</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {subTab === 'theory' && theoryQuestions.length > 0 && (
            <TheoryMarkingPanel
              exam={selectedExam}
              questions={theoryQuestions}
              attempts={attempts}
              students={classStudents}
              objectiveQuestions={objectiveQuestions}
              showToast={showToast}
              logAction={logAction}
              onReload={loadAttempts}
            />
          )}
        </>
      )}
    </div>
  )
}

function LiveStat({ label, value, tone, isText }: { label: string; value: number | string; tone: 'neutral' | 'blue' | 'amber' | 'emerald'; isText?: boolean }) {
  const toneMap = {
    neutral: 'text-[#4A2E1B]',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    emerald: 'text-emerald-600',
  }
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`${isText ? 'text-lg' : 'text-2xl'} font-black mt-1 ${toneMap[tone]}`}>{value}</p>
    </div>
  )
}

/* ============================================================================
   THEORY MARKING PANEL
   ============================================================================ */

function TheoryMarkingPanel({
  exam, questions, attempts, students, objectiveQuestions, showToast, logAction, onReload,
}: {
  exam: CbtExam
  questions: Question[]
  attempts: Attempt[]
  students: Student[]
  objectiveQuestions: Question[]
  showToast: (m: string, t?: Toast['tone']) => void
  logAction: (a: string, d?: string) => void
  onReload: () => void
}) {
  const [openAttemptId, setOpenAttemptId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Record<string, number>>>({})
  const [saving, setSaving] = useState(false)

  const studentById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students])

  const pendingAttempts = useMemo(
    () => attempts.filter((a) => a.status === 'pending_manual_marking' || a.status === 'graded'),
    [attempts]
  )

  function initDraft(attempt: Attempt) {
    if (drafts[attempt.id]) return
    const init: Record<string, number> = {}
    questions.forEach((q) => { init[q.id] = 0 })
    setDrafts((prev) => ({ ...prev, [attempt.id]: init }))
  }

  async function saveMarks(attempt: Attempt) {
    const d = drafts[attempt.id] || {}
    const theoryScore = Object.values(d).reduce((a, b) => a + (b || 0), 0)
    const objScore = attempt.score || 0
    const finalScore = objScore + theoryScore

    setSaving(true)
    const { error } = await supabase
      .from('cbt_attempts')
      .update({
        final_score: finalScore,
        status: 'graded',
        graded_at: new Date().toISOString(),
      })
      .eq('id', attempt.id)
    setSaving(false)

    if (error) { showToast(`Save failed: ${error.message}`, 'error'); return }
    showToast(`Marks saved. Final score: ${finalScore}`)
    logAction('Theory marked', `${studentById[attempt.student_id]?.full_name} · Final ${finalScore}`)
    onReload()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-bold text-[#4A2E1B]">Theory Marking · {questions.length} question(s)</h3>
        <p className="text-[11px] text-gray-500 mt-0.5">Open each submission to award marks per question.</p>
      </div>
      <div className="divide-y divide-slate-100">
        {pendingAttempts.length === 0 && (
          <div className="p-12 text-center text-xs text-gray-400 italic">No submissions waiting for manual marking.</div>
        )}
        {pendingAttempts.map((attempt) => {
          const student = studentById[attempt.student_id]
          const open = openAttemptId === attempt.id
          const objTotal = objectiveQuestions.reduce((a, q) => a + q.marks, 0)
          return (
            <div key={attempt.id}>
              <button
                onClick={() => { setOpenAttemptId(open ? null : attempt.id); if (!open) initDraft(attempt) }}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-pink-50/40"
              >
                <div className="min-w-0">
                  <p className="font-bold text-sm text-[#4A2E1B] truncate">{student?.full_name || '—'}</p>
                  <p className="text-[10px] text-gray-500 font-mono">{student?.admission_number}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 uppercase ${attempt.status === 'graded' ? 'bg-purple-50 text-purple-700 ring-purple-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}`}>
                    {attempt.status === 'graded' ? 'Graded' : 'Pending'}
                  </span>
                  {attempt.final_score !== null && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-gray-700">Final: {attempt.final_score}</span>
                  )}
                  <span className="text-xs text-gray-500">{open ? '▲' : '▼'}</span>
                </div>
              </button>

              {open && (
                <div className="px-5 pb-6 space-y-4 bg-slate-50">
                  <div className="bg-white rounded-xl p-4 border border-slate-200 mt-3">
                    <p className="text-[11px] font-bold uppercase text-gray-500">Objective Section</p>
                    <p className="text-sm font-bold text-[#4A2E1B] mt-1">
                      {attempt.score ?? 0} / {objTotal} marks auto-scored
                    </p>
                  </div>

                  {questions.map((q, idx) => {
                    const studentAnswer = (attempt.theory_answers || {})[q.id] || ''
                    const awarded = drafts[attempt.id]?.[q.id] ?? 0
                    return (
                      <div key={q.id} className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 flex-1">
                            <span className="shrink-0 w-7 h-7 rounded-lg bg-[#4A2E1B] text-white text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                            <p className="text-sm font-medium text-[#4A2E1B]">{q.question_text}</p>
                          </div>
                          <span className="text-[10px] font-bold text-gray-500 shrink-0">Max {q.marks}</span>
                        </div>

                        <div>
                          <p className="text-[11px] font-bold uppercase text-gray-500 mb-1">Student's Answer</p>
                          <div className="bg-slate-50 rounded-lg p-3 text-xs text-gray-800 whitespace-pre-wrap border border-slate-200">
                            {studentAnswer || <span className="italic text-gray-400">(Blank)</span>}
                          </div>
                        </div>

                        {q.theory_answer_guide && (
                          <details>
                            <summary className="cursor-pointer text-[11px] font-bold text-amber-700 hover:text-amber-800">Show answer guide</summary>
                            <p className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 italic whitespace-pre-wrap">{q.theory_answer_guide}</p>
                          </details>
                        )}

                        <div className="flex items-center gap-3">
                          <label className="text-xs font-bold text-gray-600">Marks:</label>
                          <input
                            type="number"
                            min={0}
                            max={q.marks}
                            value={awarded}
                            onChange={(e) => {
                              const v = Math.max(0, Math.min(q.marks, Number(e.target.value) || 0))
                              setDrafts((prev) => ({
                                ...prev,
                                [attempt.id]: { ...(prev[attempt.id] || {}), [q.id]: v },
                              }))
                            }}
                            className="w-20 text-sm px-3 py-2 bg-white border border-pink-200 rounded-lg outline-none text-center font-bold"
                          />
                          <span className="text-xs text-gray-500">/ {q.marks}</span>
                        </div>
                      </div>
                    )
                  })}

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                    <button onClick={() => setOpenAttemptId(null)} className="text-xs font-bold px-4 py-2 rounded-lg text-gray-700 hover:bg-slate-100">Close</button>
                    <button onClick={() => saveMarks(attempt)} disabled={saving} className="text-xs font-bold px-5 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-50">
                      Save Marks &amp; Finalize
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


/* ============================================================================
   TAB: BROADSHEET + REPORT CARD PUBLISH
   ============================================================================ */

function BroadsheetTab({
  classes, subjects, students, scores, setScores, reportCardPub, refresh, showToast, logAction, askConfirm,
}: {
  classes: ClassRow[]; subjects: SubjectRow[]; students: Student[]
  scores: ScoreRow[]; setScores: (s: ScoreRow[]) => void
  reportCardPub: ReportCardPub[]
  refresh: () => void
  showToast: (m: string, t?: Toast['tone']) => void
  logAction: (a: string, d?: string) => void
  askConfirm: (t: string, m: string, cb: () => void) => void
}) {
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedTerm, setSelectedTerm] = useState<Term>('First Term')
  const [session, setSession] = useState(SCHOOL.session)

  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c.name])), [classes])
  const subjectById = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s.name])), [subjects])
  const studentById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students])

  const classStudents = useMemo(
    () => students.filter((s) => s.class_id === selectedClass),
    [students, selectedClass]
  )

  const filteredScores = useMemo(
    () => scores.filter((sc) => {
      const student = studentById[sc.student_id]
      return student?.class_id === selectedClass && sc.term === selectedTerm && sc.session === session
    }),
    [scores, selectedClass, selectedTerm, session, studentById]
  )

  const classSubjectIds = useMemo(() => {
    const set = new Set<string>()
    filteredScores.forEach((s) => set.add(s.subject_id))
    return Array.from(set).sort()
  }, [filteredScores])

  const rows = useMemo(() => {
    const byStudent = new Map<string, {
      id: string; name: string; admissionNo: string; age: number | null
      subjects: Record<string, { test: number | null; exam: number | null; total: number }>
      total: number; subjectsOffered: number; percentage: number
    }>()

    classStudents.forEach((st) => {
      byStudent.set(st.id, {
        id: st.id, name: st.full_name, admissionNo: st.admission_number,
        age: ageFromDob(st.date_of_birth),
        subjects: {}, total: 0, subjectsOffered: 0, percentage: 0,
      })
    })

    filteredScores.forEach((sc) => {
      const row = byStudent.get(sc.student_id)
      if (!row) return
      row.subjects[sc.subject_id] = {
        test: sc.test_score,
        exam: sc.exam_score,
        total: (sc.test_score || 0) + (sc.exam_score || 0),
      }
      if (sc.test_score !== null || sc.exam_score !== null) {
        row.total += (sc.test_score || 0) + (sc.exam_score || 0)
        row.subjectsOffered++
      }
    })

    const arr = Array.from(byStudent.values()).map((r) => ({
      ...r,
      percentage: r.subjectsOffered > 0 ? (r.total / (r.subjectsOffered * 100)) * 100 : 0,
    }))

    const sorted = [...arr].sort((a, b) => b.total - a.total)
    const rankMap: Record<string, number> = {}
    let lastTotal = -1, lastRank = 0
    sorted.forEach((s, i) => {
      if (s.total === lastTotal) rankMap[s.id] = lastRank
      else { rankMap[s.id] = i + 1; lastRank = i + 1; lastTotal = s.total }
    })

    return arr.map((r) => ({ ...r, rank: rankMap[r.id] })).sort((a, b) => a.name.localeCompare(b.name))
  }, [classStudents, filteredScores])

  const classAverage = useMemo(() => {
    if (rows.length === 0) return '0.00'
    const sum = rows.reduce((a, r) => a + r.percentage, 0)
    return (sum / rows.length).toFixed(2)
  }, [rows])

  const isPublished = reportCardPub.some(
    (r) => r.class_id === selectedClass && r.term === selectedTerm && r.session === session
  )

  function downloadTemplate() {
    if (!selectedClass) { showToast('Pick a class.', 'warn'); return }
    const header: string[] = ['Admission No', 'Name', 'Date of Birth']
    subjects.forEach((s) => header.push(`${s.name} CA (40)`, `${s.name} Exam (60)`))
    const ws = XLSX.utils.aoa_to_sheet([header, ...classStudents.map((s) => [
      s.admission_number, s.full_name, s.date_of_birth || '',
      ...subjects.flatMap(() => ['', '']),
    ])])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, (classById[selectedClass] || 'Class').slice(0, 28))
    XLSX.writeFile(wb, `TTS_Broadsheet_${classById[selectedClass]}_${selectedTerm}.xlsx`.replace(/\s+/g, '_'))
    showToast('Template downloaded.', 'info')
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!selectedClass) { showToast('Pick a class first.', 'warn'); return }

    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: '' })
        if (raw.length < 2) { showToast('File is empty.', 'error'); return }

        const header = raw[0] as string[]
        const body = raw.slice(1) as any[][]

        const subjectNameToId = new Map<string, string>()
        subjects.forEach((s) => subjectNameToId.set(normalizeName(s.name), s.id))

        const subjectCols: { subject_id: string; caIdx: number; examIdx: number }[] = []
        const errors: string[] = []
        for (let i = 0; i < header.length; i++) {
          const h = String(header[i]).trim()
          const m = h.match(/^(.+?)\s+CA\s*\(\d+\)$/i)
          if (m) {
            const subjName = m[1].trim()
            const sid = subjectNameToId.get(normalizeName(subjName))
            if (!sid) { errors.push(`Unknown subject "${subjName}"`); continue }
            const examIdx = header.findIndex((x) => new RegExp(`^${subjName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+Exam`, 'i').test(String(x)))
            if (examIdx === -1) { errors.push(`No Exam column for "${subjName}"`); continue }
            subjectCols.push({ subject_id: sid, caIdx: i, examIdx })
          }
        }
        if (subjectCols.length === 0) { showToast('No subject columns found. Use the template.', 'error'); return }
        if (errors.length) { showToast(`Header errors: ${errors[0]}`, 'error'); return }

        const admToStudent = new Map<string, Student>()
        classStudents.forEach((s) => admToStudent.set(s.admission_number.toLowerCase(), s))

        const upserts: any[] = []
        const rowErrors: string[] = []

        body.forEach((row, rowIdx) => {
          const adm = String(row[0] ?? '').trim()
          if (!adm) return
          const student = admToStudent.get(adm.toLowerCase())
          if (!student) { rowErrors.push(`Row ${rowIdx + 2}: ${adm} not in this class`); return }
          subjectCols.forEach((sc) => {
            const caRaw = row[sc.caIdx]
            const examRaw = row[sc.examIdx]
            const ca = caRaw === '' || caRaw == null ? null : Number(caRaw)
            const exam = examRaw === '' || examRaw == null ? null : Number(examRaw)
            if (ca !== null && (isNaN(ca) || ca < 0 || ca > 40)) { rowErrors.push(`Row ${rowIdx + 2}: CA must be 0–40`); return }
            if (exam !== null && (isNaN(exam) || exam < 0 || exam > 60)) { rowErrors.push(`Row ${rowIdx + 2}: Exam must be 0–60`); return }
            if (ca === null && exam === null) return
            upserts.push({
              student_id: student.id,
              subject_id: sc.subject_id,
              class_id: selectedClass,
              test_score: ca,
              exam_score: exam,
              term: selectedTerm,
              session,
            })
          })
        })

        if (rowErrors.length) { showToast(`${rowErrors.length} issue(s): ${rowErrors[0]}`, 'error'); return }
        if (upserts.length === 0) { showToast('No valid scores found.', 'error'); return }

        const { error } = await supabase
          .from('scores')
          .upsert(upserts, { onConflict: 'student_id,subject_id,term,session' })

        if (error) { showToast(`Save failed: ${error.message}`, 'error'); return }

        const { data: fresh } = await supabase.from('scores').select('*')
        setScores(fresh || [])
        showToast(`${upserts.length} score(s) saved.`)
        logAction('Broadsheet uploaded', `${classById[selectedClass]} · ${selectedTerm} · ${upserts.length} scores`)
      } catch { showToast('Could not read the file.', 'error') }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  async function publishReportCards() {
    askConfirm(
      'Publish Report Cards?',
      `All students in ${classById[selectedClass]} will see their ${selectedTerm} report cards immediately. Continue?`,
      async () => {
        const { error } = await supabase
          .from('report_card_publications')
          .insert([{ class_id: selectedClass, term: selectedTerm, session }])
        if (error) {
          if (error.code === '23505') showToast('Already published for this class + term.', 'warn')
          else showToast(`Publish failed: ${error.message}`, 'error')
          return
        }
        showToast(`Report cards published for ${classById[selectedClass]} · ${selectedTerm}.`)
        logAction('Report cards published', `${classById[selectedClass]} · ${selectedTerm} · ${session}`)
        refresh()
      }
    )
  }

  async function unpublishReportCards() {
    askConfirm(
      'Unpublish Report Cards?',
      `Students in ${classById[selectedClass]} will no longer see their ${selectedTerm} report cards. Continue?`,
      async () => {
        const { error } = await supabase
          .from('report_card_publications')
          .delete()
          .eq('class_id', selectedClass)
          .eq('term', selectedTerm)
          .eq('session', session)
        if (error) { showToast(`Unpublish failed: ${error.message}`, 'error'); return }
        showToast(`Report cards unpublished for ${classById[selectedClass]} · ${selectedTerm}.`, 'warn')
        logAction('Report cards unpublished', `${classById[selectedClass]} · ${selectedTerm}`)
        refresh()
      }
    )
  }

  async function clearBroadsheet() {
    askConfirm(
      'Clear All Scores?',
      `This will delete ALL subject scores for ${classById[selectedClass]} · ${selectedTerm} · ${session}. You can re-upload a corrected file after. Cannot be undone.`,
      async () => {
        const { error: scErr } = await supabase
          .from('scores')
          .delete()
          .eq('class_id', selectedClass)
          .eq('term', selectedTerm)
          .eq('session', session)

        if (scErr) { showToast(`Clear failed: ${scErr.message}`, 'error'); return }

        const { error: pubErr } = await supabase
          .from('report_card_publications')
          .delete()
          .eq('class_id', selectedClass)
          .eq('term', selectedTerm)
          .eq('session', session)

        if (pubErr) { showToast(`Cleared scores but couldn't unpublish report cards: ${pubErr.message}`, 'warn') }

        showToast('Broadsheet cleared. You can now re-upload.')
        logAction('Broadsheet cleared', `${classById[selectedClass]} · ${selectedTerm} · ${session}`)

        const { data: fresh } = await supabase.from('scores').select('*')
        setScores(fresh || [])
        refresh()
      }
    )
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#4A2E1B] mb-1">Class</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none">
              <option value="">-- Choose Class --</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#4A2E1B] mb-1">Term</label>
            <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value as Term)} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none">
              {TERMS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#4A2E1B] mb-1">Session</label>
            <input value={session} onChange={(e) => setSession(e.target.value)} className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={downloadTemplate} className="text-xs font-bold bg-[#4A2E1B] text-white px-4 py-2.5 rounded-xl hover:bg-black inline-flex items-center gap-2">
            <Icon name="download" /> Template
          </button>
          <label className="text-xs font-bold bg-pink-600 text-white px-4 py-2.5 rounded-xl hover:bg-pink-700 cursor-pointer inline-flex items-center gap-2">
            <Icon name="upload" /> Upload Excel
            <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="hidden" />
          </label>

          {selectedClass && !isPublished && (
            <button onClick={publishReportCards} className="text-xs font-bold bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 inline-flex items-center gap-2">
              🚀 Publish Report Cards
            </button>
          )}
          {selectedClass && isPublished && (
            <>
              <span className="text-xs font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-4 py-2.5 rounded-xl inline-flex items-center gap-2">
                ✓ Report Cards Published
              </span>
              <button onClick={unpublishReportCards} className="text-xs font-bold bg-amber-600 text-white px-4 py-2.5 rounded-xl hover:bg-amber-700">
                Unpublish Report Cards
              </button>
            </>
          )}

          {selectedClass && filteredScores.length > 0 && (
            <button
              onClick={clearBroadsheet}
              className="text-xs font-bold bg-red-600 text-white px-4 py-2.5 rounded-xl hover:bg-red-700 inline-flex items-center gap-2"
            >
              🗑️ Clear All Scores
            </button>
          )}
        </div>
      </div>

      {selectedClass && (
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-[#4A2E1B]">{classById[selectedClass]} · {selectedTerm} Broadsheet</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">{rows.length} students · Class Average {classAverage}%</p>
          </div>
          {rows.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-400 italic">No students or scores yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#4A2E1B] text-white">
                  <tr>
                    <th className="p-3 sticky left-0 bg-[#4A2E1B]">Name</th>
                    <th className="p-3 text-center">Age</th>
                    <th className="p-3 text-center">Pos.</th>
                    {classSubjectIds.map((sid) => (
                      <th key={sid} className="p-3 text-center border-l border-pink-900/50">
                        {subjectById[sid]}<br /><span className="text-[10px] opacity-80">(100)</span>
                      </th>
                    ))}
                    <th className="p-3 text-center border-l border-pink-900">Total</th>
                    <th className="p-3 text-center border-l border-pink-900">Avg (%)</th>
                    <th className="p-3 text-center border-l border-pink-900">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pink-100">
                  {rows.map((r) => {
                    const { grade, tone } = gradeFromTotal(r.percentage)
                    return (
                      <tr key={r.id} className="hover:bg-pink-50/50">
                        <td className="p-3 font-bold text-[#4A2E1B] sticky left-0 bg-white">
                          {r.name}
                          <div className="text-[10px] text-gray-500 font-mono">{r.admissionNo}</div>
                        </td>
                        <td className="p-3 text-center">{r.age ?? '—'}</td>
                        <td className="p-3 text-center font-black">{ordinal(r.rank)}</td>
                        {classSubjectIds.map((sid) => {
                          const s = r.subjects[sid]
                          if (!s) return <td key={sid} className="p-3 text-center bg-gray-50 text-gray-300">–</td>
                          const subG = gradeFromTotal(s.total)
                          return (
                            <td key={sid} className="p-3 text-center border-l border-pink-100">
                              <div className={s.total < 40 ? 'text-red-600 font-bold' : ''}>{s.total}</div>
                              <div className={`text-[10px] ${subG.tone}`}>{subG.grade}</div>
                            </td>
                          )
                        })}
                        <td className="p-3 text-center font-black text-pink-700">{r.total}</td>
                        <td className="p-3 text-center font-bold text-emerald-700">{r.percentage.toFixed(2)}</td>
                        <td className={`p-3 text-center font-black ${tone}`}>{grade}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ============================================================================
   TAB: NEWS & ANNOUNCEMENTS
   ============================================================================ */

function NewsTab({
  announcements, classes, refresh, showToast, logAction, askConfirm,
}: {
  announcements: Announcement[]
  classes: ClassRow[]
  refresh: () => void
  showToast: (m: string, t?: Toast['tone']) => void
  logAction: (a: string, d?: string) => void
  askConfirm: (t: string, m: string, cb: () => void) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '',
    body: '',
    audience: 'all' as 'all' | 'students' | 'teachers' | 'class',
    class_id: '',
    pinned: false,
    expires_at: '',
  })
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c.name])), [classes])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.type !== 'application/pdf') {
      showToast('Only PDF files are allowed.', 'error')
      e.target.value = ''
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      showToast('File too large. Max 5 MB.', 'error')
      e.target.value = ''
      return
    }
    setFile(f)
  }

  async function submitAnnouncement(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { showToast('Title is required.', 'error'); return }
    if (!form.body.trim()) { showToast('Body is required.', 'error'); return }
    if (form.audience === 'class' && !form.class_id) {
      showToast('Please choose a class.', 'error'); return
    }

    setSaving(true)
    let attachment_url: string | null = null
    let attachment_name: string | null = null

    if (file) {
      const ts = Date.now()
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_')
      const path = `${ts}_${safeName}`
      const { error: upErr } = await supabase.storage
        .from('announcements')
        .upload(path, file, { contentType: 'application/pdf', upsert: false })

      if (upErr) {
        showToast(`Upload failed: ${upErr.message}`, 'error')
        setSaving(false)
        return
      }

      const { data: urlData } = supabase.storage.from('announcements').getPublicUrl(path)
      attachment_url = urlData.publicUrl
      attachment_name = file.name
    }

    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      audience: form.audience,
      class_id: form.audience === 'class' ? form.class_id : null,
      attachment_url,
      attachment_name,
      pinned: form.pinned,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    }

    const { error } = await supabase.from('announcements').insert([payload])
    setSaving(false)

    if (error) { showToast(`Save failed: ${error.message}`, 'error'); return }

    showToast('Announcement published.')
    logAction('Announcement published', `${form.title} · ${form.audience}`)
    setForm({ title: '', body: '', audience: 'all', class_id: '', pinned: false, expires_at: '' })
    setFile(null)
    setShowForm(false)
    refresh()
  }

  function deleteAnnouncement(a: Announcement) {
    askConfirm('Delete Announcement?', `Remove "${a.title}"? Students will no longer see it.`, async () => {
      if (a.attachment_url) {
        const path = a.attachment_url.split('/').pop()
        if (path) {
          await supabase.storage.from('announcements').remove([path])
        }
      }
      const { error } = await supabase.from('announcements').delete().eq('id', a.id)
      if (error) { showToast(`Delete failed: ${error.message}`, 'error'); return }
      showToast('Announcement removed.', 'warn')
      logAction('Announcement deleted', a.title)
      refresh()
    })
  }

  async function togglePin(a: Announcement) {
    const { error } = await supabase.from('announcements').update({ pinned: !a.pinned }).eq('id', a.id)
    if (error) { showToast(`Update failed: ${error.message}`, 'error'); return }
    showToast(a.pinned ? 'Unpinned.' : 'Pinned to top.', 'info')
    refresh()
  }

  const AUDIENCE_LABEL: Record<Announcement['audience'], string> = {
    all: 'Everyone',
    students: 'All Students',
    teachers: 'All Teachers',
    class: 'Specific Class',
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[#4A2E1B]">News &amp; Announcements</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Post news to students and teachers. Attach a PDF (school calendar, newsletter, etc.).
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="text-xs font-bold bg-pink-600 text-white px-4 py-2.5 rounded-xl hover:bg-pink-700"
          >
            {showForm ? 'Close' : '+ New Announcement'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={submitAnnouncement} className="p-5 bg-slate-50 border-b border-slate-100 space-y-4">
            <FormField label="Title" required>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Mid-Term Break Announcement"
                className="w-full text-sm px-3.5 py-2.5 bg-white border border-pink-200 rounded-xl outline-none"
              />
            </FormField>

            <FormField label="Message" required>
              <textarea
                required
                rows={4}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Write your announcement here…"
                className="w-full text-sm p-3 bg-white border border-pink-200 rounded-xl outline-none resize-none"
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Send To" required>
                <select
                  value={form.audience}
                  onChange={(e) => setForm({ ...form, audience: e.target.value as any })}
                  className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none"
                >
                  <option value="all">Everyone</option>
                  <option value="students">All Students</option>
                  <option value="teachers">All Teachers</option>
                  <option value="class">Specific Class</option>
                </select>
              </FormField>

              {form.audience === 'class' && (
                <FormField label="Class" required>
                  <select
                    required
                    value={form.class_id}
                    onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                    className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none"
                  >
                    <option value="">-- Choose Class --</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </FormField>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Attach PDF (optional)">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#4A2E1B] file:text-white hover:file:bg-black bg-white border border-pink-200 rounded-xl p-1"
                />
                {file && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    Selected: {file.name} ({(file.size / 1024).toFixed(0)} KB)
                  </p>
                )}
              </FormField>

              <FormField label="Expires (optional)">
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                  className="w-full text-sm px-3 py-2.5 bg-white border border-pink-200 rounded-xl outline-none"
                />
                <p className="text-[10px] text-gray-500 mt-1">Leave blank to keep forever</p>
              </FormField>
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                className="w-5 h-5 rounded border-pink-300 text-pink-600 focus:ring-pink-500"
              />
              <span className="text-sm font-medium text-[#4A2E1B]">📌 Pin to top (important)</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setFile(null) }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-700 disabled:opacity-50"
              >
                {saving ? 'Publishing…' : 'Publish Announcement'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="font-semibold text-[#4A2E1B]">Published Announcements</h2>
          <p className="text-xs text-gray-500 mt-0.5">{announcements.length} total</p>
        </div>

        {announcements.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-400 italic">
            No announcements yet. Click "+ New Announcement" to publish one.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {announcements.map((a) => (
              <li key={a.id} className="p-5 hover:bg-pink-50/30">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {a.pinned && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">📌 Pinned</span>}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 uppercase ${
                        a.audience === 'all' ? 'bg-slate-100 text-gray-700 ring-slate-200' :
                        a.audience === 'students' ? 'bg-pink-50 text-pink-700 ring-pink-200' :
                        a.audience === 'teachers' ? 'bg-blue-50 text-blue-700 ring-blue-200' :
                        'bg-emerald-50 text-emerald-700 ring-emerald-200'
                      }`}>
                        {a.audience === 'class' ? classById[a.class_id || ''] || 'Class' : AUDIENCE_LABEL[a.audience]}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-[#4A2E1B]">{a.title}</h3>
                    <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">{a.body}</p>

                    {a.attachment_url && (
                      <a
                        href={a.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-pink-700 hover:text-pink-800 underline"
                      >
                        📎 {a.attachment_name || 'Attachment'}
                      </a>
                    )}

                    <p className="text-[10px] text-gray-400 mt-2">
                      Published {new Date(a.published_at).toLocaleString()}
                      {a.expires_at && ` · Expires ${new Date(a.expires_at).toLocaleString()}`}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button
                      onClick={() => togglePin(a)}
                      className="text-[11px] font-bold text-amber-700 hover:text-amber-900"
                    >
                      {a.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                      onClick={() => deleteAnnouncement(a)}
                      className="text-[11px] font-bold text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ============================================================================
   TAB: AUDIT
   ============================================================================ */

function AuditTab({
  audit, setAudit, showToast, askConfirm,
}: {
  audit: AuditEntry[]; setAudit: React.Dispatch<React.SetStateAction<AuditEntry[]>>
  showToast: (m: string, t?: Toast['tone']) => void
  askConfirm: (t: string, m: string, cb: () => void) => void
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[#4A2E1B]">Audit Log</h2>
          <p className="text-xs text-gray-500 mt-0.5">Session actions (not persisted across reloads).</p>
        </div>
        <button
          onClick={() => askConfirm('Clear Log?', 'Clear the session audit log?', () => { setAudit([]); showToast('Cleared.', 'warn') })}
          className="text-xs font-semibold text-gray-600 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50"
        >
          Clear
        </button>
      </div>
      <ol className="p-5 space-y-3 max-h-[600px] overflow-y-auto">
        {audit.length === 0 && <li className="text-center py-10 text-xs text-gray-400 italic">No actions in this session.</li>}
        {audit.map((a, i) => (
          <li key={i} className="flex items-start gap-3 p-3 rounded-xl ring-1 ring-slate-200 bg-white">
            <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center shrink-0"><Icon name="clock" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#4A2E1B]">{a.action}</p>
              {a.detail && <p className="text-[11px] text-gray-500">{a.detail}</p>}
              <p className="text-[10px] text-gray-400 mt-1">{new Date(a.ts).toLocaleString()}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ============================================================================
   TAB: SETTINGS
   ============================================================================ */

function SettingsTab() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="font-semibold text-[#4A2E1B]">School Identity</h2>
          <p className="text-xs text-gray-500 mt-0.5">Read-only.</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadOnly label="School Name" value={SCHOOL.name} />
          <ReadOnly label="Motto" value={SCHOOL.motto} />
          <div className="sm:col-span-2"><ReadOnly label="Address" value={SCHOOL.address} /></div>
          <ReadOnly label="Email" value={SCHOOL.email} />
          <ReadOnly label="Website" value={SCHOOL.website} />
          <ReadOnly label="Academic Session" value={SCHOOL.session} />
          <ReadOnly label="Version" value={`v${SCHOOL.version}`} />
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100"><h2 className="font-semibold text-[#4A2E1B]">Grade Scale</h2></div>
        <div className="p-5 grid grid-cols-2 gap-2 text-[11px]">
          {GRADE_SCALE.map((g) => (
            <div key={g.g} className="flex justify-between p-2.5 rounded-lg bg-slate-50 ring-1 ring-slate-200">
              <span className="font-semibold text-[#4A2E1B]">{g.g}</span>
              <span className="text-gray-600">{g.min}+</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
   SHARED UI
   ============================================================================ */

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">{label}</p>
      <p className="text-sm text-[#4A2E1B] font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">{value}</p>
    </div>
  )
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-[#4A2E1B] mb-1">
        {label} {required && <span className="text-pink-600">*</span>}
      </label>
      {children}
    </div>
  )
}