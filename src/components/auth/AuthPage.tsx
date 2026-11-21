/**
 * Shared body of /sign-in and /sign-up. Both use the same Google/GitHub
 * buttons (a first sign-in creates the account); they differ in copy.
 *
 * Once the session reports signed in, whether the visitor just came back
 * from the provider or was already signed in, it sends them to the safe
 * `?redirect=` target.
 */

import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStatus } from 'deepspace'
import { AlertCircle, Check } from 'lucide-react'
import { parseJoinCode } from '@/lib/join-code'
import { safeRedirect, signInPath } from '@/lib/auth-redirect'
import { AuthShell } from './AuthShell'
import { OAuthButtons } from './OAuthButtons'
import { TestAccountForm } from './TestAccountForm'

type Mode = 'sign-in' | 'sign-up'

const COPY = {
  'sign-in': {
    title: 'Welcome back',
    subtitle: 'Sign in to create quizzes, join live games and see your recaps.',
    pageTitle: 'Sign in',
  },
  'sign-up': {
    title: 'Create your account',
    subtitle: 'Use Google or GitHub. No new password to remember.',
    pageTitle: 'Create your account',
  },
} as const

const BENEFITS = ['Turn any topic or your notes into a sourced quiz', 'Host or join live games with a 6-character code', 'Get a recap of what you missed, with sources']

export function AuthPage({ mode }: { mode: Mode }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { isLoaded, isSignedIn } = useAuthStatus()
  const redirectParam = params.get('redirect')
  const target = safeRedirect(redirectParam)
  const failed = params.has('error')
  const showTestForm = import.meta.env.DEV || params.get('test') === '1'
  const joinCode = target.startsWith('/join/') ? parseJoinCode(target) : null
  const copy = COPY[mode]

  useEffect(() => {
    if (isLoaded && isSignedIn) navigate(target, { replace: true })
  }, [isLoaded, isSignedIn, navigate, target])

  const footer =
    mode === 'sign-in' ? (
      <>
        New to StudyArena?{' '}
        <Link to={signInPath(redirectParam, '/sign-up')} className="font-bold text-primary-text underline-offset-4 hover:underline">
          Create an account
        </Link>
      </>
    ) : (
      <>
        Already have an account?{' '}
        <Link to={signInPath(redirectParam)} className="font-bold text-primary-text underline-offset-4 hover:underline">
          Sign in
        </Link>
      </>
    )

  return (
    <>
      <title>{`${copy.pageTitle} · StudyArena`}</title>
      <meta name="robots" content="noindex" />
      <AuthShell title={copy.title} subtitle={copy.subtitle} footer={footer}>
        {isLoaded && isSignedIn ? (
          <p className="flex items-center gap-3 text-muted-foreground" role="status">
            <span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Signing you in…
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {joinCode && (
              <p className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm">
                <span className="text-muted-foreground">Sign in to join game</span>
                <span className="font-mono font-bold tracking-[0.15em]">{joinCode}</span>
              </p>
            )}

            {failed && (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm font-bold text-destructive">
                <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                Sign-in was cancelled or didn’t finish. Please try again.
              </p>
            )}

            {mode === 'sign-up' && (
              <ul className="flex flex-col gap-2.5">
                {BENEFITS.map((b) => (
                  <li key={b} className="flex items-start gap-2.5">
                    <span aria-hidden="true" className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-correct/20 text-correct-text">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            )}

            <OAuthButtons redirect={target} />

            <p className="text-center text-xs text-muted-foreground">
              {mode === 'sign-up'
                ? 'Your StudyArena account is created the first time you continue.'
                : 'Signing in for the first time creates your account.'}
            </p>

            {showTestForm && <TestAccountForm defaultOpen={params.get('test') === '1'} />}
          </div>
        )}
      </AuthShell>
    </>
  )
}
