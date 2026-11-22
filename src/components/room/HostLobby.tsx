/**
 * Host (and co-host) lobby, built for a laptop on a projector: the join
 * code big enough to read across a room, the live roster, and the host's
 * controls. The game itself starts here in M3.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserLookup } from 'deepspace'
import { Check, Copy, Users, X } from 'lucide-react'
import { Badge, Button, ConfirmModal } from '@/components/ui'
import { joinPath } from '@/lib/join-code'
import { MAX_PLAYERS } from '@/lib/game-rules'
import { LEAVE_CONFIRMED } from '@/lib/leave-guard'
import { useAction } from '@/lib/use-action'
import type { RoomState } from '@/lib/use-room'
import type { RoomPlayer } from '@/schemas/game-types'
import { PlayerList } from './PlayerList'

export function HostLobby({ state }: { state: RoomState }) {
  const { room, quiz, players, online, role } = state
  const { run, pending } = useAction()
  const { getName } = useUserLookup()
  const [copied, setCopied] = useState(false)
  const [removing, setRemoving] = useState<RoomPlayer | null>(null)
  const [ending, setEnding] = useState(false)
  const navigate = useNavigate()
  if (!room) return null

  const roomId = room.recordId
  const isHost = role === 'host'
  const link = `${window.location.origin}${joinPath(room.data.code)}`
  const coHosts = room.data.coHostIds ?? []

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked; the link is on screen to copy by hand.
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">Join at</p>
        <p className="mt-1 break-all font-mono text-base font-bold sm:text-lg">
          {window.location.host}/join
        </p>
        <p className="mt-6 text-sm font-medium text-muted-foreground">with code</p>
        <p
          data-testid="room-code"
          className="mt-1 font-mono text-5xl font-extrabold tracking-[0.18em] sm:text-7xl"
        >
          {room.data.code}
        </p>
        <Button variant="outline" size="sm" className="mt-8" onClick={copyLink}>
          {copied ? <Check /> : <Copy />}
          {copied ? 'Link copied' : 'Copy invite link'}
        </Button>
      </section>

      <section className="flex min-h-80 flex-col rounded-2xl border border-border bg-card p-6">
        <header className="mb-1 flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-bold tracking-tight">
            {quiz?.data.title ?? 'Lobby'}
          </h1>
          {role === 'co-host' && <Badge variant="info" size="sm">You’re a co-host</Badge>}
        </header>
        <p className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-4" aria-hidden="true" />
          <span data-testid="player-count">
            {players.length} / {MAX_PLAYERS} players
          </span>
          <span aria-hidden="true">·</span>
          <span>{players.filter((p) => online.has(p.data.userId)).length} online</span>
        </p>

        {players.length === 0 ? (
          <p className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Waiting for players to join with the code…
          </p>
        ) : (
          <PlayerList
            players={players}
            online={online}
            onRemove={isHost ? setRemoving : undefined}
            onMakeCoHost={
              isHost
                ? (p) => void run('addCoHost', { roomId, userId: p.userId }, `cohost:${p.userId}`)
                : undefined
            }
          />
        )}

        {coHosts.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold">Co-hosts</h2>
            <ul className="flex flex-wrap gap-2">
              {coHosts.map((id) => (
                <li
                  key={id}
                  className="flex items-center gap-1 rounded-full border border-border py-1 pl-3 pr-1 text-sm"
                >
                  {getName(id) ?? 'Co-host'}
                  {isHost && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 rounded-full"
                      aria-label={`Remove ${getName(id) ?? 'co-host'} as co-host`}
                      onClick={() => void run('removeCoHost', { roomId, userId: id })}
                    >
                      <X />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <footer className="mt-auto flex flex-wrap items-center justify-end gap-3 pt-8">
          {isHost && (
            <Button variant="ghost" className="mr-auto hover:text-destructive" onClick={() => setEnding(true)}>
              End game
            </Button>
          )}
          {players.length === 0 && (
            <p className="text-sm text-muted-foreground">You can start once someone has joined.</p>
          )}
          <Button
            size="lg"
            disabled={players.length === 0}
            loading={pending === 'startQuestion'}
            onClick={() => void run('startQuestion', { roomId })}
          >
            Start game
          </Button>
        </footer>
      </section>

      <ConfirmModal
        open={ending}
        onClose={() => setEnding(false)}
        title="End this game?"
        description="Everyone in the room is told the game has finished, and the code stops working."
        confirmText="End game"
        loading={pending === 'endRoom'}
        onConfirm={async () => {
          const result = await run('endRoom', { roomId })
          setEnding(false)
          // Already confirmed here; don't ask again on the way out.
          if (result.success && quiz) navigate(`/quizzes/${quiz.recordId}`, { state: LEAVE_CONFIRMED })
        }}
      />

      <ConfirmModal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.displayName ?? 'player'}?`}
        description="They leave the game and can't rejoin with the code."
        confirmText="Remove"
        loading={pending === 'removePlayer'}
        onConfirm={async () => {
          if (removing) await run('removePlayer', { roomId, userId: removing.userId })
          setRemoving(null)
        }}
      />
    </div>
  )
}
