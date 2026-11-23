/**
 * A space's boards: whiteboards members draw on together, and AI mind maps
 * generated from a Wikipedia topic (docs/features.md F15).
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { ChevronRight, Network, PenTool, Plus, Sparkles } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { BOARD_TITLE_MAX, DAILY_MINDMAP_LIMIT } from '@/lib/game-rules'
import { useAction } from '@/lib/use-action'
import type { SpaceState } from '@/lib/use-space'
import type { Board } from '@/schemas/board-schemas'

export function SpaceBoards({ state }: { state: SpaceState }) {
  const { space, members } = state
  const navigate = useNavigate()
  const { run, pending } = useAction()
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const boards = useQuery<Board>('boards', {
    where: { spaceId: space?.recordId ?? '' },
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  if (!space) return null
  const spaceId = space.recordId
  const nameOf = (userId: string) => members.find((m) => m.data.userId === userId)?.data.displayName ?? 'A former member'
  const open = (boardId: string) => navigate(`/spaces/${spaceId}/boards/${boardId}`)

  async function createWhiteboard(e: FormEvent) {
    e.preventDefault()
    const res = await run<{ boardId: string }>('createBoard', { spaceId, title: title.trim() })
    if (res.success) open(res.data.boardId)
  }

  async function createMindMap(e: FormEvent) {
    e.preventDefault()
    const res = await run<{ boardId: string }>('createMindMap', { spaceId, topic: topic.trim() })
    if (res.success) open(res.data.boardId)
  }

  return (
    <section aria-labelledby="space-boards" className="space-y-4">
      <h2 id="space-boards" className="sr-only">
        Boards
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        <form onSubmit={createWhiteboard} className="space-y-2 rounded-xl border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <PenTool className="size-4 text-primary" aria-hidden="true" /> Whiteboard
          </p>
          <p className="text-xs text-muted-foreground">Draw and sketch together, with everyone’s cursor on the board.</p>
          <div className="flex gap-2">
            <Input
              value={title}
              maxLength={BOARD_TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Board title"
              aria-label="Whiteboard title"
            />
            <Button type="submit" disabled={!title.trim()} loading={pending === 'createBoard'} data-testid="create-whiteboard">
              <Plus /> Create
            </Button>
          </div>
        </form>

        <form onSubmit={createMindMap} className="space-y-2 rounded-xl border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Network className="size-4 text-primary" aria-hidden="true" /> AI mind map
          </p>
          <p className="text-xs text-muted-foreground">
            Claude maps a Wikipedia topic; then edit it together. Up to {DAILY_MINDMAP_LIMIT} a day.
          </p>
          <div className="flex gap-2">
            <Input
              value={topic}
              maxLength={120}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic, e.g. Photosynthesis"
              aria-label="Mind map topic"
            />
            <Button type="submit" disabled={!topic.trim()} loading={pending === 'createMindMap'} data-testid="create-mindmap">
              <Sparkles /> Generate
            </Button>
          </div>
          {pending === 'createMindMap' && (
            <p role="status" className="text-xs text-muted-foreground">
              Reading the article and drafting the map, about 20 seconds…
            </p>
          )}
        </form>
      </div>

      {boards.records.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">No boards yet.</p>
      ) : (
        <ul data-testid="space-boards" className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {boards.records.map((board) => (
            <li key={board.recordId}>
              <Link
                to={`/spaces/${spaceId}/boards/${board.recordId}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
              >
                {board.data.kind === 'mindmap' ? (
                  <Network className="size-4 shrink-0 text-muted-foreground" aria-label="Mind map" />
                ) : (
                  <PenTool className="size-4 shrink-0 text-muted-foreground" aria-label="Whiteboard" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{board.data.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {nameOf(board.data.ownerId)} · {new Date(board.updatedAt).toLocaleDateString()}
                  </span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
