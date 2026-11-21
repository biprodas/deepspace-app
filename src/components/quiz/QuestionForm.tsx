/**
 * Write or edit one question: prompt, four options with the correct one
 * marked, an optional explanation and a time limit. Validates with the same
 * schema the server uses, so most mistakes show before a round trip.
 */

import { useId, useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { Button, Input, Label, Textarea, cn } from '@/components/ui'
import { AnswerChip } from '@/components/landing/bits'
import { DEFAULT_TIME_LIMIT, OPTION_COUNT, TIME_LIMITS } from '@/lib/game-rules'
import { firstError, newQuestion } from '@/lib/quiz-input'

export interface QuestionValues {
  prompt: string
  options: string[]
  correctIndex: number
  explanation: string
  timeLimit: number
}

export const EMPTY_QUESTION: QuestionValues = {
  prompt: '',
  options: Array(OPTION_COUNT).fill(''),
  correctIndex: 0,
  explanation: '',
  timeLimit: DEFAULT_TIME_LIMIT,
}

interface QuestionFormProps {
  initial?: QuestionValues
  submitLabel: string
  /** Resolves true when saved; the form then resets (add) or closes (edit). */
  onSubmit: (values: QuestionValues) => Promise<boolean>
  onCancel?: () => void
}

export function QuestionForm({ initial = EMPTY_QUESTION, submitLabel, onSubmit, onCancel }: QuestionFormProps) {
  const id = useId()
  const [values, setValues] = useState<QuestionValues>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof QuestionValues>(key: K, value: QuestionValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    setError(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const problem = firstError(newQuestion, values)
    if (problem) return setError(problem)
    setSaving(true)
    const saved = await onSubmit(values)
    setSaving(false)
    if (saved && !onCancel) setValues(EMPTY_QUESTION)
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor={`${id}-prompt`}>Question</Label>
        <Textarea
          id={`${id}-prompt`}
          value={values.prompt}
          onChange={(e) => set('prompt', e.target.value)}
          placeholder="Which molecule is split during the light-dependent reactions?"
          maxLength={300}
          rows={2}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">
          Options <span className="font-normal text-muted-foreground">· tick the correct one</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {values.options.map((option, i) => {
            const correct = values.correctIndex === i
            return (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-2 rounded-lg border bg-background p-1.5 pr-2 transition-colors',
                  correct ? 'border-correct ring-1 ring-correct' : 'border-border',
                )}
              >
                <AnswerChip index={i} />
                <Input
                  aria-label={`Option ${'ABCD'[i]}`}
                  value={option}
                  onChange={(e) =>
                    set('options', values.options.map((o, j) => (j === i ? e.target.value : o)))
                  }
                  maxLength={160}
                  className="h-8 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                />
                <button
                  type="button"
                  onClick={() => set('correctIndex', i)}
                  aria-pressed={correct}
                  aria-label={`Mark option ${'ABCD'[i]} correct`}
                  className={cn(
                    'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors',
                    correct
                      ? 'border-correct bg-correct text-white'
                      : 'border-border text-transparent hover:border-correct hover:text-correct-text',
                  )}
                >
                  <Check className="size-4" strokeWidth={3} />
                </button>
              </div>
            )
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor={`${id}-explanation`}>
          Explanation <span className="font-normal text-muted-foreground">· shown at reveal, optional</span>
        </Label>
        <Textarea
          id={`${id}-explanation`}
          value={values.explanation}
          onChange={(e) => set('explanation', e.target.value)}
          placeholder="Photolysis splits water, releasing oxygen."
          maxLength={1000}
          rows={2}
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Time limit</legend>
        <div className="inline-flex rounded-lg border border-border p-0.5" role="radiogroup">
          {TIME_LIMITS.map((seconds) => (
            <button
              key={seconds}
              type="button"
              role="radio"
              aria-checked={values.timeLimit === seconds}
              onClick={() => set('timeLimit', seconds)}
              className={cn(
                'cursor-pointer rounded-md px-3 py-1.5 font-mono text-xs font-bold transition-colors',
                values.timeLimit === seconds
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {seconds}s
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
