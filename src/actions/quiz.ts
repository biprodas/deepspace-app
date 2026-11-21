/**
 * Quiz-building actions (docs/features.md F2). Every one but `createQuiz`
 * is owner-only, checked here because actions run with RBAC off.
 *
 * A question's prompt and options live in `questions` (readable by players);
 * its answer, explanation and source live in `answer_keys` (owner-only).
 * These actions write both together.
 */

import type { ActionTools } from 'deepspace/worker'
import { z } from 'zod'
import { newQuestion, questionEdit, quizTitle } from '../lib/quiz-input'
import type { AnswerKey, Question, Quiz, Room } from '../schemas/game-types'
import {
  ActionError,
  defineAction,
  getRecord,
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
  if (rooms.some((r) => r.data.status !== 'final' && r.data.status !== 'cancelled')) {
    throw new ActionError('This quiz is being played right now; edit it after the game', 'quiz_in_play')
  }
}

// ─── Actions ─────────────────────────────────────────────

/** A hand-written quiz: ready at once, questions added one by one. */
const createQuiz = defineAction(z.object({ title: quizTitle }), async ({ userId, tools }, p) => {
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
})

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
  renameQuiz,
  deleteQuiz,
  addQuestion,
  updateQuestion,
  moveQuestion,
  deleteQuestion,
}
