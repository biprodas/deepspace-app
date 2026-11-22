/**
 * Shared notes in study spaces (docs/features.md F14). These actions manage
 * the note rows; the text itself is edited live over the Yjs route, which
 * lets the space's active members in.
 */

import { z } from 'zod'
import { NOTE_TITLE_MAX, MAX_NOTES_PER_SPACE } from '../lib/game-rules'
import type { Room } from '../schemas/game-types'
import type { Note } from '../schemas/note-schemas'
import type { Space } from '../schemas/space-types'
import { ActionError, defineAction, getRecord, queryRecords, recordId, unwrap } from './shared'
import { requireMember } from './space'

const noteTitle = z.string().trim().min(1, 'Give the note a title').max(NOTE_TITLE_MAX)

async function createNoteRow(
  tools: Parameters<typeof requireMember>[0],
  spaceId: string,
  userId: string,
  title: string,
  roomId?: string,
) {
  const existing = await queryRecords<Note>(tools, 'documents', { spaceId })
  if (existing.length >= MAX_NOTES_PER_SPACE) {
    throw new ActionError(`A space can have up to ${MAX_NOTES_PER_SPACE} notes`, 'note_limit')
  }
  const note: Note = {
    title,
    spaceId,
    teamId: spaceId,
    ownerId: userId,
    ...(roomId ? { roomId } : {}),
    createdAt: Date.now(),
  }
  const { recordId: noteId } = unwrap(await tools.create('documents', { ...note }))
  return noteId
}

const createNote = defineAction(z.object({ spaceId: recordId, title: noteTitle }), async ({ userId, tools }, p) => {
  await requireMember(tools, p.spaceId, userId)
  return { noteId: await createNoteRow(tools, p.spaceId, userId, p.title) }
})

const renameNote = defineAction(z.object({ noteId: recordId, title: noteTitle }), async ({ userId, tools }, p) => {
  const note = await getRecord<Note>(tools, 'documents', p.noteId, 'Note')
  await requireMember(tools, note.data.spaceId, userId)
  unwrap(await tools.update('documents', p.noteId, { title: p.title }))
  return { noteId: p.noteId }
})

/** The note's creator or the space owner deletes it. */
const deleteNote = defineAction(z.object({ noteId: recordId }), async ({ userId, tools }, p) => {
  const note = await getRecord<Note>(tools, 'documents', p.noteId, 'Note')
  await requireMember(tools, note.data.spaceId, userId)
  const space = await getRecord<Space>(tools, 'spaces', note.data.spaceId, 'Space')
  if (note.data.ownerId !== userId && space.data.ownerId !== userId) {
    throw new ActionError('Only whoever wrote it or the space owner can delete a note', 'forbidden')
  }
  unwrap(await tools.remove('documents', p.noteId))
  return { noteId: p.noteId }
})

/**
 * The session note for a game played in a space, created on first use. Pins
 * from that game's reveals go here (the client appends to it over Yjs).
 */
const sessionNote = defineAction(z.object({ roomId: recordId }), async ({ userId, tools }, p) => {
  const room = await getRecord<Room>(tools, 'rooms', p.roomId, 'Room')
  if (!room.data.spaceId) throw new ActionError('This game isn’t in a study space', 'no_space')
  await requireMember(tools, room.data.spaceId, userId)
  const [existing] = await queryRecords<Note>(tools, 'documents', { roomId: p.roomId }, { limit: 1 })
  if (existing) return { noteId: existing.recordId, spaceId: room.data.spaceId }
  const title = `Game ${room.data.code} · ${new Date().toLocaleDateString('en-GB')}`
  const noteId = await createNoteRow(tools, room.data.spaceId, userId, title, p.roomId)
  return { noteId, spaceId: room.data.spaceId }
})

export const noteActions = {
  createNote,
  renameNote,
  deleteNote,
  sessionNote,
}
