/**
 * Quiz-building actions (docs/features.md F2). Every one but `createQuiz`
 * is owner-only, checked here because actions run with RBAC off.
 *
 * A question's prompt and options live in `questions` (readable by players);
 * its answer, explanation and source live in `answer_keys` (owner-only).
 * These actions write both together.
 */

import { enqueueJob, type ActionTools } from 'deepspace/worker'
import { z } from 'zod'
import { DAILY_GENERATION_LIMIT } from '../lib/game-rules'
import { GENERATE_QUESTIONS, INTERRUPTED_ERROR, isStaleRun, MODEL, PROMPT_VERSION } from '../lib/generation'
import { newQuestion, newQuiz, questionEdit, quizTitle } from '../lib/quiz-input'
import type { AnswerKey, Generation, Question, Quiz, Room } from '../schemas/game-types'
import type { Env } from '../../worker'
import {
  ActionError,
  defineAction,
  findRecord,
  getRecord,
  isClosed,
  queryRecords,
  recordId,
  requireQuizOwner,
  unwrap,
  type Rec,
} from './shared'

// ─── Helpers ─────────────────────────────────────────────

async function loadOwnedQuiz(tools: ActionTools, quizId: string, userId: string) {
  const quiz = await getRecord<Quiz>(tools, 'quizzes', quizId, 'Quiz')
  requireQuizOwner(quiz, userId)
  return quiz
}

/** The question, its quiz (owned by the caller) and its answer key. */
async function loadOwnedQuestion(tools: ActionTools, questionId: string, userId: string) {
  const question = await getRecord<Question>(tools, 'questions', questionId, 'Question')
  const quiz = await loadOwnedQuiz(tools, question.data.quizId, userId)
  const [answerKey] = await queryRecords<AnswerKey>(tools, 'answer_keys', { questionId }, { limit: 1 })
  return { question, quiz, answerKey }
}

/** Drops `undefined` fields, so a patch only touches what was sent. */
function defined<T extends Record<string, unknown>>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>
}

function listQuestions(tools: ActionTools, quizId: string) {
  return queryRecords<Question>(tools, 'questions', { quizId }, { orderBy: 'order', orderDir: 'asc' })
}

/** Edits would change answers mid-game, so a quiz in a running room is frozen. */
async function requireNoLiveRoom(tools: ActionTools, quizId: string) {
  const rooms = await queryRecords<Room>(tools, 'rooms', { quizId })
  if (rooms.some((r) => !isClosed(r.data))) {
    throw new ActionError('This quiz is being played right now; edit it after the game', 'quiz_in_play')
  }
}

/**
 * The credit guard (docs/trd.md §8): a rolling 24-hour cap per user,
 * counted from `generations` rows, and one run at a time.
 */
async function requireGenerationAllowance(tools: ActionTools, userId: string) {
  const runs = await queryRecords<Generation>(tools, 'generations', { userId }, { orderBy: 'createdAt', orderDir: 'desc', limit: 100 })
  const now = Date.now()
  const dayAgo = now - 24 * 60 * 60 * 1000
  const unfinished = runs.filter((r) => r.data.status === 'pending' || r.data.status === 'running')
  const stale = unfinished.filter((r) => isStaleRun(r.data, Date.parse(r.createdAt), now))
  await Promise.all(stale.map((r) => settleInterruptedRun(tools, r)))
  if (unfinished.length > stale.length) {
    throw new ActionError('Wait for your current generation to finish', 'generation_in_progress')
  }
  if (runs.filter((r) => Date.parse(r.createdAt) > dayAgo).length >= DAILY_GENERATION_LIMIT) {
    throw new ActionError(
      `You’ve used today’s ${DAILY_GENERATION_LIMIT} AI generations. Write questions by hand, or try again tomorrow.`,
      'daily_limit',
    )
  }
}

/**
 * Closes a run whose job died without finishing (no heartbeat), so it stops
 * blocking the user and the quiz stops saying "generating".
 */
async function settleInterruptedRun(tools: ActionTools, run: Rec<Generation>) {
  await tools.update('generations', run.recordId, {
    status: 'failed',
    error: INTERRUPTED_ERROR,
    completedAt: Date.now(),
  })
  if (run.data.replaceQuestionId) return
  const quiz = await findRecord<Quiz>(tools, 'quizzes', run.data.quizId)
  if (quiz?.data.status === 'generating') await tools.update('quizzes', quiz.recordId, { status: 'failed' })
}

type SearchHit = { title?: string }

/**
 * Maps each typed topic to a Wikipedia article title before anything is
 * created or counted, so a typo costs the user nothing but a correction.
 * Plain search misses misspellings ("Photosysthesis"); a fuzzy search
 * (`term~`) finds what they meant, which we offer rather than swap in.
 */
