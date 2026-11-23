/**
 * The signed-in user's synced preferences (src/schemas/pref-schemas.ts).
 * One row per user, created on first save.
 */

import type { ActionTools } from 'deepspace/worker'
import { z } from 'zod'
import { DEFAULT_PREFS, type UserPrefs } from '../schemas/pref-schemas'
import { defineAction, isDuplicate, queryRecords, unwrap } from './shared'

/** A user's preferences, with defaults for anything never saved. */
export async function prefsFor(tools: ActionTools, userId: string): Promise<Omit<UserPrefs, 'userId' | 'updatedAt'>> {
  const [row] = await queryRecords<UserPrefs>(tools, 'user_prefs', { userId }, { limit: 1 })
  // Booleans are stored as numbers; read them back as booleans.
  return row ? { inviteEmails: Boolean(row.data.inviteEmails) } : { ...DEFAULT_PREFS }
}

const updatePreferences = defineAction(z.object({ inviteEmails: z.boolean() }), async ({ userId, tools }, p) => {
  const [row] = await queryRecords<UserPrefs>(tools, 'user_prefs', { userId }, { limit: 1 })
  const fields = { inviteEmails: p.inviteEmails, updatedAt: Date.now() }
  if (row) {
    unwrap(await tools.update('user_prefs', row.recordId, fields))
  } else {
    const created = await tools.create('user_prefs', { userId, ...fields })
    // Two tabs saving at once: the row exists now, so update it.
    if (isDuplicate(created)) {
      const [raced] = await queryRecords<UserPrefs>(tools, 'user_prefs', { userId }, { limit: 1 })
      if (raced) unwrap(await tools.update('user_prefs', raced.recordId, fields))
    } else unwrap(created)
  }
  return { inviteEmails: p.inviteEmails }
})

export const prefActions = {
  updatePreferences,
}
