/**
 * Rankings as the server computed them (`standings`, recomputed at each
 * reveal). Every client renders the same rows in the same order.
 */

import { cn } from '@/components/ui'
import { Initials } from '@/components/landing/bits'
import type { Standing } from '@/schemas/game-types'

interface StandingsListProps {
  standings: Standing[]
  names: Map<string, string>
  userId?: string
  /** Show only the top N (the viewer's own row is appended if cut). */
  limit?: number
  className?: string
}

export function StandingsList({ standings, names, userId, limit, className }: StandingsListProps) {
  const sorted = [...standings].sort((a, b) => a.rank - b.rank)
  let rows = limit ? sorted.slice(0, limit) : sorted
  const mine = sorted.find((s) => s.userId === userId)
  if (mine && !rows.includes(mine)) rows = [...rows, mine]

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No scores yet.</p>
  }

  return (
    <ol data-testid="standings" className={cn('space-y-1.5', className)}>
      {rows.map((s) => (
        <li
          key={s.userId}
          data-testid="standing-row"
          className={cn(
            'flex items-center gap-3 rounded-lg border bg-card px-3 py-2',
            s.userId === userId ? 'border-primary' : 'border-border',
          )}
        >
          <span className="w-7 text-right font-mono text-sm font-bold text-muted-foreground">{s.rank}</span>
          <Initials name={names.get(s.userId) ?? '?'} i={s.rank - 1} className="size-7" />
          <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
            <span data-testid="standing-name" className="truncate font-semibold">
              {names.get(s.userId) ?? 'Player'}
            </span>
            {s.userId === userId && <span className="text-xs text-muted-foreground">you</span>}
          </span>
          <span className="hidden text-xs text-muted-foreground sm:inline">{s.correctCount} correct</span>
          <span data-testid="standing-score" className="w-16 text-right font-mono font-bold tabular-nums">
            {s.score.toLocaleString()}
          </span>
        </li>
      ))}
    </ol>
  )
}
