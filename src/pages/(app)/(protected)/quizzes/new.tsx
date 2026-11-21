/**
 * Quiz builder: /quizzes/new (docs/features.md F2). Placeholder so the
 * landing page's "Create a quiz" lands somewhere real behind sign-in.
 */

import { Link } from 'react-router-dom'

export default function NewQuizPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <h1 className="font-display text-2xl font-bold">Create a quiz</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The quiz builder is on its way: pick topics or paste notes, then review the drafted questions.
      </p>
      <Link to="/" className="mt-2 text-sm font-bold text-primary-text underline-offset-4 hover:underline">
        Back to StudyArena
      </Link>
    </div>
  )
}
