/**
 * Settings: /settings/* (docs/features.md F18). A section menu (a sidebar,
 * or a scrollable row of tabs on phones) beside one section at a time:
 * Profile (/settings), Password, Devices and Preferences, each with its own
 * URL so links and Back work. Account changes go to the platform's auth
 * worker through the app's /api/auth proxy (Better Auth's client).
 *
 * The layout loads how the account signs in once and hands it to the
 * sections that need it (Profile, Password) through the outlet context.
 */

import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { authClient, signOut } from 'deepspace'
import { KeyRound, LogOut, MonitorSmartphone, SlidersHorizontal, UserRound, type LucideIcon } from 'lucide-react'
import { Button, cn } from '@/components/ui'
import type { SettingsContext } from '@/lib/settings-context'

interface Section {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const SECTIONS: Section[] = [
  { to: '/settings', label: 'Profile', icon: UserRound, end: true },
  { to: '/settings/password', label: 'Password', icon: KeyRound },
  { to: '/settings/devices', label: 'Devices', icon: MonitorSmartphone },
  { to: '/settings/preferences', label: 'Preferences', icon: SlidersHorizontal },
]

export default function SettingsLayout() {
  const [providers, setProviders] = useState<string[] | null>(null)
  const navRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  // Phones: keep the open section's tab in view in the scrolling tab row.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [pathname])

  useEffect(() => {
    void authClient.listAccounts().then((res) => {
      const list = (res.data as { providerId: string }[] | null) ?? []
      setProviders([...new Set(list.map((a) => a.providerId))])
    })
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6">
      <header className="mb-6 md:mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your profile, sign-in and how StudyArena behaves for you.</p>
      </header>

      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        <aside className="md:w-48 md:shrink-0">
          <nav
            aria-label="Settings sections"
            ref={navRef}
            data-testid="settings-nav"
            className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:sticky md:top-6 md:mx-0 md:flex-col md:overflow-visible md:px-0"
          >
            {SECTIONS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-primary/10 text-primary-text' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
            <Button
              variant="ghost"
              className="hidden justify-start gap-2.5 px-3 text-muted-foreground md:mt-4 md:flex"
              onClick={() => void signOut()}
            >
              <LogOut /> Sign out
            </Button>
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet context={{ providers } satisfies SettingsContext} />
          {/* Phones: Sign out sits under the section, since the tab row has no room. */}
          <Button variant="outline" className="mt-6 md:hidden" onClick={() => void signOut()}>
            <LogOut /> Sign out
          </Button>
        </main>
      </div>
    </div>
  )
}
