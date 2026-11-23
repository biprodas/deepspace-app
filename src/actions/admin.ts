/**
 * Owner-only data inspector (docs/trd.md §13). A server action rather than
 * admin read access on the collections: the app owner also plays as a test
 * account, and admin read on `answer_keys` would show them answers mid-game.
 */

import { z } from 'zod'
import type { Generation, Question, Quiz, Round } from '../schemas/game-types'
import { audit } from './audit'
import { ActionError, defineAction, findRecord, queryRecords, unwrap, type Rec } from './shared'

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
  await audit(tools, userId, { action: 'admin.data_exported' })
  return { exportedAt: new Date().toISOString(), limitPerCollection: PER_COLLECTION, collections }
})

/**
 * One-off repair for data saved before questions became owner-only: gives
 * each question its quiz's `ownerId` (without it even the owner can't read
 * the row), and copies the question onto rounds played before rounds carried
 * it (players read past questions from there). Idempotent; owner-only.
 */
const backfillQuestionOwners = defineAction(z.object({}), async ({ userId, tools, env }) => {
  if (!env.OWNER_USER_ID || userId !== env.OWNER_USER_ID) {
    throw new ActionError('Only the app owner can update older records', 'forbidden')
  }
  const [questions, rounds] = await Promise.all([
    queryRecords<Question>(tools, 'questions', {}, { limit: PER_COLLECTION }),
    queryRecords<Round>(tools, 'rounds', {}, { limit: PER_COLLECTION }),
  ])

  const owners = new Map<string, string | undefined>()
  let questionsFixed = 0
  for (const q of questions) {
    if (q.data.ownerId) continue
    if (!owners.has(q.data.quizId)) {
      owners.set(q.data.quizId, (await findRecord<Quiz>(tools, 'quizzes', q.data.quizId))?.data.ownerId)
    }
    const ownerId = owners.get(q.data.quizId)
    if (!ownerId) continue
    unwrap(await tools.update('questions', q.recordId, { ownerId }))
    questionsFixed += 1
  }

  const byId = new Map(questions.map((q) => [q.recordId, q.data]))
  let roundsFixed = 0
  for (const r of rounds) {
    const q = byId.get(r.data.questionId)
    if (r.data.prompt || !q) continue
    unwrap(await tools.update('rounds', r.recordId, { prompt: q.prompt, options: q.options }))
    roundsFixed += 1
  }
  return { questionsFixed, roundsFixed }
})

// ─── Admin console (docs/features.md F16) ────────────────

/** Rows counted per collection; the console shows "5000+" past this. */
const COUNT_LIMIT = 5000
const DAY_MS = 24 * 60 * 60 * 1000

/** Owner-only, like exportData: the console's numbers include every user's activity. */
function requireOwner(env: { OWNER_USER_ID?: string }, userId: string) {
  if (!env.OWNER_USER_ID || userId !== env.OWNER_USER_ID) {
    throw new ActionError('Only the app owner can open the admin console', 'forbidden')
  }
}

interface UsageWindow {
  generations: number
  generationsFailed: number
  inputTokens: number
  outputTokens: number
  mindMaps: number
  /** AI note drafts and reviews (counted from the audit log). */
  noteAi: number
  emailsSent: number
  /** Wikipedia lookups: one per Wikipedia-sourced generation topic and per mind map. */
  wikipediaLookups: number
}

const emptyWindow = (): UsageWindow => ({
  generations: 0,
  generationsFailed: 0,
  inputTokens: 0,
  outputTokens: 0,
  mindMaps: 0,
  noteAi: 0,
  emailsSent: 0,
  wikipediaLookups: 0,
})

/**
 * What the console's Overview and API usage pages show: how much there is
 * of everything, and the paid calls the app made, all time and in the last
 * 30 days. Built from the app's own records (generation token counts, mind
 * maps, sent invite emails), since the platform's billing ledger isn't
 * readable from the app; the DeepSpace dashboard has the exact bill.
 */
const adminSummary = defineAction(z.object({}), async ({ userId, tools, env }) => {
  requireOwner(env, userId)
  const all = <T>(collection: string) =>
    queryRecords<T>(tools, collection, {}, { orderBy: 'createdAt', orderDir: 'desc', limit: COUNT_LIMIT })

  const [users, quizzes, rooms, spaces, notes, boards, generations, roomInvites, spaceInvites, paid] = await Promise.all([
    all('users'),
    all('quizzes'),
    all<{ status: string }>('rooms'),
    all('spaces'),
    all('documents'),
    all<{ kind: string; createdAt: number }>('boards'),
    all<Generation>('generations'),
    all<{ emailSent?: boolean; invitedAt: number }>('room_invites'),
    all<{ emailSent?: boolean; invitedAt: number }>('space_invites'),
    queryRecords<{ action: string; at: number; meta?: Record<string, unknown> }>(
      tools,
      'audit_log',
      { category: 'paid' },
      { limit: COUNT_LIMIT },
    ),
  ])

  const since = Date.now() - 30 * DAY_MS
  const usage = { allTime: emptyWindow(), last30Days: emptyWindow() }
  const add = (at: number, f: (w: UsageWindow) => void) => {
    f(usage.allTime)
    if (at >= since) f(usage.last30Days)
  }
  for (const g of generations) {
    add(Date.parse(g.createdAt), (w) => {
      w.generations += 1
      if (g.data.status === 'failed') w.generationsFailed += 1
      w.inputTokens += g.data.inputTokens ?? 0
      w.outputTokens += g.data.outputTokens ?? 0
      if (g.data.sourceType === 'wikipedia') w.wikipediaLookups += g.data.topics?.length ?? 0
    })
  }
  for (const b of boards) {
    if (b.data.kind === 'mindmap') add(b.data.createdAt, (w) => ((w.mindMaps += 1), (w.wikipediaLookups += 1)))
  }
  for (const e of paid) {
    const wiki = e.data.action === 'ai.note_draft' || (e.data.action === 'ai.note_review' && !!e.data.meta?.checkedAgainst)
    if (e.data.action === 'ai.note_draft' || e.data.action === 'ai.note_review') {
      add(e.data.at, (w) => ((w.noteAi += 1), (w.wikipediaLookups += wiki ? 1 : 0)))
    }
  }
  for (const i of [...roomInvites, ...spaceInvites]) {
    if (i.data.emailSent) add(i.data.invitedAt, (w) => (w.emailsSent += 1))
  }

  const count = (rows: unknown[]) => ({ count: rows.length, capped: rows.length >= COUNT_LIMIT })
  return {
    generatedAt: new Date().toISOString(),
    counts: {
      users: count(users),
      quizzes: count(quizzes),
      games: count(rooms),
      liveGames: count(rooms.filter((r) => !['final', 'cancelled'].includes(r.data.status))),
      spaces: count(spaces),
      notes: count(notes),
      boards: count(boards),
    },
    usage,
  }
})

export type AdminSummary = {
  generatedAt: string
  counts: Record<'users' | 'quizzes' | 'games' | 'liveGames' | 'spaces' | 'notes' | 'boards', { count: number; capped: boolean }>
  usage: { allTime: UsageWindow; last30Days: UsageWindow }
}

export const adminActions = {
  exportData,
  backfillQuestionOwners,
  adminSummary,
}
