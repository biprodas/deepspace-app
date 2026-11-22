/**
 * Study spaces (docs/features.md F13). The owner creates a space and shares
 * its code or invites people; members join, see each other, and host games
 * in it. Membership rows live in `team_members`, which the SDK's `'team'`
 * read rule uses, so these actions keep the rows right and everything else
 * is filtered by the platform.
 */

import type { ActionTools } from 'deepspace/worker'
import { z } from 'zod'
import {
  MAX_INVITES_PER_SPACE,
  MAX_OWNED_SPACES,
  MAX_SPACE_MEMBERS,
  SPACE_DESCRIPTION_MAX,
  SPACE_NAME_MAX,
} from '../lib/game-rules'
import { mintJoinCode, parseJoinCode, spaceJoinPath } from '../lib/join-code'
import type { Space, SpaceInvite, TeamMember } from '../schemas/space-types'
import { acceptInvites, deliverInvites, inviteTargetFields, resolveTargets, withTargetChecks } from './invite'
import { ActionError, defineAction, displayName, getRecord, isDuplicate, queryRecords, recordId, unwrap, type Rec } from './shared'

const CODE_ATTEMPTS = 5

// ─── Helpers ─────────────────────────────────────────────

export async function findMember(
  tools: ActionTools,
  spaceId: string,
  userId: string,
): Promise<Rec<TeamMember> | undefined> {
  const [member] = await queryRecords<TeamMember>(tools, 'team_members', { teamId: spaceId, userId }, { limit: 1 })
  return member
}

/** The caller's active membership, or a refusal. Other phases (notes, boards) reuse it. */
export async function requireMember(tools: ActionTools, spaceId: string, userId: string): Promise<Rec<TeamMember>> {
  const member = await findMember(tools, spaceId, userId)
  if (!member || member.data.status !== 'active') throw new ActionError('You’re not in this space', 'not_a_member')
  return member
}

function requireOwner(space: Rec<Space>, userId: string) {
  if (space.data.ownerId !== userId) throw new ActionError('Only the space owner can do that', 'forbidden')
}

const activeMembers = async (tools: ActionTools, spaceId: string) =>
  (await queryRecords<TeamMember>(tools, 'team_members', { teamId: spaceId })).filter((m) => m.data.status === 'active')

const spaceFields = {
  name: z.string().trim().min(1, 'Give the space a name').max(SPACE_NAME_MAX),
  description: z.string().trim().max(SPACE_DESCRIPTION_MAX).optional(),
}

// ─── Actions ─────────────────────────────────────────────

const createSpace = defineAction(z.object(spaceFields), async ({ userId, tools }, p) => {
  const owned = await queryRecords<Space>(tools, 'spaces', { ownerId: userId })
  if (owned.length >= MAX_OWNED_SPACES) {
    throw new ActionError(`You can own up to ${MAX_OWNED_SPACES} spaces`, 'space_limit')
  }

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const space: Space = {
      name: p.name,
      ...(p.description ? { description: p.description } : {}),
      ownerId: userId,
      code: mintJoinCode(),
      teamId: '',
      createdAt: Date.now(),
    }
    const result = await tools.create('spaces', { ...space })
    if (isDuplicate(result)) continue
    const { recordId: spaceId } = unwrap(result)
    // The team id is the space's own id; it can only be written once the id exists.
    unwrap(await tools.update('spaces', spaceId, { teamId: spaceId }))
    const owner: TeamMember = {
      teamId: spaceId,
      userId,
      displayName: await displayName(tools, userId),
      role: 'owner',
      status: 'active',
      joinedAt: Date.now(),
    }
    unwrap(await tools.create('team_members', { ...owner }))
    return { spaceId, code: space.code }
  }
  throw new ActionError('Couldn’t pick a free space code, try again', 'code_exhausted')
})

const updateSpace = defineAction(z.object({ spaceId: recordId, ...spaceFields }), async ({ userId, tools }, p) => {
  const space = await getRecord<Space>(tools, 'spaces', p.spaceId, 'Space')
  requireOwner(space, userId)
  unwrap(await tools.update('spaces', p.spaceId, { name: p.name, description: p.description ?? null }))
  return { spaceId: p.spaceId }
})

/** Deletes the space with its memberships and invites. Games played in it are kept. */
const deleteSpace = defineAction(z.object({ spaceId: recordId }), async ({ userId, tools }, p) => {
  const space = await getRecord<Space>(tools, 'spaces', p.spaceId, 'Space')
  requireOwner(space, userId)
  for (const m of await queryRecords<TeamMember>(tools, 'team_members', { teamId: p.spaceId })) {
    unwrap(await tools.remove('team_members', m.recordId))
  }
  for (const i of await queryRecords<SpaceInvite>(tools, 'space_invites', { spaceId: p.spaceId })) {
    unwrap(await tools.remove('space_invites', i.recordId))
  }
  unwrap(await tools.remove('spaces', p.spaceId))
  return { spaceId: p.spaceId }
})

