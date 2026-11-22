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
export const INVITE_STATUSES = ['pending', 'accepted', 'dismissed'] as const
export const POLL_KINDS = ['poll', 'confidence'] as const
export const POLL_STATUSES = ['open', 'closed'] as const

export type SourceType = (typeof SOURCE_TYPES)[number]
export type Difficulty = (typeof DIFFICULTIES)[number]
export type QuizStatus = (typeof QUIZ_STATUSES)[number]
export type GenerationStatus = (typeof GENERATION_STATUSES)[number]
export type GenerationStage = (typeof GENERATION_STAGES)[number]
export type RoomStatus = (typeof ROOM_STATUSES)[number]
export type RoundStatus = (typeof ROUND_STATUSES)[number]
export type InviteStatus = (typeof INVITE_STATUSES)[number]
export type PollKind = (typeof POLL_KINDS)[number]
export type PollStatus = (typeof POLL_STATUSES)[number]

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
  /** The study space this game belongs to, if any. */
  spaceId?: string
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
  /** Players who flagged this reveal "still confused"; recomputed from `round_flags`. */
  confusedCount?: number
}

/** "Still confused" on one revealed round, once per player. */
export interface RoundFlag {
  roomId: string
  roundId: string
  userId: string
}

/**
 * A live poll the host runs in a room. One poll is open at a time; `counts`
 * is recomputed from `poll_votes` on every vote, which stay private.
 */
export interface Poll {
  roomId: string
  question: string
  options: string[]
  kind: PollKind
  status: PollStatus
  createdBy: string
  counts: number[]
  createdAt: number
  closedAt?: number
}

export interface PollVote {
  pollId: string
  roomId: string
  userId: string
  choiceIndex: number
}

export interface RoomPlayer {
  roomId: string
  userId: string
  displayName: string
  removed: boolean
  joinedAt: number
  firstRoundNumber: number
}

/**
 * A host's invitation to one person, by account or email. Readable only by
 * the invitee (matched by account); an email-only invite is delivered by
 * email alone. Host name, quiz title and code are copied in so the invite
 * card needs no further reads.
 */
export interface RoomInvite {
  roomId: string
  code: string
  quizTitle: string
  invitedBy: string
  inviterName: string
  /** Who, once per room: the lower-cased email, or `user:<id>` for an account without one. */
  key: string
  /** Lower-cased; where the invite email went. */
  email?: string
  /** The invitee's account, when picked or when the email belongs to one. */
  inviteeId?: string
  status: InviteStatus
  invitedAt: number
  emailSent: boolean
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

/** All-time totals per player over finished games, maintained by the server. */
export interface LeaderboardEntry {
  userId: string
  displayName: string
  totalScore: number
  games: number
  wins: number
  correctAnswers: number
  /** Rooms already counted, so a repeated finish never double-counts. */
  roomIds: string[]
}
