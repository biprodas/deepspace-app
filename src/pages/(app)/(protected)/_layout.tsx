/**
 * Gated routes. Any file under src/pages/(app)/(protected)/ requires sign-in.
 * The `(protected)` folder is a Generouted route group — parentheses mean
 * it doesn't appear in the URL. For a dynamic page that does NOT require
 * sign-in, put it directly under src/pages/(app)/; for a static page, put it
 * at the top level of src/pages/.
 *
 * Children may call data hooks like `useUser()` safely because the parent
 * (app)/_layout.tsx mounts <RecordProvider> above this layout.
 *
 * Signed-out visitors go to /sign-in with the page they wanted as
 * `?redirect=`, so after Google/GitHub they come straight back (for example
 * to /join/K7QX9P). `fallback` only covers first visits; signing out
 * mid-session follows AuthGate's `redirectOnSignOut` instead.
 *
 * The gate is client-side only: the worker's routes do their own checks.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AuthGate } from 'deepspace'
import { signInPath } from '@/lib/auth-redirect'

export default function ProtectedLayout() {
  const { pathname, search, hash } = useLocation()

  return (
    <AuthGate fallback={<Navigate to={signInPath(pathname + search + hash)} replace />}>
      <Outlet />
    </AuthGate>
  )
}