export async function resolveWikipediaTopics(tools: ActionTools, topics: string[]): Promise<string[]> {
  const search = async (query: string) => {
    const res = await tools.integration<SearchHit[]>('wikipedia/search-pages', { query, limit: 1 })
    if (!res.success) throw new ActionError(`Wikipedia search failed: ${res.error}`, 'wikipedia_unavailable')
    return Array.isArray(res.data) ? res.data[0]?.title : undefined
  }

  const titles: string[] = []
  for (const topic of topics) {
    const title = await search(topic)
    if (title) {
      titles.push(title)
      continue
    }
    const suggestion = await search(`${topic.replace(/~/g, '')}~`)
    throw new ActionError(
      suggestion
        ? `No Wikipedia article for “${topic}”. Did you mean “${suggestion}”?`
        : `No Wikipedia article for “${topic}”. Check the spelling or try a broader topic.`,
      'topic_not_found',
      { topic, ...(suggestion ? { suggestion } : {}) },
    )
  }
  return [...new Set(titles)]
}

/** Records the run, then queues the job that does it (src/jobs.ts). */
async function startGeneration(
  tools: ActionTools,
  env: Env,
  userId: string,
  input: Pick<Generation, 'quizId' | 'sourceType' | 'topics' | 'notes' | 'difficulty' | 'questionCount' | 'replaceQuestionId'>,
): Promise<string> {
  const generation: Generation = {
    ...input,
    userId,
    model: MODEL,
    promptVersion: PROMPT_VERSION,
    status: 'pending',
    droppedCount: 0,
  }
  const { recordId: generationId } = unwrap(await tools.create('generations', defined({ ...generation })))
  try {
    // maxAttempts 1: a failed run is reported, never silently re-billed.
    await enqueueJob(env.JOB_ROOMS, `app:${env.DEEPSPACE_APP_ID}`, GENERATE_QUESTIONS, { generationId }, {
      enqueuedBy: userId,
      maxAttempts: 1,
    })
  } catch (err) {
    await tools.update('generations', generationId, { status: 'failed', error: 'Couldn’t start the job' })
    throw err
  }
  return generationId
}

// ─── Actions ─────────────────────────────────────────────

/**
 * Starts a quiz. By hand: ready at once, questions added one by one. From
 * Wikipedia topics or pasted notes: status `generating` until the
 * `generate-questions` job finishes; drafts arrive unapproved.
 */
const createQuiz = defineAction(newQuiz, async ({ userId, tools, env }, p) => {
  if (p.sourceType === 'manual') {
    const quiz: Quiz = {
      ownerId: userId,
      title: p.title,
      sourceType: 'manual',
      sourceUrls: [],
      difficulty: 'mixed',
      status: 'ready',
    }
    const { recordId: quizId } = unwrap(await tools.create('quizzes', { ...quiz }))
    return { quizId }
  }

  await requireGenerationAllowance(tools, userId)
  // Article titles, not the raw input: the job fetches these directly.
  const articles = p.sourceType === 'wikipedia' ? await resolveWikipediaTopics(tools, p.topics) : []
  const quiz: Quiz = {
    ownerId: userId,
    title: p.title ?? (p.sourceType === 'wikipedia' ? articles.join(', ') : 'My notes'),
    sourceType: p.sourceType,
    sourceUrls: [],
    difficulty: p.difficulty,
    status: 'generating',
  }
  const { recordId: quizId } = unwrap(await tools.create('quizzes', { ...quiz }))
  const generationId = await startGeneration(tools, env, userId, {
    quizId,
    sourceType: p.sourceType,
    ...(p.sourceType === 'wikipedia' ? { topics: articles } : { notes: p.notes }),
    difficulty: p.difficulty,
    questionCount: p.questionCount,
  })
  unwrap(await tools.update('quizzes', quizId, { generationId }))
  return { quizId }
})

/**
 * Replaces one question with a freshly drafted one from the same source.
 * The old question stays until the new one has passed every check.
 */
const regenerateQuestion = defineAction(
  z.object({ questionId: recordId }),
  async ({ userId, tools, env }, p) => {
    const { quiz } = await loadOwnedQuestion(tools, p.questionId, userId)
    await requireNoLiveRoom(tools, quiz.recordId)
    if (quiz.data.sourceType === 'manual' || !quiz.data.generationId) {
      throw new ActionError('Only AI-drafted quizzes have a source to regenerate from', 'no_source')
    }
    const source = await getRecord<Generation>(tools, 'generations', quiz.data.generationId, 'Generation')
    await requireGenerationAllowance(tools, userId)
    const generationId = await startGeneration(tools, env, userId, {
      quizId: quiz.recordId,
      sourceType: source.data.sourceType,
      topics: source.data.topics,
      notes: source.data.notes,
      difficulty: source.data.difficulty,
      questionCount: 1,
      replaceQuestionId: p.questionId,
    })
    return { generationId }
  },
)

const renameQuiz = defineAction(
  z.object({ quizId: recordId, title: quizTitle }),
  async ({ userId, tools }, p) => {
    await loadOwnedQuiz(tools, p.quizId, userId)
    unwrap(await tools.update('quizzes', p.quizId, { title: p.title }))
    return { quizId: p.quizId }
  },
)

