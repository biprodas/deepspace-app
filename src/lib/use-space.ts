/**
 * Everything a study space screen renders from, live: the space, its active
 * members, who's online in it, and what the viewer is in it. The platform's
 * `'team'` rule decides what arrives: a non-member gets no space row at all.
 */

import { useMemo } from 'react'
import { usePresenceRoom, useQuery, useUser } from 'deepspace'
import type { Room } from '@/schemas/game-types'
import type { Space, TeamMember } from '@/schemas/space-types'

/** Presence scope for a space's screens. */
export const spacePresenceScope = (spaceId: string) => `space:${spaceId}`

export function useSpace(spaceId: string) {
  const { user } = useUser()
  const spaces = useQuery<Space>('spaces', { where: { recordId: spaceId }, limit: 1 })
  const members = useQuery<TeamMember>('team_members', {
    where: { teamId: spaceId },
    orderBy: 'joinedAt',
    orderDir: 'asc',
  })
  const rooms = useQuery<Room>('rooms', { where: { spaceId }, orderBy: 'createdAt', orderDir: 'desc', limit: 20 })
  const presence = usePresenceRoom(spacePresenceScope(spaceId))

  const space = spaces.records[0]
  const active = useMemo(() => members.records.filter((m) => m.data.status === 'active'), [members.records])
  const online = useMemo(() => {
    const ids = new Set(presence.peers.map((p) => p.userId))
    if (user && presence.connected) ids.add(user.id)
    return ids
  }, [presence.peers, presence.connected, user])

  const me = members.records.find((m) => m.data.userId === user?.id)
  const isMember = !!me && me.data.status === 'active'

  return {
    status: spaces.status === 'loading' && !space ? 'loading' : 'ready',
    space,
    members: active,
    me,
    isMember,
    isOwner: !!space && space.data.ownerId === user?.id,
    online,
    userId: user?.id,
    rooms: rooms.records,
  } as const
}

export type SpaceState = ReturnType<typeof useSpace>
