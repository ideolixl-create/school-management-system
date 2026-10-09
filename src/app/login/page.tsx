'use client'

/* ============================================================================
   THE TRUSTWORTHY SCHOOLS — LOGIN PAGE
   Student · Teacher · Admin
   ============================================================================ */

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/* ============================================================================
   CONFIG
   ============================================================================ */

const ADMIN_PASSWORD = 'f09b302c@2TS'
const ADMIN_SESSION_KEY = 'tts.admin.session'
const ADMIN_SESSION_MINUTES = 30

const SCHOOL = {
  name: 'The Trustworthy Schools',
  motto: 'Nurture for Piety',
  logo: 'https://raw.githubusercontent.com/ideolixlearninghub/Trustworthy_schoolsexam/main/The%20trustworthy%20school%20logo.jpg',
}

type Role = 'student' | 'teacher' | 'admin'

const ROLE_OPTIONS: { value: Role; label: string; icon: string; hint: string }[] = [
  { value: 'student', label: 'Student', icon: '🎓', hint: 'Admission number + password' },
  { value: 'teacher', label: 'Teacher', icon: '📚', hint: 'School email + password' },
  { value: 'admin', label: 'Admin', icon: '🔐', hint: 'Admin password' },
]

/* ============================================================================
   GLOBAL STYLE — white-on-white fix
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
          @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-slide {
            animation: fadeSlideUp 0.35s ease-out both;
          }
          @keyframes popIn {
            0%   { transform: scale(0.6); opacity: 0; }
            60%  { transform: scale(1.08); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          .animate-pop {
            animation: popIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) both;
          }
        `,
      }}
    />
  )
}

/* ============================================================================
   MAIN COMPONENT
   ============================================================================ */

