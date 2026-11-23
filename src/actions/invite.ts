/**
 * Inviting people by account or email, to a room or a study space. The
 * inviter picks from people who played in their earlier games, or types
 * emails. Account holders see the invite live on Home; everyone with an
 * address also gets an email with the join link (the `email/send`
 * integration, billed to the app).
 *
 * Room invites are defined here; space invites reuse the helpers from
 * src/actions/space.ts.
 */

import type { ActionTools } from 'deepspace/worker'
import { z } from 'zod'
import type { Env } from '../../worker'
import { MAX_INVITES_PER_CALL, MAX_INVITES_PER_ROOM } from '../lib/game-rules'
import { joinPath } from '../lib/join-code'
import type { Quiz, Room, RoomInvite, RoomPlayer } from '../schemas/game-types'
import type { SpaceInvite } from '../schemas/space-types'
import { audit } from './audit'
import { prefsFor } from './prefs'
import {
  ActionError,
  defineAction,
  displayName,
  getRecord,
  isClosed,
  isDuplicate,
  isHostOrCoHost,
  queryRecords,
  recordId,
  requireHostOrCoHost,
  unwrap,
} from './shared'

/** Hosted games looked through for "people you've played with". */
const RECENT_ROOMS = 30
const MAX_RECENT_PLAYERS = 100

export interface RecentPlayer {
  userId: string
  displayName: string
}

/** Players from the caller's most recent hosted games, newest first, without the caller. */
async function playersFromHostedGames(tools: ActionTools, userId: string): Promise<RecentPlayer[]> {
  const rooms = await queryRecords<Room>(
    tools,
    'rooms',
    { hostId: userId },
    { orderBy: 'createdAt', orderDir: 'desc', limit: RECENT_ROOMS },
  )
  const seen = new Map<string, RecentPlayer & { joinedAt: number }>()
  for (const room of rooms) {
    for (const { data: p } of await queryRecords<RoomPlayer>(tools, 'room_players', { roomId: room.recordId })) {
      if (p.userId === userId) continue
      const prev = seen.get(p.userId)
      if (!prev || p.joinedAt > prev.joinedAt) {
        seen.set(p.userId, { userId: p.userId, displayName: p.displayName, joinedAt: p.joinedAt })
      }
    }
  }
  return [...seen.values()]
    .sort((a, b) => b.joinedAt - a.joinedAt)
    .slice(0, MAX_RECENT_PLAYERS)
    .map(({ userId: id, displayName: name }) => ({ userId: id, displayName: name }))
}

async function userEmail(tools: ActionTools, userId: string): Promise<string | undefined> {
  const result = await tools.get('users', userId)
  const email = result.success ? (result.data.record.data as { email?: unknown }).email : undefined
  return typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : undefined
}

async function userIdByEmail(tools: ActionTools, email: string): Promise<string | undefined> {
  const [user] = await queryRecords<{ email?: string }>(tools, 'users', { email }, { limit: 1 })
  return user?.recordId
}

/**
 * Where email links point. The deployed app uses `APP_URL`; local dev may
 * pass its own localhost origin. Any other caller-supplied origin is ignored,
 * so an invite email can't be made to link somewhere else.
 */
