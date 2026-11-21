/**
 * All-time leaderboard: /leaderboard (docs/features.md F11). Totals over
 * finished games, written only by the server when a game ends.
 */

import { usePageTitle } from '@/lib/page-title'
import { useQuery, useUser } from 'deepspace'
import { Trophy } from 'lucide-react'
import { EmptyState, cn } from '@/components/ui'
import { Initials } from '@/components/landing/bits'
import { rankEntries } from '@/lib/leaderboard'
import type { LeaderboardEntry } from '@/schemas/game-types'

const LIMIT = 50

export default function LeaderboardPage() {
  const { user } = useUser()
  usePageTitle('Leaderboard')
  const { records, status } = useQuery<LeaderboardEntry>('leaderboard', {
    orderBy: 'totalScore',
    orderDir: 'desc',
    limit: LIMIT,
  })
  const entries = rankEntries(records.map((r) => r.data))

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All-time points from finished games. Scores are computed by the server, never submitted.
        </p>
      </header>

      {status === 'loading' ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <EmptyState icon={<Trophy />} title="No finished games yet" description="Play a game to the end to get on the board." />
      ) : (
        <ol data-testid="leaderboard" className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {entries.map((e, i) => (
            <li
              key={e.userId}
              data-testid="leaderboard-row"
              className={cn('flex items-center gap-3 px-4 py-3', e.userId === user?.id && 'bg-primary/5')}
            >
              <span
                className={cn(
                  'w-8 text-right font-mono font-bold',
                  i === 0 ? 'text-answer-c' : i < 3 ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {i + 1}
              </span>
              <Initials name={e.displayName} i={i} className="size-8" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {e.displayName}
                  {e.userId === user?.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">you</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {e.games} game{e.games === 1 ? '' : 's'} · {e.wins} win{e.wins === 1 ? '' : 's'} · {e.correctAnswers}{' '}
                  correct
                </span>
              </span>
              <span data-testid="leaderboard-score" className="font-mono text-lg font-bold tabular-nums">
                {e.totalScore.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
