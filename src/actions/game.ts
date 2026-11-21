/**
 * The live game, run by the server (docs/features.md F4–F6, docs/trd.md
 * §5–6). The client is never trusted with the answer, the clock or the
 * score:
 *  - the deadline is set here from the server clock and checked here;
 *  - answers are scored here against `answer_keys` (owner-only);
 *  - reveal fields reach players only when `revealQuestion` copies them
 *    onto the round, after the deadline.
 *
 * State machine (docs/trd.md §5):
 *   lobby ─start→ question ─reveal→ reveal ─start→ question … → final
 *   question ⇄ paused; question ─skip→ question (or final); any → cancelled
 */

import type { ActionTools } from 'deepspace/worker'
import { z } from 'zod'
import { GRACE_MS, OPTION_COUNT } from '../lib/game-rules'
import { computeStandings, elapsedMs, points } from '../lib/scoring'
import type {
  Answer,
  AnswerKey,
  Question,
  Room,
  RoomPlayer,
  RoomStatus,
  Round,
  Standing,
} from '../schemas/game-types'
import {
  ActionError,
  defineAction,
  getRecord,
  isDuplicate,
  isHostOrCoHost,
  queryRecords,
  recordId,
  requireHostOrCoHost,
  unwrap,
  type Rec,
} from './shared'

const roomParams = z.object({ roomId: recordId })

// ─── Helpers ─────────────────────────────────────────────

function requireStatus(room: Rec<Room>, ...allowed: RoomStatus[]) {
  if (!allowed.includes(room.data.status)) {
    throw new ActionError(`Not possible while the game is ${room.data.status}`, 'invalid_state')
  }
}

async function loadHostedRoom(tools: ActionTools, roomId: string, userId: string) {
  const room = await getRecord<Room>(tools, 'rooms', roomId, 'Room')
  requireHostOrCoHost(room, userId)
  return room
}

async function currentRound(tools: ActionTools, room: Rec<Room>): Promise<Rec<Round>> {
  if (!room.data.currentRoundId) throw new ActionError('No question is running', 'invalid_state')
  return getRecord<Round>(tools, 'rounds', room.data.currentRoundId, 'Round')
}

/** Approved questions not yet played in this room, in quiz order. */
async function remainingQuestions(tools: ActionTools, room: Rec<Room>) {
  const [questions, rounds] = await Promise.all([
    queryRecords<Question>(tools, 'questions', { quizId: room.data.quizId }, { orderBy: 'order', orderDir: 'asc' }),
    queryRecords<Round>(tools, 'rounds', { roomId: room.recordId }),
  ])
  const played = new Set(rounds.map((r) => r.data.questionId))
  return {
    remaining: questions.filter((q) => q.data.approved && !played.has(q.recordId)),
    roundCount: rounds.length,
  }
}

async function answerKeyFor(tools: ActionTools, questionId: string): Promise<AnswerKey> {
  const [key] = await queryRecords<AnswerKey>(tools, 'answer_keys', { questionId }, { limit: 1 })
  if (!key) throw new ActionError('This question has no answer key', 'not_found')
  return key.data
}

/**
 * Creates the next round and moves the room to `question`. A double click
 * (or two co-hosts at once) can't start two rounds: the second create hits
 * `uniqueOn [roomId, roundNumber]`.
 */
async function startNextRound(tools: ActionTools, room: Rec<Room>) {
  const { remaining, roundCount } = await remainingQuestions(tools, room)
  const question = remaining[0]
  if (!question) return null

  const now = Date.now()
  const timeLimitMs = question.data.timeLimit * 1000
  const round: Round = {
    roomId: room.recordId,
    questionId: question.recordId,
    roundNumber: roundCount + 1,
    status: 'active',
    startedAt: now,
    deadline: now + timeLimitMs,
    timeLimitMs,
  }
  const result = await tools.create('rounds', { ...round })
  if (isDuplicate(result)) throw new ActionError('That question has already started', 'already_started')
  const { recordId: roundId } = unwrap(result)

  unwrap(
    await tools.update('rooms', room.recordId, {
      status: 'question',
      currentRoundId: roundId,
      ...(room.data.startedAt ? {} : { startedAt: now }),
    }),
  )
  return { roundId, deadline: round.deadline }
}

