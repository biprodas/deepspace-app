/**
 * Owner-only data inspector (docs/trd.md §13). A server action rather than
 * admin read access on the collections: the app owner also plays as a test
 * account, and admin read on `answer_keys` would show them answers mid-game.
 */

import { z } from 'zod'
import type { Generation } from '../schemas/game-types'
import { ActionError, defineAction, queryRecords, type Rec } from './shared'

export const EXPORT_COLLECTIONS = [
  'quizzes',
  'questions',
  'answer_keys',
  'generations',
  'rooms',
  'rounds',
  'room_players',
  'answers',
  'standings',
  'leaderboard',
] as const

const PER_COLLECTION = 5000

/** Every game collection as JSON. Users' pasted notes are left out; only their length is kept. */
const exportData = defineAction(z.object({}), async ({ userId, tools, env }) => {
  if (!env.OWNER_USER_ID || userId !== env.OWNER_USER_ID) {
    throw new ActionError('Only the app owner can export data', 'forbidden')
  }
  const collections: Record<string, Rec<unknown>[]> = {}
  for (const name of EXPORT_COLLECTIONS) {
    const records = await queryRecords<unknown>(tools, name, {}, { orderBy: 'createdAt', orderDir: 'desc', limit: PER_COLLECTION })
    collections[name] =
      name === 'generations'
        ? (records as Rec<Generation>[]).map(({ data: { notes, ...rest }, ...record }) => ({
            ...record,
            data: { ...rest, notesLength: notes?.length ?? 0 },
          }))
        : records
  }
  return { exportedAt: new Date().toISOString(), limitPerCollection: PER_COLLECTION, collections }
})

export const adminActions = {
  exportData,
}
