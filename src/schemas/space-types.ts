/**
 * Study spaces (docs/features.md F13): a group's long-lived home. A space is
 * a DeepSpace *team*: its rows carry `teamId` and are readable only by active
 * rows in `team_members` (the SDK's `'team'` permission rule), so non-members
 * never receive them. Times are epoch milliseconds.
 */

export const MEMBER_ROLES = ['owner', 'member'] as const
export const MEMBER_STATUSES = ['active', 'removed'] as const

export type MemberRole = (typeof MEMBER_ROLES)[number]
export type MemberStatus = (typeof MEMBER_STATUSES)[number]

export interface Space {
  name: string
  description?: string
  ownerId: string
  /** Join code, like a room's (src/lib/join-code.ts). */
  code: string
  /** The space's own record id; the `'team'` rule matches members against it. */
  teamId: string
  createdAt: number
}

/**
 * Membership, in the collection the SDK's `'team'` rule reads. A member
 * counts while `status` is `active`; the owner removing someone sets
 * `removed`, which also keeps them from rejoining with the code. Leaving
 * deletes the row, so they can come back.
 */
export interface TeamMember {
  teamId: string
  userId: string
  displayName: string
  role: MemberRole
  status: MemberStatus
  joinedAt: number
}

/** Like a room invite, for a space. */
export interface SpaceInvite {
  spaceId: string
  code: string
  spaceName: string
  invitedBy: string
  inviterName: string
  key: string
  email?: string
  inviteeId?: string
  status: 'pending' | 'accepted' | 'dismissed'
  invitedAt: number
  emailSent: boolean
}
