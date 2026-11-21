/**
 * Validation for quiz and question input, shared by the quiz actions (the
 * authority) and the editor form (so it can show the same messages before
 * sending).
 */

import { z } from 'zod'
import {
  DEFAULT_TIME_LIMIT,
  MAX_NOTES_CHARS,
  MAX_QUESTIONS,
  MAX_TOPICS,
  MIN_QUESTIONS,
  OPTION_COUNT,
  TIME_LIMITS,
} from './game-rules'
import { DIFFICULTIES } from '../schemas/game-types'

export const quizTitle = z.string().trim().min(1, 'Give the quiz a title').max(120)

/** Options compare equal ignoring case and repeated spaces. */
export const normalizeOption = (option: string) => option.trim().toLowerCase().replace(/\s+/g, ' ')

const options = z
  .array(z.string().trim().min(1, 'Fill in all four options').max(160))
  .length(OPTION_COUNT, `A question needs exactly ${OPTION_COUNT} options`)
  .refine((opts) => new Set(opts.map(normalizeOption)).size === opts.length, {
    message: 'Options must all be different',
  })

const timeLimit = z.number().refine((n) => (TIME_LIMITS as readonly number[]).includes(n), {
  message: `Time limit must be one of ${TIME_LIMITS.join(', ')} seconds`,
})

const explanation = z.string().trim().max(1000)

/** Everything the host can edit on a question. */
export const questionEdit = z.object({
  prompt: z.string().trim().min(1, 'Write the question').max(300),
  options,
  correctIndex: z.number().int().min(0).max(OPTION_COUNT - 1),
  explanation,
  timeLimit,
  approved: z.boolean(),
})

/** A new hand-written question (approval is decided by the server). */
export const newQuestion = questionEdit.omit({ approved: true }).extend({
  explanation: explanation.default(''),
  timeLimit: timeLimit.default(DEFAULT_TIME_LIMIT),
})

export type NewQuestion = z.input<typeof newQuestion>

// ─── New quiz: by hand, from Wikipedia, or from notes ────

const questionCount = z
  .number()
  .int()
  .min(MIN_QUESTIONS, `Between ${MIN_QUESTIONS} and ${MAX_QUESTIONS} questions`)
  .max(MAX_QUESTIONS, `Between ${MIN_QUESTIONS} and ${MAX_QUESTIONS} questions`)
const difficulty = z.enum(DIFFICULTIES)

export const newQuiz = z.discriminatedUnion('sourceType', [
  z.object({ sourceType: z.literal('manual'), title: quizTitle }),
  z.object({
    sourceType: z.literal('wikipedia'),
    title: quizTitle.optional(),
    topics: z
      .array(z.string().trim().min(1, 'Topics can’t be blank').max(120))
      .min(1, 'Add a topic')
      .max(MAX_TOPICS, `Up to ${MAX_TOPICS} topics`),
    questionCount,
    difficulty,
  }),
  z.object({
    sourceType: z.literal('notes'),
    title: quizTitle,
    notes: z
      .string()
      .trim()
      .min(200, 'Paste at least a few paragraphs (200+ characters)')
      .max(MAX_NOTES_CHARS, `Notes can be up to ${MAX_NOTES_CHARS.toLocaleString('en-US')} characters`),
    questionCount,
    difficulty,
  }),
])

export type NewQuiz = z.input<typeof newQuiz>

/** First validation message for a form, or null when the input is valid. */
export function firstError(schema: z.ZodType, input: unknown): string | null {
  const result = schema.safeParse(input)
  return result.success ? null : (result.error.issues[0]?.message ?? 'Check the form')
}
