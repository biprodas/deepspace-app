/**
 * "Make a quiz from these notes": the note's text goes to the existing
 * notes generator (createQuiz with sourceType 'notes'), so every question
 * is backed by a sentence from the note, and lands on the quiz's review page.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Label, Modal, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import { MAX_NOTES_CHARS, MAX_QUESTIONS, MIN_QUESTIONS } from '@/lib/game-rules'
import { LEAVE_CONFIRMED } from '@/lib/leave-guard'
import { useAction } from '@/lib/use-action'
import { DIFFICULTIES, type Difficulty } from '@/schemas/game-types'

/** The generator needs some text to work from (src/lib/quiz-input.ts). */
export const MIN_NOTE_CHARS = 200

interface QuizFromNoteModalProps {
  open: boolean
  onClose: () => void
  noteTitle: string
  /** Read when the quiz is created, so it uses the latest text. */
  getText: () => string
}

export function QuizFromNoteModal({ open, onClose, noteTitle, getText }: QuizFromNoteModalProps) {
  const navigate = useNavigate()
  const { run, pending } = useAction()
  const [title, setTitle] = useState(noteTitle)
  const [count, setCount] = useState(String(MIN_QUESTIONS))
  const [difficulty, setDifficulty] = useState<Difficulty>('mixed')
  const length = open ? getText().trim().length : 0
  const tooShort = length < MIN_NOTE_CHARS

  async function create() {
    const notes = getText().trim().slice(0, MAX_NOTES_CHARS)
    const res = await run<{ quizId: string }>('createQuiz', {
      sourceType: 'notes',
      title: title.trim(),
      notes,
      questionCount: Number(count),
      difficulty,
    })
    // Choosing "Make quiz" is the decision to leave; skip the note's leave prompt.
    if (res.success) navigate(`/quizzes/${res.data.quizId}`, { state: LEAVE_CONFIRMED })
  }

  return (
    <Modal open={open} onClose={onClose} size="md" data-testid="quiz-from-note">
      <Modal.Header>
        <Modal.Title>Make a quiz from these notes</Modal.Title>
        <Modal.Description>
          Claude drafts questions from this note, each backed by a sentence from it. You review them before playing.
        </Modal.Description>
      </Modal.Header>
      <Modal.Body className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="note-quiz-title">Quiz title</Label>
          <Input id="note-quiz-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Questions</Label>
            <Select value={count} onValueChange={(v) => setCount(String(v))}>
              <SelectTrigger aria-label="Number of questions">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: MAX_QUESTIONS - MIN_QUESTIONS + 1 }, (_, i) => String(MIN_QUESTIONS + i)).map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
              <SelectTrigger aria-label="Difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d[0].toUpperCase() + d.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {tooShort && (
          <p role="status" className="rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
            The note needs at least {MIN_NOTE_CHARS} characters to make a quiz ({length} so far).
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={tooShort || !title.trim()} loading={pending === 'createQuiz'} onClick={() => void create()}>
          Make quiz
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
