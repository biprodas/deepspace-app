/**
 * Whiteboards and AI mind maps in study spaces (docs/features.md F15). A
 * board row is the metadata; its shapes live in the canvas room named after
 * the record id, which the app's canvas route opens only to the space's
 * active members. Team-scoped like spaces and notes.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { bool, json, select, serverWritten, text, time } from './schema-helpers'

export const BOARD_KINDS = ['whiteboard', 'mindmap'] as const
export type BoardKind = (typeof BOARD_KINDS)[number]

export interface Board {
  title: string
  kind: BoardKind
  spaceId: string
  /** = spaceId; the `'team'` rule and the canvas route match members against it. */
  teamId: string
  ownerId: string
  /** For a mind map: the Wikipedia article it was drawn from. */
  topic?: string
  /** For a mind map: the generated tree (src/lib/mindmap.ts), drawn once by the creator. */
  mindMap?: unknown
  mindMapDrawn?: boolean
  createdAt: number
}

export const boardsSchema: CollectionSchema = {
  name: 'boards',
  columns: [
    text('title', { required: true }),
    select('kind', BOARD_KINDS, { required: true, immutable: true }),
    text('spaceId', { required: true, immutable: true }),
    text('teamId', { required: true, immutable: true }),
    text('ownerId', { required: true, immutable: true }),
    text('topic', { immutable: true }),
    json('mindMap', { immutable: true }),
    bool('mindMapDrawn', { default: false }),
    time('createdAt', { required: true, immutable: true }),
  ],
  ownerField: 'ownerId',
  teamField: 'teamId',
  permissions: serverWritten('team'),
}
