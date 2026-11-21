/**
 * Study Arena record shapes (docs/schema.md) and the enum values the schemas
 * and server actions share. Times are epoch milliseconds.
 */

export const SOURCE_TYPES = ['manual', 'wikipedia', 'notes'] as const
export const DIFFICULTIES = ['easy', 'mixed', 'hard'] as const
export const QUIZ_STATUSES = ['generating', 'ready', 'failed'] as const
export const GENERATION_STATUSES = ['pending', 'running', 'completed', 'failed'] as const
export const GENERATION_STAGES = ['fetching', 'writing', 'saving'] as const
export const ROOM_STATUSES = ['lobby', 'question', 'reveal', 'paused', 'final', 'cancelled'] as const
export const ROUND_STATUSES = ['active', 'revealed', 'skipped'] as const

export type SourceType = (typeof SOURCE_TYPES)[number]
export type Difficulty = (typeof DIFFICULTIES)[number]
export type QuizStatus = (typeof QUIZ_STATUSES)[number]
export type GenerationStatus = (typeof GENERATION_STATUSES)[number]
export type GenerationStage = (typeof GENERATION_STAGES)[number]
export type RoomStatus = (typeof ROOM_STATUSES)[number]
export type RoundStatus = (typeof ROUND_STATUSES)[number]

/** A finished or ended game: nothing can change any more. */
export const isClosedStatus = (status: RoomStatus) => status === 'final' || status === 'cancelled'

export interface Quiz {
  ownerId: string
  title: string
  sourceType: SourceType
  sourceUrls: string[]
  difficulty: Difficulty
  status: QuizStatus
  generationId?: string
}

export interface Question {
  quizId: string
  order: number
  prompt: string
  options: string[]
  timeLimit: number
  approved: boolean
}

export interface AnswerKey {
  questionId: string
  quizId: string
  ownerId: string
  correctIndex: number
  explanation: string
  sourceQuote: string
  sourceUrl?: string
}

export interface Generation {
  userId: string
  quizId: string
  jobId?: string
  sourceType: SourceType
  /** Wikipedia topics as typed (sourceType `wikipedia`). */
  topics?: string[]
  /** Pasted notes (sourceType `notes`). Owner-only, like the whole row. */
  notes?: string
  difficulty: Difficulty
  questionCount: number
  /** Set when this run regenerates one question in place. */
  replaceQuestionId?: string
  model: string
  promptVersion: string
  status: GenerationStatus
  /** What the running job is doing, for the progress line. */
  stage?: GenerationStage
  /** Stamped by the running job every few seconds; a silent run is treated as dead. */
  heartbeatAt?: number
  droppedCount: number
  inputTokens?: number
  outputTokens?: number
  error?: string
  completedAt?: number
}

export interface Room {
  quizId: string
  code: string
  hostId: string
  coHostIds: string[]
  status: RoomStatus
  currentRoundId?: string
  startedAt?: number
  completedAt?: number
}

export interface Round {
  roomId: string
  questionId: string
  roundNumber: number
  status: RoundStatus
  startedAt: number
  deadline: number
  /** The question's time limit, copied at start; pauses shift `deadline`, not this. */
  timeLimitMs: number
  remainingMs?: number
  revealedAt?: number
  correctIndex?: number
  explanation?: string
  sourceQuote?: string
  sourceUrl?: string
  distribution?: number[]
}

export interface RoomPlayer {
  roomId: string
  userId: string
  displayName: string
  removed: boolean
  joinedAt: number
  firstRoundNumber: number
}

export interface Answer {
  roomId: string
  roundId: string
  questionId: string
  userId: string
  choiceIndex: number
  correct: boolean
  points: number
  answerMs: number
}

export interface Standing {
  roomId: string
  userId: string
  score: number
  correctCount: number
  correctMs: number
  rank: number
}
