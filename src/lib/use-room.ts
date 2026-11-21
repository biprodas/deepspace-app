/**
 * Everything a room screen renders from, as live queries: the room, its
 * quiz, its players, who's online and what the viewer is in it. Screens
 * derive from this alone, which is what makes refresh/reconnect recover
 * (docs/trd.md §5).
 */

import { useMemo } from 'react'
import { usePresenceRoom, useQuery, useUser } from 'deepspace'
import type { Quiz, Room, RoomPlayer } from '@/schemas/game-types'

export type RoomRole = 'host' | 'co-host' | 'player' | 'removed' | 'outsider'

/** Presence scope for a room's lobby and game screens. */
export const presenceScope = (roomId: string) => `room:${roomId}`

export function useRoom(roomId: string) {
  const { user } = useUser()
  const rooms = useQuery<Room>('rooms', { where: { recordId: roomId }, limit: 1 })
  const room = rooms.records[0]
  const quizzes = useQuery<Quiz>('quizzes', { where: { recordId: room?.data.quizId ?? '' }, limit: 1 })
  const players = useQuery<RoomPlayer>('room_players', {
    where: { roomId },
    orderBy: 'joinedAt',
    orderDir: 'asc',
  })
  const presence = usePresenceRoom(presenceScope(roomId))

  const online = useMemo(() => {
    const ids = new Set(presence.peers.map((p) => p.userId))
    if (user && presence.connected) ids.add(user.id)
    return ids
  }, [presence.peers, presence.connected, user])

  const active = useMemo(() => players.records.filter((p) => !p.data.removed), [players.records])
  const me = players.records.find((p) => p.data.userId === user?.id)

  let role: RoomRole = 'outsider'
  if (room && user) {
    if (room.data.hostId === user.id) role = 'host'
    else if ((room.data.coHostIds ?? []).includes(user.id)) role = 'co-host'
    else if (me?.data.removed) role = 'removed'
    else if (me) role = 'player'
  }

  return {
    status: rooms.status === 'loading' || players.status === 'loading' ? 'loading' : 'ready',
    room,
    quiz: quizzes.records[0],
    players: active,
    me,
    role,
    online,
    userId: user?.id,
  } as const
}
