/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import {
  answerKeysSchema,
  generationsSchema,
  questionsSchema,
  quizzesSchema,
} from './schemas/quiz-schemas'
import {
  answersSchema,
  leaderboardSchema,
  roomPlayersSchema,
  roomsSchema,
  roundsSchema,
  standingsSchema,
} from './schemas/game-schemas'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  quizzesSchema,
  questionsSchema,
  answerKeysSchema,
  generationsSchema,
  roomsSchema,
  roundsSchema,
  roomPlayersSchema,
  answersSchema,
  standingsSchema,
  leaderboardSchema,
]
