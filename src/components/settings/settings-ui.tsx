/** Shared pieces for the settings sections (src/pages/(app)/(protected)/settings/). */

import type { ReactNode } from 'react'

export function SettingsCard({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} data-testid={`settings-${id}`} className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-4">
        <h2 id={`${id}-title`} className="font-display text-lg font-bold">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  )
}

/** Better Auth's account kinds, as people know them. */
export const PROVIDER_LABEL: Record<string, string> = {
  credential: 'Email and password',
  google: 'Google',
  github: 'GitHub',
}

/** Better Auth returns `{ data, error }`; this reads the error's message, if any. */
export function authError(res: { error?: { message?: string; code?: string } | null }): string | null {
  if (!res.error) return null
  if (res.error.code === 'INVALID_PASSWORD') return 'That current password isn’t right.'
  return res.error.message || 'Something went wrong. Try again.'
}
