/**
 * A shared note in a study space: /spaces/:spaceId/notes/:noteId
 * (docs/features.md F14). Every member edits live; the title saves on blur;
 * "Make a quiz" (top right) turns the note into a reviewed quiz. The note
 * is a bordered page on a tinted desk, so the writing area is obvious. The
 * app navigation gives way to the space bar (focus mode), which shows who is
 * online and who is in this note.
 */

import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import type { Editor } from '@tiptap/react'
import { MoreHorizontal, SearchX, Sparkles, Trash2 } from 'lucide-react'
import {
  Button,
  ConfirmModal,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
} from '@/components/ui'
import { NoteEditor } from '@/components/notes/NoteEditor'
import { QuizFromNoteModal } from '@/components/notes/QuizFromNoteModal'
import { SpaceFocusBar } from '@/components/space/SpaceFocusBar'
import { useFocusMode } from '@/lib/focus-mode'
import { LEAVE_CONFIRMED } from '@/lib/leave-guard'
import { NOTE_TITLE_MAX } from '@/lib/game-rules'
import { usePageTitle } from '@/lib/page-title'
import { useAction } from '@/lib/use-action'
import { useSpace } from '@/lib/use-space'
import type { Note } from '@/schemas/note-schemas'

export default function NotePage() {
  const { spaceId = '', noteId = '' } = useParams()
  const navigate = useNavigate()
  const { records, status } = useQuery<Note>('documents', { where: { recordId: noteId }, limit: 1 })
  const note = records[0]
  // The note's location is shared on the space's presence, so members see who's in which note.
  const location = useMemo(
    () => (note ? { kind: 'note' as const, id: noteId, title: note.data.title } : undefined),
    [note, noteId],
  )
  const spaceState = useSpace(spaceId, location)
  useFocusMode(!!note)
  const { run, pending } = useAction()
  const [makingQuiz, setMakingQuiz] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editor, setEditor] = useState<Editor | null>(null)
  usePageTitle(note?.data.title ?? 'Note')

  if (status === 'loading' && !note) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Loading note…</div>
  }
  if (!note) {
    return (
      <EmptyState
        icon={<SearchX />}
        title="Note not found"
        description="It may have been deleted, or you’re not a member of its space."
        action={{ label: 'Back to the space', onClick: () => navigate(`/spaces/${spaceId}?tab=notes`) }}
      />
    )
  }

  return (
    <>
      <SpaceFocusBar state={spaceState} section="notes" />
      {/* The "desk": a tinted surface the page sits on, so the writing area reads as one sheet. */}
      <div className="min-h-[calc(100dvh-3rem)] bg-muted/40 pb-16">
        <header className="mx-auto flex max-w-4xl items-center gap-x-3 gap-y-2 px-4 pb-4 pt-5 sm:px-2">
          <div className="min-w-0 flex-1">
            <input
              key={note.data.title}
              defaultValue={note.data.title}
              maxLength={NOTE_TITLE_MAX}
              aria-label="Note title"
              data-testid="note-title"
              onBlur={(e) => {
                const title = e.target.value.trim()
                if (title && title !== note.data.title) void run('renameNote', { noteId, title })
                else e.target.value = note.data.title
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="w-full rounded-md bg-transparent px-2 py-0.5 font-display text-xl font-bold sm:text-2xl tracking-tight outline-none hover:bg-accent/60 focus:bg-accent/60"
            />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button onClick={() => setMakingQuiz(true)} data-testid="quiz-from-note-open">
              <Sparkles />
              <span className="sm:hidden">Quiz</span>
              <span className="hidden sm:inline">Make a quiz</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Note options" />}>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setDeleting(true)} className="text-destructive focus:text-destructive">
                  <Trash2 aria-hidden /> Delete note
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="px-2 sm:px-4">
          <NoteEditor noteId={noteId} onEditor={setEditor} />
        </div>

        {makingQuiz && (
          <QuizFromNoteModal
            open
            onClose={() => setMakingQuiz(false)}
            noteTitle={note.data.title}
            getText={() => editor?.getText({ blockSeparator: '\n\n' }) ?? ''}
          />
        )}
        <ConfirmModal
          open={deleting}
          onClose={() => setDeleting(false)}
          title={`Delete “${note.data.title}”?`}
          description="It’s gone for everyone in the space."
          confirmText="Delete note"
          loading={pending === 'deleteNote'}
          onConfirm={async () => {
            const res = await run('deleteNote', { noteId })
            setDeleting(false)
            // Already confirmed by the delete dialog; don't ask "Leave this note?" too.
            if (res.success) navigate(`/spaces/${spaceId}?tab=notes`, { replace: true, state: LEAVE_CONFIRMED })
          }}
        />
      </div>
    </>
  )
}
