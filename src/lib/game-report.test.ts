import { describe, expect, it } from 'vitest'
import { hardestQuestions, questionResults } from './game-report'
import type { Question, Round } from '../schemas/game-types'

const q = (prompt: string): Question => ({
  quizId: 'z',
  order: 1,
  prompt,
  options: ['a', 'b', 'c', 'd'],
  timeLimit: 20,
  approved: true,
})
const round = (id: string, n: number, extra: Partial<Round>): { recordId: string; data: Round } => ({
  recordId: id,
  data: {
    roomId: 'r',
    questionId: `q${n}`,
    roundNumber: n,
    status: 'revealed',
    startedAt: 0,
    deadline: 0,
    timeLimitMs: 20_000,
    ...extra,
  },
})

const questions = new Map([
  ['q1', q('Easy one?')],
  ['q2', q('Hard one?')],
  ['q3', q('Skipped?')],
  ['q4', q('Nobody answered?')],
])

const rounds = [
  round('r2', 2, { correctIndex: 1, distribution: [3, 1, 0, 0] }),
  round('r1', 1, { correctIndex: 0, distribution: [4, 0, 0, 0] }),
  round('r3', 3, { status: 'skipped' }),
  round('r4', 4, { correctIndex: 2, distribution: [0, 0, 0, 0] }),
]

describe('questionResults', () => {
  it('reports accuracy per revealed question, in play order, skipping skipped rounds', () => {
    expect(questionResults(rounds, questions)).toEqual([
      { roundId: 'r1', roundNumber: 1, prompt: 'Easy one?', correctOption: 'a', answered: 4, correct: 4, accuracy: 1 },
      { roundId: 'r2', roundNumber: 2, prompt: 'Hard one?', correctOption: 'b', answered: 4, correct: 1, accuracy: 0.25 },
      { roundId: 'r4', roundNumber: 4, prompt: 'Nobody answered?', correctOption: 'c', answered: 0, correct: 0, accuracy: null },
    ])
  })
})

describe('hardestQuestions', () => {
  it('lists missed questions, lowest accuracy first, ignoring perfect and unanswered ones', () => {
    expect(hardestQuestions(questionResults(rounds, questions)).map((r) => r.prompt)).toEqual(['Hard one?'])
  })
})
