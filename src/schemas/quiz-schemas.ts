/**
 * Quiz content: quizzes, their questions, the owner-only answer keys and the
 * AI generation log (docs/schema.md, docs/trd.md §4).
 */

import type { CollectionSchema } from 'deepspace/schema'
import {
  DIFFICULTIES,
  GENERATION_STAGES,
  GENERATION_STATUSES,
  QUIZ_STATUSES,
  SOURCE_TYPES,
} from './game-types'
import { bool, json, num, select, serverWritten, text, time } from './schema-helpers'

export const quizzesSchema: CollectionSchema = {
  name: 'quizzes',
  columns: [
    text('ownerId', { required: true, immutable: true }),
    text('title', { required: true }),
    select('sourceType', SOURCE_TYPES, { required: true, immutable: true }),
    json('sourceUrls', { default: [] }),
    select('difficulty', DIFFICULTIES, { default: 'mixed' }),
    select('status', QUIZ_STATUSES, { required: true }),
    text('generationId'),
  ],
  permissions: serverWritten(true),
}

export const questionsSchema: CollectionSchema = {
  name: 'questions',
  columns: [
    text('quizId', { required: true, immutable: true }),
    num('order', { required: true }),
    text('prompt', { required: true }),
    json('options', { required: true }),
    num('timeLimit', { required: true }),
    bool('approved', { default: false }),
  ],
  permissions: serverWritten(true),
}

/**
 * Kept apart from `questions` because permissions are per record, not per
 * field: the answer must never be in a player's WebSocket frames.
 */
export const answerKeysSchema: CollectionSchema = {
  name: 'answer_keys',
  columns: [
    text('questionId', { required: true, immutable: true }),
    text('quizId', { required: true, immutable: true }),
    text('ownerId', { required: true, immutable: true }),
    num('correctIndex', { required: true }),
    text('explanation', { default: '' }),
    text('sourceQuote', { default: '' }),
    text('sourceUrl'),
  ],
  uniqueOn: ['questionId'],
  ownerField: 'ownerId',
  permissions: serverWritten('own'),
}

/** One row per AI run: the per-user daily cap counts these. */
export const generationsSchema: CollectionSchema = {
  name: 'generations',
  columns: [
    text('userId', { required: true, immutable: true }),
    text('quizId', { required: true, immutable: true }),
    text('jobId'),
    select('sourceType', SOURCE_TYPES, { required: true }),
    json('topics'),
    text('notes'),
    select('difficulty', DIFFICULTIES, { default: 'mixed' }),
    num('questionCount', { required: true }),
    text('replaceQuestionId'),
    text('model', { required: true }),
    text('promptVersion', { required: true }),
    select('status', GENERATION_STATUSES, { required: true }),
    select('stage', GENERATION_STAGES),
    time('heartbeatAt'),
    num('droppedCount', { default: 0 }),
    num('inputTokens'),
    num('outputTokens'),
    text('error'),
    time('completedAt'),
  ],
  ownerField: 'userId',
  permissions: serverWritten('own'),
}
