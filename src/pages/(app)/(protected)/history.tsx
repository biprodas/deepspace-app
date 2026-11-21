/**
 * Game history: /history (docs/features.md F10). Finished games you played
 * (your rank and score) and hosted (players, and a link to the question
 * breakdown on the room's final screen). Everything here is public game
 * data; each row opens the room's final screen.
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useUser } from 'deepspace'
import { ChevronRight, History } from 'lucide-react'
import { Badge, EmptyState } from '@/components/ui'
import { isClosedStatus, type Quiz, type Room, type RoomPlayer, type Standing } from '@/schemas/game-types'

const LIMIT = 30

export default function HistoryPage() {
  const { user } = useUser()
  const userId = user?.id ?? ''
  const played = useQuery<RoomPlayer>('room_players', {
    where: { userId },
    orderBy: 'joinedAt',
    orderDir: 'desc',
    limit: LIMIT,
  })
  const hosted = useQuery<Room>('rooms', { where: { hostId: userId }, orderBy: 'createdAt', orderDir: 'desc', limit: LIMIT })
  const hostedDone = hosted.records.filter((r) => isClosedStatus(r.data.status))
  const loading = !userId || played.status === 'loading' || hosted.status === 'loading'

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 pb-24 pt-8 sm:px-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">History</h1>
        <p className="mt-1 text-sm text-muted-foreground">Finished games you played or hosted.</p>
      </header>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : played.records.length === 0 && hostedDone.length === 0 ? (
        <EmptyState icon={<History />} title="No games yet" description="Games show up here once they finish." />
      ) : (
        <>
          <Section title="Played" testId="history-played">
            {played.records.map((p) => (
              <PlayedRow key={p.recordId} roomId={p.data.roomId} userId={userId} removed={p.data.removed} />
            ))}
          </Section>
          <Section title="Hosted" testId="history-hosted">
            {hostedDone.map((r) => (
              <HostedRow key={r.recordId} room={r} />
            ))}
          </Section>
        </>
      )}
    </div>
  )
}

function Section({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-bold">{title}</h2>
      {/* Rows render nothing for games still in progress; an empty list says so. */}
      <ul
        data-testid={testId}
        className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card empty:hidden"
      >
        {children}
      </ul>
    </section>
  )
}

function useRoomBits(roomId: string) {
  const rooms = useQuery<Room>('rooms', { where: { recordId: roomId }, limit: 1 })
  const room = rooms.records[0]
  const quizzes = useQuery<Quiz>('quizzes', { where: { recordId: room?.data.quizId ?? '' }, limit: 1 })
  const title = quizzes.records[0]?.data.title
  // Only call it deleted once the lookup has finished and found nothing.
  return { room, title: title ?? (room && quizzes.status === 'ready' ? 'Deleted quiz' : '…') }
}

function when(room: { updatedAt: string; data: Room }) {
  return new Date(room.data.completedAt ?? Date.parse(room.updatedAt)).toLocaleDateString()
}

function PlayedRow({ roomId, userId, removed }: { roomId: string; userId: string; removed: boolean }) {
  const { room, title } = useRoomBits(roomId)
  const standings = useQuery<Standing>('standings', { where: { roomId } })
  if (!room || !isClosedStatus(room.data.status)) return null
  const mine = standings.records.find((s) => s.data.userId === userId)?.data

  return (
    <li>
      <Link to={`/rooms/${roomId}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{title}</span>
          <span className="text-xs text-muted-foreground">
            {when(room)}
            {room.data.status === 'cancelled' && ' · ended early'}
          </span>
        </span>
        {removed ? (
          <Badge variant="secondary" size="sm">Removed</Badge>
        ) : mine ? (
          <span className="text-right">
            <span data-testid="history-rank" className="block font-mono font-bold">
              #{mine.rank} of {standings.records.length}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">{mine.score.toLocaleString()} pts</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No score</span>
        )}
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  )
}

function HostedRow({ room }: { room: { recordId: string; updatedAt: string; data: Room } }) {
  const { title } = useRoomBits(room.recordId)
  const players = useQuery<RoomPlayer>('room_players', { where: { roomId: room.recordId } })
  const count = players.records.filter((p) => !p.data.removed).length

  return (
    <li>
      <Link to={`/rooms/${room.recordId}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{title}</span>
          <span className="text-xs text-muted-foreground">
            {when(room)} · {count} player{count === 1 ? '' : 's'}
            {room.data.status === 'cancelled' && ' · ended early'}
          </span>
        </span>
        <span className="text-sm font-semibold text-primary-text">Results</span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  )
}
