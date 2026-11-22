/**
 * A board in a study space: /spaces/:spaceId/boards/:boardId
 * (docs/features.md F15). Members draw together; a generated mind map is
 * drawn once by whoever generated it, then edited like any board.
 */

import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useUser } from 'deepspace'
import { ArrowLeft, MoreHorizontal, SearchX, Trash2 } from 'lucide-react'
import {
  Button,
  ConfirmModal,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
} from '@/components/ui'
import { CanvasView } from '@/components/boards/CanvasView'
import { BOARD_TITLE_MAX } from '@/lib/game-rules'
import { layoutMindMap, mindMapSchema } from '@/lib/mindmap'
import { usePageTitle } from '@/lib/page-title'
import { useAction } from '@/lib/use-action'
import type { Board } from '@/schemas/board-schemas'

/** Where layoutMindMap puts the root; the view starts centred there. */
const MAP_CENTER = { x: 600, y: 420 }

export default function BoardPage() {
  const { spaceId = '', boardId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useUser()
  const { records, status } = useQuery<Board>('boards', { where: { recordId: boardId }, limit: 1 })
  const board = records[0]
  const { run, pending } = useAction()
  const [deleting, setDeleting] = useState(false)
  usePageTitle(board?.data.title ?? 'Board')

  // The generated map, laid out, for its creator to draw once.
  const drawOnce = useMemo(() => {
    if (!board || board.data.kind !== 'mindmap' || board.data.mindMapDrawn || board.data.ownerId !== user?.id) return undefined
    const parsed = mindMapSchema.safeParse(board.data.mindMap)
    return parsed.success ? layoutMindMap(parsed.data, MAP_CENTER.x, MAP_CENTER.y) : undefined
  }, [board, user?.id])
  const onDrawn = useCallback(() => void run('markMindMapDrawn', { boardId }), [run, boardId])

  const back = `/spaces/${spaceId}?tab=boards`

  if (status === 'loading' && !board) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Loading board…</div>
  }
  if (!board) {
    return (
      <EmptyState
        icon={<SearchX />}
        title="Board not found"
        description="It may have been deleted, or you’re not a member of its space."
        action={{ label: 'Back to the space', onClick: () => navigate(back) }}
      />
    )
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Link to={back} aria-label="Back to the space" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <input
          key={board.data.title}
          defaultValue={board.data.title}
          maxLength={BOARD_TITLE_MAX}
          aria-label="Board title"
          onBlur={(e) => {
            const title = e.target.value.trim()
            if (title && title !== board.data.title) void run('renameBoard', { boardId, title })
            else e.target.value = board.data.title
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 font-display text-lg font-bold outline-none hover:bg-accent/50 focus:bg-accent/50"
        />
        {board.data.topic && (
          <span className="hidden text-xs text-muted-foreground sm:inline">From Wikipedia: {board.data.topic}</span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Board options" />}>
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => setDeleting(true)} className="text-destructive focus:text-destructive">
              <Trash2 aria-hidden /> Delete board
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <CanvasView
        key={board.recordId}
        docId={board.recordId}
        className="min-h-0 flex-1"
        center={board.data.kind === 'mindmap' ? MAP_CENTER : undefined}
        drawOnce={drawOnce}
        onDrawn={onDrawn}
      />

      <ConfirmModal
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete “${board.data.title}”?`}
        description="It’s gone for everyone in the space."
        confirmText="Delete board"
        loading={pending === 'deleteBoard'}
        onConfirm={async () => {
          const res = await run('deleteBoard', { boardId })
          setDeleting(false)
          if (res.success) navigate(back, { replace: true })
        }}
      />
    </div>
  )
}
