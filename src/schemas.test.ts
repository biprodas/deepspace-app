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
]
const byName = new Map(schemas.map((s) => [s.name, s]))

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
})
