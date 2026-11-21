/**
 * The latest AI run for a quiz, from its owner-only `generations` row
 * (live): progress while it runs, why it failed, or how many drafts were
 * dropped for failing the checks.
 */

import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { useServerNow } from '@/lib/clock'
import { INTERRUPTED_ERROR, isStaleRun } from '@/lib/generation'
import type { Generation, GenerationStage } from '@/schemas/game-types'

const STAGE_TEXT: Record<GenerationStage, string> = {
  fetching: 'Reading the source…',
  writing: 'Claude is drafting questions and checking each against the source…',
  saving: 'Saving the drafts…',
}

export function GenerationBanner({ generation, createdAt }: { generation: Generation; createdAt: string }) {
  const unfinished = generation.status === 'pending' || generation.status === 'running'
  const now = useServerNow(5_000, unfinished)
  // A run whose job died (no heartbeat) reads as failed; starting another
  // run settles the row on the server.
  const status = isStaleRun(generation, Date.parse(createdAt), now) ? 'failed' : generation.status
  const error = status === generation.status ? generation.error : INTERRUPTED_ERROR

  if (status === 'pending' || status === 'running') {
    return (
      <div role="status" data-testid="generation-status" className="flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm">
        <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
        <div>
          <p className="font-semibold">
            Drafting {generation.questionCount} question{generation.questionCount === 1 ? '' : 's'}
          </p>
          <p className="text-muted-foreground">
            {(generation.stage && STAGE_TEXT[generation.stage]) ?? 'Queued…'} This can take up to a minute.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div role="alert" data-testid="generation-status" className="flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/5 p-4 text-sm">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
        <div>
          <p className="font-semibold">Drafting failed</p>
          <p className="text-muted-foreground">
            {error ?? 'Something went wrong.'} You can still write questions by hand below.
          </p>
        </div>
      </div>
    )
  }

  const dropped = generation.droppedCount ?? 0
  const kept = generation.questionCount - dropped
  return (
    <div data-testid="generation-status" className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-correct-text" aria-hidden="true" />
      <div>
        <p className="font-semibold">
          {kept} draft{kept === 1 ? '' : 's'} ready for review
        </p>
        <p className="text-muted-foreground">
          {dropped > 0
            ? `${dropped} more ${dropped === 1 ? 'was' : 'were'} dropped because ${dropped === 1 ? 'it' : 'they'} failed the checks (for example, a quote that isn’t in the source).`
            : 'Every draft passed the checks.'}{' '}
          Drafts aren’t playable until you approve them.
        </p>
      </div>
    </div>
  )
}
