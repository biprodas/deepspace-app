/**
 * Where to send someone after they sign in.
 *
 * The target arrives as `?redirect=` on /sign-in and /sign-up (set by the
 * protected layout and the nav button). Google/GitHub sign-in leaves the app
 * for the platform's auth worker, and the app's `/api/auth/social-redirect`
 * always returns to the site root, dropping any path or query. So before
 * that hop the target is saved in sessionStorage; the landing page picks it
 * up (`consumePendingReturn`) and forwards to /sign-in, which sends the
 * now-signed-in visitor on to the target.
 *
 * Only same-origin paths are honoured: anything else (another host, a
 * protocol-relative `//host`, a backslash trick, or an auth page itself)
 * falls back to the default, so the parameter can't be used as an open
 * redirect.
 */

export const DEFAULT_AFTER_AUTH = '/home'

const STORAGE_KEY = 'studyarena:post-auth-redirect'
/** A saved target older than this is ignored (an abandoned sign-in). */
const PENDING_TTL_MS = 15 * 60 * 1000
const AUTH_PATHS = ['/sign-in', '/sign-up']
const PROBE_ORIGIN = 'https://studyarena.invalid'

export function safeRedirect(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return DEFAULT_AFTER_AUTH
  }
  // Resolve against a dummy origin: if the result leaves it, reject.
  let url: URL
  try {
    url = new URL(value, PROBE_ORIGIN)
  } catch {
    return DEFAULT_AFTER_AUTH
  }
  if (url.origin !== PROBE_ORIGIN) return DEFAULT_AFTER_AUTH
  if (AUTH_PATHS.includes(url.pathname)) return DEFAULT_AFTER_AUTH
  return url.pathname + url.search + url.hash
}

/** `/sign-in?redirect=…` for the given path (no param when it's the default). */
export function signInPath(from?: string | null, page: '/sign-in' | '/sign-up' = '/sign-in'): string {
  const target = safeRedirect(from)
  return target === DEFAULT_AFTER_AUTH ? page : `${page}?redirect=${encodeURIComponent(target)}`
}

/** Save the target just before leaving for the OAuth provider. */
export function rememberRedirect(target: string | null | undefined) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ to: safeRedirect(target), at: Date.now() }))
  } catch {
    // Storage blocked: the visitor lands on the home page after sign-in instead.
  }
}

/**
 * A saved target from a sign-in that just returned, or null. Removes it
 * either way, so an abandoned sign-in can't bounce a later visit.
 */
export function consumePendingReturn(now = Date.now()): string | null {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const { to, at } = JSON.parse(raw) as { to?: unknown; at?: unknown }
    if (typeof to !== 'string' || typeof at !== 'number' || now - at > PENDING_TTL_MS || now < at) return null
    return safeRedirect(to)
  } catch {
    return null
  }
}
