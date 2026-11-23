/**
 * "Add to notes" on a reveal, for games played in a study space
 * (docs/features.md F14): appends the question, answer, explanation and
 * source to the game's session note, which `sessionNote` creates on first
 * use. The append happens over the note's Yjs room, so anyone with the note
 * open sees it arrive.
 */

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useYjsRoom } from 'deepspace'
import { Check, NotebookPen } from 'lucide-react'
import { Button, useToast } from '@/components/ui'
import { appendToNote, revealBlocks } from '@/lib/note-append'
import { useAction } from '@/lib/use-action'
import type { Question, Round } from '@/schemas/game-types'
import type { TeamMember } from '@/schemas/space-types'

interface AddToNotesProps {
  roomId: string
  /** The room's study space; the button shows only to its active members. */
  spaceId: string
  userId?: string
  roundId: string
  question: Question
  round: Round
}

export function AddToNotes({ roomId, spaceId, userId, roundId, question, round }: AddToNotesProps) {
  const { run, pending } = useAction()
  // Members can read their own membership row; anyone else gets nothing back.
  const membership = useQuery<TeamMember>('team_members', { where: { teamId: spaceId, userId: userId ?? '' }, limit: 1 })
  const [target, setTarget] = useState<{ noteId: string; spaceId: string } | null>(null)
  const [addedTo, setAddedTo] = useState<{ roundId: string; noteId: string; spaceId: string } | null>(null)
  const added = addedTo?.roundId === roundId

  if (membership.records[0]?.data.status !== 'active') return null

  async function add() {
    const res = await run<{ noteId: string; spaceId: string }>('sessionNote', { roomId })
    if (res.success) setTarget(res.data)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        data-testid="add-to-notes"
        disabled={added || target !== null}
        loading={pending === 'sessionNote' || target !== null}
        onClick={() => void add()}
      >
        {added ? <Check /> : <NotebookPen />}
        {added ? 'Added to notes' : 'Add to notes'}
      </Button>
      {target && (
        <Appender
          noteId={target.noteId}
          blocks={revealBlocks(question, round)}
          onDone={(ok) => {
            if (ok) setAddedTo({ roundId, ...target })
            setTarget(null)
          }}
        />
      )}
      {added && (
        <Link
          to={`/spaces/${addedTo.spaceId}/notes/${addedTo.noteId}`}
          className="text-sm font-semibold text-primary-text hover:underline"
        >
          Open notes
        </Link>
      )}
    </div>
  )
}

/** Connects to the note, appends once it has synced, then reports back. Renders nothing. */
function Appender({
  noteId,
  blocks,
  onDone,
}: {
  noteId: string
  blocks: ReturnType<typeof revealBlocks>
  onDone: (ok: boolean) => void
}) {
  const { doc, synced, canWrite, writeAuthResolved } = useYjsRoom(noteId, 'content')
  const toast = useToast()
  const done = useRef(false)

  useEffect(() => {
    if (done.current || !synced || !writeAuthResolved) return
    done.current = true
    if (canWrite) {
      appendToNote(doc, blocks)
      toast.success('Added to the session notes')
    } else {
      toast.error('You can’t edit this space’s notes')
    }
    onDone(canWrite)
  }, [synced, writeAuthResolved, canWrite, doc, blocks, toast, onDone])

  return null
}
