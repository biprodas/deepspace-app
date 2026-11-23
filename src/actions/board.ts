/**
 * Whiteboards and AI mind maps in study spaces (docs/features.md F15).
 * These actions manage board rows; shapes are drawn live over the canvas
 * route, which lets the space's active members in.
 *
 * A mind map is generated here (Wikipedia article → Claude → a checked tree,
 * src/lib/mindmap.ts) and stored on the board; the creator's browser lays it
 * out and draws it once, then marks it drawn, so two open tabs can't draw it
 * twice.
 */

import { z } from 'zod'
import { BOARD_TITLE_MAX, DAILY_MINDMAP_LIMIT, MAX_BOARDS_PER_SPACE, MAX_TOPIC_CHARS } from '../lib/game-rules'
import { MODEL, htmlToText, readModelReply, truncate } from '../lib/generation'
import { buildMindMapPrompt, parseMindMap } from '../lib/mindmap'
import type { Board } from '../schemas/board-schemas'
import type { Space } from '../schemas/space-types'
import { resolveWikipediaTopics } from './quiz'
import { ActionError, defineAction, getRecord, queryRecords, recordId, unwrap } from './shared'
import { audit, auditsToday } from './audit'
import { requireMember } from './space'

const MINDMAP_MAX_TOKENS = 2500

const boardTitle = z.string().trim().min(1, 'Give the board a title').max(BOARD_TITLE_MAX)

async function requireBoardCapacity(tools: Parameters<typeof requireMember>[0], spaceId: string) {
  const boards = await queryRecords<Board>(tools, 'boards', { spaceId })
  if (boards.length >= MAX_BOARDS_PER_SPACE) {
    throw new ActionError(`A space can have up to ${MAX_BOARDS_PER_SPACE} boards`, 'board_limit')
  }
}

const createBoard = defineAction(z.object({ spaceId: recordId, title: boardTitle }), async ({ userId, tools }, p) => {
  await requireMember(tools, p.spaceId, userId)
  await requireBoardCapacity(tools, p.spaceId)
  const board: Board = {
    title: p.title,
    kind: 'whiteboard',
    spaceId: p.spaceId,
    teamId: p.spaceId,
    ownerId: userId,
    createdAt: Date.now(),
  }
  const { recordId: boardId } = unwrap(await tools.create('boards', { ...board }))
  return { boardId }
})

/**
 * Generates a mind map of a Wikipedia topic and creates its board. Nothing
 * is created if the topic isn't found or Claude's map doesn't check out.
 */
const createMindMap = defineAction(
  z.object({ spaceId: recordId, topic: z.string().trim().min(1, 'Enter a topic').max(120) }),
  async ({ userId, tools }, p) => {
    await requireMember(tools, p.spaceId, userId)
    await requireBoardCapacity(tools, p.spaceId)
    if ((await auditsToday(tools, userId, ['ai.mind_map'], DAILY_MINDMAP_LIMIT)) >= DAILY_MINDMAP_LIMIT) {
      throw new ActionError(`You can generate ${DAILY_MINDMAP_LIMIT} mind maps a day`, 'daily_limit')
    }

    const [title] = await resolveWikipediaTopics(tools, [p.topic])
    const page = await tools.integration<{ htmlContent: string }>('wikipedia/get-page-content', { title })
    if (!page.success) throw new ActionError(`Couldn’t load “${title}” from Wikipedia`, 'wikipedia_unavailable')
    const text = truncate(htmlToText(page.data.htmlContent ?? ''), MAX_TOPIC_CHARS)
    if (text.length < 200) throw new ActionError(`“${title}” has too little text for a mind map`, 'too_little_text')

    const { system, user } = buildMindMapPrompt(title, text)
    const reply = await tools.integration('anthropic/chat-completion', {
      model: MODEL,
      max_tokens: MINDMAP_MAX_TOKENS,
      temperature: 0.3,
      system,
      messages: [{ role: 'user', content: user }],
    })
    if (!reply.success) throw new ActionError('Claude couldn’t draft the mind map, try again', 'model_failed')
    let mindMap
    const replyText = readModelReply(reply.data).text
    try {
      mindMap = parseMindMap(replyText, text)
    } catch (err) {
      // Visible in `deepspace logs`: a cut-off reply shows as stop_reason "max_tokens".
      console.warn('mind map reply unreadable', {
        length: replyText.length,
        stopReason: (reply.data as { stop_reason?: string }).stop_reason,
      })
      throw new ActionError(err instanceof Error ? err.message : 'The mind map couldn’t be read', 'model_failed')
    }

    const board: Board = {
      title: `Mind map: ${title}`.slice(0, BOARD_TITLE_MAX),
      kind: 'mindmap',
      spaceId: p.spaceId,
      teamId: p.spaceId,
      ownerId: userId,
      topic: title,
      mindMap,
      mindMapDrawn: false,
      createdAt: Date.now(),
    }
    const { recordId: boardId } = unwrap(await tools.create('boards', { ...board }))
    await audit(tools, userId, { action: 'ai.mind_map', targetType: 'board', targetId: boardId, targetLabel: title })
    return { boardId }
  },
)

/** The creator's browser drew the generated map; don't draw it again. */
const markMindMapDrawn = defineAction(z.object({ boardId: recordId }), async ({ userId, tools }, p) => {
  const board = await getRecord<Board>(tools, 'boards', p.boardId, 'Board')
  if (board.data.ownerId !== userId) throw new ActionError('Only whoever generated it draws the map', 'forbidden')
  if (!board.data.mindMapDrawn) unwrap(await tools.update('boards', p.boardId, { mindMapDrawn: true }))
  return { boardId: p.boardId }
})

const renameBoard = defineAction(z.object({ boardId: recordId, title: boardTitle }), async ({ userId, tools }, p) => {
  const board = await getRecord<Board>(tools, 'boards', p.boardId, 'Board')
  await requireMember(tools, board.data.spaceId, userId)
  unwrap(await tools.update('boards', p.boardId, { title: p.title }))
  return { boardId: p.boardId }
})

/** The board's creator or the space owner deletes it. */
const deleteBoard = defineAction(z.object({ boardId: recordId }), async ({ userId, tools }, p) => {
  const board = await getRecord<Board>(tools, 'boards', p.boardId, 'Board')
  await requireMember(tools, board.data.spaceId, userId)
  const space = await getRecord<Space>(tools, 'spaces', board.data.spaceId, 'Space')
  if (board.data.ownerId !== userId && space.data.ownerId !== userId) {
    throw new ActionError('Only whoever made it or the space owner can delete a board', 'forbidden')
  }
  unwrap(await tools.remove('boards', p.boardId))
  await audit(tools, userId, { action: 'board.deleted', targetType: 'board', targetId: p.boardId, targetLabel: board.data.title })
  return { boardId: p.boardId }
})

export const boardActions = {
  createBoard,
  createMindMap,
  markMindMapDrawn,
  renameBoard,
  deleteBoard,
}
