/**
 * Settings → Preferences. Theme and showing reactions are per device
 * (localStorage); invite emails are synced and enforced by the server, which
 * skips the email for people who turned it off (src/actions/invite.ts).
 */

import { useEffect, useState } from 'react'
import { useQuery, useUser } from 'deepspace'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Switch, cn, useToast } from '@/components/ui'
import { colorModeChoice, followSystemColorMode, setColorMode, type ColorModeChoice } from '@/lib/color-mode'
import { useDevicePref } from '@/lib/device-prefs'
import { useAction } from '@/lib/use-action'
import { DEFAULT_PREFS, type UserPrefs } from '@/schemas/pref-schemas'
import { SettingsCard } from './settings-ui'

const THEMES: { id: ColorModeChoice; label: string; icon: typeof Sun }[] = [
  { id: 'system', label: 'System', icon: Monitor },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
]

export function PreferencesCard() {
  const { user } = useUser()
  const toast = useToast()
  const { run } = useAction()
  const [theme, setTheme] = useState<ColorModeChoice>('system')
  const [showReactions, setShowReactions] = useDevicePref('showReactions')
  const prefs = useQuery<UserPrefs>('user_prefs', { where: { userId: user?.id ?? '' }, limit: 1 })
  const saved = prefs.records[0]?.data
  const inviteEmails = saved ? Boolean(saved.inviteEmails) : DEFAULT_PREFS.inviteEmails
  const [optimistic, setOptimistic] = useState<boolean | null>(null)

  // The theme lives in localStorage; read it after mount (prerendered pages can't).
  useEffect(() => setTheme(colorModeChoice()), [])

  function chooseTheme(choice: ColorModeChoice) {
    setTheme(choice)
    if (choice === 'system') followSystemColorMode()
    else setColorMode(choice)
  }

  async function setInviteEmails(on: boolean) {
    setOptimistic(on)
    const res = await run('updatePreferences', { inviteEmails: on })
    setOptimistic(null)
    if (res.success) toast.success(on ? 'Invite emails on' : 'Invite emails off')
  }

  return (
    <SettingsCard id="preferences" title="Preferences">
      <div className="space-y-6">
        <div>
          <p id="theme-label" className="text-sm font-medium">
            Theme
          </p>
          <p className="text-xs text-muted-foreground">On this device. System follows your device’s light or dark setting.</p>
          <div role="radiogroup" aria-labelledby="theme-label" className="mt-2 inline-flex rounded-lg border border-border p-1">
            {THEMES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={theme === id}
                data-testid={`theme-${id}`}
                onClick={() => chooseTheme(id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                  theme === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <PrefRow
          id="pref-reactions"
          title="Show emoji reactions in games"
          detail="Other players’ reactions float up over the screen. On this device."
          checked={showReactions}
          onChange={setShowReactions}
        />
        <PrefRow
          id="pref-invite-emails"
          title="Email me when someone invites me"
          detail="To a game or a study space. You’ll still see invites on Home. Applies everywhere you sign in."
          checked={optimistic ?? inviteEmails}
          onChange={(on) => void setInviteEmails(on)}
        />
      </div>
    </SettingsCard>
  )
}

function PrefRow({
  id,
  title,
  detail,
  checked,
  onChange,
}: {
  id: string
  title: string
  detail: string
  checked: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </label>
      <Switch id={id} data-testid={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
