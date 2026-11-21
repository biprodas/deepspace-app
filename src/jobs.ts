/**
 * Background-job handler — invoked by AppJobRoom (worker.ts) for every job
 * picked up from the queue. Dispatch on `job.type` and return a result
 * (captured as `job.result`) or throw to fail.
 *
 * `generate-questions` (docs/trd.md §8): the AI quiz pipeline. It runs as a
 * job because a 10-question Claude call can outlive an HTTP request. Only
 * `createQuiz` / `regenerateQuestion` enqueue it; the payload is just a
 * `generationId`, and everything else is read from that owner-only row.
 * Progress and failures are written to the row (the owner sees them live);
 * `job.result` carries nothing private.
 */

import type { ActionTools, Job, JobContext } from 'deepspace/worker'
import { ActionError, findRecord, queryRecords, unwrap, type Rec } from './actions/shared'
import { createActionTools } from './server/action-routes'
import {
  draftQuestions,
  GENERATE_QUESTIONS,
  HEARTBEAT_MS,
  htmlToText,
  MAX_TOKENS,
  MODEL,
  readModelReply,
  TEMPERATURE,
  truncate,
  wikipediaUrl,
  type DraftQuestion,
  type Source,
} from './lib/generation'
import { DEFAULT_TIME_LIMIT, MAX_NOTES_CHARS, MAX_TOPIC_CHARS } from './lib/game-rules'
import type { AnswerKey, Generation, Question, Quiz } from './schemas/game-types'
import type { Env } from '../worker'

export async function runJob(job: Job, ctx: JobContext, env: Env): Promise<unknown> {
  switch (job.type) {
    case GENERATE_QUESTIONS:
      return generateQuestions(job, ctx, env)
    default:
      throw new Error(`Unknown job type: ${job.type}`)
  }
}

async function generateQuestions(job: Job, ctx: JobContext, env: Env) {
  const generationId = (job.payload as { generationId?: unknown } | null)?.generationId
  const userId = job.enqueuedBy
  if (typeof generationId !== 'string' || !userId) throw new Error('Malformed generate-questions job')

  const tools = createActionTools(env, userId, '')
  const generation = await findRecord<Generation>(tools, 'generations', generationId)
  // Spend nothing on a job this server didn't set up for this user: the row
  // must exist, belong to whoever enqueued the job, and not have run yet.
  if (!generation || generation.data.userId !== userId || generation.data.status !== 'pending') {
    throw new Error('Generation not found or already handled')
  }

  const setStage = async (stage: Generation['stage'], progress: number) => {
    ctx.progress(progress)
    await tools.update('generations', generationId, { stage })
  }

  await tools.update('generations', generationId, { status: 'running', jobId: job.id, heartbeatAt: Date.now() })
  // Proof of life while we wait on Wikipedia and Claude: a run that stops
  // beating (worker recycled mid-call) is settled as interrupted elsewhere.
  const heartbeat = setInterval(() => {
    void tools.update('generations', generationId, { heartbeatAt: Date.now() })
  }, HEARTBEAT_MS)
  try {
    await setStage('fetching', 0.1)
    const sources = await fetchSources(tools, generation.data)

    await setStage('writing', 0.3)
    const existing = await queryRecords<Question>(tools, 'questions', { quizId: generation.data.quizId })
    const result = await draftQuestions({
      sources,
      count: generation.data.questionCount,
      difficulty: generation.data.difficulty,
      avoid: existing.map((q) => q.data.prompt),
      callModel: async ({ system, user }) => {
        if (ctx.signal.aborted) throw new Error('Canceled')
        const reply = await tools.integration('anthropic/chat-completion', {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          temperature: TEMPERATURE,
          system,
          messages: [{ role: 'user', content: user }],
        })
        if (!reply.success) throw new Error(`Claude call failed: ${reply.error}`)
        return readModelReply(reply.data)
      },
    })

    await setStage('saving', 0.9)
    const saved = await saveQuestions(tools, generation, result.questions, existing)
    await tools.update('generations', generationId, {
      status: 'completed',
      droppedCount: result.dropped,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      completedAt: Date.now(),
    })
    if (!generation.data.replaceQuestionId) {
      await tools.update('quizzes', generation.data.quizId, {
        status: saved > 0 || existing.length > 0 ? 'ready' : 'failed',
        sourceUrls: sources.flatMap((s) => (s.url ? [s.url] : [])),
      })
    }
    return { saved, dropped: result.dropped }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await tools.update('generations', generationId, {
      status: 'failed',
      error: message.slice(0, 500),
      completedAt: Date.now(),
    })
    if (!generation.data.replaceQuestionId) {
      await tools.update('quizzes', generation.data.quizId, { status: 'failed' })
    }
    // A failed run is recorded, not retried: retrying would spend credits again.
    return { failed: true }
  } finally {
    clearInterval(heartbeat)
  }
}

