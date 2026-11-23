/**
 * The audit log's vocabulary (docs/features.md F17): which category each
 * action belongs to, and the plain-English sentence the admin console shows
 * for an entry. Pure, so it's unit-tested.
 */

import type { AuditAction, AuditCategory, AuditEntry } from '../schemas/audit-schemas'

export const AUDIT_RETENTION_DAYS = 90

export const CATEGORY_OF: Record<AuditAction, AuditCategory> = {
  'space.member_removed': 'moderation',
  'room.player_removed': 'moderation',
  'room.cohost_added': 'moderation',
  'room.cohost_removed': 'moderation',
  'space.deleted': 'deletion',
  'quiz.deleted': 'deletion',
  'note.deleted': 'deletion',
  'board.deleted': 'deletion',
  'ai.quiz_generation': 'paid',
  'ai.mind_map': 'paid',
  'ai.note_draft': 'paid',
  'ai.note_review': 'paid',
  'email.invites_sent': 'paid',
  'admin.data_exported': 'admin',
  'user.role_changed': 'roles',
}

export const CATEGORY_LABEL: Record<AuditCategory, string> = {
  moderation: 'Moderation',
  deletion: 'Deletions',
  paid: 'Paid calls',
  admin: 'Admin',
  roles: 'Roles',
}

const quoted = (s?: string) => (s ? `“${s}”` : 'something')
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The sentence after the actor's name, e.g. `removed Sam from “Biology”`. */
export function describeAudit(e: Pick<AuditEntry, 'action' | 'targetLabel' | 'meta'>): string {
  const m = e.meta ?? {}
  const t = quoted(e.targetLabel)
  switch (e.action) {
    case 'space.member_removed':
      return `removed ${m.member ?? 'a member'} from the space ${t}`
    case 'space.deleted':
      return `deleted the space ${t}`
    case 'room.player_removed':
      return `removed ${m.player ?? 'a player'} from the game ${t}`
    case 'room.cohost_added':
      return `made ${m.member ?? 'a player'} co-host of the game ${t}`
    case 'room.cohost_removed':
      return `removed ${m.member ?? 'a co-host'} as co-host of the game ${t}`
    case 'quiz.deleted':
      return `deleted the quiz ${t}`
    case 'note.deleted':
      return `deleted the note ${t}`
    case 'board.deleted':
      return `deleted the board ${t}`
    case 'ai.quiz_generation':
      return m.questions
        ? `started an AI draft of ${plural(Number(m.questions), 'question')} for ${t}`
        : `started an AI draft for ${t}`
    case 'ai.mind_map':
      return `generated an AI mind map of ${t}`
    case 'ai.note_draft':
      return m.topic ? `drafted AI notes on ${m.topic} in ${t}` : `drafted AI notes in ${t}`
    case 'ai.note_review':
      return m.checkedAgainst ? `asked AI to review ${t} against ${m.checkedAgainst}` : `asked AI to review ${t}`
    case 'email.invites_sent':
      return `sent ${plural(Number(m.count ?? 0), 'invite email')} for ${t}`
    case 'admin.data_exported':
      return 'exported the app’s data'
    case 'user.role_changed':
      return `changed ${m.user ?? e.targetLabel ?? 'a user'}’s role${m.from ? ` from ${m.from}` : ''} to ${m.to ?? 'another role'}`
  }
}
