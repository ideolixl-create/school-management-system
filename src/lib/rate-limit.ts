/* ============================================================================
   THE TRUSTWORTHY SCHOOLS — IN-MEMORY RATE LIMITER
   ============================================================================ */

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, retryAfterSeconds: 0 }
  }
  if (b.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((b.resetAt - now) / 1000) }
  }
  b.count += 1
  return { allowed: true, retryAfterSeconds: 0 }
}

export function clearRateLimit(key: string): void {
  buckets.delete(key)
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}
