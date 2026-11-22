/**
 * Everything a room screen renders from, as live queries: the room, its
 * quiz and questions, players, rounds, standings, the viewer's own answers,
 * the latest poll and the viewer's votes and "confused" flags, who's online
 * (and their reactions) and what the viewer is in it. Screens derive from this
 * alone, which is what makes refresh/reconnect recover (docs/trd.md §5).
 *
 * Permissions decide what arrives: `answers` holds only the viewer's own
 * rows, and a round's reveal fields are empty until the server reveals it.
 */

import { useCallback, useMemo } from 'react'
import { usePresenceRoom, useQuery, useUser } from 'deepspace'
import type {
  Answer,
  Poll,
  PollVote,
  Question,
  Quiz,
  Room,
  RoomPlayer,
  Round,
  RoundFlag,
  Standing,
} from '@/schemas/game-types'

export type RoomRole = 'host' | 'co-host' | 'player' | 'removed' | 'outsider'

/** Presence scope for a room's lobby and game screens. */
export const presenceScope = (roomId: string) => `room:${roomId}`

export function useRoom(roomId: string) {
  const { user } = useUser()
  const rooms = useQuery<Room>('rooms', { where: { recordId: roomId }, limit: 1 })
  const room = rooms.records[0]
  const quizId = room?.data.quizId ?? ''
  const quizzes = useQuery<Quiz>('quizzes', { where: { recordId: quizId }, limit: 1 })
  const questions = useQuery<Question>('questions', { where: { quizId } })
  const players = useQuery<RoomPlayer>('room_players', {
    where: { roomId },
    orderBy: 'joinedAt',
    orderDir: 'asc',
  })
  const rounds = useQuery<Round>('rounds', { where: { roomId }, orderBy: 'roundNumber', orderDir: 'asc' })
  const standings = useQuery<Standing>('standings', { where: { roomId }, orderBy: 'rank', orderDir: 'asc' })
  const answers = useQuery<Answer>('answers', { where: { roomId, userId: user?.id ?? '' } })
  const polls = useQuery<Poll>('polls', { where: { roomId }, orderBy: 'createdAt', orderDir: 'desc', limit: 1 })
  const votes = useQuery<PollVote>('poll_votes', { where: { roomId, userId: user?.id ?? '' } })
  const flags = useQuery<RoundFlag>('round_flags', { where: { roomId, userId: user?.id ?? '' } })
  const presence = usePresenceRoom(presenceScope(roomId))

  const online = useMemo(() => {
    const ids = new Set(presence.peers.map((p) => p.userId))
    if (user && presence.connected) ids.add(user.id)
    return ids
  }, [presence.peers, presence.connected, user])

  const active = useMemo(() => players.records.filter((p) => !p.data.removed), [players.records])
  const names = useMemo(
    () => new Map(players.records.map((p) => [p.data.userId, p.data.displayName])),
    [players.records],
  )
  const questionsById = useMemo(
    () => new Map(questions.records.map((q) => [q.recordId, q.data])),
    [questions.records],
  )
  const answersByRound = useMemo(
    () => new Map(answers.records.map((a) => [a.data.roundId, a.data])),
    [answers.records],
  )
  const myVotes = useMemo(
    () => new Map(votes.records.map((v) => [v.data.pollId, v.data.choiceIndex])),
    [votes.records],
  )
  const flaggedRounds = useMemo(() => new Set(flags.records.map((f) => f.data.roundId)), [flags.records])
  const { updateState } = presence
  const react = useCallback(
    (emoji: string) => updateState({ reaction: { emoji, id: crypto.randomUUID(), at: Date.now() } }),
    [updateState],
  )
  const me = players.records.find((p) => p.data.userId === user?.id)
  const round = rounds.records.find((r) => r.recordId === room?.data.currentRoundId)

  let role: RoomRole = 'outsider'
  if (room && user) {
    if (room.data.hostId === user.id) role = 'host'
    else if ((room.data.coHostIds ?? []).includes(user.id)) role = 'co-host'
    else if (me?.data.removed) role = 'removed'
    else if (me) role = 'player'
  }

  // On a dropped socket the SDK re-subscribes with status 'loading' but keeps
  // the last records, so only a first load (nothing yet) counts as loading;
  // a reconnect keeps showing the last screen under the banner.
  const firstLoad =
    (rooms.status === 'loading' && !room) || (players.status === 'loading' && players.records.length === 0)

  return {
    status: firstLoad ? 'loading' : 'ready',
    room,
    quiz: quizzes.records[0],
    players: active,
    names,
    me,
    role,
    online,
    userId: user?.id,
    rounds: rounds.records,
    round,
    question: round ? questionsById.get(round.data.questionId) : undefined,
    questionsById,
    approvedCount: questions.records.filter((q) => q.data.approved).length,
    standings: standings.records.map((s) => s.data),
    answersByRound,
    /** The room's latest poll, open or closed. */
    poll: polls.records[0],
    myVotes,
    flaggedRounds,
    /** Peers' presence, for reactions; the viewer's own reactions aren't echoed back. */
    peers: presence.peers,
    /** Sends an emoji reaction to everyone in the room (presence only; nothing stored). */
    react,
  } as const
}

export type RoomState = ReturnType<typeof useRoom>
