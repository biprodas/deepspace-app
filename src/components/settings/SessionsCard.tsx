/**
 * Settings → Devices: where you're signed in (Better Auth sessions), with
 * "Sign out of other devices". This device is marked and never listed as
 * one to sign out.
 *
 * Listing and signing out devices need a recent sign-in: after about a day
 * the auth service refuses them ("session not fresh"). Then the card says so
 * and offers "Sign in again", which comes back here, instead of showing an
 * empty list.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authClient, signOut } from 'deepspace'
import { Laptop, LockKeyhole, Smartphone } from 'lucide-react'
import { signInPath } from '@/lib/auth-redirect'
import { Button, ConfirmModal, useToast } from '@/components/ui'
import { SettingsCard, authError, isNotFresh } from './settings-ui'

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
  /** The auth service wants a recent sign-in before showing or changing devices. */
  const [needsSignIn, setNeedsSignIn] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reauthing, setReauthing] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    const [list, current] = await Promise.all([authClient.listSessions(), authClient.getSession()])
    setCurrentToken(current.data?.session.token ?? null)
    if (isNotFresh(list)) {
      setNeedsSignIn(true)
      return
    }
    setNeedsSignIn(false)
    setLoadError(list.error ? authError(list) : null)
    setSessions((list.data as Session[] | null) ?? [])
  }, [])

  /** Signs out here and goes to sign-in, which brings you back to Devices. */
  async function signInAgain() {
    setReauthing(true)
    await signOut()
    navigate(signInPath('/settings/devices'), { replace: true })
  }

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
      {needsSignIn ? (
        <div data-testid="sessions-reauth" className="rounded-lg border border-border bg-muted/40 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <LockKeyhole className="size-4 text-muted-foreground" aria-hidden="true" /> Sign in again to see your devices
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            For your security, seeing and signing out devices needs a recent sign-in. You’ll come straight back here.
          </p>
          <Button size="sm" className="mt-3" loading={reauthing} onClick={() => void signInAgain()}>
            Sign in again
          </Button>
        </div>
      ) : sessions === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : loadError ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <p role="alert" className="text-destructive">
            Couldn’t load your devices: {loadError}
          </p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
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
          const res = await authClient.revokeOtherSessions()
          setSigningOut(false)
          setConfirming(false)
          if (isNotFresh(res)) return setNeedsSignIn(true)
          const err = authError(res)
          if (err) toast.error(err)
          else toast.success('Other devices are signed out')
          await load()
        }}
      />
    </SettingsCard>
  )
}
