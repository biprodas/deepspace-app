/**
 * Rooms and the lobby (docs/features.md F3, F9). A room is one live session
 * of a quiz; its host is the quiz owner who opened it. Co-hosts help run the
 * game but, like the host, never play.
 */

import type { ActionTools } from 'deepspace/worker'
import { z } from 'zod'
import { MAX_PLAYERS } from '../lib/game-rules'
import { mintJoinCode, parseJoinCode } from '../lib/join-code'
import type { Question, Quiz, Room, RoomPlayer, Round } from '../schemas/game-types'
import {
  ActionError,
  defineAction,
  getRecord,
  isDuplicate,
  isClosed,
  isHostOrCoHost,
  queryRecords,
  recordId,
  requireHost,
  requireQuizOwner,
  unwrap,
  type Rec,
} from './shared'

const CODE_ATTEMPTS = 5

function requireOpen(room: Rec<Room>) {
  if (isClosed(room.data)) throw new ActionError('This game has finished', 'room_closed')
}

async function findPlayer(tools: ActionTools, roomId: string, userId: string) {
  const [player] = await queryRecords<RoomPlayer>(tools, 'room_players', { roomId, userId }, { limit: 1 })
  return player as Rec<RoomPlayer> | undefined
}

async function displayName(tools: ActionTools, userId: string): Promise<string> {
  const result = await tools.get('users', userId)
  const name = result.success ? (result.data.record.data as { name?: unknown }).name : undefined
  return typeof name === 'string' && name.trim() ? name.trim().slice(0, 60) : 'Player'
}

/** Late joiners start at the round after the latest one (docs/features.md F7). */
async function nextRoundNumber(tools: ActionTools, roomId: string): Promise<number> {
  const [latest] = await queryRecords<Round>(
    tools,
    'rounds',
    { roomId },
    { orderBy: 'roundNumber', orderDir: 'desc', limit: 1 },
  )
  return (latest?.data.roundNumber ?? 0) + 1
}

// ─── Actions ─────────────────────────────────────────────

/**
 * Opens a lobby for an owned quiz with at least one approved question. If
 * the host already has an open game of this quiz, that one is returned
 * instead: pressing "Host a game" again must not strand players who joined
 * the first code in a room the host has left.
 */
const createRoom = defineAction(z.object({ quizId: recordId }), async ({ userId, tools }, p) => {
  const quiz = await getRecord<Quiz>(tools, 'quizzes', p.quizId, 'Quiz')
  requireQuizOwner(quiz, userId)
  // Oldest first: that's the code players most likely already have.
  const [open] = (
    await queryRecords<Room>(tools, 'rooms', { quizId: p.quizId, hostId: userId }, { orderBy: 'createdAt', orderDir: 'asc' })
  ).filter((r) => !isClosed(r.data))
  if (open) return { roomId: open.recordId, code: open.data.code, reused: true }
  if (quiz.data.status !== 'ready') {
    throw new ActionError('This quiz isn’t ready yet', 'quiz_not_ready')
  }
  // Booleans are stored as numbers, so filter here rather than in `where`.
  const questions = await queryRecords<Question>(tools, 'questions', { quizId: p.quizId })
  if (!questions.some((q) => q.data.approved)) {
    throw new ActionError('Approve at least one question first', 'no_approved_questions')
  }

  // Codes are random; a clash with an existing room is refused by `uniqueOn`.
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const room: Room = {
      quizId: p.quizId,
      code: mintJoinCode(),
      hostId: userId,
      coHostIds: [],
      status: 'lobby',
    }
    const result = await tools.create('rooms', { ...room })
    if (isDuplicate(result)) continue
    const { recordId: roomId } = unwrap(result)
    return { roomId, code: room.code, reused: false }
  }
  throw new ActionError('Couldn’t pick a free room code, try again', 'code_exhausted')
})

/**
 * Joins by code. Idempotent: a returning player (or the host / a co-host)
 * gets their room back. Refuses removed players, full rooms and finished
 * games.
 */
