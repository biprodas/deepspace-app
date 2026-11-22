/**
 * "You're invited" on Home: the viewer's pending invites, live, newest
 * first. Only the invitee can read an invite (schema `room_invites`), so the
 * query needs no filter by user. Invites to games that have finished drop
 * out on their own.
 */

import { useQuery } from 'deepspace'
import { useNavigate } from 'react-router-dom'
import { Mail, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { useAction } from '@/lib/use-action'
import { isClosedStatus, type Room, type RoomInvite } from '@/schemas/game-types'

const MAX_INVITES = 5

export function InvitesCard() {
  const invites = useQuery<RoomInvite>('room_invites', {
    where: { status: 'pending' },
    orderBy: 'invitedAt',
    orderDir: 'desc',
    limit: 20,
  })
  if (invites.records.length === 0) return null

  return (
    // Rows for finished games render nothing; hide the section when none are left.
    <section aria-labelledby="your-invites" className="hidden has-[li]:block">
      <h2 id="your-invites" className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
        <Mail className="size-5 text-primary" aria-hidden="true" /> You’re invited
      </h2>
      <ul data-testid="your-invites" className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {invites.records.slice(0, MAX_INVITES).map((invite) => (
          <InviteRow key={invite.recordId} inviteId={invite.recordId} invite={invite.data} />
        ))}
      </ul>
    </section>
  )
}

function InviteRow({ inviteId, invite }: { inviteId: string; invite: RoomInvite }) {
  const navigate = useNavigate()
  const { run, pending } = useAction()
  const { records } = useQuery<Room>('rooms', { where: { recordId: invite.roomId }, limit: 1 })
  const room = records[0]
  if (!room || isClosedStatus(room.data.status)) return null

  async function join() {
    const res = await run<{ roomId: string }>('joinRoom', { code: invite.code }, `join:${inviteId}`)
    if (res.success) navigate(`/rooms/${res.data.roomId}`)
  }

  return (
    <li data-testid="invite-row" className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{invite.quizTitle}</p>
        <p className="truncate text-xs text-muted-foreground">
          {invite.inviterName} invited you · {room.data.status === 'lobby' ? 'In the lobby' : 'Game in progress'}
        </p>
      </div>
      <Button size="sm" loading={pending === `join:${inviteId}`} onClick={() => void join()}>
        Join
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-8"
        aria-label={`Dismiss invite to ${invite.quizTitle}`}
        loading={pending === `dismiss:${inviteId}`}
        onClick={() => void run('dismissInvite', { inviteId }, `dismiss:${inviteId}`)}
      >
        <X />
      </Button>
    </li>
  )
}
