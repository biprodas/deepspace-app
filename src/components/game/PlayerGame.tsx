/**
 * The player's game screen, phone-first: four big tiles, the clock, then
 * "answer locked in" (never right/wrong: the client doesn't know yet), and
 * at reveal their result and standing.
 *
 * The locked-in state comes from the player's own `answers` row, so it
 * survives a refresh.
 */

import { useState, type ReactNode } from 'react'
import { CheckCircle2, Clock, Hourglass, Pause, WifiOff, XCircle } from 'lucide-react'
import { useCountdown, useServerOffset } from '@/lib/clock'
import { useAction } from '@/lib/use-action'
import type { RoomState } from '@/lib/use-room'
import { AnswerTiles } from './AnswerTiles'
import { Countdown } from './Countdown'
import { RevealPanel } from './RevealPanel'
import { StandingsList } from './StandingsList'

export function PlayerGame({ state }: { state: RoomState }) {
  const { room, round, question, me, answersByRound, standings, names, userId, online, approvedCount, flaggedRounds } =
    state
  const offset = useServerOffset()
  const { run, pending } = useAction()
  // The tile tapped while the answer is in flight; cleared if refused.
  const [sending, setSending] = useState<{ roundId: string; choice: number } | null>(null)
  const left = useCountdown(round?.data.deadline, offset, room?.data.status === 'paused' ? round?.data.remainingMs : undefined)
  if (!room || !round || !question || !me) {
    return <p className="p-10 text-center text-sm text-muted-foreground">Loading question…</p>
  }

  const status = room.data.status
  const answer = answersByRound.get(round.recordId)
  const picked = answer?.choiceIndex ?? (sending?.roundId === round.recordId ? sending.choice : undefined)
  const lateJoiner = round.data.roundNumber < me.data.firstRoundNumber
  const hostOnline = online.has(room.data.hostId)

  async function choose(choice: number) {
    if (!round) return
    setSending({ roundId: round.recordId, choice })
    const result = await run('submitAnswer', { roundId: round.recordId, choiceIndex: choice })
    if (!result.success) setSending(null)
  }

  let banner: { icon: ReactNode; text: string; tone: string } | null = null
  if (status === 'reveal') {
    banner = !answer
      ? { icon: <Clock />, text: lateJoiner ? 'You joined during this one' : 'No answer this time', tone: 'border-border' }
      : answer.correct
        ? { icon: <CheckCircle2 />, text: `Correct! +${answer.points}`, tone: 'border-correct bg-correct/10 text-correct-text' }
        : { icon: <XCircle />, text: 'Not this time', tone: 'border-destructive/50 bg-destructive/10 text-destructive' }
  } else if (lateJoiner) {
    banner = { icon: <Hourglass />, text: 'You’re in from the next question', tone: 'border-border' }
  } else if (status === 'paused') {
    banner = { icon: <Pause />, text: 'Paused by the host', tone: 'border-warning/50 bg-warning/10' }
  } else if (answer) {
    banner = { icon: <CheckCircle2 />, text: 'Answer locked in', tone: 'border-primary/50 bg-primary/10' }
  } else if (left === 0) {
    banner = { icon: <Clock />, text: 'Time’s up', tone: 'border-border' }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-5" data-testid="player-game">
      {!hostOnline && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
          The host is disconnected. The game continues when they’re back.
        </p>
      )}

      <p className="font-mono text-xs font-bold text-muted-foreground">
        Question {round.data.roundNumber} of {approvedCount}
      </p>
      <h1 className="font-display text-2xl font-bold leading-snug">{question.prompt}</h1>

      {status !== 'reveal' && (
        <Countdown
          deadline={round.data.deadline}
          timeLimitMs={round.data.timeLimitMs}
          offset={offset}
          frozenMs={status === 'paused' ? round.data.remainingMs : undefined}
        />
      )}

      {banner && (
        <p
          role="status"
          data-testid="player-status"
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 font-semibold [&_svg]:size-5 ${banner.tone}`}
        >
          {banner.icon}
          {banner.text}
        </p>
      )}

      {status === 'reveal' ? (
        <>
          <RevealPanel
            question={question}
            round={round.data}
            picked={answer?.choiceIndex}
            confused={{
              flagged: flaggedRounds.has(round.recordId),
              pending: pending === 'flagConfused',
              onFlag: () => void run('flagConfused', { roundId: round.recordId }),
            }}
          />
          <section>
            <h2 className="mb-2 text-sm font-semibold">Standings</h2>
            <StandingsList standings={standings} names={names} userId={userId} limit={5} />
          </section>
        </>
      ) : (
        <AnswerTiles
          options={question.options}
          mode="choose"
          picked={picked}
          disabled={picked !== undefined || lateJoiner || status !== 'question' || left === 0}
          onChoose={(i) => void choose(i)}
          size="lg"
        />
      )}
    </div>
  )
}
