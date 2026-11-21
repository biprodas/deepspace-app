/**
 * "Continue with Google / GitHub", the sign-in methods DeepSpace offers real
 * users. A first sign-in also creates the account, so sign-in and sign-up
 * use the same buttons.
 *
 * Uses the same entry point as the SDK's AuthOverlay
 * (`/api/auth/social-redirect`). That route always returns to the site
 * root, so the return target is saved first (see src/lib/auth-redirect.ts).
 */

import { useState } from 'react'
import { rememberRedirect } from '@/lib/auth-redirect'
import { cn } from '@/lib/utils'

type Provider = 'google' | 'github'

const PROVIDERS: { id: Provider; label: string; Icon: () => React.ReactElement }[] = [
  { id: 'google', label: 'Google', Icon: GoogleIcon },
  { id: 'github', label: 'GitHub', Icon: GitHubIcon },
]

export function OAuthButtons({ redirect }: { redirect: string }) {
  const [pending, setPending] = useState<Provider | null>(null)

  function start(provider: Provider) {
    setPending(provider)
    rememberRedirect(redirect)
    window.location.href = `/api/auth/social-redirect?provider=${provider}`
  }

  return (
    <div className="flex flex-col gap-3">
      {PROVIDERS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          data-testid={`oauth-${id}`}
          onClick={() => start(id)}
          disabled={pending !== null}
          aria-busy={pending === id || undefined}
          className={cn(
            'inline-flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-input bg-card px-4 text-base font-bold text-card-foreground shadow-[0_1px_2px_rgba(20,20,43,0.05)] outline-none transition-[border-color,transform] hover:-translate-y-0.5 hover:border-foreground/30 focus-visible:ring-[3px] focus-visible:ring-primary/40 disabled:cursor-default disabled:opacity-60 disabled:hover:translate-y-0',
          )}
        >
          {pending === id ? (
            <span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Icon />
          )}
          {pending === id ? `Opening ${label}…` : `Continue with ${label}`}
        </button>
      ))}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.31v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-current">
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49l-.01-1.7c-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.66.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.64 1.03 2.76 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9l-.01 2.81c0 .27.18.59.69.49A10.27 10.27 0 0 0 22 12.26C22 6.58 17.52 2 12 2z" />
    </svg>
  )
}
