/**
 * Live game: rooms, the rounds played in them, players, answers and
 * standings (docs/schema.md, docs/trd.md §4). One app-wide scope; every row
 * carries its `roomId`.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { ROOM_STATUSES, ROUND_STATUSES } from './game-types'
import { bool, json, num, select, serverWritten, text, time } from './schema-helpers'

export const roomsSchema: CollectionSchema = {
  name: 'rooms',
  columns: [
    text('quizId', { required: true, immutable: true }),
    text('code', { required: true, immutable: true }),
    text('hostId', { required: true, immutable: true }),
    json('coHostIds', { default: [] }),
    select('status', ROOM_STATUSES, { required: true }),
    text('currentRoundId'),
    time('startedAt'),
    time('completedAt'),
  ],
  uniqueOn: ['code'],
  permissions: serverWritten(true),
}

/**
 * One row per question played. The reveal fields (`correctIndex` through
 * `distribution`) stay empty until `revealQuestion` fills them.
 */
export const roundsSchema: CollectionSchema = {
  name: 'rounds',
  columns: [
    text('roomId', { required: true, immutable: true }),
    text('questionId', { required: true, immutable: true }),
    num('roundNumber', { required: true, immutable: true }),
    select('status', ROUND_STATUSES, { required: true }),
    time('startedAt', { required: true }),
    time('deadline', { required: true }),
    num('timeLimitMs', { required: true, immutable: true }),
    num('remainingMs'),
    time('revealedAt'),
    num('correctIndex'),
    text('explanation'),
    text('sourceQuote'),
    text('sourceUrl'),
    json('distribution'),
  ],
  uniqueOn: ['roomId', 'roundNumber'],
  permissions: serverWritten(true),
}

export const roomPlayersSchema: CollectionSchema = {
  name: 'room_players',
  columns: [
    text('roomId', { required: true, immutable: true }),
    text('userId', { required: true, immutable: true }),
    text('displayName', { required: true }),
    bool('removed', { default: false }),
    time('joinedAt', { required: true }),
    num('firstRoundNumber', { required: true }),
  ],
  uniqueOn: ['roomId', 'userId'],
  permissions: serverWritten(true),
}

/** Players read only their own answers; the distribution is published on the round. */
export const answersSchema: CollectionSchema = {
  name: 'answers',
  columns: [
    text('roomId', { required: true, immutable: true }),
    text('roundId', { required: true, immutable: true }),
    text('questionId', { required: true, immutable: true }),
    text('userId', { required: true, immutable: true }),
    num('choiceIndex', { required: true }),
    bool('correct', { required: true }),
    num('points', { required: true }),
    num('answerMs', { required: true }),
  ],
  uniqueOn: ['roundId', 'userId'],
  ownerField: 'userId',
  permissions: serverWritten('own'),
}

/** Recomputed from `answers` at each reveal, never incremented. */
export const standingsSchema: CollectionSchema = {
  name: 'standings',
  columns: [
    text('roomId', { required: true, immutable: true }),
    text('userId', { required: true, immutable: true }),
    num('score', { required: true }),
    num('correctCount', { required: true }),
    num('correctMs', { required: true }),
    num('rank', { required: true }),
  ],
  uniqueOn: ['roomId', 'userId'],
  permissions: serverWritten(true),
}

/**
 * All-time leaderboard (docs/features.md F11). Built from server-computed
 * standings when a game finishes; nobody can submit a score. (DeepSpace's
 * ready-made `leaderboard` feature lets users submit scores, which would
 * break the "client never owns the score" rule, so it isn't used.)
 */
export const leaderboardSchema: CollectionSchema = {
  name: 'leaderboard',
  columns: [
    text('userId', { required: true, immutable: true }),
    text('displayName', { required: true }),
    num('totalScore', { default: 0 }),
    num('games', { default: 0 }),
    num('wins', { default: 0 }),
    num('correctAnswers', { default: 0 }),
    json('roomIds', { default: [] }),
  ],
  uniqueOn: ['userId'],
  permissions: serverWritten(true),
}