async function fetchSources(tools: ActionTools, generation: Generation): Promise<Source[]> {
  if (generation.sourceType === 'notes') {
    const text = truncate((generation.notes ?? '').trim(), MAX_NOTES_CHARS)
    if (!text) throw new Error('The notes are empty')
    return [{ title: 'Your notes', text }]
  }

  const sources: Source[] = []
  // `topics` holds article titles `createQuiz` already resolved by search.
  for (const title of generation.topics ?? []) {
    const page = await tools.integration<{ htmlContent: string }>('wikipedia/get-page-content', { title })
    if (!page.success) throw new Error(`Couldn’t load “${title}” from Wikipedia: ${page.error}`)
    const text = truncate(htmlToText(page.data.htmlContent ?? ''), MAX_TOPIC_CHARS)
    if (text.length < 200) throw new Error(`“${title}” has too little text to write questions from`)
    sources.push({ title, url: wikipediaUrl(title), text })
  }
  if (sources.length === 0) throw new Error('No topics to fetch')
  return sources
}

/**
 * Writes drafts as unapproved questions with their answer keys. A
 * regeneration takes the old question's place (same order, same time limit)
 * and removes it; a full run appends after any existing questions.
 */
async function saveQuestions(
  tools: ActionTools,
  generation: Rec<Generation>,
  drafts: DraftQuestion[],
  existing: Rec<Question>[],
): Promise<number> {
  const { quizId, replaceQuestionId } = generation.data
  const quiz = await findRecord<Quiz>(tools, 'quizzes', quizId)
  if (!quiz) throw new ActionError('The quiz was deleted', 'not_found')

  const replacing = replaceQuestionId ? existing.find((q) => q.recordId === replaceQuestionId) : undefined
  if (replaceQuestionId && !replacing) throw new Error('The question to replace was deleted')
  let order = replacing?.data.order ?? existing.reduce((max, q) => Math.max(max, q.data.order), 0) + 1

  let saved = 0
  for (const draft of drafts) {
    const question: Question = {
      quizId,
      order: replacing ? order : order++,
      prompt: draft.prompt,
      options: draft.options,
      timeLimit: replacing?.data.timeLimit ?? DEFAULT_TIME_LIMIT,
      approved: false,
    }
    const { recordId: questionId } = unwrap(await tools.create('questions', { ...question }))
    const key: AnswerKey = {
      questionId,
      quizId,
      ownerId: quiz.data.ownerId,
      correctIndex: draft.correctIndex,
      explanation: draft.explanation,
      sourceQuote: draft.sourceQuote,
      ...(draft.sourceUrl ? { sourceUrl: draft.sourceUrl } : {}),
    }
    const keyResult = await tools.create('answer_keys', { ...key })
    if (!keyResult.success) {
      await tools.remove('questions', questionId)
      continue
    }
    saved++
  }

  if (replacing && saved > 0) {
    const [oldKey] = await queryRecords<AnswerKey>(tools, 'answer_keys', { questionId: replacing.recordId }, { limit: 1 })
    if (oldKey) await tools.remove('answer_keys', oldKey.recordId)
    await tools.remove('questions', replacing.recordId)
  }
  return saved
}
