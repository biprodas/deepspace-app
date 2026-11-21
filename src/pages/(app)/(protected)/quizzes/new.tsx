/**
 * Quiz builder: /quizzes/new (docs/features.md F2). Starts a hand-written
 * quiz and opens its editor; building from Wikipedia topics or notes with
 * AI joins this page in M4 (docs/implementation-plan.md).
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button, Input, Label } from '@/components/ui'
import { firstError, quizTitle } from '@/lib/quiz-input'
import { useAction } from '@/lib/use-action'

export default function NewQuizPage() {
  const navigate = useNavigate()
  const { run, pending } = useAction()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const problem = firstError(quizTitle, title)
    if (problem) return setError(problem)
    const result = await run<{ quizId: string }>('createQuiz', { title })
    if (result.success) navigate(`/quizzes/${result.data.quizId}`, { replace: true })
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-24 pt-8 sm:px-6">
      <Link
        to="/quizzes"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> My quizzes
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-tight">Create a quiz</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Name it, then write your questions. Each one has four options, one correct answer and a time limit.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4 rounded-xl border border-border bg-card p-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="quiz-title">Title</Label>
          <Input
            id="quiz-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setError(null)
            }}
            placeholder="Photosynthesis basics"
            maxLength={120}
            autoFocus
          />
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
        <Button type="submit" loading={pending === 'createQuiz'} className="w-full sm:w-auto">
          Create and add questions
        </Button>
      </form>
    </div>
  )
}
