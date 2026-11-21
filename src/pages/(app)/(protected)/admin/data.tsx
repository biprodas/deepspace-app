/**
 * Owner-only data inspector: /admin/data (docs/trd.md §13). Everything comes
 * from the `exportData` action, which refuses anyone but the app owner; the
 * page itself grants nothing.
 */

import { usePageTitle } from '@/lib/page-title'
import { useCallback, useEffect, useState } from 'react'
import { Database, Download, RefreshCw, ShieldAlert } from 'lucide-react'
import { Badge, Button, EmptyState } from '@/components/ui'
import { callAction } from '@/lib/actions-client'
import type { Room, RoomPlayer } from '@/schemas/game-types'

type Exported = {
  exportedAt: string
  limitPerCollection: number
  collections: Record<string, { recordId: string; createdAt: string; data: unknown }[]>
}

export default function AdminDataPage() {
  const [data, setData] = useState<Exported | null>(null)
  const [error, setError] = useState<{ code?: string; message: string } | null>(null)
  const [loading, setLoading] = useState(true)
  usePageTitle('Data')

  const load = useCallback(async () => {
    setLoading(true)
    const result = await callAction<Exported>('exportData')
    setLoading(false)
    if (result.success) {
      setData(result.data)
      setError(null)
    } else setError({ code: result.code, message: result.error })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function download() {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `studyarena-${data.exportedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`,
    })
    a.click()
    URL.revokeObjectURL(url)
  }

  if (error?.code === 'forbidden') {
    return <EmptyState icon={<ShieldAlert />} title="Owner only" description="Only the app owner can inspect the data." />
  }

  const rooms = (data?.collections.rooms ?? []) as { recordId: string; createdAt: string; data: Room }[]
  const players = (data?.collections.room_players ?? []) as { data: RoomPlayer }[]
  const playerCount = (roomId: string) => players.filter((p) => p.data.roomId === roomId && !p.data.removed).length

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 pb-24 pt-8 sm:px-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 font-display text-3xl font-bold tracking-tight">Data</h1>
        <Button variant="outline" onClick={() => void load()} loading={loading}>
          <RefreshCw /> Refresh
        </Button>
        <Button onClick={download} disabled={!data}>
          <Download /> Download JSON
        </Button>
      </header>

      {error && <p role="alert" className="text-sm font-medium text-destructive">{error.message}</p>}

      {data && (
        <>
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
              <Database className="size-5" aria-hidden="true" /> Collections
            </h2>
            <dl data-testid="collection-counts" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {Object.entries(data.collections).map(([name, records]) => (
                <div key={name} className="rounded-lg border border-border bg-card p-3">
                  <dt className="truncate font-mono text-xs text-muted-foreground">{name}</dt>
                  <dd className="font-mono text-xl font-bold tabular-nums">
                    {records.length}
                    {records.length >= data.limitPerCollection && '+'}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="mb-3 font-display text-lg font-bold">Recent rooms</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card text-sm">
              {rooms.slice(0, 20).map((r) => (
                <li key={r.recordId} className="flex items-center gap-3 px-4 py-2">
                  <span className="font-mono font-bold tracking-[0.15em]">{r.data.code}</span>
                  <Badge variant="secondary" size="sm">{r.data.status}</Badge>
                  <span className="text-muted-foreground">{playerCount(r.recordId)} players</span>
                  <span className="ml-auto text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </section>
          <p className="text-xs text-muted-foreground">
            Exported {new Date(data.exportedAt).toLocaleString()}. Pasted notes are not included.
          </p>
        </>
      )}
    </div>
  )
}
