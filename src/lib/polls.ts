/**
 * Live polls (docs/features.md F12): the vote tally the server publishes on
 * a poll, and the quick templates the host picks from.
 */

import type { PollKind } from '../schemas/game-types'

/** Votes per option, recomputed from every vote (never incremented). Out-of-range choices are ignored. */
export function tallyVotes(choices: number[], optionCount: number): number[] {
  const counts = Array<number>(optionCount).fill(0)
  for (const c of choices) {
    if (Number.isInteger(c) && c >= 0 && c < optionCount) counts[c] += 1
  }
  return counts
}

/** Each option's share of the votes, as whole percentages (0 when nobody voted). */
export function percentages(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0)
  return counts.map((n) => (total === 0 ? 0 : Math.round((n / total) * 100)))
}

export interface PollTemplate {
  id: string
  label: string
  kind: PollKind
  question: string
  options: string[]
}

export const POLL_TEMPLATES: PollTemplate[] = [
  {
    id: 'confidence',
    label: 'Confidence check',
    kind: 'confidence',
    question: 'How confident do you feel about this topic?',
    options: ['Lost', 'Shaky', 'Okay', 'Good', 'Nailed it'],
  },
  {
    id: 'ready',
    label: 'Ready?',
    kind: 'poll',
    question: 'Ready for the next question?',
    options: ['Ready', 'Need a minute'],
  },
  {
    id: 'pace',
    label: 'Pace',
    kind: 'poll',
    question: 'How is the pace?',
    options: ['Too fast', 'Just right', 'Too slow'],
  },
]
