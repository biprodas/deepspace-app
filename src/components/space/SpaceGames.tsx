/**
 * Games in a space: open ones to jump into, recent finished ones, and for
 * members with a ready quiz, "Host a game" here.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { ChevronRight, Gamepad2, Play } from 'lucide-react'
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { useAction } from '@/lib/use-action'
import type { SpaceState } from '@/lib/use-space'
import { isClosedStatus, type Quiz } from '@/schemas/game-types'

export function SpaceGames({ state }: { state: SpaceState }) {
  const { space, rooms, userId } = state
  const navigate = useNavigate()
  const { run, pending } = useAction()
  const quizzes = useQuery<Quiz>('quizzes', { where: { ownerId: userId ?? '' }, orderBy: 'updatedAt', orderDir: 'desc' })
  const ready = quizzes.records.filter((q) => q.data.status === 'ready')
  const [quizId, setQuizId] = useState<string>('')
  if (!space) return null

  const open = rooms.filter((r) => !isClosedStatus(r.data.status))
  const finished = rooms.filter((r) => isClosedStatus(r.data.status)).slice(0, 5)

  async function host() {
    const res = await run<{ roomId: string }>('createRoom', { quizId, spaceId: space!.recordId })
    if (res.success) navigate(`/rooms/${res.data.roomId}`)
  }

  return (
    <section aria-labelledby="space-games">
      <h2 id="space-games" className="mb-3 font-display text-lg font-bold">
        Games
      </h2>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        {ready.length > 0 ? (
          <>
            <Select value={quizId} onValueChange={(v) => setQuizId(String(v ?? ''))}>
              <SelectTrigger className="min-w-0 flex-1" aria-label="Quiz to host">
                <SelectValue placeholder="Pick one of your quizzes" />
              </SelectTrigger>
              <SelectContent>
                {ready.map((q) => (
                  <SelectItem key={q.recordId} value={q.recordId}>
                    {q.data.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={!quizId} loading={pending === 'createRoom'} onClick={() => void host()} data-testid="host-in-space">
              <Play /> Host here
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link to="/quizzes/new" className="font-semibold text-primary-text hover:underline">
              Create a quiz
            </Link>{' '}
            to host a game in this space.
          </p>
        )}
      </div>

      {rooms.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Gamepad2 className="size-4" aria-hidden="true" /> No games here yet.
        </p>
      ) : (
        <ul data-testid="space-games" className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {[...open, ...finished].map((room) => {
            const live = !isClosedStatus(room.data.status)
            return (
              <li key={room.recordId}>
                <Link to={`/rooms/${room.recordId}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent">
                  <span className="font-mono font-bold tracking-[0.15em]">{room.data.code}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {new Date(room.createdAt).toLocaleDateString()}
                  </span>
                  <Badge variant={live ? 'success' : 'secondary'} size="sm">
                    {live ? (room.data.status === 'lobby' ? 'In the lobby' : 'Live') : 'Finished'}
                  </Badge>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
