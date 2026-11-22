/**
 * Admin console, audit log: /admin/audit (docs/features.md F17). Who did
 * what, newest first, live: moderation, deletions, paid calls, admin actions
 * and role changes. Only admins receive these rows (schema `audit_log`);
 * entries are written by server actions and kept for AUDIT_RETENTION_DAYS.
 */

import { useMemo, useState } from 'react'
import { useQuery } from 'deepspace'
import { BadgeCheck, CircleAlert, Search } from 'lucide-react'
import { Badge, Input, cn } from '@/components/ui'
import { AdminHeader, formatCount } from '@/components/admin/admin-ui'
import { AUDIT_RETENTION_DAYS, CATEGORY_LABEL, describeAudit } from '@/lib/audit'
import { usePageTitle } from '@/lib/page-title'
import { AUDIT_CATEGORIES, type AuditCategory, type AuditEntry } from '@/schemas/audit-schemas'

const SHOWN = 300

const CATEGORY_TONE: Record<AuditCategory, string> = {
  moderation: 'bg-warning/15 text-foreground',
  deletion: 'bg-destructive/10 text-destructive',
  paid: 'bg-primary/10 text-primary-text',
  admin: 'bg-secondary text-foreground',
  roles: 'bg-correct/15 text-foreground',
}

function ago(at: number): string {
  const s = Math.round((Date.now() - at) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d < 30 ? `${d} d ago` : new Date(at).toLocaleDateString()
}

export default function AdminAuditPage() {
  usePageTitle('Audit log')
  const [category, setCategory] = useState<AuditCategory | 'all'>('all')
  const [query, setQuery] = useState('')
  const { records, status } = useQuery<AuditEntry>('audit_log', { orderBy: 'at', orderDir: 'desc', limit: SHOWN })

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return records.filter(
      (r) =>
        (category === 'all' || r.data.category === category) &&
        (!q ||
          r.data.actorName.toLowerCase().includes(q) ||
          (r.data.targetLabel ?? '').toLowerCase().includes(q) ||
          describeAudit(r.data).toLowerCase().includes(q)),
    )
  }, [records, category, query])

  return (
    <>
      <AdminHeader
        title="Audit log"
        description={`Who removed, deleted, spent or changed what. Kept for ${AUDIT_RETENTION_DAYS} days.`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter by kind" className="flex flex-wrap gap-1.5">
          {(['all', ...AUDIT_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-accent',
                category === c ? 'border-primary bg-primary/10 text-primary-text' : 'border-border',
              )}
            >
              {c === 'all' ? 'All' : CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people or things"
            aria-label="Search the audit log"
            className="pl-9"
          />
        </div>
      </div>

      {status === 'loading' && records.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          {records.length === 0 ? 'Nothing logged yet.' : 'No entries match.'}
        </p>
      ) : (
        <ol data-testid="audit-log" className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {shown.map((r) => (
            <li key={r.recordId} data-testid="audit-entry" data-action={r.data.action} className="flex items-start gap-3 px-4 py-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold"
              >
                {r.data.actorName.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold">{r.data.actorName}</span> {describeAudit(r.data)}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <time dateTime={new Date(r.data.at).toISOString()} title={new Date(r.data.at).toLocaleString()}>
                    {ago(r.data.at)}
                  </time>
                  <span className={cn('rounded-full px-2 py-0.5 font-medium', CATEGORY_TONE[r.data.category])}>
                    {CATEGORY_LABEL[r.data.category]}
                  </span>
                  {r.data.source === 'verified' && (
                    <span className="inline-flex items-center gap-1" title="The server saw the new role on the user">
                      <BadgeCheck className="size-3.5 text-correct" aria-hidden="true" /> Verified
                    </span>
                  )}
                  {r.data.source === 'reported' && (
                    <span className="inline-flex items-center gap-1" title="Reported by the admin's browser; the server hadn't seen the new role yet">
                      <CircleAlert className="size-3.5 text-warning" aria-hidden="true" /> Reported by browser
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {records.length >= SHOWN && (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing the latest {formatCount(SHOWN)} entries. <Badge variant="secondary" size="sm">Search and filters apply to these</Badge>
        </p>
      )}
    </>
  )
}
