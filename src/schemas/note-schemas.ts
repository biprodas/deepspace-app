/**
 * Shared notes in study spaces (docs/features.md F14). The collection is
 * named `documents` because the app's Yjs route (src/server/realtime-routes.ts)
 * resolves editor access from it; the note's text lives in the Yjs room
 * named after its record id, not in this row.
 *
 * Rows are team-scoped like spaces: only the space's active members receive
 * them, and the Yjs route lets those members edit.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { serverWritten, text, time } from './schema-helpers'

export interface Note {
  title: string
  spaceId: string
  /** = spaceId; the `'team'` rule and the Yjs route match members against it. */
  teamId: string
  /** Who created it (the route's "owner": full access). */
  ownerId: string
  /** Set on a game's session note, so pins from that game find it. */
  roomId?: string
  createdAt: number
}

export const documentsSchema: CollectionSchema = {
  name: 'documents',
  columns: [
    text('title', { required: true }),
    text('spaceId', { required: true, immutable: true }),
    text('teamId', { required: true, immutable: true }),
    text('ownerId', { required: true, immutable: true }),
    text('roomId', { immutable: true }),
    time('createdAt', { required: true, immutable: true }),
  ],
  ownerField: 'ownerId',
  teamField: 'teamId',
  permissions: serverWritten('team'),
}
