/**
 * Admin console, API usage: /admin/usage (docs/features.md F16). The paid
 * calls StudyArena makes, from its own records, all time and for the last
 * 30 days. Exact charges live in DeepSpace's billing, which the app can't
 * read: the dashboard and `npx deepspace app usage` show them.
 */

import { ExternalLink } from 'lucide-react'
import { AdminHeader, OwnerOnly, formatCount, useAdminSummary } from '@/components/admin/admin-ui'
import { usePageTitle } from '@/lib/page-title'

/** The email integration's listed price per message (`npx deepspace integrations info email/send`). */
const EMAIL_PRICE_USD = 0.013

type Window = { generations: number; generationsFailed: number; inputTokens: number; outputTokens: number; mindMaps: number; noteAi: number; emailsSent: number; wikipediaLookups: number }

interface Row {
  label: string
  detail: string
  value: (w: Window) => string
}

const ROWS: Row[] = [
  {
    label: 'AI quiz drafts',
    detail: 'Claude runs that drafted or replaced questions (anthropic/chat-completion)',
    value: (w) => formatCount(w.generations) + (w.generationsFailed ? ` (${w.generationsFailed} failed)` : ''),
  },
  { label: 'Claude input tokens', detail: 'Source text and instructions sent to Claude', value: (w) => formatCount(w.inputTokens) },
  { label: 'Claude output tokens', detail: 'Questions Claude wrote back', value: (w) => formatCount(w.outputTokens) },
  { label: 'AI mind maps', detail: 'Claude runs that drafted a mind map (tokens aren’t recorded)', value: (w) => formatCount(w.mindMaps) },
  { label: 'AI in notes', detail: 'Claude runs that drafted notes from a topic or reviewed a note', value: (w) => formatCount(w.noteAi) },
  { label: 'Wikipedia lookups', detail: 'Articles fetched for quizzes, mind maps and AI notes', value: (w) => formatCount(w.wikipediaLookups) },
  {
    label: 'Invite emails',
    detail: `Game and space invites delivered by email/send, at $${EMAIL_PRICE_USD} each`,
    value: (w) => `${formatCount(w.emailsSent)} · ≈ $${(w.emailsSent * EMAIL_PRICE_USD).toFixed(2)}`,
  },
]

export default function AdminUsagePage() {
  usePageTitle('API usage')
  const { summary, loading, reload, forbidden, error } = useAdminSummary()
  if (forbidden) return <OwnerOnly />

  return (
    <>
      <AdminHeader
        title="API usage"
        description="Paid calls StudyArena made, counted from its own records."
        onRefresh={() => void reload()}
        refreshing={loading}
      />
      {error && <p className="mb-4 text-sm text-destructive">{error.message}</p>}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table data-testid="admin-usage" className="w-full min-w-[520px] text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Call
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Last 30 days
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                All time
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ROWS.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  <span className="block font-medium">{row.label}</span>
                  <span className="block text-xs text-muted-foreground">{row.detail}</span>
                </th>
                <td className="px-4 py-3 text-right tabular-nums">{summary ? row.value(summary.usage.last30Days) : '…'}</td>
                <td className="px-4 py-3 text-right tabular-nums">{summary ? row.value(summary.usage.allTime) : '…'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4 text-sm">
        <p className="font-medium">Exact charges</p>
        <p className="mt-1 text-muted-foreground">
          DeepSpace bills Claude at the provider’s cost plus a platform markup, which the app can’t see, so this page
          counts calls and tokens instead of guessing dollars. For the real bill, open the{' '}
          <a
            href="https://dashboard.deep.space"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-primary-text hover:underline"
          >
            DeepSpace dashboard <ExternalLink className="size-3" aria-hidden="true" />
          </a>{' '}
          or run <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">npx deepspace app usage</code>.
        </p>
      </div>
    </>
  )
}
