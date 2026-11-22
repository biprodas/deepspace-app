/**
 * The room's latest poll. Players tap an option (and can change it while the
 * poll is open), then see the live result bars. The host and co-hosts see the
 * bars from the start, with a "Close poll" button.
 */

import { BarChart3, Check, X } from 'lucide-react'
import { Button, cn } from '@/components/ui'
import { percentages } from '@/lib/polls'
import { useAction } from '@/lib/use-action'
import type { Poll } from '@/schemas/game-types'

interface PollCardProps {
  pollId: string
  poll: Poll
  /** The viewer's vote, if any. */
  myChoice?: number
  /** Host or co-host: sees results, can close, can't vote. */
  canManage: boolean
  onDismiss: () => void
}

export function PollCard({ pollId, poll, myChoice, canManage, onDismiss }: PollCardProps) {
  const { run, pending } = useAction()
  const open = poll.status === 'open'
  const total = poll.counts.reduce((a, b) => a + b, 0)
  const pct = percentages(poll.counts)
  const showResults = canManage || !open || myChoice !== undefined
  const canVote = open && !canManage

  return (
    <section
      data-testid="poll-card"
      data-status={poll.status}
      aria-labelledby={`poll-${pollId}`}
      className="w-full rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-lg"
    >
      <header className="mb-3 flex items-start gap-2">
        <BarChart3 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {open ? 'Live poll' : 'Poll closed'} · {total} {total === 1 ? 'vote' : 'votes'}
          </p>
          <h2 id={`poll-${pollId}`} className="font-semibold leading-snug">
            {poll.question}
          </h2>
        </div>
        {!open && (
          <Button variant="ghost" size="icon" className="-mr-2 -mt-1 size-7" aria-label="Hide poll" onClick={onDismiss}>
            <X />
          </Button>
        )}
      </header>

      <ul className="space-y-1.5">
        {poll.options.map((option, i) => {
          const mine = myChoice === i
          const body = (
            <>
              {showResults && (
                <span
                  aria-hidden="true"
                  className={cn('absolute inset-y-0 left-0 rounded-lg transition-[width] duration-500', mine ? 'bg-primary/25' : 'bg-secondary')}
                  style={{ width: `${pct[i]}%` }}
                />
              )}
              <span className="relative flex items-center gap-2">
                {mine && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                <span className="min-w-0 flex-1 truncate text-left">{option}</span>
                {showResults && (
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {pct[i]}%<span className="sr-only"> ({poll.counts[i]} votes)</span>
                  </span>
                )}
              </span>
            </>
          )
          return (
            <li key={i}>
              {canVote ? (
                <button
                  type="button"
                  aria-pressed={mine}
                  disabled={pending === 'votePoll'}
                  onClick={() => void run('votePoll', { pollId, choiceIndex: i })}
                  className={cn(
                    'relative w-full overflow-hidden rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:border-primary/60',
                    mine ? 'border-primary' : 'border-border',
                  )}
                >
                  {body}
                </button>
              ) : (
                <div className="relative overflow-hidden rounded-lg border border-border px-3 py-2 text-sm font-medium">{body}</div>
              )}
            </li>
          )
        })}
      </ul>

      {canVote && myChoice === undefined && <p className="mt-2 text-xs text-muted-foreground">Tap an option. Votes are anonymous.</p>}
      {canVote && myChoice !== undefined && <p className="mt-2 text-xs text-muted-foreground">You can change your vote until it closes.</p>}

      {canManage && open && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          loading={pending === 'closePoll'}
          onClick={() => void run('closePoll', { pollId })}
        >
          Close poll
        </Button>
      )}
    </section>
  )
}
