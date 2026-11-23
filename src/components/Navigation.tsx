/**
 * Top nav — minimal placeholder bar wired to the app's mechanisms:
 * nav.ts-driven links (with role/dev filtering; settings and admin pages go
 * in the account menu), a sign-in link to /sign-in, and sign-out. Restyle or rebuild it freely; keep the data-testid hooks
 * (`app-navigation`, `nav-sign-in-button`, `nav-user-name`, `nav-user-email`)
 * — the shipped tests rely on them. `nav-user-email` is the one that carries
 * an identity the test can check exactly: a display name is optional, the
 * email is the credential the session was opened with.
 */

import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthProfileReady, signOut } from 'deepspace'
import {
  ChevronDown,
  History,
  House,
  ListChecks,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Trophy,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Logo } from './landing/bits'
import type { Role } from '../constants'
import { nav } from '../nav'
import { cn } from '../lib/utils'
import { signInPath } from '../lib/auth-redirect'
import { ColorModeToggle } from './ColorModeToggle'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui'

/** Icons for account-menu links, by path. */
const ACCOUNT_ICONS: Record<string, LucideIcon> = {
  '/settings': Settings,
  '/admin': ShieldCheck,
}

/** Icons for the phone menu's rows, by path. The desktop bar stays text-only (see the baseline note below). */
const MAIN_ICONS: Record<string, LucideIcon> = {
  '/home': House,
  '/quizzes': ListChecks,
  '/spaces': UsersRound,
  '/history': History,
  '/leaderboard': Trophy,
}

export default function Navigation() {
  const { isLoaded, isSignedIn, user, userLoading } = useAuthProfileReady({ requireUser: true })
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const profileReady = !isSignedIn || (!userLoading && !!user)
  const userRole = (user?.role ?? 'anonymous') as Role | 'anonymous'

  // Close the mobile menu when navigating
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const visibleNav = nav.filter((item) => {
    if (item.devOnly && !import.meta.env.DEV) return false
    if (!item.roles) return true
    if (!profileReady) return false
    if (userRole === 'admin') return true
    return item.roles.includes(userRole as Role)
  })

  // Everyday pages sit in the top bar; settings and admin pages in the account menu.
  const mainNav = visibleNav.filter((item) => item.placement !== 'account')
  const accountNav = visibleNav.filter((item) => item.placement === 'account')

  const isActive = (item: (typeof nav)[number]) => location.pathname.startsWith(item.path)

  // Desktop: text pills. They stay inline (not flex) so their words keep the
  // shared text baseline with the logo; the current section is tinted.
  const navLink = (item: (typeof nav)[number]) => {
    const active = isActive(item)
    return (
      <Link
        key={item.path}
        to={item.path}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'rounded-full px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
          // Same weight either way: bolder text is wider and would nudge the links
          // along. Hover is neutral grey, so it never looks like a second current page.
          active ? 'bg-primary/10 text-primary-text' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        {item.label}
      </Link>
    )
  }

  // Phones: full-width rows with an icon, big enough to tap.
  const mobileLink = (item: (typeof nav)[number]) => {
    const active = isActive(item)
    const Icon = MAIN_ICONS[item.path]
    return (
      <Link
        key={item.path}
        to={item.path}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
          active ? 'bg-primary/10 text-primary-text' : 'text-foreground hover:bg-muted',
        )}
      >
        {Icon && <Icon className={cn('size-4', active ? 'text-primary-text' : 'text-muted-foreground')} aria-hidden="true" />}
        {item.label}
      </Link>
    )
  }

  return (
    <>
      <nav data-testid="app-navigation" className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          {/* Brand and links share a text baseline (as on the landing header):
              the display and body fonts sit at different heights in their
              line boxes, so centring the boxes leaves the words out of line. */}
          <div className="flex items-baseline gap-4">
            <Link
              to="/home"
              aria-label="StudyArena home"
              className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40"
            >
              <Logo />
            </Link>

            <div className="hidden items-baseline gap-0.5 md:flex">{mainNav.map(navLink)}</div>
          </div>

          <div className="flex-1" />

          <ColorModeToggle />

          {!isLoaded ? null : isSignedIn && !profileReady ? (
            /* Signed in, profile still loading — skeleton pill, never the
               Sign in button (that would offer sign-in to a signed-in user). */
            <div className="flex items-center gap-2 rounded-full border border-border bg-card/60 py-1 pl-1 pr-2.5">
              <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
              <div className="hidden h-4 w-20 animate-pulse rounded-md bg-muted sm:block" />
            </div>
          ) : isSignedIn && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    aria-label="Account menu"
                    className="group flex items-center gap-2 rounded-full border border-border bg-card/60 py-1 pl-1 pr-2.5 text-sm transition-colors hover:bg-card"
                  >
                    <Avatar className="h-6 w-6 ring-1 ring-inset ring-border">
                      <AvatarImage src={user.imageUrl ?? undefined} referrerPolicy="no-referrer" />
                      <AvatarFallback className="text-[11px]">
                        {(user.name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      data-testid="nav-user-name"
                      className="hidden max-w-[140px] truncate text-foreground sm:inline"
                    >
                      {user.name || user.email}
                    </span>
                    <ChevronDown
                      className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 group-data-[popup-open]:rotate-180"
                      aria-hidden
                    />
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="truncate font-medium text-foreground">
                    {user.name || 'Signed in'}
                  </div>
                  <div
                    data-testid="nav-user-email"
                    className="truncate text-xs font-normal text-muted-foreground"
                  >
                    {user.email}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {accountNav.length > 0 && (
                  <>
                    {accountNav.map((item) => {
                      const Icon = ACCOUNT_ICONS[item.path] ?? Settings
                      return (
                        <DropdownMenuItem
                          key={item.path}
                          data-testid={`nav-account-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                          render={<Link to={item.path} />}
                        >
                          <Icon aria-hidden />
                          {item.label}
                        </DropdownMenuItem>
                      )
                    })}
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut aria-hidden />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              data-testid="nav-sign-in-button"
              to={signInPath(location.pathname + location.search)}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Sign in
            </Link>
          )}

          <button
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav"
          >
            {mobileMenuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div
            id="mobile-nav"
            data-testid="mobile-nav"
            className="flex animate-in flex-col gap-0.5 border-t border-border px-2 py-2 fade-in-0 slide-in-from-top-2 md:hidden"
          >
            {mainNav.map(mobileLink)}
          </div>
        )}
      </nav>
    </>
  )
}