/** Joins by code. Idempotent for members; refuses people the owner removed. */
const joinSpace = defineAction(z.object({ code: z.string().max(200) }), async ({ userId, tools }, p) => {
  const code = parseJoinCode(p.code)
  if (!code) throw new ActionError('Codes are 6 letters or numbers, like K7QX9P', 'invalid_code')
  const [space] = await queryRecords<Space>(tools, 'spaces', { code }, { limit: 1 })
  if (!space) throw new ActionError('No space with that code', 'not_found')
  const spaceId = space.recordId

  const existing = await findMember(tools, spaceId, userId)
  if (existing?.data.status === 'removed') {
    throw new ActionError('The owner removed you from this space', 'removed')
  }
  if (!existing) {
    if ((await activeMembers(tools, spaceId)).length >= MAX_SPACE_MEMBERS) {
      throw new ActionError(`This space is full (${MAX_SPACE_MEMBERS} members)`, 'space_full')
    }
    const member: TeamMember = {
      teamId: spaceId,
      userId,
      displayName: await displayName(tools, userId),
      role: 'member',
      status: 'active',
      joinedAt: Date.now(),
    }
    const result = await tools.create('team_members', { ...member })
    if (!isDuplicate(result)) unwrap(result)
  }
  await acceptInvites(tools, 'space_invites', { spaceId }, userId)
  return { spaceId }
})

/** A member leaves; they can rejoin with the code. The owner deletes instead. */
const leaveSpace = defineAction(z.object({ spaceId: recordId }), async ({ userId, tools }, p) => {
  const space = await getRecord<Space>(tools, 'spaces', p.spaceId, 'Space')
  if (space.data.ownerId === userId) {
    throw new ActionError('Owners can’t leave their space; delete it instead', 'owner_cannot_leave')
  }
  const member = await findMember(tools, p.spaceId, userId)
  if (member && member.data.status === 'active') unwrap(await tools.remove('team_members', member.recordId))
  return { spaceId: p.spaceId }
})

/** The owner removes a member for good; the code no longer lets them back in. */
const removeMember = defineAction(
  z.object({ spaceId: recordId, userId: recordId }),
  async ({ userId, tools }, p) => {
    const space = await getRecord<Space>(tools, 'spaces', p.spaceId, 'Space')
    requireOwner(space, userId)
    if (p.userId === userId) throw new ActionError('You can’t remove yourself', 'invalid_params')
    const member = await findMember(tools, p.spaceId, p.userId)
    if (!member) throw new ActionError('That person isn’t in this space', 'not_found')
    if (member.data.status !== 'removed') {
      unwrap(await tools.update('team_members', member.recordId, { status: 'removed' }))
    }
    return { spaceId: p.spaceId }
  },
)

/** Any member invites people to the space, the same way hosts invite to a game. */
const inviteToSpace = defineAction(
  withTargetChecks(z.object({ spaceId: recordId, ...inviteTargetFields })),
  async ({ userId, tools, env }, p) => {
    const space = await getRecord<Space>(tools, 'spaces', p.spaceId, 'Space')
    await requireMember(tools, p.spaceId, userId)

    const existing = await queryRecords<SpaceInvite>(tools, 'space_invites', { spaceId: p.spaceId })
    if (existing.length + p.userIds.length + p.emails.length > MAX_INVITES_PER_SPACE) {
      throw new ActionError(`A space can have up to ${MAX_INVITES_PER_SPACE} invites`, 'invite_limit')
    }

    const members = await queryRecords<TeamMember>(tools, 'team_members', { teamId: p.spaceId })
    const targets = await resolveTargets(tools, userId, p)
    const inviterName = await displayName(tools, userId, 'A member')

    const results = await deliverInvites({
      tools,
      env,
      origin: p.origin,
      targets,
      // Removed members can't rejoin, so inviting them would only mislead.
      isIn: (id) => !!id && members.some((m) => m.data.userId === id),
      collection: 'space_invites',
      row: {
        spaceId: p.spaceId,
        code: space.data.code,
        spaceName: space.data.name,
        invitedBy: userId,
        inviterName,
        status: 'pending',
        invitedAt: Date.now(),
        emailSent: false,
      },
      email: { inviterName, kind: 'space', title: space.data.name, code: space.data.code },
      joinPath: spaceJoinPath(space.data.code),
    })
    return { results }
  },
)

export const spaceActions = {
  createSpace,
  updateSpace,
  deleteSpace,
  joinSpace,
  leaveSpace,
  removeMember,
  inviteToSpace,
}
