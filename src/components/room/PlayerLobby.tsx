/**
 * Player lobby, phone-first: confirmation that you're in, who else is, and
 * whether the host is here.
 */

import { useUserLookup } from 'deepspace'
import { CheckCircle2, WifiOff } from 'lucide-react'
import type { RoomState } from '@/lib/use-room'
import { PlayerList } from './PlayerList'

export function PlayerLobby({ state }: { state: RoomState }) {
  const { room, quiz, players, online, me, userId } = state
  const { getName } = useUserLookup()
  if (!room || !me) return null

  const hostName = getName(room.data.hostId) ?? 'The host'
  const hostOnline = online.has(room.data.hostId)

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-8">
      {!hostOnline && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm"
        >
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
          {hostName} isn’t connected right now.
        </p>
      )}

      <section className="rounded-2xl border border-border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-10 text-correct-text" aria-hidden="true" />
        <h1 className="font-display text-2xl font-bold tracking-tight">You’re in, {me.data.displayName}!</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {quiz?.data.title ? <>“{quiz.data.title}” · </> : null}
          Waiting for {hostName} to start.
        </p>
        <p className="mt-4 font-mono text-sm font-bold tracking-[0.18em] text-muted-foreground">
          {room.data.code}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">
          {players.length} player{players.length === 1 ? '' : 's'} in the lobby
        </h2>
        <PlayerList players={players} online={online} userId={userId} />
      </section>
    </div>
  )
}
