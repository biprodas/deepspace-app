/**
 * Quiz builder: /quizzes/new (docs/features.md F2). Three ways in: 1–3
 * Wikipedia topics or pasted notes (Claude drafts the questions, the host
 * reviews them), or writing every question by hand. The same rules the
 * server enforces (`newQuiz`) validate the form first.
 */

import { usePageTitle } from '@/lib/page-title'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, NotebookPen, PenLine, Plus, Sparkles, X } from 'lucide-react'
import { Button, Input, Label, Tabs, TabsContent, TabsList, TabsTrigger, Textarea, cn } from '@/components/ui'
import {
  DAILY_GENERATION_LIMIT,
  MAX_NOTES_CHARS,
  MAX_QUESTIONS,
  MAX_TOPICS,
  MIN_QUESTIONS,
} from '@/lib/game-rules'
import { firstError, newQuiz, type NewQuiz } from '@/lib/quiz-input'
import { useAction } from '@/lib/use-action'
import { DIFFICULTIES, type Difficulty } from '@/schemas/game-types'

type Mode = NewQuiz['sourceType']

export default function NewQuizPage() {
  const navigate = useNavigate()
  const { run, pending } = useAction()
  usePageTitle('Create a quiz')
  const [mode, setMode] = useState<Mode>('wikipedia')
  const [title, setTitle] = useState('')
  const [topics, setTopics] = useState<string[]>([''])
  const [notes, setNotes] = useState('')
  const [questionCount, setQuestionCount] = useState(8)
  const [difficulty, setDifficulty] = useState<Difficulty>('mixed')
  const [error, setError] = useState<string | null>(null)
  // A misspelled topic and the article Wikipedia suggests for it.
  const [fix, setFix] = useState<{ topic: string; suggestion: string } | null>(null)

  const input: NewQuiz =
    mode === 'manual'
      ? { sourceType: 'manual', title }
      : mode === 'wikipedia'
        ? {
            sourceType: 'wikipedia',
            ...(title.trim() ? { title } : {}),
            topics: topics.filter((t) => t.trim()),
            questionCount,
            difficulty,
          }
        : { sourceType: 'notes', title, notes, questionCount, difficulty }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const problem = firstError(newQuiz, input)
    if (problem) return setError(problem)
    const result = await run<{ quizId: string }>('createQuiz', input, 'createQuiz', { toast: false })
    if (result.success) return navigate(`/quizzes/${result.data.quizId}`, { replace: true })
    setError(result.error)
    const { topic, suggestion } = (result.details ?? {}) as { topic?: string; suggestion?: string }
    setFix(result.code === 'topic_not_found' && topic && suggestion ? { topic, suggestion } : null)
  }

  /** Swaps a misspelled topic for Wikipedia's suggestion. */
  function applyFix() {
    if (!fix) return
    edit(setTopics)(topics.map((t) => (t.trim() === fix.topic ? fix.suggestion : t)))
  }

  const edit =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setError(null)
      setFix(null)
    }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-8 sm:px-6">
      <Link
        to="/quizzes"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> My quizzes
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-tight">Create a quiz</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Start from a source and Claude drafts the questions, each backed by a sentence from it. You review
        and approve them before anyone plays.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-6 rounded-xl border border-border bg-card p-5" noValidate>
        <Tabs value={mode} onValueChange={(v) => edit(setMode)(v as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="wikipedia">
              <BookOpen /> Wikipedia
            </TabsTrigger>
            <TabsTrigger value="notes">
              <NotebookPen /> My notes
            </TabsTrigger>
            <TabsTrigger value="manual">
              <PenLine /> By hand
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wikipedia" className="space-y-2 pt-4">
            <Label>Topics</Label>
            <p className="text-xs text-muted-foreground">Up to {MAX_TOPICS}. Each one becomes a Wikipedia article.</p>
            {topics.map((topic, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  aria-label={`Topic ${i + 1}`}
                  value={topic}
                  onChange={(e) => edit(setTopics)(topics.map((t, j) => (j === i ? e.target.value : t)))}
                  placeholder={['Photosynthesis', 'Calvin cycle', 'Chloroplast'][i]}
                  maxLength={120}
                />
                {topics.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove topic ${i + 1}`}
                    onClick={() => edit(setTopics)(topics.filter((_, j) => j !== i))}
                  >
                    <X />
                  </Button>
                )}
              </div>
            ))}
            {topics.length < MAX_TOPICS && (
              <Button variant="ghost" size="sm" onClick={() => setTopics([...topics, ''])}>
                <Plus /> Add a topic
              </Button>
            )}
          </TabsContent>

          <TabsContent value="notes" className="space-y-2 pt-4">
            <Label htmlFor="quiz-notes">Your notes</Label>
            <Textarea
              id="quiz-notes"
              value={notes}
              onChange={(e) => edit(setNotes)(e.target.value)}
              rows={10}
              maxLength={MAX_NOTES_CHARS}
              placeholder="Paste lecture notes, a textbook section, an article…"
            />
            <p className="text-right text-xs text-muted-foreground tabular-nums">
              {notes.length.toLocaleString()} / {MAX_NOTES_CHARS.toLocaleString()}
            </p>
          </TabsContent>

          <TabsContent value="manual" className="pt-4">
            <p className="text-sm text-muted-foreground">
              Name the quiz, then write each question with four options, the correct answer and a time limit.
            </p>
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <Label htmlFor="quiz-title">
            Title{mode === 'wikipedia' && <span className="font-normal text-muted-foreground"> · optional</span>}
          </Label>
          <Input
            id="quiz-title"
            value={title}
            onChange={(e) => edit(setTitle)(e.target.value)}
            placeholder={mode === 'wikipedia' ? 'Defaults to the topics' : 'Photosynthesis basics'}
            maxLength={120}
          />
        </div>

        {mode !== 'manual' && (
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Questions">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  aria-label="Number of questions"
                  min={MIN_QUESTIONS}
                  max={MAX_QUESTIONS}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <span className="w-6 text-right font-mono font-bold tabular-nums">{questionCount}</span>
              </div>
            </Field>
            <Field label="Difficulty">
              <div className="inline-flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Difficulty">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={difficulty === d}
                    onClick={() => setDifficulty(d)}
                    className={cn(
                      'cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                      difficulty === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {error && (
          <div className="flex flex-wrap items-center gap-3">
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
            {fix && (
              <Button variant="outline" size="sm" onClick={applyFix}>
                Use “{fix.suggestion}”
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {mode !== 'manual' && (
            <p className="text-xs text-muted-foreground">Up to {DAILY_GENERATION_LIMIT} AI drafts a day.</p>
          )}
          <Button type="submit" loading={pending === 'createQuiz'} className="ml-auto">
            {mode === 'manual' ? (
              'Create and add questions'
            ) : (
              <>
                <Sparkles /> Draft {questionCount} questions
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  )
}
