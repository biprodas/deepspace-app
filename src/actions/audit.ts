/**
 * Writing the admin audit log (docs/features.md F17). Server actions call
 * `audit()` after they've done the thing; it never throws, so a log write
 * that fails can't undo or block the action it records (it's logged to the
 * worker console instead, visible in `deepspace logs`).
 *
 * Role changes are done by the platform (`useUsers().setRole` in the admin
 * console), not by an action here, so the console reports them through
 * `logRoleChange`, which checks the reporter is an admin and looks at the
 * user's role to mark the entry verified or only reported.
 */

import type { ActionTools } from 'deepspace/worker'
import { z } from 'zod'
import { CATEGORY_OF } from '../lib/audit'
import type { AuditAction, AuditEntry, AuditSource } from '../schemas/audit-schemas'
import { ActionError, defineAction, displayName, queryRecords, recordId } from './shared'

interface AuditInput {
  action: AuditAction
  targetType?: string
  targetId?: string
  targetLabel?: string
  meta?: Record<string, string | number>
  /** Saves a lookup when the action already knows the actor's name. */
  actorName?: string
  source?: AuditSource
}

export async function audit(tools: ActionTools, actorId: string, input: AuditInput): Promise<void> {
  try {
    const entry: AuditEntry = {
      at: Date.now(),
      actorId,
      actorName: input.actorName ?? (await displayName(tools, actorId, 'Someone')),
      action: input.action,
      category: CATEGORY_OF[input.action],
      ...(input.targetType ? { targetType: input.targetType } : {}),
      ...(input.targetId ? { targetId: input.targetId } : {}),
      ...(input.targetLabel ? { targetLabel: input.targetLabel.slice(0, 120) } : {}),
      ...(input.meta ? { meta: input.meta } : {}),
      source: input.source ?? 'server',
    }
    const res = await tools.create('audit_log', { ...entry })
    if (!res.success) console.warn('audit log write failed', input.action, res.error)
  } catch (err) {
    console.warn('audit log write failed', input.action, err instanceof Error ? err.message : err)
  }
}

/**
 * How many of `actions` the actor did in the last 24 hours, counting at
 * most `cap` (enough to tell whether a daily limit is reached). Daily AI
 * limits count these entries rather than what the calls created, so
 * deleting a mind map or a note doesn't hand a use back. Newest first, so
 * a long history inside the retention window can't hide today's entries.
 */
export async function auditsToday(
  tools: ActionTools,
  actorId: string,
  actions: readonly AuditAction[],
  cap: number,
): Promise<number> {
  const since = Date.now() - 24 * 60 * 60 * 1000
  const pages = await Promise.all(
    actions.map((action) =>
      queryRecords<AuditEntry>(tools, 'audit_log', { actorId, action }, { orderBy: 'at', orderDir: 'desc', limit: cap }),
    ),
  )
  return pages.flat().filter((e) => e.data.at > since).length
}

/** How long logRoleChange waits for a role change to show on the user: up to ~3 s. */
const VERIFY_ATTEMPTS = 5
const VERIFY_DELAY_MS = 750

async function userRole(tools: ActionTools, userId: string): Promise<string | undefined> {
  const res = await tools.get('users', userId)
  const role = res.success ? (res.data.record.data as { role?: unknown }).role : undefined
  return typeof role === 'string' ? role : undefined
}

/**
 * The admin console reports a role change it just made through the
 * platform. Only admins may report; the entry is `verified` when the user
 * already has the new role, `reported` otherwise (the change may still be
 * on its way, or the browser may be wrong).
 */
const logRoleChange = defineAction(
  z.object({
    userId: recordId,
    from: z.string().max(20).optional(),
    to: z.string().min(1).max(20),
  }),
  async ({ userId: actorId, tools }, p) => {
    if ((await userRole(tools, actorId)) !== 'admin') {
      throw new ActionError('Only admins change roles', 'forbidden')
    }
    const name = await displayName(tools, p.userId, 'a user')
    // The console reports right after asking the platform, so give the change
    // a moment to land before deciding it's only reported.
    let verified = false
    for (let attempt = 0; attempt < VERIFY_ATTEMPTS && !verified; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, VERIFY_DELAY_MS))
      verified = (await userRole(tools, p.userId)) === p.to
    }
    await audit(tools, actorId, {
      action: 'user.role_changed',
      targetType: 'user',
      targetId: p.userId,
      targetLabel: name,
      meta: { user: name, to: p.to, ...(p.from ? { from: p.from } : {}) },
      source: verified ? 'verified' : 'reported',
    })
    return { verified }
  },
)

export const auditActions = {
  logRoleChange,
}
