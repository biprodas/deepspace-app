/**
 * A room: /rooms/:roomId (docs/features.md F3). One URL for everyone; the
 * screen follows the viewer's role in the room and the room's status, both
 * read live, so a refresh lands back in the same place.
 */

import { useNavigate, useParams } from 'react-router-dom'
import { DoorOpen, Flag, UserX } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'
import { HostLobby } from '@/components/room/HostLobby'
import { FocusBar } from '@/components/room/FocusBar'
import { PlayerLobby } from '@/components/room/PlayerLobby'
import { ConnectionBanner } from '@/components/game/ConnectionBanner'
import { FinalScreen } from '@/components/game/FinalScreen'
import { HostGame } from '@/components/game/HostGame'
import { PlayerGame } from '@/components/game/PlayerGame'
import { useFocusMode } from '@/lib/focus-mode'
import { usePageTitle } from '@/lib/page-title'
import { useAction } from '@/lib/use-action'
import { useRoom, type RoomState } from '@/lib/use-room'
import { isClosedStatus, type Room } from '@/schemas/game-types'

export default function RoomPage() {
  // Above every state, so a dropped connection is always explained.
  return (
    <>
      <ConnectionBanner />
      <RoomBody />
    </>
  )
}

function RoomBody() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const state = useRoom(roomId)
  const { run, pending } = useAction()
  const { room, role } = state
  // Lobby and live game take the whole screen; results and refusals keep the nav.
  const inGame = !!room && !isClosedStatus(room.data.status) && ['host', 'co-host', 'player'].includes(role)
  useFocusMode(inGame)
  usePageTitle(room ? roomTitle(room.data) : 'Game')

  if (state.status === 'loading') {
    return <div className="p-10 text-center text-sm text-muted-foreground">Loading room…</div>
  }
  if (!room) {
    return (
      <EmptyState
        icon={<DoorOpen />}
        title="Room not found"
        description="Check the code with your host."
        action={{ label: 'Go home', onClick: () => navigate('/home') }}
      />
    )
  }
  if (role === 'removed') {
    return (
      <EmptyState
        icon={<UserX />}
        title="You were removed from this game"
        description="The host removed you, so you can’t rejoin this room."
        action={{ label: 'Go home', onClick: () => navigate('/home') }}
      />
    )
  }
  if (isClosedStatus(room.data.status) && role === 'outsider') {
    return (
      <EmptyState
        icon={<Flag />}
        title="This game has finished"
        action={{ label: 'Go home', onClick: () => navigate('/home') }}
      />
    )
  }
  if (role === 'outsider') {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 px-4 py-16 text-center">
        <p className="font-mono text-3xl font-bold tracking-[0.18em]">{room.data.code}</p>
        <p className="text-sm text-muted-foreground">You’re not in this game yet.</p>
        <Button
          size="lg"
          loading={pending === 'joinRoom'}
          onClick={() => void run('joinRoom', { code: room.data.code })}
        >
          Join game
        </Button>
      </div>
    )
  }

  const isPlayer = role === 'player'
  return (
    <>
      {inGame && <FocusBar state={state} />}
      <RoomScreen state={state} isPlayer={isPlayer} />
    </>
  )
}

function RoomScreen({ state, isPlayer }: { state: RoomState; isPlayer: boolean }) {
  switch (state.room?.data.status) {
    case 'lobby':
      return isPlayer ? <PlayerLobby state={state} /> : <HostLobby state={state} />
    case 'question':
    case 'paused':
    case 'reveal':
      return isPlayer ? <PlayerGame state={state} /> : <HostGame state={state} />
    case 'final':
    case 'cancelled':
      return <FinalScreen state={state} />
    default:
      return null
  }
}

/** Tab title that follows the game, so a host juggling tabs can find it. */
function roomTitle(room: Room): string {
  switch (room.status) {
    case 'lobby':
      return `Lobby ${room.code}`
    case 'final':
    case 'cancelled':
      return 'Results'
    default:
      return `Live · ${room.code}`
  }
}
