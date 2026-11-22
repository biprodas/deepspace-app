/**
 * The admin audit log (docs/features.md F17): who did what to what, and
 * when, for moderation, deletions, paid calls and admin actions. Written
 * only by server actions (src/actions/audit.ts), so no browser can add,
 * edit or delete an entry; read only by app admins. A daily cron task
 * deletes entries older than AUDIT_RETENTION_DAYS (src/cron.ts).
 */

import type { CollectionSchema } from 'deepspace/schema'
import { json, select, text, time } from './schema-helpers'

export const AUDIT_CATEGORIES = ['moderation', 'deletion', 'paid', 'admin', 'roles'] as const
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number]

export const AUDIT_ACTIONS = [
  'space.member_removed',
  'space.deleted',
  'room.player_removed',
  'room.cohost_added',
  'room.cohost_removed',
  'quiz.deleted',
  'note.deleted',
  'board.deleted',
  'ai.quiz_generation',
  'ai.mind_map',
  'email.invites_sent',
  'admin.data_exported',
  'user.role_changed',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

/**
 * How sure the log is that it happened: `server` entries are written by
 * the action that did the thing; a role change is done by the platform, so
 * its entry is `verified` when the server saw the new role on the user, or
 * `reported` when it only has the admin's browser's word.
 */
export const AUDIT_SOURCES = ['server', 'verified', 'reported'] as const
export type AuditSource = (typeof AUDIT_SOURCES)[number]

export interface AuditEntry {
  at: number
  actorId: string
  actorName: string
  action: AuditAction
  category: AuditCategory
  /** What it was done to, kept readable after the thing itself is deleted. */
  targetType?: string
  targetId?: string
  targetLabel?: string
  /** Small extra facts for the sentence, e.g. { count: 3 } or { from: 'member', to: 'admin' }. */
  meta?: Record<string, string | number>
  source: AuditSource
}

const AUDIT_READERS = {
  viewer: { read: false, create: false, update: false, delete: false },
  member: { read: false, create: false, update: false, delete: false },
  admin: { read: true, create: false, update: false, delete: false },
} as const

export const auditLogSchema: CollectionSchema = {
  name: 'audit_log',
  columns: [
    time('at', { required: true, immutable: true }),
    text('actorId', { required: true, immutable: true }),
    text('actorName', { required: true, immutable: true }),
    select('action', AUDIT_ACTIONS, { required: true, immutable: true }),
    select('category', AUDIT_CATEGORIES, { required: true, immutable: true }),
    text('targetType', { immutable: true }),
    text('targetId', { immutable: true }),
    text('targetLabel', { immutable: true }),
    json('meta', { immutable: true }),
    select('source', AUDIT_SOURCES, { required: true, immutable: true }),
  ],
  permissions: AUDIT_READERS,
}
