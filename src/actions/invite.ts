/**
 * Inviting people to a room by account or email. The host (or a co-host)
 * picks from people who played in their earlier games, or types emails.
 * Account holders see the invite live on Home; everyone with an address
 * also gets an email with the join link (the `email/send` integration,
 * billed to the app).
 */

import type { ActionTools } from 'deepspace/worker'
import { z } from 'zod'
import type { Env } from '../../worker'
import { MAX_INVITES_PER_CALL, MAX_INVITES_PER_ROOM } from '../lib/game-rules'
import { joinPath } from '../lib/join-code'
import type { Quiz, Room, RoomInvite, RoomPlayer } from '../schemas/game-types'
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

function inviteEmail(invite: RoomInvite, link: string) {
  const subject = `${invite.inviterName} invited you to play “${invite.quizTitle}” on StudyArena`
  const text = [
    `${invite.inviterName} invited you to a live quiz game on StudyArena: “${invite.quizTitle}”.`,
    '',
    `Join: ${link}`,
    `Or go to ${link.replace(/\/join\/.*$/, '/join')} and enter the code ${invite.code}.`,
    '',
    'Sign in or create a free account to play.',
  ].join('\n')
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#14142b">
  <p style="font-size:16px;margin:0 0 16px">
    <strong>${escapeHtml(invite.inviterName)}</strong> invited you to a live quiz game on StudyArena:
  </p>
  <p style="font-size:20px;font-weight:700;margin:0 0 24px">${escapeHtml(invite.quizTitle)}</p>
  <p style="margin:0 0 24px">
    <a href="${escapeHtml(link)}" style="display:inline-block;background:#5b4cf0;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Join the game</a>
  </p>
  <p style="font-size:14px;color:#555;margin:0 0 4px">Or enter this code at the join page:</p>
  <p style="font-family:ui-monospace,monospace;font-size:28px;font-weight:800;letter-spacing:.18em;margin:0 0 24px">${escapeHtml(invite.code)}</p>
  <p style="font-size:12px;color:#888;margin:0">Sign in or create a free account to play. If you didn’t expect this, you can ignore it.</p>
</div>`
  return { subject, text, html }
}

/** Marks the caller's invites to a room accepted; called when they join it. */
export async function acceptInvites(tools: ActionTools, roomId: string, userId: string): Promise<void> {
  const invites = await queryRecords<RoomInvite>(tools, 'room_invites', { roomId, inviteeId: userId })
  for (const invite of invites) {
    if (invite.data.status !== 'accepted') {
      unwrap(await tools.update('room_invites', invite.recordId, { status: 'accepted' }))
    }
  }
}

// ─── Actions ─────────────────────────────────────────────

/** People the caller can pick from in the invite card. */
const recentPlayers = defineAction(z.object({}), async ({ userId, tools }) => ({
  players: await playersFromHostedGames(tools, userId),
}))

export type InviteOutcome = 'invited' | 'already_invited' | 'already_in' | 'email_failed'

/**
 * Invites picked accounts and typed emails to an open room. Idempotent per
 * person: an existing invite is left alone and not re-emailed. Picks are
 * limited to people from the caller's own earlier games, so nobody can
 * look up or notify arbitrary accounts.
 */
const invitePlayers = defineAction(
  z
    .object({
      roomId: recordId,
      userIds: z.array(recordId).max(MAX_INVITES_PER_CALL).default([]),
      emails: z.array(z.string().trim().toLowerCase().email().max(254)).max(MAX_INVITES_PER_CALL).default([]),
      /** The caller's page origin; only honoured for localhost (see linkOrigin). */
      origin: z.string().max(100).optional(),
    })
    .refine((p) => p.userIds.length + p.emails.length > 0, 'Pick someone or enter an email')
    .refine((p) => p.userIds.length + p.emails.length <= MAX_INVITES_PER_CALL, {
      message: `Invite up to ${MAX_INVITES_PER_CALL} people at a time`,
    }),
  async ({ userId, tools, env }, p) => {
    const room = await getRecord<Room>(tools, 'rooms', p.roomId, 'Room')
    requireHostOrCoHost(room, userId)
    if (isClosed(room.data)) throw new ActionError('This game has finished', 'room_closed')

    const existing = await queryRecords<RoomInvite>(tools, 'room_invites', { roomId: p.roomId })
    if (existing.length + p.userIds.length + p.emails.length > MAX_INVITES_PER_ROOM) {
      throw new ActionError(`A game can have up to ${MAX_INVITES_PER_ROOM} invites`, 'invite_limit')
    }

    if (p.userIds.length > 0) {
      const allowed = new Set((await playersFromHostedGames(tools, userId)).map((r) => r.userId))
      if (p.userIds.some((id) => !allowed.has(id))) {
        throw new ActionError('You can only pick people from your earlier games', 'forbidden')
      }
    }

    const players = await queryRecords<RoomPlayer>(tools, 'room_players', { roomId: p.roomId })
    const inRoom = (id: string | undefined) =>
      !!id && (isHostOrCoHost(room, id) || players.some((pl) => pl.data.userId === id && !pl.data.removed))

    // One entry per person: picked accounts, then emails not already covered by a pick.
    const targets: { label: string; inviteeId?: string; email?: string }[] = []
    for (const id of new Set(p.userIds)) {
      const email = await userEmail(tools, id)
      const label = players.find((pl) => pl.data.userId === id)?.data.displayName ?? (await displayName(tools, id))
      targets.push({ label, inviteeId: id, email })
    }
    for (const email of new Set(p.emails)) {
      if (targets.some((t) => t.email === email)) continue
      targets.push({ label: email, email, inviteeId: await userIdByEmail(tools, email) })
    }

    const quiz = await getRecord<Quiz>(tools, 'quizzes', room.data.quizId, 'Quiz')
    const inviterName = await displayName(tools, userId, 'Your host')
    const origin = linkOrigin(env, p.origin)

    const results: { label: string; outcome: InviteOutcome }[] = []
    for (const target of targets) {
      if (inRoom(target.inviteeId)) {
        results.push({ label: target.label, outcome: 'already_in' })
        continue
      }
      const invite: RoomInvite = {
        roomId: p.roomId,
        code: room.data.code,
        quizTitle: quiz.data.title,
        invitedBy: userId,
        inviterName,
        key: target.email ?? `user:${target.inviteeId}`,
        ...(target.email ? { email: target.email } : {}),
        ...(target.inviteeId ? { inviteeId: target.inviteeId } : {}),
        status: 'pending',
        invitedAt: Date.now(),
        emailSent: false,
      }
      const created = await tools.create('room_invites', { ...invite })
      if (isDuplicate(created)) {
        results.push({ label: target.label, outcome: 'already_invited' })
        continue
      }
      const { recordId: inviteId } = unwrap(created)

      let outcome: InviteOutcome = 'invited'
      if (target.email && origin) {
        const sent = await tools.integration('email/send', {
          to: target.email,
          ...inviteEmail(invite, `${origin}${joinPath(room.data.code)}`),
        })
        if (sent.success) unwrap(await tools.update('room_invites', inviteId, { emailSent: true }))
        // An account holder still has the in-app invite; only email-only invites truly failed.
        else if (!target.inviteeId) outcome = 'email_failed'
      }
      results.push({ label: target.label, outcome })
    }
    return { results }
  },
)

/** Hides an invite from the invitee's Home. */
const dismissInvite = defineAction(z.object({ inviteId: recordId }), async ({ userId, tools }, p) => {
  const invite = await getRecord<RoomInvite>(tools, 'room_invites', p.inviteId, 'Invite')
  if (invite.data.inviteeId !== userId) throw new ActionError('Invite not found', 'not_found')
  if (invite.data.status === 'pending') {
    unwrap(await tools.update('room_invites', p.inviteId, { status: 'dismissed' }))
  }
  return { inviteId: p.inviteId }
})

export const inviteActions = {
  recentPlayers,
  invitePlayers,
  dismissInvite,
}
