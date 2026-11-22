/**
 * Plumbing every Study Arena server action shares (docs/trd.md §6):
 * params are parsed with Zod, failures are thrown as `ActionError` and turned
 * into `{ success: false, error, code }`, and successes carry `serverNow` so
 * clients can keep their clock offset fresh.
 *
 * Actions run with RBAC off (see src/server/action-routes.ts): every role
 * check here is the only one there is.
 */

import { RECORD_NOT_FOUND } from 'deepspace/worker'
import type { ActionContext, ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import { z } from 'zod'
import type { Env } from '../../worker'
import { isClosedStatus, type Quiz, type Room } from '../schemas/game-types'

export class ActionError extends Error {
  constructor(
    message: string,
    readonly code: string,
    /** Structured fields the client can act on (e.g. a suggested fix). */
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
  }
}

export type ActionData<T extends object> = T & { serverNow: number }

/**
 * Wraps a handler with params validation and error mapping. Unexpected
 * errors still throw, so the worker's error handler logs them.
 */
export function defineAction<S extends z.ZodType, T extends object>(
  schema: S,
  run: (ctx: ActionContext<Env>, params: z.infer<S>) => Promise<T>,
): ActionHandler<Env> {
  return async (ctx): Promise<ActionResult<ActionData<T>>> => {
    const parsed = schema.safeParse(ctx.params ?? {})
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((issue) => (issue.path.length ? `${issue.path.join('.')}: ` : '') + issue.message)
        .join('; ')
      return { success: false, error: `Invalid request: ${detail}`, code: 'invalid_params' }
    }
    try {
      const data = await run(ctx, parsed.data)
      return { success: true, data: { ...data, serverNow: Date.now() } }
    } catch (err) {
      if (err instanceof ActionError) {
        return { success: false, error: err.message, code: err.code, ...(err.details ? { details: err.details } : {}) }
      }
      throw err
    }
  }
}

/** Returns a tool call's data, or throws its failure as an `ActionError`. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.success) throw new ActionError(result.error, result.code ?? 'tool_failed')
  return result.data
}

export interface Rec<T> {
  recordId: string
  data: T
  createdBy: string
  /** ISO time. */
  createdAt: string
}

/** One record, or `null` when it doesn't exist. */
export async function findRecord<T>(
  tools: ActionTools,
  collection: string,
  recordId: string,
): Promise<Rec<T> | null> {
  const result = await tools.get(collection, recordId)
  if (!result.success && result.error === RECORD_NOT_FOUND) return null
  const { record } = unwrap(result)
  return record as unknown as Rec<T>
}

/** One record, or a `not_found` refusal naming what was missing. */
export async function getRecord<T>(
  tools: ActionTools,
  collection: string,
  recordId: string,
  label = 'Record',
): Promise<Rec<T>> {
  const record = await findRecord<T>(tools, collection, recordId)
  if (!record) throw new ActionError(`${label} not found`, 'not_found')
  return record
}

/**
 * Equality-filtered query, up to `limit` records (default 500). The room
 * may stop a long scan early and hand back `nextOffset`; this follows it,
 * so a recompute never silently works from a partial list.
 */
export async function queryRecords<T>(
  tools: ActionTools,
  collection: string,
  where: Record<string, unknown>,
  options: { orderBy?: string; orderDir?: 'asc' | 'desc'; limit?: number } = {},
): Promise<Rec<T>[]> {
  const { limit = 500, ...order } = options
  const all: Rec<T>[] = []
  let offset: number | undefined = 0
  while (offset !== undefined && all.length < limit) {
    // `offset` is accepted by the room's records.query; the SDK's option type omits it.
    const page = unwrap(
      await tools.query(collection, { where, ...order, limit: limit - all.length, offset } as never),
    ) as { records: unknown[]; nextOffset?: number }
    all.push(...(page.records as Rec<T>[]))
    offset = page.nextOffset
  }
  return all
}

/** True when a write failed on a `uniqueOn` constraint. */
export function isDuplicate(result: ActionResult<unknown>): boolean {
  return !result.success && /duplicate/i.test(result.error)
}

/** A user's profile name, trimmed to fit a player chip, or `fallback`. */
export async function displayName(tools: ActionTools, userId: string, fallback = 'Player'): Promise<string> {
  const result = await tools.get('users', userId)
  const name = result.success ? (result.data.record.data as { name?: unknown }).name : undefined
  return typeof name === 'string' && name.trim() ? name.trim().slice(0, 60) : fallback
}

// ─── Caller checks ───────────────────────────────────────

export function requireQuizOwner(quiz: Rec<Quiz>, userId: string): void {
  if (quiz.data.ownerId !== userId) {
    throw new ActionError('Only the quiz owner can do that', 'forbidden')
  }
}

export const isClosed = (room: Room): boolean => isClosedStatus(room.status)

export function isHost(room: Rec<Room>, userId: string): boolean {
  return room.data.hostId === userId
}

export function isHostOrCoHost(room: Rec<Room>, userId: string): boolean {
  return isHost(room, userId) || (room.data.coHostIds ?? []).includes(userId)
}

export function requireHost(room: Rec<Room>, userId: string): void {
  if (!isHost(room, userId)) throw new ActionError('Only the host can do that', 'forbidden')
}

export function requireHostOrCoHost(room: Rec<Room>, userId: string): void {
  if (!isHostOrCoHost(room, userId)) {
    throw new ActionError('Only the host or a co-host can do that', 'forbidden')
  }
}

// ─── Common params ───────────────────────────────────────

export const recordId = z.string().min(1).max(64)