const joinRoom = defineAction(z.object({ code: z.string().max(200) }), async ({ userId, tools }, p) => {
  const code = parseJoinCode(p.code)
  if (!code) throw new ActionError('Codes are 6 letters or numbers, like K7QX9P', 'invalid_code')

  const [room] = await queryRecords<Room>(tools, 'rooms', { code }, { limit: 1 })
  if (!room) throw new ActionError('No game with that code', 'not_found')
  const roomId = room.recordId

  if (isHostOrCoHost(room, userId)) return { roomId, role: 'host' as const }

  const existing = await findPlayer(tools, roomId, userId)
  if (existing?.data.removed) {
    throw new ActionError('The host removed you from this game', 'removed')
  }
  if (existing) return { roomId, role: 'player' as const }

  requireOpen(room)
  const players = await queryRecords<RoomPlayer>(tools, 'room_players', { roomId })
  if (players.filter((pl) => !pl.data.removed).length >= MAX_PLAYERS) {
    throw new ActionError(`This game is full (${MAX_PLAYERS} players)`, 'room_full')
  }

  const player: RoomPlayer = {
    roomId,
    userId,
    displayName: await displayName(tools, userId),
    removed: false,
    joinedAt: Date.now(),
    firstRoundNumber: room.data.status === 'lobby' ? 1 : await nextRoundNumber(tools, roomId),
  }
  const result = await tools.create('room_players', { ...player })
  // A double-click raced us to the same row: the first one counts.
  if (!isDuplicate(result)) unwrap(result)
  return { roomId, role: 'player' as const }
})

/** Removes a player for good: `joinRoom` refuses them from now on. */
const removePlayer = defineAction(
  z.object({ roomId: recordId, userId: recordId }),
  async ({ userId, tools }, p) => {
    const room = await getRecord<Room>(tools, 'rooms', p.roomId, 'Room')
    requireHost(room, userId)
    requireOpen(room)
    const player = await findPlayer(tools, p.roomId, p.userId)
    if (!player) throw new ActionError('That player isn’t in this game', 'not_found')
    if (!player.data.removed) unwrap(await tools.update('room_players', player.recordId, { removed: true }))
    return { roomId: p.roomId }
  },
)

/**
 * Promotes a lobby player to co-host. Co-hosts can't answer, so their player
 * row goes; this is only allowed before the game starts, while they have no
 * answers to lose.
 */
const addCoHost = defineAction(
  z.object({ roomId: recordId, userId: recordId }),
  async ({ userId, tools }, p) => {
    const room = await getRecord<Room>(tools, 'rooms', p.roomId, 'Room')
    requireHost(room, userId)
    if (room.data.status !== 'lobby') {
      throw new ActionError('Add co-hosts before the game starts', 'invalid_state')
    }
    const player = await findPlayer(tools, p.roomId, p.userId)
    if (!player || player.data.removed) {
      throw new ActionError('Only a player in the lobby can become a co-host', 'not_found')
    }
    const coHostIds = [...new Set([...(room.data.coHostIds ?? []), p.userId])]
    unwrap(await tools.update('rooms', p.roomId, { coHostIds }))
    unwrap(await tools.remove('room_players', player.recordId))
    return { roomId: p.roomId }
  },
)

/** Drops a co-host. They can rejoin with the code as a player (from the next round). */
const removeCoHost = defineAction(
  z.object({ roomId: recordId, userId: recordId }),
  async ({ userId, tools }, p) => {
    const room = await getRecord<Room>(tools, 'rooms', p.roomId, 'Room')
    requireHost(room, userId)
    const coHostIds = (room.data.coHostIds ?? []).filter((id) => id !== p.userId)
    unwrap(await tools.update('rooms', p.roomId, { coHostIds }))
    return { roomId: p.roomId }
  },
)

/**
 * Ends the game from any open state (docs/trd.md §5). Results so far are
 * kept; the room is closed to joins and the quiz can be edited again.
 */
const endRoom = defineAction(z.object({ roomId: recordId }), async ({ userId, tools }, p) => {
  const room = await getRecord<Room>(tools, 'rooms', p.roomId, 'Room')
  requireHost(room, userId)
  requireOpen(room)
  unwrap(await tools.update('rooms', p.roomId, { status: 'cancelled', completedAt: Date.now() }))
  return { roomId: p.roomId }
})

export const roomActions = {
  createRoom,
  joinRoom,
  removePlayer,
  addCoHost,
  removeCoHost,
  endRoom,
}