function linkOrigin(env: Env, origin: string | undefined): string | undefined {
  if (origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin
  return env.APP_URL?.replace(/\/+$/, '') || undefined
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

interface EmailContent {
  inviterName: string
  /** What they're invited to: a live game of a quiz, or a study space. */
  kind: 'game' | 'space'
  title: string
  code: string
  link: string
}

function inviteEmail({ inviterName, kind, title, code, link }: EmailContent) {
  const what = kind === 'game' ? 'a live quiz game' : 'a study space'
  const action = kind === 'game' ? 'Join the game' : 'Join the space'
  const subject =
    kind === 'game'
      ? `${inviterName} invited you to play “${title}” on StudyArena`
      : `${inviterName} invited you to the study space “${title}” on StudyArena`
  const text = [
    `${inviterName} invited you to ${what} on StudyArena: “${title}”.`,
    '',
    `${action}: ${link}`,
    `Join code: ${code}`,
    '',
    'Sign in or create a free account to join.',
  ].join('\n')
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#14142b">
  <p style="font-size:16px;margin:0 0 16px">
    <strong>${escapeHtml(inviterName)}</strong> invited you to ${what} on StudyArena:
  </p>
  <p style="font-size:20px;font-weight:700;margin:0 0 24px">${escapeHtml(title)}</p>
  <p style="margin:0 0 24px">
    <a href="${escapeHtml(link)}" style="display:inline-block;background:#5b4cf0;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${action}</a>
  </p>
  <p style="font-size:14px;color:#555;margin:0 0 4px">Join code:</p>
  <p style="font-family:ui-monospace,monospace;font-size:28px;font-weight:800;letter-spacing:.18em;margin:0 0 24px">${escapeHtml(code)}</p>
  <p style="font-size:12px;color:#888;margin:0">Sign in or create a free account to join. If you didn’t expect this, you can ignore it.</p>
</div>`
  return { subject, text, html }
}

// ─── Shared invite flow ──────────────────────────────────

/** The "who" part of an invite request, shared by room and space invites. */
export const inviteTargetFields = {
  userIds: z.array(recordId).max(MAX_INVITES_PER_CALL).default([]),
  emails: z.array(z.string().trim().toLowerCase().email().max(254)).max(MAX_INVITES_PER_CALL).default([]),
  /** The caller's page origin; only honoured for localhost (see linkOrigin). */
  origin: z.string().max(100).optional(),
}

export function withTargetChecks<S extends z.ZodType<{ userIds: string[]; emails: string[] }>>(schema: S) {
  return schema
    .refine((p) => p.userIds.length + p.emails.length > 0, 'Pick someone or enter an email')
    .refine((p) => p.userIds.length + p.emails.length <= MAX_INVITES_PER_CALL, {
      message: `Invite up to ${MAX_INVITES_PER_CALL} people at a time`,
    })
}

export type InviteOutcome = 'invited' | 'already_invited' | 'already_in' | 'email_failed'

export interface InviteTarget {
  label: string
  inviteeId?: string
  email?: string
}

/**
 * One target per person: picked accounts, then emails not covered by a
 * pick. Picks are limited to people from the caller's own earlier games, so
 * nobody can look up or notify arbitrary accounts.
 */
export async function resolveTargets(
  tools: ActionTools,
  callerId: string,
  p: { userIds: string[]; emails: string[] },
  knownName?: (userId: string) => string | undefined,
): Promise<InviteTarget[]> {
  if (p.userIds.length > 0) {
    const allowed = new Set((await playersFromHostedGames(tools, callerId)).map((r) => r.userId))
    if (p.userIds.some((id) => !allowed.has(id))) {
      throw new ActionError('You can only pick people from your earlier games', 'forbidden')
    }
  }
  const targets: InviteTarget[] = []
  for (const id of new Set(p.userIds)) {
    targets.push({
      label: knownName?.(id) ?? (await displayName(tools, id)),
      inviteeId: id,
      email: await userEmail(tools, id),
    })
  }
  for (const email of new Set(p.emails)) {
    if (targets.some((t) => t.email === email)) continue
    targets.push({ label: email, email, inviteeId: await userIdByEmail(tools, email) })
  }
  return targets
}

interface Delivery {
  tools: ActionTools
  env: Env
  origin: string | undefined
  targets: InviteTarget[]
  /** Already a player / member: no invite needed. */
  isIn: (inviteeId: string | undefined) => boolean
  collection: 'room_invites' | 'space_invites'
  /** The invite row for one target, minus the per-target fields filled in here. */
  row: Omit<RoomInvite, 'key' | 'email' | 'inviteeId'> | Omit<SpaceInvite, 'key' | 'email' | 'inviteeId'>
  email: Omit<EmailContent, 'link'>
  joinPath: string
}

/**
 * Creates one invite row per target (idempotent: an existing invite is left
 * alone and not re-emailed) and emails each address.
 */
export async function deliverInvites(d: Delivery): Promise<{ label: string; outcome: InviteOutcome }[]> {
  const origin = linkOrigin(d.env, d.origin)
  const results: { label: string; outcome: InviteOutcome }[] = []
  let emailsSent = 0
  for (const target of d.targets) {
    if (d.isIn(target.inviteeId)) {
      results.push({ label: target.label, outcome: 'already_in' })
      continue
    }
    const created = await d.tools.create(d.collection, {
      ...d.row,
      key: target.email ?? `user:${target.inviteeId}`,
      ...(target.email ? { email: target.email } : {}),
      ...(target.inviteeId ? { inviteeId: target.inviteeId } : {}),
    })
    if (isDuplicate(created)) {
      results.push({ label: target.label, outcome: 'already_invited' })
      continue
    }
    const { recordId: inviteId } = unwrap(created)

    let outcome: InviteOutcome = 'invited'
    // People with an account who turned invite emails off get the in-app invite only.
    const wantsEmail = !target.inviteeId || (await prefsFor(d.tools, target.inviteeId)).inviteEmails
    if (target.email && origin && wantsEmail) {
      const sent = await d.tools.integration('email/send', {
        to: target.email,
        ...inviteEmail({ ...d.email, link: `${origin}${d.joinPath}` }),
      })
      if (sent.success) {
        unwrap(await d.tools.update(d.collection, inviteId, { emailSent: true }))
        emailsSent += 1
      }
      // An account holder still has the in-app invite; only email-only invites truly failed.
      else if (!target.inviteeId) outcome = 'email_failed'
    }
    results.push({ label: target.label, outcome })
  }

  // One audit entry per send, with the count: emails are billed per message.
  if (emailsSent > 0) {
    const isRoom = 'roomId' in d.row
    await audit(d.tools, d.row.invitedBy, {
      action: 'email.invites_sent',
      actorName: d.row.inviterName,
      targetType: isRoom ? 'room' : 'space',
      targetId: 'roomId' in d.row ? d.row.roomId : d.row.spaceId,
      targetLabel: 'quizTitle' in d.row ? d.row.quizTitle : d.row.spaceName,
      meta: { count: emailsSent },
    })
  }
  return results
}

/** Marks the caller's invites accepted once they've joined; called by `joinRoom` and `joinSpace`. */
export async function acceptInvites(
  tools: ActionTools,
  collection: 'room_invites' | 'space_invites',
  where: { roomId: string } | { spaceId: string },
  userId: string,
): Promise<void> {
  const invites = await queryRecords<{ status: string }>(tools, collection, { ...where, inviteeId: userId })
  for (const invite of invites) {
    if (invite.data.status !== 'accepted') {
      unwrap(await tools.update(collection, invite.recordId, { status: 'accepted' }))
    }
  }
}

// ─── Actions ─────────────────────────────────────────────

/** People the caller can pick from in an invite card. */
const recentPlayers = defineAction(z.object({}), async ({ userId, tools }) => ({
  players: await playersFromHostedGames(tools, userId),
}))

/** Invites picked accounts and typed emails to an open room. */
const invitePlayers = defineAction(
  withTargetChecks(z.object({ roomId: recordId, ...inviteTargetFields })),
  async ({ userId, tools, env }, p) => {
    const room = await getRecord<Room>(tools, 'rooms', p.roomId, 'Room')
    requireHostOrCoHost(room, userId)
    if (isClosed(room.data)) throw new ActionError('This game has finished', 'room_closed')

    const existing = await queryRecords<RoomInvite>(tools, 'room_invites', { roomId: p.roomId })
    if (existing.length + p.userIds.length + p.emails.length > MAX_INVITES_PER_ROOM) {
      throw new ActionError(`A game can have up to ${MAX_INVITES_PER_ROOM} invites`, 'invite_limit')
    }

    const players = await queryRecords<RoomPlayer>(tools, 'room_players', { roomId: p.roomId })
    const targets = await resolveTargets(
      tools,
      userId,
      p,
      (id) => players.find((pl) => pl.data.userId === id)?.data.displayName,
    )
    const quiz = await getRecord<Quiz>(tools, 'quizzes', room.data.quizId, 'Quiz')
    const inviterName = await displayName(tools, userId, 'Your host')

    const results = await deliverInvites({
      tools,
      env,
      origin: p.origin,
      targets,
      isIn: (id) =>
        !!id && (isHostOrCoHost(room, id) || players.some((pl) => pl.data.userId === id && !pl.data.removed)),
      collection: 'room_invites',
      row: {
        roomId: p.roomId,
        code: room.data.code,
        quizTitle: quiz.data.title,
        invitedBy: userId,
        inviterName,
        status: 'pending',
        invitedAt: Date.now(),
        emailSent: false,
      },
      email: { inviterName, kind: 'game', title: quiz.data.title, code: room.data.code },
      joinPath: joinPath(room.data.code),
    })
    return { results }
  },
)

/** Hides a room or space invite from the invitee's Home. */
const dismissInvite = defineAction(
  z.object({ inviteId: recordId, kind: z.enum(['room', 'space']).default('room') }),
  async ({ userId, tools }, p) => {
    const collection = p.kind === 'space' ? 'space_invites' : 'room_invites'
    const invite = await getRecord<{ inviteeId?: string; status: string }>(tools, collection, p.inviteId, 'Invite')
    if (invite.data.inviteeId !== userId) throw new ActionError('Invite not found', 'not_found')
    if (invite.data.status === 'pending') {
      unwrap(await tools.update(collection, p.inviteId, { status: 'dismissed' }))
    }
    return { inviteId: p.inviteId }
  },
)

export const inviteActions = {
  recentPlayers,
  invitePlayers,
  dismissInvite,
}
