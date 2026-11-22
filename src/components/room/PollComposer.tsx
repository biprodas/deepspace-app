/**
 * The host's "new poll" dialog: start from a template (confidence check,
 * ready?, pace) or write a question with 2–6 options. Opening a poll closes
 * the one before it.
 */

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button, Input, Label, Modal, cn } from '@/components/ui'
import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS, POLL_OPTION_MAX, POLL_QUESTION_MAX } from '@/lib/game-rules'
import { POLL_TEMPLATES } from '@/lib/polls'
import { useAction } from '@/lib/use-action'
import type { PollKind } from '@/schemas/game-types'

interface PollComposerProps {
  roomId: string
  open: boolean
  onClose: () => void
}

export function PollComposer({ roomId, open, onClose }: PollComposerProps) {
  const { run, pending } = useAction()
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [kind, setKind] = useState<PollKind>('poll')
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])

  function applyTemplate(id: string) {
    const t = POLL_TEMPLATES.find((x) => x.id === id)
    if (!t) return
    setTemplateId(id)
    setKind(t.kind)
    setQuestion(t.question)
    setOptions([...t.options])
  }

  function reset() {
    setTemplateId(null)
    setKind('poll')
    setQuestion('')
    setOptions(['', ''])
  }

  const filled = options.map((o) => o.trim()).filter(Boolean)
  const valid = question.trim().length > 0 && filled.length >= POLL_MIN_OPTIONS

  async function submit() {
    const res = await run('createPoll', { roomId, question: question.trim(), options: filled, kind })
    if (res.success) {
      reset()
      onClose()
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md" data-testid="poll-composer">
      <Modal.Header>
        <Modal.Title>New poll</Modal.Title>
        <Modal.Description>Everyone in the room sees it right away. Votes are anonymous.</Modal.Description>
      </Modal.Header>
      <Modal.Body className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {POLL_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-accent',
                templateId === t.id ? 'border-primary bg-primary/10 text-primary-text' : 'border-border',
              )}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            onClick={reset}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-accent',
              templateId === null ? 'border-primary bg-primary/10 text-primary-text' : 'border-border',
            )}
          >
            Custom
          </button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="poll-question">Question</Label>
          <Input
            id="poll-question"
            value={question}
            maxLength={POLL_QUESTION_MAX}
            onChange={(e) => {
              setQuestion(e.target.value)
              setTemplateId(null)
            }}
            placeholder="What should we cover next?"
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-sm font-medium">Options</legend>
          {options.map((value, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={value}
                maxLength={POLL_OPTION_MAX}
                aria-label={`Option ${i + 1}`}
                placeholder={`Option ${i + 1}`}
                onChange={(e) => {
                  const next = [...options]
                  next[i] = e.target.value
                  setOptions(next)
                  setTemplateId(null)
                }}
              />
              {options.length > POLL_MIN_OPTIONS && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove option ${i + 1}`}
                  onClick={() => setOptions(options.filter((_, j) => j !== i))}
                >
                  <X />
                </Button>
              )}
            </div>
          ))}
          {options.length < POLL_MAX_OPTIONS && (
            <Button variant="ghost" size="sm" onClick={() => setOptions([...options, ''])}>
              <Plus /> Add option
            </Button>
          )}
        </fieldset>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!valid} loading={pending === 'createPoll'} onClick={() => void submit()}>
          Start poll
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
