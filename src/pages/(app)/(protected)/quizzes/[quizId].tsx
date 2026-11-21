/**
 * Quiz editor: /quizzes/:quizId (docs/features.md F2). The owner writes,
 * edits, approves, reorders and deletes questions. Reads are live
 * (`useQuery`); every write goes through a quiz server action.
 *
 * `answer_keys` is owner-readable only, so for anyone else this page can't
 * show answers, and it says so instead of offering controls that would be
 * refused.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useUser } from 'deepspace'
import { ArrowLeft, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge, Button, ConfirmModal, EmptyState, Input } from '@/components/ui'
import { QuestionCard } from '@/components/quiz/QuestionCard'
import { QuestionForm, type QuestionValues } from '@/components/quiz/QuestionForm'
import { useAction } from '@/lib/use-action'
import type { AnswerKey, Question, Quiz } from '@/schemas/game-types'

export default function QuizEditorPage() {
  const { quizId = '' } = useParams()
  const { user } = useUser()
  const navigate = useNavigate()
  const { run, pending } = useAction()

  const quizzes = useQuery<Quiz>('quizzes', { where: { recordId: quizId }, limit: 1 })
  const questions = useQuery<Question>('questions', {
    where: { quizId },
    orderBy: 'order',
    orderDir: 'asc',
  })
  const answerKeys = useQuery<AnswerKey>('answer_keys', { where: { quizId } })

  const keysByQuestion = useMemo(
    () => new Map(answerKeys.records.map((k) => [k.data.questionId, k.data])),
    [answerKeys.records],
  )

  const quiz = quizzes.records[0]
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (quizzes.status === 'loading') {
    return <div className="p-10 text-center text-sm text-muted-foreground">Loading quiz…</div>
  }
  if (!quiz) {
    return (
      <EmptyState
        icon={<ListChecks />}
        title="Quiz not found"
        description="It may have been deleted."
        action={{ label: 'Back to my quizzes', onClick: () => navigate('/quizzes') }}
      />
    )
  }

  const isOwner = user?.id === quiz.data.ownerId
  const approvedCount = questions.records.filter((q) => q.data.approved).length

  const saveQuestion = (questionId: string) => async (values: QuestionValues) =>
    (await run('updateQuestion', { questionId, ...values }, `save:${questionId}`)).success

  const addQuestion = async (values: QuestionValues) =>
    (await run('addQuestion', { quizId, ...values })).success

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6">
      <Link
        to="/quizzes"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> My quizzes
      </Link>

      <header className="mb-8 flex flex-col items-start gap-2 sm:flex-row sm:gap-4">
        <div className="w-full min-w-0 flex-1">
          {isOwner ? (
            <TitleEditor
              title={quiz.data.title}
              saving={pending === 'renameQuiz'}
              onSave={async (title) => (await run('renameQuiz', { quizId, title })).success}
            />
          ) : (
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{quiz.data.title}</h1>
          )}
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {questions.records.length} question{questions.records.length === 1 ? '' : 's'}
            </span>
            <span aria-hidden="true">·</span>
            <span data-testid="approved-count">{approvedCount} approved</span>
            {approvedCount === 0 && questions.records.length > 0 && (
              <Badge variant="warning" size="sm">Approve at least one to play</Badge>
            )}
          </p>
        </div>
        {isOwner && (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 text-muted-foreground hover:text-destructive sm:ml-0"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 /> Delete quiz
          </Button>
        )}
      </header>

      {!isOwner ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Only the quiz owner can see the answers and edit this quiz.
        </p>
      ) : (
        <>
          <section aria-label="Questions" className="space-y-4">
            {questions.records.map((q, i) => (
              <QuestionCard
                key={q.recordId}
                number={i + 1}
                questionId={q.recordId}
                question={q.data}
                answerKey={keysByQuestion.get(q.recordId)}
                isFirst={i === 0}
                isLast={i === questions.records.length - 1}
                pending={pending}
                onSave={saveQuestion(q.recordId)}
                onApprove={(approved) =>
                  void run('updateQuestion', { questionId: q.recordId, approved }, `approve:${q.recordId}`)
                }
                onMove={(direction) =>
                  void run('moveQuestion', { questionId: q.recordId, direction }, `move:${q.recordId}`)
                }
                onDelete={async () => {
                  await run('deleteQuestion', { questionId: q.recordId }, `delete:${q.recordId}`)
                }}
              />
            ))}
          </section>

          <section className="mt-8 rounded-xl border border-border bg-card p-5" aria-labelledby="add-question">
            <h2 id="add-question" className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
              <Plus className="size-5" /> Add a question
            </h2>
            <QuestionForm submitLabel="Add question" onSubmit={addQuestion} />
          </section>
        </>
      )}

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this quiz?"
        description="All its questions and answers are deleted. This can't be undone."
        confirmText="Delete quiz"
        loading={pending === 'deleteQuiz'}
        onConfirm={async () => {
          const result = await run('deleteQuiz', { quizId })
          setConfirmDelete(false)
          if (result.success) navigate('/quizzes', { replace: true })
        }}
      />
    </div>
  )
}

function TitleEditor({
  title,
  saving,
  onSave,
}: {
  title: string
  saving: boolean
  onSave: (title: string) => Promise<boolean>
}) {
  const [draft, setDraft] = useState<string | null>(null)

  if (draft === null) {
    return (
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
        <span className="min-w-0 break-words">{title}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          aria-label="Rename quiz"
          onClick={() => setDraft(title)}
        >
          <Pencil />
        </Button>
      </h1>
    )
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (draft.trim() === title || (await onSave(draft))) setDraft(null)
      }}
    >
      <Input
        aria-label="Quiz title"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={120}
        autoFocus
        className="h-11 font-display text-xl font-bold"
      />
      <Button type="submit" loading={saving}>Save</Button>
      <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
        Cancel
      </Button>
    </form>
  )
}
