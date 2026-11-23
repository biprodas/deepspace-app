/**
 * Settings → Devices: where you're signed in (Better Auth sessions), with
 * "Sign out of other devices". This device is marked and never listed as
 * one to sign out.
 */

import { useCallback, useEffect, useState } from 'react'
import { authClient } from 'deepspace'
import { Laptop, Smartphone } from 'lucide-react'
import { Button, ConfirmModal, useToast } from '@/components/ui'
import { SettingsCard, authError } from './settings-ui'

interface Session {
  id: string
  token: string
  createdAt: string | Date
  updatedAt: string | Date
  userAgent?: string | null
}

/** "Chrome on Windows"-style label from a user-agent string. */
export function deviceLabel(ua?: string | null): { label: string; mobile: boolean } {
  if (!ua) return { label: 'Unknown device', mobile: false }
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : ''
  return { label: os ? `${browser} on ${os}` : browser, mobile: /Mobi|iPhone|Android/.test(ua) }
}

/** Devices listed before "Show all". */
const SHOWN = 5

export function SessionsCard() {
  const toast = useToast()
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [currentToken, setCurrentToken] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    const [list, current] = await Promise.all([authClient.listSessions(), authClient.getSession()])
    setSessions((list.data as Session[] | null) ?? [])
    setCurrentToken(current.data?.session.token ?? null)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const others = (sessions ?? []).filter((s) => s.token !== currentToken)
  // This device first, then the most recently active.
  const sorted = [...(sessions ?? [])].sort(
    (a, b) =>
      Number(b.token === currentToken) - Number(a.token === currentToken) ||
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
  const shown = showAll ? sorted : sorted.slice(0, SHOWN)

  return (
    <SettingsCard id="devices" title="Devices" description="Browsers and devices where you’re signed in.">
      {sessions === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <ul data-testid="sessions-list" className="divide-y divide-border rounded-lg border border-border">
            {shown.map((s) => {
              const { label, mobile } = deviceLabel(s.userAgent)
              const Icon = mobile ? Smartphone : Laptop
              const isCurrent = s.token === currentToken
              return (
                <li key={s.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">
                      Signed in {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                  {isCurrent && (
                    <span className="rounded-full bg-correct/15 px-2 py-0.5 text-[11px] font-semibold">This device</span>
                  )}
                </li>
              )
            })}
          </ul>
          {sorted.length > SHOWN && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 text-sm font-medium text-primary-text hover:underline"
            >
              {showAll ? 'Show fewer' : `Show all ${sorted.length}`}
            </button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={others.length === 0}
            onClick={() => setConfirming(true)}
            data-testid="sign-out-others"
          >
            Sign out of other devices{others.length > 0 ? ` (${others.length})` : ''}
          </Button>
        </>
      )}

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Sign out of other devices?"
        description="Every other browser and device will need to sign in again. You stay signed in here."
        confirmText="Sign them out"
        loading={signingOut}
        onConfirm={async () => {
          setSigningOut(true)
          const err = authError(await authClient.revokeOtherSessions())
          setSigningOut(false)
          setConfirming(false)
          if (err) toast.error(err)
          else toast.success('Other devices are signed out')
          await load()
        }}
      />
    </SettingsCard>
  )
}
