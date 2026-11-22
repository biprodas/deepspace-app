/**
 * Home: /home. The way back into a game after closing the tab
 * (docs/features.md F7): invites waiting for you and every open room you
 * host or play in, live, plus a code field and the way to your quizzes. Signed-out visitors get the code
 * field and a sign-in prompt; all game pages themselves require sign-in.
 */

import { usePageTitle } from '@/lib/page-title'
import { Link } from 'react-router-dom'
import { useAuthProfileReady, useQuery } from 'deepspace'
import { ChevronRight, ListChecks, Plus, Radio } from 'lucide-react'
import { Badge, buttonVariants, cn } from '@/components/ui'
import { JoinCodeForm } from '@/components/landing/JoinCodeForm'
import { InvitesCard } from '@/components/room/InvitesCard'
import { signInPath } from '@/lib/auth-redirect'
import { isClosedStatus, type Room, type RoomPlayer, type RoomStatus } from '@/schemas/game-types'

const STATUS_LABEL: Record<RoomStatus, string> = {
  lobby: 'In the lobby',
  question: 'Question live',
  paused: 'Paused',
  reveal: 'Showing answer',
  final: 'Finished',
  cancelled: 'Ended',
}

export default function HomePage() {
  const { isSignedIn, user } = useAuthProfileReady({ requireUser: true })
  const userId = isSignedIn ? (user?.id ?? '') : ''
  usePageTitle('Home')

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 pb-24 pt-10 sm:px-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {isSignedIn && user?.name ? `Hi, ${user.name.split(' ')[0]}` : 'StudyArena'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Join a game with a code, or pick up where you left off.</p>
      </header>

      <JoinCodeForm variant="hero" signInHint={!isSignedIn} />

      {isSignedIn && userId ? (
        <>
          <InvitesCard />
          <YourGames userId={userId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/quizzes/new" className={cn(buttonVariants(), 'h-12')}>
              <Plus /> Create a quiz
            </Link>
            <Link to="/quizzes" className={cn(buttonVariants({ variant: 'outline' }), 'h-12')}>
              <ListChecks /> My quizzes
            </Link>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link to={signInPath('/home')} className="font-bold text-primary-text hover:underline">
            Sign in
          </Link>{' '}
          to host a game or see your games.
        </p>
      )}
    </div>
  )
}

/** Rooms idle longer than this were abandoned without "End game"; don't list them. */
const RECENT_MS = 24 * 60 * 60 * 1000
const MAX_GAMES = 5

/**
 * Open rooms the user hosts or plays in (not removed from), most recently
 * active first. Player rooms are looked up by id (`room_players` → `rooms`),
 * so we rank memberships by when they last changed and render the newest.
 */
function YourGames({ userId }: { userId: string }) {
  const hosted = useQuery<Room>('rooms', { where: { hostId: userId }, orderBy: 'updatedAt', orderDir: 'desc', limit: 20 })
  const memberships = useQuery<RoomPlayer>('room_players', {
    where: { userId },
    orderBy: 'updatedAt',
    orderDir: 'desc',
    limit: 20,
  })
  const since = Date.now() - RECENT_MS
  const recent = (r: { updatedAt: string }) => Date.parse(r.updatedAt) > since
  const hostedOpen = hosted.records.filter((r) => !isClosedStatus(r.data.status) && recent(r)).slice(0, MAX_GAMES)
  const playing = memberships.records
    .filter((m) => !m.data.removed && recent(m))
    .slice(0, MAX_GAMES)
    .map((m) => m.data.roomId)

  if (hosted.status === 'loading' || memberships.status === 'loading') return null
  if (hostedOpen.length === 0 && playing.length === 0) return null

  return (
    <section aria-labelledby="your-games">
      <h2 id="your-games" className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
        <Radio className="size-5 text-primary" aria-hidden="true" /> Your games
      </h2>
      <ul data-testid="your-games" className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {hostedOpen.map((room) => (
          <GameRow key={room.recordId} room={room} role="Hosting" />
        ))}
        {playing.map((roomId) => (
          <PlayingRow key={roomId} roomId={roomId} since={since} />
        ))}
      </ul>
    </section>
  )
}

/** A room the user plays in, shown only while it's open and recently active. */
function PlayingRow({ roomId, since }: { roomId: string; since: number }) {
  const { records } = useQuery<Room>('rooms', { where: { recordId: roomId }, limit: 1 })
  const room = records[0]
  if (!room || isClosedStatus(room.data.status) || Date.parse(room.updatedAt) <= since) return null
  return <GameRow room={room} role="Playing" />
}

function GameRow({ room, role }: { room: { recordId: string; data: Room }; role: 'Hosting' | 'Playing' }) {
  const live = room.data.status !== 'lobby'
  return (
    <li>
      <Link
        to={`/rooms/${room.recordId}`}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
      >
        <span className="font-mono font-bold tracking-[0.15em]">{room.data.code}</span>
        <span className="text-sm text-muted-foreground">{role}</span>
        <Badge variant={live ? 'success' : 'secondary'} size="sm" className="ml-auto">
          {STATUS_LABEL[room.data.status]}
        </Badge>
        <span className="text-sm font-semibold text-primary-text">{live ? 'Rejoin' : 'Open'}</span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  )
}
