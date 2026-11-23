/** A space's shared notes, newest first, and a way to start one. */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { ChevronRight, FileText, Plus } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { NOTE_TITLE_MAX } from '@/lib/game-rules'
import { useAction } from '@/lib/use-action'
import type { SpaceState } from '@/lib/use-space'
import type { Note } from '@/schemas/note-schemas'

export function SpaceNotes({ state }: { state: SpaceState }) {
  const { space, members } = state
  const navigate = useNavigate()
  const { run, pending } = useAction()
  const [title, setTitle] = useState('')
  const notes = useQuery<Note>('documents', {
    where: { spaceId: space?.recordId ?? '' },
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  if (!space) return null
  const nameOf = (userId: string) => members.find((m) => m.data.userId === userId)?.data.displayName ?? 'A former member'

  async function create(e: FormEvent) {
    e.preventDefault()
    const res = await run<{ noteId: string }>('createNote', { spaceId: space!.recordId, title: title.trim() })
    if (res.success) navigate(`/spaces/${space!.recordId}/notes/${res.data.noteId}`)
  }

  return (
    <section aria-labelledby="space-notes" className="space-y-4">
      <h2 id="space-notes" className="sr-only">
        Notes
      </h2>
      <form onSubmit={create} className="flex gap-2">
        <Input
          value={title}
          maxLength={NOTE_TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New note title, e.g. Week 3: cell respiration"
          aria-label="New note title"
        />
        <Button type="submit" disabled={!title.trim()} loading={pending === 'createNote'} data-testid="create-note">
          <Plus /> New note
        </Button>
      </form>

      {notes.records.length === 0 ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <FileText className="size-4" aria-hidden="true" />
          No notes yet. Everyone in the space can write in a note at the same time.
        </p>
      ) : (
        <ul data-testid="space-notes" className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {notes.records.map((note) => (
            <li key={note.recordId}>
              <Link
                to={`/spaces/${space.recordId}/notes/${note.recordId}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{note.data.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {nameOf(note.data.ownerId)} · {new Date(note.updatedAt).toLocaleDateString()}
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
