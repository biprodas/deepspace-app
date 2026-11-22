/**
 * "You're invited" on Home: the viewer's pending game and study-space
 * invites, live, newest first. Only the invitee can read an invite (schemas
 * `room_invites`, `space_invites`), so the queries need no filter by user.
 * Invites to games that have finished drop out on their own; deleting a
 * space deletes its invites.
 */

import type { ReactNode } from 'react'
import { useQuery } from 'deepspace'
import { useNavigate } from 'react-router-dom'
import { Gamepad2, Mail, UsersRound, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { useAction } from '@/lib/use-action'
import { isClosedStatus, type Room, type RoomInvite } from '@/schemas/game-types'
import type { SpaceInvite } from '@/schemas/space-types'

const MAX_INVITES = 5

export function InvitesCard() {
  const pending = { where: { status: 'pending' }, orderBy: 'invitedAt', orderDir: 'desc', limit: 20 } as const
  const games = useQuery<RoomInvite>('room_invites', pending)
  const spaces = useQuery<SpaceInvite>('space_invites', pending)
  if (games.records.length === 0 && spaces.records.length === 0) return null

  return (
    // Rows for finished games render nothing; hide the section when none are left.
    <section aria-labelledby="your-invites" className="hidden has-[li]:block">
      <h2 id="your-invites" className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
        <Mail className="size-5 text-primary" aria-hidden="true" /> You’re invited
      </h2>
      <ul data-testid="your-invites" className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {spaces.records.slice(0, MAX_INVITES).map((invite) => (
          <SpaceInviteRow key={invite.recordId} inviteId={invite.recordId} invite={invite.data} />
        ))}
        {games.records.slice(0, MAX_INVITES).map((invite) => (
          <GameInviteRow key={invite.recordId} inviteId={invite.recordId} invite={invite.data} />
        ))}
      </ul>
    </section>
  )
}

function GameInviteRow({ inviteId, invite }: { inviteId: string; invite: RoomInvite }) {
  const navigate = useNavigate()
  const { run, pending } = useAction()
  const { records } = useQuery<Room>('rooms', { where: { recordId: invite.roomId }, limit: 1 })
  const room = records[0]
  if (!room || isClosedStatus(room.data.status)) return null

  return (
    <InviteRow
      icon={<Gamepad2 />}
      title={invite.quizTitle}
      subtitle={`${invite.inviterName} invited you · ${room.data.status === 'lobby' ? 'In the lobby' : 'Game in progress'}`}
      joining={pending === `join:${inviteId}`}
      dismissing={pending === `dismiss:${inviteId}`}
      onJoin={async () => {
        const res = await run<{ roomId: string }>('joinRoom', { code: invite.code }, `join:${inviteId}`)
        if (res.success) navigate(`/rooms/${res.data.roomId}`)
      }}
      onDismiss={() => void run('dismissInvite', { inviteId, kind: 'room' }, `dismiss:${inviteId}`)}
    />
  )
}

function SpaceInviteRow({ inviteId, invite }: { inviteId: string; invite: SpaceInvite }) {
  const navigate = useNavigate()
  const { run, pending } = useAction()
  return (
    <InviteRow
      icon={<UsersRound />}
      title={invite.spaceName}
      subtitle={`${invite.inviterName} invited you to this study space`}
      joining={pending === `join:${inviteId}`}
      dismissing={pending === `dismiss:${inviteId}`}
      onJoin={async () => {
        const res = await run<{ spaceId: string }>('joinSpace', { code: invite.code }, `join:${inviteId}`)
        if (res.success) navigate(`/spaces/${res.data.spaceId}`)
      }}
      onDismiss={() => void run('dismissInvite', { inviteId, kind: 'space' }, `dismiss:${inviteId}`)}
    />
  )
}

interface InviteRowProps {
  icon: ReactNode
  title: string
  subtitle: string
  joining: boolean
  dismissing: boolean
  onJoin: () => void | Promise<void>
  onDismiss: () => void
}

function InviteRow({ icon, title, subtitle, joining, dismissing, onJoin, onDismiss }: InviteRowProps) {
  return (
    <li data-testid="invite-row" className="flex items-center gap-3 px-4 py-3">
      <span className="text-muted-foreground [&_svg]:size-5" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <Button size="sm" loading={joining} onClick={() => void onJoin()}>
        Join
      </Button>
      <Button size="icon" variant="ghost" className="size-8" aria-label={`Dismiss invite to ${title}`} loading={dismissing} onClick={onDismiss}>
        <X />
      </Button>
    </li>
  )
}
