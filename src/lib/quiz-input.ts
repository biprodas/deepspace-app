/**
 * Validation for quiz and question input, shared by the quiz actions (the
 * authority) and the editor form (so it can show the same messages before
 * sending).
 */

import { z } from 'zod'
import { DEFAULT_TIME_LIMIT, OPTION_COUNT, TIME_LIMITS } from './game-rules'

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

/** First validation message for a form, or null when the input is valid. */
export function firstError(schema: z.ZodType, input: unknown): string | null {
  const result = schema.safeParse(input)
  return result.success ? null : (result.error.issues[0]?.message ?? 'Check the form')
}
