/**
 * Live game: rooms, the rounds played in them, players, answers and
 * standings (docs/schema.md, docs/trd.md §4). One app-wide scope; every row
 * carries its `roomId`.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { INVITE_STATUSES, POLL_KINDS, POLL_STATUSES, ROOM_STATUSES, ROUND_STATUSES } from './game-types'
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
    /** The study space this game belongs to, if any (docs/features.md F13). */
    text('spaceId', { immutable: true }),
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
    num('confusedCount', { default: 0 }),
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

/**
 * Invitations by account or email. Only the invitee reads theirs (by
 * `inviteeId`), so the host's address book never leaks to other players.
 */
export const roomInvitesSchema: CollectionSchema = {
  name: 'room_invites',
  columns: [
    text('roomId', { required: true, immutable: true }),
    text('code', { required: true, immutable: true }),
    text('quizTitle', { required: true }),
    text('invitedBy', { required: true, immutable: true }),
    text('inviterName', { required: true }),
    text('key', { required: true, immutable: true }),
    text('email', { immutable: true }),
    text('inviteeId'),
    select('status', INVITE_STATUSES, { required: true }),
    time('invitedAt', { required: true }),
    bool('emailSent', { default: false }),
  ],
  uniqueOn: ['roomId', 'key'],
  ownerField: 'inviteeId',
  permissions: serverWritten('own'),
}

/** "Still confused" flags; players read only their own, the count is on the round. */
export const roundFlagsSchema: CollectionSchema = {
  name: 'round_flags',
  columns: [
    text('roomId', { required: true, immutable: true }),
    text('roundId', { required: true, immutable: true }),
    text('userId', { required: true, immutable: true }),
  ],
  uniqueOn: ['roundId', 'userId'],
  ownerField: 'userId',
  permissions: serverWritten('own'),
}

/** Live polls in a room; everyone in the app reads them like rounds. */
export const pollsSchema: CollectionSchema = {
  name: 'polls',
  columns: [
    text('roomId', { required: true, immutable: true }),
    text('question', { required: true, immutable: true }),
    json('options', { required: true, immutable: true }),
    select('kind', POLL_KINDS, { required: true, immutable: true }),
    select('status', POLL_STATUSES, { required: true }),
    text('createdBy', { required: true, immutable: true }),
    json('counts', { required: true }),
    time('createdAt', { required: true, immutable: true }),
    time('closedAt'),
  ],
  permissions: serverWritten(true),
}

/** One vote per player per poll; private, only the poll's counts are public. */
export const pollVotesSchema: CollectionSchema = {
  name: 'poll_votes',
  columns: [
    text('pollId', { required: true, immutable: true }),
    text('roomId', { required: true, immutable: true }),
    text('userId', { required: true, immutable: true }),
    num('choiceIndex', { required: true }),
  ],
  uniqueOn: ['pollId', 'userId'],
  ownerField: 'userId',
  permissions: serverWritten('own'),
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
