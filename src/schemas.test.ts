import { describe, expect, it } from 'vitest'
import { lintSchemas } from 'deepspace/worker'
import { schemas } from './schemas'

const GAME_COLLECTIONS = [
  'quizzes',
  'questions',
  'answer_keys',
  'generations',
  'rooms',
  'rounds',
  'room_players',
  'room_invites',
  'round_flags',
  'polls',
  'poll_votes',
  'answers',
  'standings',
  'leaderboard',
  'spaces',
  'team_members',
  'space_invites',
  'documents',
  'boards',
  'audit_log',
  'user_prefs',
]
const byName = new Map(schemas.map((s) => [s.name, s]))

/** Space-scoped collections, readable only by the space's members (the SDK's `'team'` rule). */
const TEAM_COLLECTIONS = ['spaces', 'team_members', 'documents', 'boards']

describe('schemas', () => {
  it('pass the SDK schema lint', () => {
    expect(lintSchemas(schemas)).toEqual([])
  })

  it.each(GAME_COLLECTIONS)('%s is written only by server actions', (name) => {
    const schema = byName.get(name)
    expect(schema).toBeDefined()
    for (const perms of Object.values(schema!.permissions)) {
      expect(perms).toMatchObject({ create: false, update: false, delete: false })
    }
  })

  // The answer must never reach a player before reveal (docs/features.md F5).
  it.each([
    ['answer_keys', 'ownerId'],
    ['answers', 'userId'],
    ['generations', 'userId'],
    ['room_invites', 'inviteeId'],
    ['round_flags', 'userId'],
    ['poll_votes', 'userId'],
    ['space_invites', 'inviteeId'],
    ['user_prefs', 'userId'],
  ])('%s is readable by its owner only, admins included', (name, ownerField) => {
    const schema = byName.get(name)!
    expect(schema.ownerField).toBe(ownerField)
    for (const role of ['viewer', 'member', 'admin']) {
      expect(schema.permissions[role].read).not.toBe(true)
    }
  })

  it('no reveal-only column lives on a player-readable question', () => {
    const columns = byName.get('questions')!.columns.map((c) => c.name)
    expect(columns).not.toContain('correctIndex')
    expect(columns).not.toContain('explanation')
  })

  it.each(TEAM_COLLECTIONS)('%s is readable by space members only', (name) => {
    const schema = byName.get(name)!
    expect(schema.teamField).toBe('teamId')
    for (const role of ['viewer', 'member', 'admin']) {
      expect(schema.permissions[role].read).not.toBe(true)
    }
    expect(schema.permissions.member.read).toBe('team')
  })

  // Members never see who removed whom or what anyone spent; only admins read the log.
  it('audit_log is readable by admins only', () => {
    const p = byName.get('audit_log')!.permissions
    expect(p.viewer.read).toBe(false)
    expect(p.member.read).toBe(false)
    expect(p.admin.read).toBe(true)
  })

  // The SDK resolves 'team' against this collection by name and these columns.
  it('team_members has the columns the team rule reads', () => {
    const columns = byName.get('team_members')!.columns.map((c) => c.name)
    expect(columns).toEqual(expect.arrayContaining(['teamId', 'userId', 'status']))
  })
})
