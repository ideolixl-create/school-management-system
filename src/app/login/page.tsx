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

type Role = 'student' | 'teacher' | 'admin'

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'admin', label: 'Admin' },
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
         Uses a session-based password (not Supabase).
         The admin dashboard reads tts.admin.session to unlock.
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
         Looks up by email in the teachers table.
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
         Looks up by admission_number in the students table.
         Password must match the students.password column.
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

  return (
    <>
      <GlobalStyles />
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white shadow-2xl rounded-2xl overflow-hidden border border-pink-200">

          {/* HEADER */}
          <div className="bg-[#4A2E1B] text-white p-6 text-center border-b-4 border-pink-500 relative">
            <button
              onClick={() => router.push('/')}
              aria-label="Back to home"
              className="absolute left-4 top-4 bg-[#331E12] text-pink-300 px-3 py-1.5 rounded text-xs font-bold hover:bg-[#2D1B0F] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
            >
              ← Home
            </button>
            <h1 className="text-xl font-extrabold mt-2">Portal Secure Login</h1>
            <p className="text-xs text-pink-300 mt-1 tracking-widest font-semibold">
              THE TRUSTWORTHY SCHOOLS
            </p>
          </div>

          {/* FORM */}
          <form onSubmit={handleLogin} className="p-6 md:p-8 space-y-5">

            {/* ROLE SELECTOR */}
            <div>
              <label htmlFor="role" className="block text-sm font-bold text-gray-700 mb-1">
                Select Portal
              </label>
              <div className="relative">
                <select
                  id="role"
                  value={loginRole}
                  onChange={(e) => changeRole(e.target.value as Role)}
                  className="w-full appearance-none border p-3 pr-10 rounded-lg text-sm bg-white text-gray-900 font-semibold border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-400 cursor-pointer"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#4A2E1B] text-xs">
                  ▾
                </span>
              </div>
            </div>

            {/* STUDENT: Admission Number */}
            {loginRole === 'student' && (
              <div>
                <label htmlFor="identifier" className="block text-sm font-bold text-gray-700 mb-1">
                  Admission Number
                </label>
                <input
                  id="identifier"
                  ref={firstFieldRef}
                  type="text"
                  placeholder="e.g. TTS/2025/001"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full border p-3 rounded-lg text-sm bg-white text-gray-900 font-semibold border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
              </div>
            )}

            {/* TEACHER: Email */}
            {loginRole === 'teacher' && (
              <div>
                <label htmlFor="identifier" className="block text-sm font-bold text-gray-700 mb-1">
                  Teacher Email Address
                </label>
                <input
                  id="identifier"
                  ref={firstFieldRef}
                  type="email"
                  placeholder="owodunnimalik@gmail.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full border p-3 rounded-lg text-sm bg-white text-gray-900 font-semibold border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
              </div>
            )}

            {/* PASSWORD */}
            <div>
              <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  ref={loginRole === 'admin' ? firstFieldRef : undefined}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full border p-3 pr-12 rounded-lg text-sm bg-white text-gray-900 border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#4A2E1B] hover:text-pink-600 focus-visible:outline-none"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* ERROR */}
            {error && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {/* SUCCESS */}
            {success && (
              <div role="status" className="bg-green-50 border border-green-200 text-green-700 text-sm font-semibold rounded-lg px-4 py-3">
                {success}
              </div>
            )}

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={loading || !!success}
              className="w-full bg-[#4A2E1B] text-white py-3 rounded-lg font-extrabold text-sm shadow-lg hover:bg-[#382213] transition disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 flex items-center justify-center gap-2"
            >
              {loading && !success ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Logging in...
                </>
              ) : (
                'Secure Login'
              )}
            </button>

            <p className="text-xs text-center text-gray-500 font-medium pt-1">
              Having trouble logging in? Contact the school office.
            </p>
          </form>
        </div>
      </div>
    </>
  )
}