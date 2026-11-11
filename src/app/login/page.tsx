'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setDebugInfo(null)

    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }

      // --- DEBUGGING COOKIE CHECK ---
      setDebugInfo('Login API returned 200 OK. Checking cookie...')
      
      // Give the browser 500ms to save the cookie, then test the /api/me/admin route
      setTimeout(async () => {
        const checkRes = await fetch('/api/me/admin')
        const checkData = await checkRes.json()
        
        if (checkRes.ok) {
          setDebugInfo('Success! Cookie is valid. Redirecting...')
          router.push('/portal/admin')
        } else {
          setError(`Cookie Check Failed: ${checkData.error || checkRes.statusText}`)
          setDebugInfo(`Status: ${checkRes.status}. Check Vercel logs for details.`)
          setLoading(false)
        }
      }, 500)

    } catch (err: any) {
      setError(err.message || 'Network error')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Admin Login (Debug Mode)</h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter admin password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Sign In'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {debugInfo && (
          <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-500 text-blue-800 text-sm font-mono">
            {debugInfo}
          </div>
        )}
      </div>
    </div>
  )
}