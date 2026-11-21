/**
 * The host's game screen, for a laptop on a projector: the question big,
 * the clock, and the controls (pause / resume, skip, reveal, next, end).
 * Co-hosts get the same controls except ending the game.
 *
 * Reveal unlocks only after deadline + grace, the same rule the server
 * enforces, so the button doesn't offer a move that would be refused.
 */

import { useState } from 'react'
import { Eye, Pause, Play, SkipForward, Users } from 'lucide-react'
import { Button, ConfirmModal } from '@/components/ui'
import { useCountdown, useServerOffset } from '@/lib/clock'
import { GRACE_MS } from '@/lib/game-rules'
import { useAction } from '@/lib/use-action'
import type { RoomState } from '@/lib/use-room'
import { AnswerTiles } from './AnswerTiles'
import { Countdown } from './Countdown'
import { RevealPanel } from './RevealPanel'
import { StandingsList } from './StandingsList'

export function HostGame({ state }: { state: RoomState }) {
  const { room, round, question, players, online, approvedCount, standings, names, role } = state
  const offset = useServerOffset()
  const { run, pending } = useAction()
  const [ending, setEnding] = useState(false)
  const paused = room?.data.status === 'paused'
  // Reveal unlocks at deadline + grace (server rule), never while paused.
  const revealIn = useCountdown(
    round ? round.data.deadline + GRACE_MS : undefined,
    offset,
    paused ? (round?.data.remainingMs ?? 0) + GRACE_MS : undefined,
  )
  if (!room || !round || !question) {
    return <p className="p-10 text-center text-sm text-muted-foreground">Loading question…</p>
  }

  const roomId = room.recordId
  const status = room.data.status
  const isReveal = status === 'reveal'
  const act = (name: 'pauseRoom' | 'resumeRoom' | 'skipQuestion' | 'revealQuestion' | 'startQuestion') =>
    void run(name, { roomId })

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6" data-testid="host-game">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span data-testid="round-label" className="font-mono font-bold text-foreground">
          Question {round.data.roundNumber} of {approvedCount}
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="size-4" aria-hidden="true" />
          {players.filter((p) => online.has(p.data.userId)).length}/{players.length} online
        </span>
        <span className="ml-auto font-mono tracking-[0.15em]">Code {room.data.code}</span>
      </header>

      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{question.prompt}</h1>

      {isReveal ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <RevealPanel question={question} round={round.data} size="lg" />
          <section>
            <h2 className="mb-3 font-display text-lg font-bold">Standings</h2>
            <StandingsList standings={standings} names={names} limit={8} online={online} />
          </section>
        </div>
      ) : (
        <>
          <Countdown
            deadline={round.data.deadline}
            timeLimitMs={round.data.timeLimitMs}
            offset={offset}
            frozenMs={paused ? round.data.remainingMs : undefined}
            size="lg"
          />
          <AnswerTiles options={question.options} mode="show" size="lg" />
        </>
      )}

      <footer className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {role === 'host' && (
          <Button variant="ghost" className="hover:text-destructive" onClick={() => setEnding(true)}>
            End game
          </Button>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {!isReveal && (
            <>
              {paused ? (
                <Button variant="outline" loading={pending === 'resumeRoom'} onClick={() => act('resumeRoom')}>
                  <Play /> Resume
                </Button>
              ) : (
                <Button
                  variant="outline"
                  loading={pending === 'pauseRoom'}
                  disabled={revealIn <= GRACE_MS}
                  onClick={() => act('pauseRoom')}
                >
                  <Pause /> Pause
                </Button>
              )}
              <Button variant="outline" loading={pending === 'skipQuestion'} onClick={() => act('skipQuestion')}>
                <SkipForward /> Skip
              </Button>
              <Button
                size="lg"
                loading={pending === 'revealQuestion'}
                disabled={paused || revealIn > 0}
                onClick={() => act('revealQuestion')}
              >
                <Eye /> Reveal answer
              </Button>
            </>
          )}
          {isReveal && (
            <Button size="lg" loading={pending === 'startQuestion'} onClick={() => act('startQuestion')}>
              Next question
            </Button>
          )}
        </div>
      </footer>

      <ConfirmModal
        open={ending}
        onClose={() => setEnding(false)}
        title="End this game now?"
        description="Scores so far are kept and everyone sees the results."
        confirmText="End game"
        loading={pending === 'endRoom'}
        onConfirm={async () => {
          await run('endRoom', { roomId })
          setEnding(false)
        }}
      />
    </div>
  )
}