export default function LoginPage() {
  const router = useRouter()

  const [loginRole, setLoginRole] = useState<Role>('student')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [loginRole])

  function changeRole(role: Role) {
    if (role === loginRole) return
    setLoginRole(role)
    setIdentifier('')
    setPassword('')
    setError(null)
    setSuccess(null)
    setShowPassword(false)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return

    setError(null)
    setSuccess(null)
    setLoading(true)

    const idVal = identifier.trim().toLowerCase()
    const passVal = password.trim().toLowerCase()

    try {
      /* ============================================================
         ADMIN
      ============================================================ */
      if (loginRole === 'admin') {
        if (password === ADMIN_PASSWORD) {
          sessionStorage.setItem(
            ADMIN_SESSION_KEY,
            JSON.stringify({ expiresAt: Date.now() + ADMIN_SESSION_MINUTES * 60 * 1000 })
          )
          setSuccess('Welcome, Administrator. Redirecting...')
          setTimeout(() => router.push('/portal/admin'), 600)
        } else {
          setError('Incorrect admin password. Please try again.')
          setLoading(false)
        }
        return
      }

      /* ============================================================
         TEACHER
      ============================================================ */
      if (loginRole === 'teacher') {
        const { data, error: dbError } = await supabase
          .from('teachers')
          .select('*')
          .ilike('email', idVal)
          .maybeSingle()

        if (dbError || !data) {
          setError('No teacher account found with that email.')
          setLoading(false)
          return
        }

        const stored = (data.password || '').trim().toLowerCase()
        if (stored && stored === passVal) {
          localStorage.setItem('loggedInTeacher', JSON.stringify(data))
          setSuccess('Login successful. Redirecting to your portal...')
          setTimeout(() => router.push('/portal/teacher'), 600)
        } else {
          setError('Incorrect password. Please check and try again.')
          setLoading(false)
        }
        return
      }

      /* ============================================================
         STUDENT
      ============================================================ */
      if (loginRole === 'student') {
        const { data, error: dbError } = await supabase
          .from('students')
          .select('*')
          .ilike('admission_number', idVal)
          .maybeSingle()

        if (dbError || !data) {
          setError('Admission number not found. Please confirm with the school office.')
          setLoading(false)
          return
        }

        const stored = (data.password || '').trim().toLowerCase()
        if (stored && stored === passVal) {
          localStorage.setItem('loggedInStudent', JSON.stringify(data))
          setSuccess('Login successful. Redirecting to your portal...')
          setTimeout(() => router.push('/portal/student'), 600)
        } else {
          setError('Incorrect password. Please check and try again.')
          setLoading(false)
        }
        return
      }
    } catch {
      setError('Something went wrong. Please check your internet connection and try again.')
      setLoading(false)
    }
  }

  const currentRoleMeta = ROLE_OPTIONS.find((r) => r.value === loginRole)!

  return (
    <>
      <GlobalStyles />
      <div className="min-h-screen bg-gradient-to-br from-[#FDFBF7] via-[#FAF3EA] to-[#F5E6D8] flex items-center justify-center p-4 relative overflow-hidden">

        {/* Soft decorative blobs */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-pink-200/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-[#4A2E1B]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md relative">

          {/* Top: logo + school name */}
          <div className="text-center mb-6 animate-fade-slide">
            <div className="relative inline-block">
              <img
                src={SCHOOL.logo}
                alt={SCHOOL.name}
                className="w-20 h-20 rounded-full bg-white p-1 shadow-lg ring-4 ring-white/70 object-contain mx-auto"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-500 ring-4 ring-[#FDFBF7]" />
            </div>
            <h1 className="mt-4 text-2xl font-black text-[#4A2E1B] tracking-tight">
              {SCHOOL.name}
            </h1>
            <p className="text-xs text-[#4A2E1B]/60 italic font-semibold mt-0.5">
              Motto: "{SCHOOL.motto}"
            </p>
          </div>

          {/* Card */}
          <div className="bg-white shadow-2xl rounded-3xl overflow-hidden border border-pink-100">

            {/* Card header bar */}
            <div className="bg-[#4A2E1B] text-white px-6 py-4 flex items-center justify-between border-b-4 border-pink-500">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-pink-300 font-bold">
                  Portal Access
                </p>
                <p className="text-sm font-black mt-0.5">Secure Login</p>
              </div>
              <button
                onClick={() => router.push('/')}
                aria-label="Back to home"
                className="text-xs font-bold text-pink-200 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition"
              >
                ← Home
              </button>
            </div>

            <form onSubmit={handleLogin} className="p-6 sm:p-8 space-y-5">

              {/* Role tabs */}
              <div>
                <p className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
                  Select Portal
                </p>
                <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-2xl">
                  {ROLE_OPTIONS.map((r) => {
                    const active = loginRole === r.value
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => changeRole(r.value)}
                        className={`relative flex flex-col items-center justify-center py-2.5 rounded-xl text-[11px] font-bold transition ${
                          active
                            ? 'bg-white text-[#4A2E1B] shadow-md ring-1 ring-pink-200'
                            : 'text-gray-500 hover:text-[#4A2E1B]'
                        }`}
                      >
                        <span className="text-base mb-0.5">{r.icon}</span>
                        <span>{r.label}</span>
                        {active && (
                          <span className="absolute -bottom-px left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-pink-500" />
                        )}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[10px] text-gray-500 mt-2 text-center italic">
                  {currentRoleMeta.hint}
                </p>
              </div>

              {/* IDENTIFIER */}
              <div className="animate-fade-slide" key={loginRole}>
                <label htmlFor="identifier" className="block text-xs font-bold text-gray-700 mb-1.5">
                  {loginRole === 'student' && 'Admission Number'}
                  {loginRole === 'teacher' && 'Teacher Email'}
                  {loginRole === 'admin' && 'Admin Access'}
                </label>
                {loginRole === 'admin' ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 font-medium flex items-start gap-2">
                    <span className="text-base leading-none">🔒</span>
                    <span>Admin login uses a password only. Skip this field.</span>
                  </div>
                ) : (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      {loginRole === 'student' ? '🎓' : '📧'}
                    </span>
                    <input
                      id="identifier"
                      ref={firstFieldRef}
                      type={loginRole === 'teacher' ? 'email' : 'text'}
                      placeholder={
                        loginRole === 'student'
                          ? 'TTS/2025/001'
                          : 'teacher@thetrustworthyschools.com'
                      }
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                      autoComplete={loginRole === 'teacher' ? 'email' : 'username'}
                      className="w-full border pl-10 pr-3 py-3 rounded-xl text-sm bg-white text-gray-900 font-semibold border-slate-200 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 transition"
                    />
                  </div>
                )}
              </div>

              {/* PASSWORD */}
              <div>
                <label htmlFor="password" className="block text-xs font-bold text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    🔑
                  </span>
                  <input
                    id="password"
                    ref={loginRole === 'admin' ? firstFieldRef : undefined}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full border pl-10 pr-14 py-3 rounded-xl text-sm bg-white text-gray-900 font-semibold border-slate-200 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#4A2E1B] hover:text-pink-600 transition"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* ERROR */}
              {error && (
                <div
                  role="alert"
                  className="animate-fade-slide bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl px-4 py-3 flex items-start gap-2"
                >
                  <span className="text-base leading-none">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* SUCCESS */}
              {success && (
                <div
                  role="status"
                  className="animate-fade-slide bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl px-4 py-3 flex items-start gap-2"
                >
                  <span className="text-base leading-none animate-pop">✅</span>
                  <span>{success}</span>
                </div>
              )}

              {/* SUBMIT */}
              <button
                type="submit"
                disabled={loading || !!success}
                className="w-full bg-[#4A2E1B] hover:bg-[#382213] active:bg-[#2D1B0F] text-white py-3.5 rounded-xl font-black text-sm shadow-lg shadow-[#4A2E1B]/20 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && !success ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Logging in...
                  </>
                ) : (
                  <>
                    {currentRoleMeta.icon} Secure Login
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-gray-500 font-medium">
                Having trouble? Contact the school office.
              </p>
            </form>
          </div>

          {/* Bottom footer */}
          <p className="text-center text-[10px] text-[#4A2E1B]/50 mt-5 font-semibold">
            {SCHOOL.name} · © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </>
  )
}