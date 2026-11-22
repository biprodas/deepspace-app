/**
 * Building blocks for the admin console pages (src/pages/(app)/(protected)/admin):
 * the summary loader, the page header, stat cards and the owner-only notice.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { RefreshCw, ShieldAlert } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'
import type { AdminSummary } from '@/actions/admin'
import { callAction } from '@/lib/actions-client'

/** Loads the owner-only `adminSummary`; `forbidden` when the viewer isn't the app owner. */
export function useAdminSummary() {
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [error, setError] = useState<{ code?: string; message: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await callAction<AdminSummary>('adminSummary')
    setLoading(false)
    if (res.success) {
      setSummary(res.data)
      setError(null)
    } else setError({ code: res.code, message: res.error })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { summary, error, loading, reload: load, forbidden: error?.code === 'forbidden' }
}

export function AdminHeader({
  title,
  description,
  onRefresh,
  refreshing,
  children,
}: {
  title: string
  description?: string
  onRefresh?: () => void
  refreshing?: boolean
  children?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        {children}
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} loading={refreshing}>
            <RefreshCw /> Refresh
          </Button>
        )}
      </div>
    </header>
  )
}

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground [&_svg]:size-4">
        {icon}
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function OwnerOnly() {
  return (
    <EmptyState
      icon={<ShieldAlert />}
      title="Owner only"
      description="These numbers include every user’s activity, so only the app owner can see them."
    />
  )
}

export const formatCount = (n: number, capped = false) => `${n.toLocaleString('en-US')}${capped ? '+' : ''}`
