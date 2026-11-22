/**
 * Admin console overview: /admin (docs/features.md F16). How much there is
 * of everything, and the last 30 days of paid calls at a glance.
 */

import { Link } from 'react-router-dom'
import { BarChart3, FileText, Gamepad2, ListChecks, Mail, Network, PenTool, Sparkles, Users, UsersRound } from 'lucide-react'
import { AdminHeader, OwnerOnly, StatCard, formatCount, useAdminSummary } from '@/components/admin/admin-ui'
import { usePageTitle } from '@/lib/page-title'

export default function AdminOverviewPage() {
  usePageTitle('Admin console')
  const { summary, loading, reload, forbidden, error } = useAdminSummary()
  if (forbidden) return <OwnerOnly />

  const c = summary?.counts
  const u = summary?.usage.last30Days
  const v = (key: keyof NonNullable<typeof c>) => (c ? formatCount(c[key].count, c[key].capped) : '…')

  return (
    <>
      <AdminHeader title="Overview" description="Everything in StudyArena right now." onRefresh={() => void reload()} refreshing={loading} />
      {error && <p className="mb-4 text-sm text-destructive">{error.message}</p>}

      <section aria-labelledby="admin-content" className="mb-8">
        <h2 id="admin-content" className="mb-3 text-sm font-semibold text-muted-foreground">
          Content
        </h2>
        <div data-testid="admin-counts" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Users" icon={<Users />} value={v('users')} />
          <StatCard label="Quizzes" icon={<ListChecks />} value={v('quizzes')} />
          <StatCard label="Games" icon={<Gamepad2 />} value={v('games')} hint={c ? `${formatCount(c.liveGames.count)} open now` : undefined} />
          <StatCard label="Study spaces" icon={<UsersRound />} value={v('spaces')} />
          <StatCard label="Notes" icon={<FileText />} value={v('notes')} />
          <StatCard label="Boards" icon={<PenTool />} value={v('boards')} />
        </div>
      </section>

      <section aria-labelledby="admin-usage">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="admin-usage" className="text-sm font-semibold text-muted-foreground">
            Paid calls, last 30 days
          </h2>
          <Link to="/admin/usage" className="text-sm font-semibold text-primary-text hover:underline">
            API usage details
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="AI quiz drafts" icon={<Sparkles />} value={u ? formatCount(u.generations) : '…'} hint={u && u.generationsFailed > 0 ? `${u.generationsFailed} failed` : undefined} />
          <StatCard label="Claude tokens" icon={<BarChart3 />} value={u ? formatCount(u.inputTokens + u.outputTokens) : '…'} />
          <StatCard label="Mind maps" icon={<Network />} value={u ? formatCount(u.mindMaps) : '…'} />
          <StatCard label="Invite emails" icon={<Mail />} value={u ? formatCount(u.emailsSent) : '…'} />
        </div>
      </section>
    </>
  )
}
