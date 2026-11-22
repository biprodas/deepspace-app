/**
 * Live polls and "still confused" flags (docs/features.md F12). The host
 * (or a co-host) asks; players answer. Votes are private rows; what everyone
 * sees is the poll's `counts`, recomputed from all votes on every vote, the
 * same way standings are recomputed rather than incremented.
 */

import type { ActionTools } from 'deepspace/worker'
import { z } from 'zod'
import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS, POLL_OPTION_MAX, POLL_QUESTION_MAX } from '../lib/game-rules'
import { tallyVotes } from '../lib/polls'
import { POLL_KINDS, type Poll, type PollVote, type Room, type RoomPlayer, type Round, type RoundFlag } from '../schemas/game-types'
import {
  ActionError,
  defineAction,
  getRecord,
  isClosed,
  isDuplicate,
  queryRecords,
  recordId,
  requireHostOrCoHost,
  unwrap,
  type Rec,
} from './shared'

/** The caller's player row in a room; hosts, co-hosts and removed players are refused. */
async function requirePlayer(tools: ActionTools, roomId: string, userId: string): Promise<Rec<RoomPlayer>> {
  const [player] = await queryRecords<RoomPlayer>(tools, 'room_players', { roomId, userId }, { limit: 1 })
  if (!player || player.data.removed) throw new ActionError('You’re not playing in this game', 'not_a_player')
  return player
}

function requireOpenRoom(room: Rec<Room>) {
  if (isClosed(room.data)) throw new ActionError('This game has finished', 'room_closed')
}

async function closeOpenPolls(tools: ActionTools, roomId: string) {
  const open = (await queryRecords<Poll>(tools, 'polls', { roomId })).filter((p) => p.data.status === 'open')
  const closedAt = Date.now()
  for (const poll of open) unwrap(await tools.update('polls', poll.recordId, { status: 'closed', closedAt }))
}

const pollText = (max: number) => z.string().trim().min(1).max(max)

/** Opens a poll; any poll already open in the room closes first. */
const createPoll = defineAction(
  z.object({
    roomId: recordId,
    question: pollText(POLL_QUESTION_MAX),
    options: z.array(pollText(POLL_OPTION_MAX)).min(POLL_MIN_OPTIONS).max(POLL_MAX_OPTIONS),
    kind: z.enum(POLL_KINDS).default('poll'),
  }),
  async ({ userId, tools }, p) => {
    const room = await getRecord<Room>(tools, 'rooms', p.roomId, 'Room')
    requireHostOrCoHost(room, userId)
    requireOpenRoom(room)
    if (new Set(p.options.map((o) => o.toLowerCase())).size !== p.options.length) {
      throw new ActionError('Each option must be different', 'invalid_params')
    }

    await closeOpenPolls(tools, p.roomId)
    const poll: Poll = {
      roomId: p.roomId,
      question: p.question,
      options: p.options,
      kind: p.kind,
      status: 'open',
      createdBy: userId,
      counts: Array<number>(p.options.length).fill(0),
      createdAt: Date.now(),
    }
    const { recordId: pollId } = unwrap(await tools.create('polls', { ...poll }))
    return { pollId }
  },
)

/** Casts or changes the caller's vote while the poll is open. */
const votePoll = defineAction(
  z.object({ pollId: recordId, choiceIndex: z.number().int().min(0).max(POLL_MAX_OPTIONS - 1) }),
  async ({ userId, tools }, p) => {
    const poll = await getRecord<Poll>(tools, 'polls', p.pollId, 'Poll')
    if (poll.data.status !== 'open') throw new ActionError('This poll has closed', 'poll_closed')
    if (p.choiceIndex >= poll.data.options.length) throw new ActionError('That isn’t one of the options', 'invalid_params')
    await requirePlayer(tools, poll.data.roomId, userId)

    const [existing] = await queryRecords<PollVote>(tools, 'poll_votes', { pollId: p.pollId, userId }, { limit: 1 })
    if (existing) {
      if (existing.data.choiceIndex !== p.choiceIndex) {
        unwrap(await tools.update('poll_votes', existing.recordId, { choiceIndex: p.choiceIndex }))
      }
    } else {
      const vote: PollVote = { pollId: p.pollId, roomId: poll.data.roomId, userId, choiceIndex: p.choiceIndex }
      const created = await tools.create('poll_votes', { ...vote })
      if (isDuplicate(created)) {
        // A double tap raced us to the row; make it hold this choice.
        const [raced] = await queryRecords<PollVote>(tools, 'poll_votes', { pollId: p.pollId, userId }, { limit: 1 })
        if (raced) unwrap(await tools.update('poll_votes', raced.recordId, { choiceIndex: p.choiceIndex }))
      } else {
        unwrap(created)
      }
    }

    const votes = await queryRecords<PollVote>(tools, 'poll_votes', { pollId: p.pollId }, { limit: 1000 })
    const counts = tallyVotes(
      votes.map((v) => v.data.choiceIndex),
      poll.data.options.length,
    )
    unwrap(await tools.update('polls', p.pollId, { counts }))
    return { pollId: p.pollId, choiceIndex: p.choiceIndex }
  },
)

const closePoll = defineAction(z.object({ pollId: recordId }), async ({ userId, tools }, p) => {
  const poll = await getRecord<Poll>(tools, 'polls', p.pollId, 'Poll')
  const room = await getRecord<Room>(tools, 'rooms', poll.data.roomId, 'Room')
  requireHostOrCoHost(room, userId)
  if (poll.data.status === 'open') {
    unwrap(await tools.update('polls', p.pollId, { status: 'closed', closedAt: Date.now() }))
  }
  return { pollId: p.pollId }
})

/** A player marks a revealed question "still confused". Idempotent. */
const flagConfused = defineAction(z.object({ roundId: recordId }), async ({ userId, tools }, p) => {
  const round = await getRecord<Round>(tools, 'rounds', p.roundId, 'Question')
  if (round.data.status !== 'revealed') throw new ActionError('Wait for the answer first', 'invalid_state')
  const room = await getRecord<Room>(tools, 'rooms', round.data.roomId, 'Room')
  requireOpenRoom(room)
  await requirePlayer(tools, room.recordId, userId)

  const flag: RoundFlag = { roomId: room.recordId, roundId: p.roundId, userId }
  const created = await tools.create('round_flags', { ...flag })
  if (!isDuplicate(created)) unwrap(created)

  const flags = await queryRecords<RoundFlag>(tools, 'round_flags', { roundId: p.roundId }, { limit: 1000 })
  unwrap(await tools.update('rounds', p.roundId, { confusedCount: flags.length }))
  return { roundId: p.roundId, confusedCount: flags.length }
})

export const pollActions = {
  createPoll,
  votePoll,
  closePoll,
  flagConfused,
}
