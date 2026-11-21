/**
 * Auth pages (/sign-in, /sign-up). `(auth)` is a route group, so it doesn't
 * appear in the URL.
 *
 * Mounts only the auth session provider: no records WebSocket and no app
 * navigation, since these pages just need to know whether someone is signed
 * in. DeepSpace sign-in is Google/GitHub through the platform's auth worker;
 * see src/components/auth/ and src/lib/auth-redirect.ts.
 */

import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { DeepSpaceAuthProvider } from 'deepspace'

export default function AuthLayout() {
  return (
    <DeepSpaceAuthProvider>
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <Outlet />
      </Suspense>
    </DeepSpaceAuthProvider>
  )
}
