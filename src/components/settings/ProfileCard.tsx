/**
 * Settings → Profile: the name people see, and how you sign in. The name is
 * the DeepSpace account's (shared sign-in), so it changes in every DeepSpace
 * app; after saving, the cached sign-in token is dropped so StudyArena picks
 * the new name up straight away. Email isn't editable: real accounts take it
 * from Google or GitHub.
 */

import { useState, type FormEvent } from 'react'
import { authClient, clearAuthToken, useUser } from 'deepspace'
import { Avatar, AvatarFallback, AvatarImage, Button, Input, Label, useToast } from '@/components/ui'
import { SettingsCard, PROVIDER_LABEL, authError } from './settings-ui'

const NAME_MAX = 60

export function ProfileCard({ providers }: { providers: string[] | null }) {
  const { user, refetch } = useUser()
  const toast = useToast()
  const [name, setName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const value = name ?? user?.name ?? ''
  const changed = value.trim() !== (user?.name ?? '') && value.trim().length > 0

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await authClient.updateUser({ name: value.trim() })
    const err = authError(res)
    if (err) {
      setError(err)
    } else {
      // The app reads the name from the sign-in token; drop the cached one.
      clearAuthToken()
      await refetch()
      setName(null)
      toast.success('Name updated')
    }
    setSaving(false)
  }

  const signIn =
    providers === null ? 'Checking…' : providers.length === 0 ? 'Unknown' : providers.map((p) => PROVIDER_LABEL[p] ?? p).join(', ')

  return (
    <SettingsCard id="profile" title="Profile" description="How you appear to other players and in study spaces.">
      <form onSubmit={save} className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarImage src={user?.imageUrl ?? undefined} referrerPolicy="no-referrer" />
            <AvatarFallback className="text-lg">{(user?.name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}</AvatarFallback>
          </Avatar>
          <p className="text-xs text-muted-foreground">
            Your photo comes from the account you sign in with
            {providers?.some((p) => p === 'google' || p === 'github') ? ' (change it there)' : ''}.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-name">Name</Label>
          <div className="flex gap-2">
            <Input
              id="profile-name"
              value={value}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!error}
              autoComplete="name"
            />
            <Button type="submit" disabled={!changed} loading={saving} data-testid="profile-save">
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            This is your DeepSpace account name, so it changes in other DeepSpace apps too. Games you’ve already
            joined keep the name you had then.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd data-testid="profile-email" className="mt-0.5 break-all font-medium">
              {user?.email ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Signs in with</dt>
            <dd data-testid="profile-signin" className="mt-0.5 font-medium">
              {signIn}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Your email comes from how you sign in, so it can’t be changed here.
        </p>
      </form>
    </SettingsCard>
  )
}
