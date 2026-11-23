/**
 * AI help in a shared note (docs/features.md F14).
 *
 * - `draftNote`: Claude writes study notes from a Wikipedia article; the
 *   browser adds them to the note (where everyone sees them, and undo works).
 * - `reviewNote`: Claude reads the note's text and suggests improvements,
 *   optionally checking facts against a Wikipedia article. It returns
 *   suggestions only; nothing in the note changes unless a member adds one.
 *
 * Both are space-member only, count toward a daily limit per person, and are
 * recorded in the audit log as paid calls (which is also what the limit
 * counts).
 */

import type { ActionTools } from 'deepspace/worker'
import { z } from 'zod'
import { DAILY_NOTE_AI_LIMIT, MAX_NOTES_CHARS, MAX_TOPIC_CHARS } from '../lib/game-rules'
import { MODEL, htmlToText, readModelReply, truncate } from '../lib/generation'
import { buildNoteDraftPrompt, buildNoteReviewPrompt, parseNoteDraft, parseNoteReview } from '../lib/note-ai'
import type { AuditEntry } from '../schemas/audit-schemas'
import type { Note } from '../schemas/note-schemas'
import { resolveWikipediaTopics } from './quiz'
import { ActionError, defineAction, getRecord, queryRecords, recordId } from './shared'
import { audit } from './audit'
import { requireMember } from './space'

const DAY_MS = 24 * 60 * 60 * 1000
const DRAFT_MAX_TOKENS = 2500
const REVIEW_MAX_TOKENS = 2500
/** Below this a note has too little to review. */
const MIN_REVIEW_CHARS = 40
const NOTE_AI_ACTIONS = ['ai.note_draft', 'ai.note_review']

const topic = z.string().trim().min(1, 'Enter a topic').max(120)

/** The note, after checking the caller is an active member of its space. */
async function noteForMember(tools: ActionTools, noteId: string, userId: string) {
  const note = await getRecord<Note>(tools, 'documents', noteId, 'Note')
  await requireMember(tools, note.data.spaceId, userId)
  return note
}

async function requireQuota(tools: ActionTools, userId: string) {
  const since = Date.now() - DAY_MS
  const mine = await queryRecords<AuditEntry>(tools, 'audit_log', { actorId: userId, category: 'paid' })
  const used = mine.filter((e) => NOTE_AI_ACTIONS.includes(e.data.action) && e.data.at > since).length
  if (used >= DAILY_NOTE_AI_LIMIT) {
    throw new ActionError(`You can use AI in notes ${DAILY_NOTE_AI_LIMIT} times a day`, 'daily_limit')
  }
}

/** A Wikipedia article's title and plain text, for grounding. */
async function wikipediaSource(tools: ActionTools, query: string) {
  const [title] = await resolveWikipediaTopics(tools, [query])
  const page = await tools.integration<{ htmlContent: string }>('wikipedia/get-page-content', { title })
  if (!page.success) throw new ActionError(`Couldn’t load “${title}” from Wikipedia`, 'wikipedia_unavailable')
  const text = truncate(htmlToText(page.data.htmlContent ?? ''), MAX_TOPIC_CHARS)
  if (text.length < 200) throw new ActionError(`“${title}” has too little text to use`, 'too_little_text')
  return { title, text }
}

async function askClaude(tools: ActionTools, system: string, user: string, maxTokens: number, what: string) {
  const reply = await tools.integration('anthropic/chat-completion', {
    model: MODEL,
    max_tokens: maxTokens,
    temperature: 0.3,
    system,
    messages: [{ role: 'user', content: user }],
  })
  if (!reply.success) throw new ActionError(`Claude couldn’t ${what}, try again`, 'model_failed')
  return { text: readModelReply(reply.data).text, stopReason: (reply.data as { stop_reason?: string }).stop_reason }
}

const draftNote = defineAction(z.object({ noteId: recordId, topic }), async ({ userId, tools }, p) => {
  const note = await noteForMember(tools, p.noteId, userId)
  await requireQuota(tools, userId)
  const source = await wikipediaSource(tools, p.topic)
  const { system, user } = buildNoteDraftPrompt(source.title, source.text)
  const reply = await askClaude(tools, system, user, DRAFT_MAX_TOKENS, 'write the notes')
  let draft
  try {
    draft = parseNoteDraft(reply.text)
  } catch (err) {
    console.warn('note draft reply unreadable', { length: reply.text.length, stopReason: reply.stopReason })
    throw new ActionError(err instanceof Error ? err.message : 'The notes couldn’t be read', 'model_failed')
  }
  await audit(tools, userId, {
    action: 'ai.note_draft',
    targetType: 'note',
    targetId: p.noteId,
    targetLabel: note.data.title,
    meta: { topic: source.title },
  })
  return { draft, sourceTitle: source.title }
})

const reviewNote = defineAction(
  z.object({
    noteId: recordId,
    text: z.string().max(MAX_NOTES_CHARS, `Notes over ${MAX_NOTES_CHARS.toLocaleString()} characters are too long to review`),
    /** A Wikipedia topic to check facts against; without it Claude judges by general knowledge. */
    topic: topic.optional(),
  }),
  async ({ userId, tools }, p) => {
    const note = await noteForMember(tools, p.noteId, userId)
    const text = p.text.trim()
    if (text.length < MIN_REVIEW_CHARS) {
      throw new ActionError('Write a little more before asking for a review', 'too_little_text')
    }
    await requireQuota(tools, userId)
    const source = p.topic ? await wikipediaSource(tools, p.topic) : undefined
    const { system, user } = buildNoteReviewPrompt(text, source)
    const reply = await askClaude(tools, system, user, REVIEW_MAX_TOKENS, 'review the note')
    let review
    try {
      review = parseNoteReview(reply.text, text)
    } catch (err) {
      console.warn('note review reply unreadable', { length: reply.text.length, stopReason: reply.stopReason })
      throw new ActionError(err instanceof Error ? err.message : 'The review couldn’t be read', 'model_failed')
    }
    await audit(tools, userId, {
      action: 'ai.note_review',
      targetType: 'note',
      targetId: p.noteId,
      targetLabel: note.data.title,
      ...(source ? { meta: { checkedAgainst: source.title } } : {}),
    })
    return { review, sourceTitle: source?.title }
  },
)

export const noteAiActions = { draftNote, reviewNote }
