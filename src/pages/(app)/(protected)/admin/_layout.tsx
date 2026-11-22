/**
 * Admin console: /admin/* (docs/features.md F16). A sidebar of sections
 * (overview, users, API usage, credits, audit log, data) beside the section's page;
 * on phones the sidebar becomes a scrollable row of tabs.
 *
 * The UI shows only to app admins; every number it shows comes from
 * owner-only server actions, so this gate isn't the security boundary.
 */

import { NavLink, Outlet } from 'react-router-dom'
import { useUser } from 'deepspace'
import { BarChart3, Coins, Database, LayoutDashboard, ScrollText, ShieldAlert, Users, type LucideIcon } from 'lucide-react'
import { EmptyState, cn } from '@/components/ui'

interface Section {
  to: string
  label: string
  icon: LucideIcon
  /** Only the exact path counts as active (the overview is the section root). */
  end?: boolean
}

const SECTIONS: Section[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/usage', label: 'API usage', icon: BarChart3 },
  { to: '/admin/credits', label: 'Credits', icon: Coins },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
  { to: '/admin/data', label: 'Data', icon: Database },
]

export default function AdminLayout() {
  const { user, isLoading } = useUser()

  if (isLoading && !user) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
  }
  if (user?.role !== 'admin') {
    return (
      <EmptyState
        icon={<ShieldAlert />}
        title="Admins only"
        description="The admin console is for the app’s admins."
      />
    )
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6 md:flex-row md:gap-8">
      <aside className="md:w-56 md:shrink-0">
        <div className="md:sticky md:top-6">
          <p className="mb-3 hidden px-3 font-display text-lg font-bold md:block">Admin console</p>
          <nav
            aria-label="Admin sections"
            data-testid="admin-sidebar"
            className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0"
          >
            {SECTIONS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary-text'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
