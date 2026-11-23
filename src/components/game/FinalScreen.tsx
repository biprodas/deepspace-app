/**
 * The end of a game (docs/features.md F6): podium, full rankings and, for a
 * player, the questions they got wrong with the right answer and source.
 * "Wrong" joins the player's own answers with the public revealed rounds;
 * no extra read access is needed.
 */

import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { buttonVariants, cn } from '@/components/ui'
import { AnswerChip, Initials } from '@/components/landing/bits'
import type { RoomState } from '@/lib/use-room'
import { askedQuestion, hardestQuestions, questionResults } from '@/lib/game-report'
import { SourceQuote } from './RevealPanel'
import { StandingsList } from './StandingsList'

const PODIUM = [
  { place: 2, height: 'h-20', order: 'order-1' },
  { place: 1, height: 'h-28', order: 'order-2' },
  { place: 3, height: 'h-14', order: 'order-3' },
]

export function FinalScreen({ state }: { state: RoomState }) {
  const { room, standings, names, userId, role, rounds, questionsById, answersByRound, me } = state
  if (!room) return null
  const cancelled = room.data.status === 'cancelled'
  const sorted = [...standings].sort((a, b) => a.rank - b.rank)

  const missed =
    role === 'player' && me
      ? rounds.filter(
          (r) =>
            r.data.status === 'revealed' &&
            r.data.roundNumber >= me.data.firstRoundNumber &&
            !answersByRound.get(r.recordId)?.correct,
        )
      : []

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6" data-testid="final-screen">
      <header className="text-center">
        <Trophy className="mx-auto mb-2 size-10 text-answer-c" aria-hidden="true" />
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {cancelled ? 'Game ended early' : 'Final results'}
        </h1>
        {state.quiz && <p className="mt-1 text-sm text-muted-foreground">{state.quiz.data.title}</p>}
      </header>

      {sorted.length > 0 && (
        <div className="flex items-end justify-center gap-3" aria-label="Podium">
          {PODIUM.map(({ place, height, order }) => {
            const s = sorted[place - 1]
            if (!s) return <div key={place} className={cn('w-24', order)} />
            const name = names.get(s.userId) ?? 'Player'
            return (
              <div key={place} className={cn('flex w-24 flex-col items-center gap-1 sm:w-32', order)}>
                <Initials name={name} i={place - 1} className="size-10 text-sm" />
                <span className="w-full truncate text-center text-sm font-semibold">{name}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{s.score.toLocaleString()}</span>
                <div
                  className={cn(
                    'flex w-full items-start justify-center rounded-t-lg pt-2 font-display text-2xl font-extrabold text-ink',
                    height,
                    place === 1 ? 'bg-answer-c' : place === 2 ? 'bg-answer-d' : 'bg-answer-b',
                  )}
                >
                  {place}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Rankings</h2>
        <StandingsList standings={standings} names={names} userId={userId} />
      </section>

      {role !== 'player' && <QuestionBreakdown state={state} />}

      {role === 'player' && (
        <section data-testid="missed-questions">
          <h2 className="mb-3 font-display text-lg font-bold">
            {missed.length === 0 ? 'You got every question right!' : 'Questions to review'}
          </h2>
          <ul className="space-y-3">
            {missed.map((r) => {
              const q = askedQuestion(r.data, questionsById)
              const mine = answersByRound.get(r.recordId)
              const correct = r.data.correctIndex ?? 0
              if (!q) return null
              return (
                <li key={r.recordId} className="rounded-xl border border-border bg-card p-4 text-sm">
                  <p className="mb-2 font-semibold">{q.prompt}</p>
                  <p className="flex items-center gap-2">
                    <AnswerChip index={correct} /> <span className="font-semibold">{q.options[correct]}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {mine ? <>You answered {q.options[mine.choiceIndex]}</> : 'You didn’t answer'}
                  </p>
                  {r.data.explanation && <p className="mt-2">{r.data.explanation}</p>}
                  {r.data.sourceQuote && (
                    <div className="mt-2">
                      <SourceQuote quote={r.data.sourceQuote} url={r.data.sourceUrl} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="flex justify-center">
        <Link
          to={role === 'player' ? '/home' : `/quizzes/${room.data.quizId}`}
          className={buttonVariants({ variant: 'outline' })}
        >
          {role === 'player' ? 'Done' : 'Back to the quiz'}
        </Link>
      </div>
    </div>
  )
}

/** Host view (docs/features.md F10): how each question went, hardest first. */
function QuestionBreakdown({ state }: { state: RoomState }) {
  const results = questionResults(state.rounds, state.questionsById)
  const hardest = hardestQuestions(results)
  if (results.length === 0) return null
  const pct = (accuracy: number | null) => (accuracy === null ? '—' : `${Math.round(accuracy * 100)}%`)

  return (
    <section data-testid="question-breakdown" className="space-y-4">
      <h2 className="font-display text-lg font-bold">How each question went</h2>
      {hardest.length > 0 && (
        <div className="rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm">
          <p className="mb-2 font-semibold">Hardest questions</p>
          <ol className="space-y-1">
            {hardest.map((r) => (
              <li key={r.roundId} className="flex gap-2">
                <span className="font-mono font-bold">{pct(r.accuracy)}</span>
                <span className="min-w-0 flex-1">{r.prompt}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <ul className="space-y-2">
        {results.map((r) => (
          <li key={r.roundId} data-testid="question-result" className="rounded-lg border border-border bg-card p-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="font-mono text-xs font-bold text-muted-foreground">Q{r.roundNumber}</span>
              <span className="min-w-0 flex-1 font-medium">{r.prompt}</span>
              <span className="font-mono font-bold tabular-nums">{pct(r.accuracy)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
              <div className="h-full rounded-full bg-correct" style={{ width: `${(r.accuracy ?? 0) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {r.correct} of {r.answered} answered correctly · answer: {r.correctOption}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
