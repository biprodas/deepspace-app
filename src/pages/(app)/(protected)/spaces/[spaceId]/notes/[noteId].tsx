/**
 * A shared note in a study space: /spaces/:spaceId/notes/:noteId
 * (docs/features.md F14). Every member edits live; the title saves on blur;
 * "Make a quiz" turns the note into a reviewed quiz.
 */

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import type { Editor } from '@tiptap/react'
import { ArrowLeft, MoreHorizontal, SearchX, Sparkles, Trash2 } from 'lucide-react'
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
import { NOTE_TITLE_MAX } from '@/lib/game-rules'
import { usePageTitle } from '@/lib/page-title'
import { useAction } from '@/lib/use-action'
import type { Note } from '@/schemas/note-schemas'

export default function NotePage() {
  const { spaceId = '', noteId = '' } = useParams()
  const navigate = useNavigate()
  const { records, status } = useQuery<Note>('documents', { where: { recordId: noteId }, limit: 1 })
  const note = records[0]
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
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-5xl flex-col px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-2 flex items-center gap-2">
        <Link
          to={`/spaces/${spaceId}?tab=notes`}
          aria-label="Back to the space"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
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
          className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 font-display text-2xl font-bold tracking-tight outline-none hover:bg-accent/50 focus:bg-accent/50"
        />
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
      </header>

      <NoteEditor noteId={noteId} onEditor={setEditor}>
        <Button size="sm" variant="outline" onClick={() => setMakingQuiz(true)} data-testid="quiz-from-note-open">
          <Sparkles /> Make a quiz
        </Button>
      </NoteEditor>

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
          if (res.success) navigate(`/spaces/${spaceId}?tab=notes`, { replace: true })
        }}
      />
    </div>
  )
}
