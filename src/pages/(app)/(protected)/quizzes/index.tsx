/**
 * My quizzes: /quizzes. Live list of the signed-in user's quizzes, newest
 * edits first.
 */

import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useUser } from 'deepspace'
import { ChevronRight, ListChecks, Plus } from 'lucide-react'
import { Badge, Button, EmptyState } from '@/components/ui'
import type { Quiz, QuizStatus } from '@/schemas/game-types'

const STATUS: Record<QuizStatus, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  ready: { label: 'Ready', variant: 'success' },
  generating: { label: 'Generating…', variant: 'warning' },
  failed: { label: 'Generation failed', variant: 'destructive' },
}

export default function QuizzesPage() {
  const { user } = useUser()
  const navigate = useNavigate()
  const { records, status } = useQuery<Quiz>('quizzes', {
    where: { ownerId: user?.id ?? '' },
    orderBy: 'updatedAt',
    orderDir: 'desc',
  })

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6">
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold tracking-tight">My quizzes</h1>
        <Button onClick={() => navigate('/quizzes/new')}>
          <Plus /> New quiz
        </Button>
      </header>

      {status === 'loading' || !user ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading quizzes…</p>
      ) : records.length === 0 ? (
        <EmptyState
          icon={<ListChecks />}
          title="No quizzes yet"
          description="Create one, write a few questions, and you're ready to host."
          action={{ label: 'Create a quiz', onClick: () => navigate('/quizzes/new') }}
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {records.map((quiz) => {
            const s = STATUS[quiz.data.status]
            return (
              <li key={quiz.recordId}>
                <Link
                  to={`/quizzes/${quiz.recordId}`}
                  className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-accent"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{quiz.data.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Edited {new Date(quiz.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={s.variant} size="sm">{s.label}</Badge>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