/**
 * Rewrites the room's standings from its answers on revealed rounds.
 * Recomputed from scratch every time, so a retried reveal can't
 * double-count, and skipped rounds never score.
 */
async function recomputeStandings(tools: ActionTools, roomId: string) {
  const [players, answers, rounds, existing] = await Promise.all([
    queryRecords<RoomPlayer>(tools, 'room_players', { roomId }),
    queryRecords<Answer>(tools, 'answers', { roomId }, { limit: 5000 }),
    queryRecords<Round>(tools, 'rounds', { roomId }),
    queryRecords<Standing>(tools, 'standings', { roomId }),
  ])
  const revealed = new Set(rounds.filter((r) => r.data.status === 'revealed').map((r) => r.recordId))
  const standings = computeStandings(
    players.map((p) => p.data),
    answers.filter((a) => revealed.has(a.data.roundId)).map((a) => a.data),
  )

  const byUser = new Map(existing.map((s) => [s.data.userId, s]))
  await Promise.all(
    standings.map((s) => {
      const row = byUser.get(s.userId)
      byUser.delete(s.userId)
      return row
        ? tools.update('standings', row.recordId, { ...s })
        : tools.create('standings', { roomId, ...s })
    }),
  )
  // Rows left over belong to players removed since the last reveal.
  await Promise.all([...byUser.values()].map((row) => tools.remove('standings', row.recordId)))
}

async function finish(tools: ActionTools, roomId: string) {
  unwrap(
    await tools.update('rooms', roomId, {
      status: 'final',
      currentRoundId: null,
      completedAt: Date.now(),
    }),
  )
}

// ─── Actions ─────────────────────────────────────────────

/** Returns `serverNow` (added by `defineAction`) for clock-offset sync (docs/trd.md §7). */
const getServerTime = defineAction(z.object({}), async () => ({}))

/** Starts the next approved question, from the lobby or after a reveal. */
const startQuestion = defineAction(roomParams, async ({ userId, tools }, p) => {
  const room = await loadHostedRoom(tools, p.roomId, userId)
  requireStatus(room, 'lobby', 'reveal')
  const started = await startNextRound(tools, room)
  if (!started) {
    if (room.data.status === 'lobby') {
      throw new ActionError('This quiz has no approved questions', 'no_approved_questions')
    }
    await finish(tools, room.recordId)
    return { status: 'final' as const }
  }
  return { status: 'question' as const, ...started }
})

/**
 * A player's answer to the current question. The first one counts; scored
 * now, against the server's receive time, but players only learn whether
 * they were right at reveal.
 */
const submitAnswer = defineAction(
  z.object({ roundId: recordId, choiceIndex: z.number().int().min(0).max(OPTION_COUNT - 1) }),
  async ({ userId, tools }, p) => {
    const receivedAt = Date.now()
    const round = await getRecord<Round>(tools, 'rounds', p.roundId, 'Question')
    const room = await getRecord<Room>(tools, 'rooms', round.data.roomId, 'Room')

    if (isHostOrCoHost(room, userId)) {
      throw new ActionError('Hosts can see the answers, so they can’t play', 'host_cannot_answer')
    }
    const [player] = await queryRecords<RoomPlayer>(
      tools,
      'room_players',
      { roomId: room.recordId, userId },
      { limit: 1 },
    )
    if (!player || player.data.removed) throw new ActionError('You’re not playing in this game', 'not_a_player')
    if (room.data.status !== 'question') {
      throw new ActionError('Answers aren’t open right now', 'not_accepting')
    }
    if (room.data.currentRoundId !== round.recordId || round.data.status !== 'active') {
      throw new ActionError('That question is over', 'not_current')
    }
    if (round.data.roundNumber < player.data.firstRoundNumber) {
      throw new ActionError('You joined mid-question; you’re in from the next one', 'joined_late')
    }
    if (receivedAt > round.data.deadline + GRACE_MS) {
      throw new ActionError('Time’s up: your answer arrived after the deadline', 'too_late')
    }

    const key = await answerKeyFor(tools, round.data.questionId)
    const correct = key.correctIndex === p.choiceIndex
    const answerMs = elapsedMs(round.data, receivedAt)
    const answer: Answer = {
      roomId: room.recordId,
      roundId: round.recordId,
      questionId: round.data.questionId,
      userId,
      choiceIndex: p.choiceIndex,
      correct,
      points: points(correct, answerMs, round.data.timeLimitMs),
      answerMs,
    }
    const result = await tools.create('answers', { ...answer })
    if (isDuplicate(result)) throw new ActionError('You’ve already answered this one', 'already_answered')
    unwrap(result)
    // No correctness here: that would reveal the answer early.
    return { locked: true, choiceIndex: p.choiceIndex }
  },
)

