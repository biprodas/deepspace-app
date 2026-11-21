/**
 * One question in the quiz editor: what players will see, plus the answer
 * key only the owner can read, and the owner's controls.
 */

import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, RefreshCw, Timer, Trash2 } from 'lucide-react'
import { Badge, Button, ConfirmModal, cn } from '@/components/ui'
import { AnswerChip } from '@/components/landing/bits'
import { SourceQuote } from '@/components/game/RevealPanel'
import type { AnswerKey, Question } from '@/schemas/game-types'
import { QuestionForm, type QuestionValues } from './QuestionForm'

interface QuestionCardProps {
  number: number
  question: Question
  answerKey?: AnswerKey
  isFirst: boolean
  isLast: boolean
  pending: string | null
  questionId: string
  onSave: (values: QuestionValues) => Promise<boolean>
  onApprove: (approved: boolean) => void
  onMove: (direction: 'up' | 'down') => void
  onDelete: () => Promise<void>
  /** Set for AI-drafted quizzes: ask Claude for a replacement question. */
  onRegenerate?: () => void
  /** A replacement is being drafted; the card is read-only until it lands. */
  regenerating?: boolean
}

export function QuestionCard({
  number,
  question,
  answerKey,
  isFirst,
  isLast,
  pending,
  questionId,
  onSave,
  onApprove,
  onMove,
  onDelete,
  onRegenerate,
  regenerating,
}: QuestionCardProps) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const busy = (what: string) => pending === `${what}:${questionId}`

  if (editing) {
    return (
      <article className="rounded-xl border border-primary/50 bg-card p-5">
        <p className="mb-4 font-mono text-xs font-bold text-muted-foreground">Q{number} · editing</p>
        <QuestionForm
          initial={{
            prompt: question.prompt,
            options: question.options,
            correctIndex: answerKey?.correctIndex ?? 0,
            explanation: answerKey?.explanation ?? '',
            timeLimit: question.timeLimit,
          }}
          submitLabel="Save question"
          onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            const saved = await onSave(values)
            if (saved) setEditing(false)
            return saved
          }}
        />
      </article>
    )
  }

  return (
    <article
      data-testid="question-card"
      className={cn(
        'rounded-xl border bg-card p-5 transition-colors',
        question.approved ? 'border-border' : 'border-dashed border-warning/60',
      )}
    >
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-bold text-muted-foreground">Q{number}</span>
        {question.approved ? (
          <Badge variant="success" size="sm">Approved</Badge>
        ) : (
          <Badge variant="warning" size="sm">Draft · not playable</Badge>
        )}
        <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
          <Timer className="size-3.5" aria-hidden="true" />
          {question.timeLimit}s
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Move up"
            disabled={isFirst || busy('move')}
            onClick={() => onMove('up')}
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Move down"
            disabled={isLast || busy('move')}
            onClick={() => onMove('down')}
          >
            <ArrowDown />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Edit" onClick={() => setEditing(true)}>
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 hover:text-destructive"
            aria-label="Delete"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 />
          </Button>
        </div>
      </header>

      <h3 className="mb-3 text-base font-semibold leading-snug">{question.prompt}</h3>

      <ul className="grid gap-2 sm:grid-cols-2">
        {question.options.map((option, i) => {
          const correct = answerKey?.correctIndex === i
          return (
            <li
              key={i}
              className={cn(
                'flex items-center gap-2 rounded-lg border p-1.5 pr-3 text-sm',
                correct ? 'border-correct bg-correct/10 font-semibold' : 'border-border',
              )}
            >
              <AnswerChip index={i} />
              <span className="min-w-0 flex-1 break-words">{option}</span>
              {correct && <Check className="size-4 shrink-0 text-correct-text" strokeWidth={3} aria-label="Correct answer" />}
            </li>
          )
        })}
      </ul>

      {answerKey?.explanation && (
        <p className="mt-3 text-sm text-muted-foreground">{answerKey.explanation}</p>
      )}
      {answerKey?.sourceQuote && (
        <div className="mt-3 text-sm">
          <SourceQuote quote={answerKey.sourceQuote} url={answerKey.sourceUrl} />
        </div>
      )}

      <footer className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {regenerating ? (
          <span role="status" className="mr-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Drafting a replacement…
          </span>
        ) : (
          onRegenerate && (
            <Button variant="ghost" size="sm" className="mr-auto" loading={busy('regenerate')} onClick={onRegenerate}>
              <RefreshCw /> Regenerate
            </Button>
          )
        )}
        {question.approved ? (
          <Button variant="ghost" size="sm" loading={busy('approve')} onClick={() => onApprove(false)}>
            Move back to draft
          </Button>
        ) : (
          <Button size="sm" loading={busy('approve')} onClick={() => onApprove(true)}>
            <Check /> Approve
          </Button>
        )}
      </footer>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this question?"
        description="It will be removed from the quiz along with its answer."
        confirmText="Delete question"
        loading={busy('delete')}
        onConfirm={async () => {
          await onDelete()
          setConfirmDelete(false)
        }}
      />
    </article>
  )
}
