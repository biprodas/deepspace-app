/**
 * Per-question results for a finished game (docs/features.md F10: "host
 * sees per-question accuracy and the hardest questions"). Built only from
 * revealed rounds, whose answer and distribution are public by then.
 */

import type { Question, Round } from '../schemas/game-types'

export type AskedQuestion = Pick<Question, 'prompt' | 'options'>

/**
 * The question a round asked. Rounds carry their own copy, since players
 * can't read `questions`; rounds from before that fall back to the
 * question row, which only the quiz owner receives.
 */
export function askedQuestion(round: Round, questions: Map<string, Question>): AskedQuestion | undefined {
  if (round.prompt && round.options) return { prompt: round.prompt, options: round.options }
  return questions.get(round.questionId)
}

export interface QuestionResult {
  roundId: string
  roundNumber: number
  prompt: string
  correctOption: string
  answered: number
  correct: number
  /** correct / answered, or null when nobody answered. */
  accuracy: number | null
}

export function questionResults(
  rounds: { recordId: string; data: Round }[],
  questions: Map<string, Question>,
): QuestionResult[] {
  return rounds
    .filter((r) => r.data.status === 'revealed' && r.data.correctIndex !== undefined && r.data.correctIndex !== null)
    .sort((a, b) => a.data.roundNumber - b.data.roundNumber)
    .map((r) => {
      const q = askedQuestion(r.data, questions)
      const distribution = r.data.distribution ?? []
      const answered = distribution.reduce((sum, n) => sum + n, 0)
      const correct = distribution[r.data.correctIndex!] ?? 0
      return {
        roundId: r.recordId,
        roundNumber: r.data.roundNumber,
        prompt: q?.prompt ?? 'Deleted question',
        correctOption: q?.options[r.data.correctIndex!] ?? '',
        answered,
        correct,
        accuracy: answered > 0 ? correct / answered : null,
      }
    })
}

/** The questions most players got wrong (answered by someone, lowest accuracy first). */
export function hardestQuestions(results: QuestionResult[], count = 3): QuestionResult[] {
  return results
    .filter((r) => r.accuracy !== null && r.accuracy < 1)
    .sort((a, b) => a.accuracy! - b.accuracy! || b.answered - a.answered)
    .slice(0, count)
}
