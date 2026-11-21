/**
 * Scoring and standings (docs/trd.md §6). Pure functions: server actions
 * call them with server-side times, and the tests pin the rules down.
 */

import { MAX_POINTS } from './game-rules'

/** Clamps `value` into `[0, max]`. */
const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max)

/**
 * How long the player took, from the server's point of view. Measured from
 * the remaining time rather than `startedAt`, so time spent paused (which
 * pushes `deadline` back) is not counted against the player.
 */
export function elapsedMs(
  round: { deadline: number; timeLimitMs: number },
  receivedAt: number,
): number {
  return clamp(round.timeLimitMs - (round.deadline - receivedAt), round.timeLimitMs)
}

/** 1000 for an instant correct answer, down to 500 at the buzzer; 0 if wrong. */
export function points(correct: boolean, elapsed: number, timeLimitMs: number): number {
  if (!correct) return 0
  const fraction = timeLimitMs > 0 ? clamp(elapsed, timeLimitMs) / timeLimitMs : 1
  return Math.round(MAX_POINTS * (1 - 0.5 * fraction))
}

export interface StandingPlayer {
  userId: string
  joinedAt: number
  removed?: boolean
}

export interface ScoredAnswer {
  userId: string
  correct: boolean
  points: number
  answerMs: number
}

export interface ComputedStanding {
  userId: string
  score: number
  correctCount: number
  /** Total answer time on correct answers: the first tie-break. */
  correctMs: number
  rank: number
}

/**
 * Standings for every non-removed player, recomputed from scratch so a
 * retried reveal can't double-count. Order: score desc → `correctMs` asc →
 * `joinedAt` asc → `userId` (only so the order is total).
 */
export function computeStandings(
  players: StandingPlayer[],
  answers: ScoredAnswer[],
): ComputedStanding[] {
  const active = players.filter((p) => !p.removed)
  const totals = new Map(
    active.map((p) => [p.userId, { score: 0, correctCount: 0, correctMs: 0 }]),
  )
  for (const answer of answers) {
    const total = totals.get(answer.userId)
    if (!total) continue
    total.score += answer.points
    if (answer.correct) {
      total.correctCount += 1
      total.correctMs += answer.answerMs
    }
  }

  return active
    .map((p) => ({ ...p, ...totals.get(p.userId)! }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.correctMs - b.correctMs ||
        a.joinedAt - b.joinedAt ||
        a.userId.localeCompare(b.userId),
    )
    .map(({ userId, score, correctCount, correctMs }, i) => ({
      userId,
      score,
      correctCount,
      correctMs,
      rank: i + 1,
    }))
}