/** Deletes the quiz with its questions and answer keys. Past rooms keep their rounds. */
const deleteQuiz = defineAction(z.object({ quizId: recordId }), async ({ userId, tools }, p) => {
  await loadOwnedQuiz(tools, p.quizId, userId)
  await requireNoLiveRoom(tools, p.quizId)
  for (const collection of ['answer_keys', 'questions']) {
    // deleteWhere removes one bounded page per call; drain it.
    let deleted: number
    do {
      ;({ deleted } = unwrap(await tools.deleteWhere(collection, { quizId: p.quizId }, 500)))
    } while (deleted === 500)
  }
  unwrap(await tools.remove('quizzes', p.quizId))
  return { quizId: p.quizId }
})

/**
 * Adds a hand-written question at the end. The host wrote it, so it starts
 * approved; AI drafts (M4) start unapproved instead.
 */
const addQuestion = defineAction(
  newQuestion.extend({ quizId: recordId }),
  async ({ userId, tools }, p) => {
    const quiz = await loadOwnedQuiz(tools, p.quizId, userId)
    await requireNoLiveRoom(tools, p.quizId)
    const existing = await listQuestions(tools, p.quizId)
    const order = existing.reduce((max, q) => Math.max(max, q.data.order), 0) + 1

    const question: Question = {
      quizId: p.quizId,
      order,
      prompt: p.prompt,
      options: p.options,
      timeLimit: p.timeLimit,
      approved: true,
    }
    const { recordId: questionId } = unwrap(await tools.create('questions', { ...question }))

    const answerKey: AnswerKey = {
      questionId,
      quizId: p.quizId,
      ownerId: quiz.data.ownerId,
      correctIndex: p.correctIndex,
      explanation: p.explanation,
      sourceQuote: '',
    }
    const keyResult = await tools.create('answer_keys', { ...answerKey })
    if (!keyResult.success) {
      // Don't leave a question without an answer behind.
      await tools.remove('questions', questionId)
      unwrap(keyResult)
    }
    // A quiz whose AI run failed becomes playable once it has a question.
    if (quiz.data.status === 'failed') unwrap(await tools.update('quizzes', p.quizId, { status: 'ready' }))
    return { questionId }
  },
)

/** Edits any subset of a question's fields, and/or approves it. */
const updateQuestion = defineAction(
  questionEdit.partial().extend({ questionId: recordId }),
  async ({ userId, tools }, p) => {
    const { question, answerKey } = await loadOwnedQuestion(tools, p.questionId, userId)
    await requireNoLiveRoom(tools, question.data.quizId)

    const questionPatch = defined({
      prompt: p.prompt,
      options: p.options,
      timeLimit: p.timeLimit,
      approved: p.approved,
    })
    const keyPatch = defined({ correctIndex: p.correctIndex, explanation: p.explanation })
    const hasKeyChanges = Object.keys(keyPatch).length > 0

    if (Object.keys(questionPatch).length === 0 && !hasKeyChanges) {
      throw new ActionError('Nothing to change', 'invalid_params')
    }
    if (hasKeyChanges && !answerKey) {
      throw new ActionError('This question has no answer key', 'not_found')
    }

    if (Object.keys(questionPatch).length > 0) {
      unwrap(await tools.update('questions', p.questionId, questionPatch))
    }
    if (hasKeyChanges && answerKey) {
      unwrap(await tools.update('answer_keys', answerKey.recordId, keyPatch))
    }
    return { questionId: p.questionId }
  },
)

/** Swaps a question with its neighbour above or below. */
const moveQuestion = defineAction(
  z.object({ questionId: recordId, direction: z.enum(['up', 'down']) }),
  async ({ userId, tools }, p) => {
    const { question } = await loadOwnedQuestion(tools, p.questionId, userId)
    await requireNoLiveRoom(tools, question.data.quizId)
    const questions = await listQuestions(tools, question.data.quizId)
    const index = questions.findIndex((q) => q.recordId === p.questionId)
    const neighbour: Rec<Question> | undefined =
      questions[p.direction === 'up' ? index - 1 : index + 1]
    if (!neighbour) return { questionId: p.questionId, moved: false }

    unwrap(await tools.update('questions', question.recordId, { order: neighbour.data.order }))
    unwrap(await tools.update('questions', neighbour.recordId, { order: question.data.order }))
    return { questionId: p.questionId, moved: true }
  },
)

const deleteQuestion = defineAction(
  z.object({ questionId: recordId }),
  async ({ userId, tools }, p) => {
    const { question, answerKey } = await loadOwnedQuestion(tools, p.questionId, userId)
    await requireNoLiveRoom(tools, question.data.quizId)
    if (answerKey) unwrap(await tools.remove('answer_keys', answerKey.recordId))
    unwrap(await tools.remove('questions', p.questionId))
    return { questionId: p.questionId }
  },
)

export const quizActions = {
  createQuiz,
  regenerateQuestion,
  renameQuiz,
  deleteQuiz,
  addQuestion,
  updateQuestion,
  moveQuestion,
  deleteQuestion,
}
