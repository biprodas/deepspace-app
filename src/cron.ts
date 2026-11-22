/**
 * Cron task definitions — registered into the AppCronRoom DO at construction
 * time (worker.ts). The DO alarm fires `runTask(name, env)` on the schedule
 * declared here; the DO itself records executions, tracks history, and
 * pushes status to admin clients via the `/ws/cron/:roomId` WebSocket.
 *
 * Each task declares EITHER `intervalMinutes` (run every N minutes) OR
 * `schedule` + `timezone` (5-field cron expression). CronRoom validates
 * the config at construction time and throws on ambiguous declarations.
 *
 * Tasks:
 *  - `prune-audit-log` (daily, 03:15 UTC): deletes admin audit-log entries
 *    older than AUDIT_RETENTION_DAYS (docs/features.md F17).
 */

import type { CronTask } from 'deepspace/worker'
import { buildCronContext } from 'deepspace/worker'
import type { Env } from '../worker'
import { AUDIT_RETENTION_DAYS } from './lib/audit'

export const tasks: CronTask[] = [{ name: 'prune-audit-log', schedule: '15 3 * * *', timezone: 'UTC' }]

/** Entries looked at per run; a busy day is far below this, and the next run continues. */
const PRUNE_BATCH = 5000

export async function runTask(name: string, env: Env): Promise<void> {
  if (name === 'prune-audit-log') await pruneAuditLog(env)
}

async function pruneAuditLog(env: Env): Promise<void> {
  const { records } = buildCronContext(env, env.OWNER_USER_ID, `app:${env.DEEPSPACE_APP_ID}`)
  const cutoff = Date.now() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000
  const rows = (await records.query('audit_log', { limit: PRUNE_BATCH })) as { recordId: string; data: { at?: number } }[]
  let deleted = 0
  for (const row of rows) {
    if (typeof row.data?.at === 'number' && row.data.at < cutoff) {
      await records.delete('audit_log', row.recordId)
      deleted += 1
    }
  }
  console.log(`prune-audit-log: deleted ${deleted} of ${rows.length} entries older than ${AUDIT_RETENTION_DAYS} days`)
}