/**
 * After the deadline (and the grace window, so no late-but-valid answer
 * lands after the reveal), publishes the answer on the round and
 * recomputes standings. The last question ends the game.
 */
const revealQuestion = defineAction(roomParams, async ({ userId, tools }, p) => {
  const room = await loadHostedRoom(tools, p.roomId, userId)
  requireStatus(room, 'question')
  const round = await currentRound(tools, room)
  if (round.data.status !== 'active') throw new ActionError('Already revealed', 'invalid_state')
  const now = Date.now()
  if (now < round.data.deadline + GRACE_MS) {
    throw new ActionError('Wait for the timer to run out', 'too_early')
  }

  const [key, answers] = await Promise.all([
    answerKeyFor(tools, round.data.questionId),
    queryRecords<Answer>(tools, 'answers', { roundId: round.recordId }),
  ])
  const distribution = Array<number>(OPTION_COUNT).fill(0)
  for (const a of answers) distribution[a.data.choiceIndex] += 1

  unwrap(
    await tools.update('rounds', round.recordId, {
      status: 'revealed',
      revealedAt: now,
      correctIndex: key.correctIndex,
      explanation: key.explanation,
      sourceQuote: key.sourceQuote,
      sourceUrl: key.sourceUrl ?? null,
      distribution,
    }),
  )
  await recomputeStandings(tools, room.recordId)

  const { remaining } = await remainingQuestions(tools, room)
  if (remaining.length === 0) {
    await finish(tools, room.recordId)
    return { status: 'final' as const }
  }
  unwrap(await tools.update('rooms', room.recordId, { status: 'reveal' }))
  return { status: 'reveal' as const }
})

/** Drops the current question without scoring it and moves straight on. */
const skipQuestion = defineAction(roomParams, async ({ userId, tools }, p) => {
  const room = await loadHostedRoom(tools, p.roomId, userId)
  requireStatus(room, 'question', 'paused')
  const round = await currentRound(tools, room)
  unwrap(await tools.update('rounds', round.recordId, { status: 'skipped', remainingMs: null }))

  const started = await startNextRound(tools, room)
  if (started) return { status: 'question' as const, ...started }
  await recomputeStandings(tools, room.recordId)
  await finish(tools, room.recordId)
  return { status: 'final' as const }
})

/** Freezes the clock: stores the time left on the round. */
const pauseRoom = defineAction(roomParams, async ({ userId, tools }, p) => {
  const room = await loadHostedRoom(tools, p.roomId, userId)
  requireStatus(room, 'question')
  const round = await currentRound(tools, room)
  const remainingMs = round.data.deadline - Date.now()
  if (remainingMs <= 0) throw new ActionError('Time’s already up; reveal instead', 'deadline_passed')

  unwrap(await tools.update('rounds', round.recordId, { remainingMs }))
  unwrap(await tools.update('rooms', room.recordId, { status: 'paused' }))
  return { remainingMs }
})

/** Restarts the clock with the stored time left. */
const resumeRoom = defineAction(roomParams, async ({ userId, tools }, p) => {
  const room = await loadHostedRoom(tools, p.roomId, userId)
  requireStatus(room, 'paused')
  const round = await currentRound(tools, room)
  const deadline = Date.now() + (round.data.remainingMs ?? 0)

  unwrap(await tools.update('rounds', round.recordId, { deadline, remainingMs: null }))
  unwrap(await tools.update('rooms', room.recordId, { status: 'question' }))
  return { deadline }
})

export const gameActions = {
  getServerTime,
  startQuestion,
  submitAnswer,
  revealQuestion,
  skipQuestion,
  pauseRoom,
  resumeRoom,
}
