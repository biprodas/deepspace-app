/**
 * Per-user preferences that follow the user everywhere and that the server
 * acts on (settings page → Preferences). Each user reads only their own row;
 * changes go through the `updatePreferences` action. Device-only
 * preferences (like showing reactions) live in localStorage instead
 * (src/lib/device-prefs.ts).
 */

import type { CollectionSchema } from 'deepspace/schema'
import { bool, serverWritten, text, time } from './schema-helpers'

export interface UserPrefs {
  userId: string
  /** Email me when someone invites me to a game or space (in-app invites still arrive). */
  inviteEmails: boolean
  updatedAt: number
}

export const DEFAULT_PREFS: Omit<UserPrefs, 'userId' | 'updatedAt'> = { inviteEmails: true }

export const userPrefsSchema: CollectionSchema = {
  name: 'user_prefs',
  columns: [
    text('userId', { required: true, immutable: true }),
    bool('inviteEmails', { default: true }),
    time('updatedAt', { required: true }),
  ],
  uniqueOn: ['userId'],
  ownerField: 'userId',
  permissions: serverWritten('own'),
}
