/**
 * Settings → Password, for accounts that sign in with email and password.
 * Google and GitHub accounts have no StudyArena password; they get a note
 * instead. Uses Better Auth's changePassword through the app's /api/auth
 * proxy, optionally signing out every other device.
 */

import { useState, type FormEvent } from 'react'
import { authClient } from 'deepspace'
import { Button, Checkbox, Input, Label, useToast } from '@/components/ui'
import { SettingsCard, PROVIDER_LABEL, authError } from './settings-ui'

const MIN_LENGTH = 8

export function PasswordCard({ providers }: { providers: string[] | null }) {
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [signOutOthers, setSignOutOthers] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (providers === null) return null
  if (!providers.includes('credential')) {
    const via = providers.map((p) => PROVIDER_LABEL[p] ?? p).join(' or ')
    return (
      <SettingsCard id="password" title="Password">
        <p className="text-sm text-muted-foreground">
          You sign in with {via || 'another provider'}, so there’s no StudyArena password to change. Your
          password and two-step sign-in are managed there.
        </p>
      </SettingsCard>
    )
  }

  const mismatch = confirm.length > 0 && next !== confirm
  const tooShort = next.length > 0 && next.length < MIN_LENGTH
  const ready = current.length > 0 && next.length >= MIN_LENGTH && next === confirm

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: signOutOthers })
    const err = authError(res)
    setSaving(false)
    if (err) return setError(err)
    setCurrent('')
    setNext('')
    setConfirm('')
    toast.success(signOutOthers ? 'Password changed; other devices are signed out' : 'Password changed')
  }

  return (
    <SettingsCard id="password" title="Password" description="Used with your email to sign in.">
      <form onSubmit={save} className="max-w-sm space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pw-current">Current password</Label>
          <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-new">New password</Label>
          <Input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            aria-invalid={tooShort}
            aria-describedby="pw-new-hint"
          />
          <p id="pw-new-hint" className={tooShort ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
            At least {MIN_LENGTH} characters.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-confirm">Confirm new password</Label>
          <Input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch}
          />
          {mismatch && <p className="text-xs text-destructive">The passwords don’t match.</p>}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={signOutOthers} onCheckedChange={setSignOutOthers} />
          Sign out my other devices
        </label>
        {error && (
          <p role="alert" data-testid="password-error" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={!ready} loading={saving}>
          Change password
        </Button>
      </form>
    </SettingsCard>
  )
}
