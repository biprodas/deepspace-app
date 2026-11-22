/**
 * Study spaces (docs/features.md F13, docs/schema.md). Every space row is
 * team-scoped: `teamField` names the space, and the SDK's `'team'` rule lets
 * a caller read it only with an active `team_members` row for that space
 * (owners always pass). All writes go through server actions.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { INVITE_STATUSES } from './game-types'
import { bool, select, serverWritten, text, time } from './schema-helpers'
import { MEMBER_ROLES, MEMBER_STATUSES } from './space-types'

export const spacesSchema: CollectionSchema = {
  name: 'spaces',
  columns: [
    text('name', { required: true }),
    text('description'),
    text('ownerId', { required: true, immutable: true }),
    text('code', { required: true, immutable: true }),
    text('teamId'),
    time('createdAt', { required: true, immutable: true }),
  ],
  uniqueOn: ['code'],
  ownerField: 'ownerId',
  teamField: 'teamId',
  permissions: serverWritten('team'),
}

/** The SDK's `'team'` rule resolves membership against this exact collection name and columns. */
export const teamMembersSchema: CollectionSchema = {
  name: 'team_members',
  columns: [
    text('teamId', { required: true, immutable: true }),
    text('userId', { required: true, immutable: true }),
    text('displayName', { required: true }),
    select('role', MEMBER_ROLES, { required: true }),
    select('status', MEMBER_STATUSES, { required: true }),
    time('joinedAt', { required: true }),
  ],
  uniqueOn: ['teamId', 'userId'],
  // A removed member still sees their own row (and so why the space is gone).
  ownerField: 'userId',
  teamField: 'teamId',
  permissions: serverWritten('team'),
}

/** Space invites; only the invitee reads theirs, like room invites. */
export const spaceInvitesSchema: CollectionSchema = {
  name: 'space_invites',
  columns: [
    text('spaceId', { required: true, immutable: true }),
    text('code', { required: true, immutable: true }),
    text('spaceName', { required: true }),
    text('invitedBy', { required: true, immutable: true }),
    text('inviterName', { required: true }),
    text('key', { required: true, immutable: true }),
    text('email', { immutable: true }),
    text('inviteeId'),
    select('status', INVITE_STATUSES, { required: true }),
    time('invitedAt', { required: true }),
    bool('emailSent', { default: false }),
  ],
  uniqueOn: ['spaceId', 'key'],
  ownerField: 'inviteeId',
  permissions: serverWritten('own'),
}
