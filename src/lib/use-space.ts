/**
 * Everything a study space screen renders from, live: the space, its active
 * members, who's online in it and where (which note or board), and what the
 * viewer is in it. The platform's `'team'` rule decides what arrives: a
 * non-member gets no space row at all.
 *
 * Pass `location` on a note or board page: it's shared as presence state on
 * the space's scope, so others see who's working where. Nothing is stored.
 */

import { useEffect, useMemo } from 'react'
import { usePresenceRoom, useQuery, useUser } from 'deepspace'
import type { Room } from '@/schemas/game-types'
import type { Space, TeamMember } from '@/schemas/space-types'

/** Presence scope for a space's screens. */
export const spacePresenceScope = (spaceId: string) => `space:${spaceId}`

/** Where in a space someone is working. */
export interface SpaceLocation {
  kind: 'note' | 'board'
  id: string
  title: string
}

function readLocation(state: Record<string, unknown>): SpaceLocation | undefined {
  const l = state.location as Partial<SpaceLocation> | null | undefined
  return l && (l.kind === 'note' || l.kind === 'board') && typeof l.id === 'string'
    ? { kind: l.kind, id: l.id, title: typeof l.title === 'string' ? l.title : '' }
    : undefined
}

export function useSpace(spaceId: string, location?: SpaceLocation) {
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

  // Online members' locations (the viewer's own included), by user id.
  const locations = useMemo(() => {
    const map = new Map<string, SpaceLocation>()
    for (const p of presence.peers) {
      const l = readLocation(p.state)
      if (l) map.set(p.userId, l)
    }
    if (user && location) map.set(user.id, location)
    return map
  }, [presence.peers, user, location])

  // Share where the viewer is; a new object with the same values doesn't resend.
  // Sent again once connected: an update made before the socket opens is dropped,
  // and a reconnect starts from empty state.
  const { updateState, connected } = presence
  const kind = location?.kind
  const id = location?.id
  const title = location?.title
  useEffect(() => {
    if (!connected) return
    updateState({ location: kind && id ? { kind, id, title: title ?? '' } : null })
  }, [connected, kind, id, title, updateState])

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
    locations,
    /** Where the viewer is, when on a note or board. */
    here: location,
    userId: user?.id,
    rooms: rooms.records,
  } as const
}

export type SpaceState = ReturnType<typeof useSpace>
