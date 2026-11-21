/**
 * Email/password sign-in for `@deepspace.test` accounts only. DeepSpace has
 * no public email sign-up, so real users never have a password; this form
 * exists for local development and automated tests. It shows in dev builds,
 * or anywhere with `?test=1`, behind a collapsed toggle.
 *
 * After a successful sign-in the session updates and the page's own effect
 * sends the visitor on to their redirect target.
 */

import { useState, type FormEvent } from 'react'
import { signIn } from 'deepspace'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'

export function TestAccountForm({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await signIn.email({ email, password })
      if (result.error) setError(result.error.message ?? 'Sign-in failed. Check the email and password.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        data-testid="test-account-toggle"
        onClick={() => setOpen(true)}
        className="w-full cursor-pointer rounded-md text-center text-sm font-bold text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-primary/40"
      >
        Sign in with a test account
      </button>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 rounded-xl border border-dashed border-input p-4" data-testid="test-account-form">
      <p className="text-xs text-muted-foreground">
        For <code className="font-mono">@deepspace.test</code> accounts made with{' '}
        <code className="font-mono">npx deepspace test accounts create</code>.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="test-email">Email</Label>
        <Input id="test-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="test-password">Password</Label>
        <Input
          id="test-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-sm font-bold text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" loading={loading} disabled={!email || !password}>
        Sign in
      </Button>
    </form>
  )
}
