/**
 * WebSocket routing for app-owned Durable Objects.
 *
 * Caller identity in query parameters and headers is never trusted. Routes
 * scrub it and forward verified JWT identity in internal-only headers; the
 * documents-aware Yjs route additionally resolves an application role from
 * the documents collection (for study-space notes: from space membership),
 * and the canvas route admits only a board's space members.
 */

import type { Context, Hono } from 'hono'
import { authenticatedRoomRequest, resolveAppRole, verifyJwt } from 'deepspace/worker'
import type { JwtVerifierConfig, VerifyResult } from 'deepspace/worker'
import type { AppContext, Env } from '../../worker.js'

function jwtConfig(env: Env): JwtVerifierConfig {
  return { publicKey: env.AUTH_JWT_PUBLIC_KEY, issuer: env.AUTH_JWT_ISSUER }
}

function wsRoute(
  doNamespace: (env: Env) => DurableObjectNamespace,
  extraIdentity?: (auth: VerifyResult, env: Env) => { role?: string } | Promise<{ role?: string }>,
) {
  return async (c: Context<AppContext>) => {
    const id = c.req.param('roomId') ?? c.req.param('docId') ?? c.req.param('scopeId')
    if (!id) return new Response('Not found', { status: 404 })
    const url = new URL(c.req.url)
    const token = url.searchParams.get('token')

    let auth: VerifyResult | null = null
    if (token) {
      auth = (await verifyJwt(jwtConfig(c.env), token)).result
      if (!auth) return new Response('Unauthorized', { status: 401 })
    }
    const roomRequest = authenticatedRoomRequest(
      c.req.raw,
      auth,
      auth ? await extraIdentity?.(auth, c.env) : undefined,
    )

    const namespace = doNamespace(c.env)
    const stub = namespace.get(namespace.idFromName(id))
    return stub.fetch(roomRequest)
  }
}

type DocsYjsRole = 'admin' | 'member' | 'viewer'

interface DocumentRecordForAccess {
  ownerId?: string
  collaborators?: string
  editors?: string
  /** Set on study-space notes (src/schemas/note-schemas.ts): access follows space membership. */
  teamId?: string
}

type DocumentAccessLookup =
  | { kind: 'found'; doc: DocumentRecordForAccess }
  | { kind: 'not-docs-room' }
  | { kind: 'error' }

function parseAccessList(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/** Runs a records tool in the app's RecordRoom as the app (RBAC off), like a server action. */
async function appRecordsTool(env: Env, tool: string, params: Record<string, unknown>): Promise<unknown> {
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
  const res = await stub.fetch(
    new Request('https://internal/api/tools/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': env.OWNER_USER_ID,
        'X-App-Action': 'true',
      },
      body: JSON.stringify({ tool, params }),
    }),
  )
  return res.json()
}

/** True when `userId` has an active membership in the space (team) `teamId`. */
async function isActiveTeamMember(env: Env, teamId: string, userId: string): Promise<boolean> {
  try {
    const json = (await appRecordsTool(env, 'records.query', {
      collection: 'team_members',
      where: { teamId, userId },
      limit: 1,
    })) as { success?: boolean; data?: { records?: { data?: { status?: string } }[] } }
    const status = json.success ? json.data?.records?.[0]?.data?.status : undefined
    return status === 'active'
  } catch {
    return false
  }
}

async function getDocumentForAccess(env: Env, docId: string): Promise<DocumentAccessLookup> {
  try {
    const json = (await appRecordsTool(env, 'records.get', { collection: 'documents', recordId: docId })) as {
      success?: boolean
      error?: string
      data?: { record?: { data?: DocumentRecordForAccess } }
    }
    if (json.success && json.data?.record?.data) {
      return { kind: 'found', doc: json.data.record.data }
    }
    if (json.error?.startsWith('Schema not registered for collection: documents')) {
      return { kind: 'not-docs-room' }
    }
    return { kind: 'error' }
  } catch {
    return { kind: 'error' }
  }
}

async function resolveDocsYjsRole(
  env: Env,
  docId: string,
  userId: string,
): Promise<DocsYjsRole | null> {
  const lookup = await getDocumentForAccess(env, docId)
  if (lookup.kind === 'not-docs-room') return 'member'
  if (lookup.kind === 'error') return null
  const { doc } = lookup
  if (userId === env.OWNER_USER_ID) return 'admin'
  // Space notes: every active member edits; anyone else, the note's creator
  // included once they've left or been removed, is refused.
  if (doc.teamId) return (await isActiveTeamMember(env, doc.teamId, userId)) ? 'member' : null
  if (doc.ownerId === userId) return 'admin'

  const editors = parseAccessList(doc.editors)
  if (editors.includes(userId)) return 'member'

  const collaborators = parseAccessList(doc.collaborators)
  if (collaborators.includes(userId)) return 'viewer'

  return null
}

/** Editor for a board's space members (and the app owner); null for anyone else or any non-board id. */
async function resolveBoardRole(env: Env, boardId: string, userId: string): Promise<'admin' | 'member' | null> {
  if (userId === env.OWNER_USER_ID) return 'admin'
  try {
    const json = (await appRecordsTool(env, 'records.get', { collection: 'boards', recordId: boardId })) as {
      success?: boolean
      data?: { record?: { data?: { teamId?: string } } }
    }
    const teamId = json.success ? json.data?.record?.data?.teamId : undefined
    if (!teamId) return null
    return (await isActiveTeamMember(env, teamId, userId)) ? 'member' : null
  } catch {
    return null
  }
}

export function registerRealtimeRoutes(app: Hono<AppContext>): void {
  app.get(
    '/ws/:roomId',
    wsRoute((env) => env.RECORD_ROOMS),
  )

  app.get('/ws/yjs/:docId', async (c) => {
    const docId = c.req.param('docId')
    const url = new URL(c.req.url)
    const token = url.searchParams.get('token')
    const auth = token ? (await verifyJwt(jwtConfig(c.env), token)).result : null
    if (!auth) return new Response('Unauthorized', { status: 401 })

    const role = await resolveDocsYjsRole(c.env, docId, auth.userId)
    if (!role) return new Response('Forbidden', { status: 403 })

    const roomRequest = authenticatedRoomRequest(c.req.raw, auth, { role })

    const stub = c.env.YJS_ROOMS.get(c.env.YJS_ROOMS.idFromName(docId))
    return stub.fetch(roomRequest)
  })

  // Canvas rooms are study-space boards (src/schemas/board-schemas.ts): only
  // the space's active members get in, as editors. Any other id is refused,
  // so a canvas can't be opened just by knowing or guessing its id.
  app.get('/ws/canvas/:docId', async (c) => {
    const docId = c.req.param('docId')
    const token = new URL(c.req.url).searchParams.get('token')
    const auth = token ? (await verifyJwt(jwtConfig(c.env), token)).result : null
    if (!auth) return new Response('Unauthorized', { status: 401 })

    const role = await resolveBoardRole(c.env, docId, auth.userId)
    if (!role) return new Response('Forbidden', { status: 403 })

    const stub = c.env.CANVAS_ROOMS.get(c.env.CANVAS_ROOMS.idFromName(docId))
    return stub.fetch(authenticatedRoomRequest(c.req.raw, auth, { role }))
  })

  app.get(
    '/ws/presence/:scopeId',
    wsRoute((env) => env.PRESENCE_ROOMS),
  )

  app.get(
    '/ws/cron/:roomId',
    wsRoute(
      (env) => env.CRON_ROOMS,
      // Authenticated users get their current app role. Anonymous connections
      // have no role and CronRoom enforces them as read-only viewers.
      async (auth, env) => ({ role: await resolveAppRole(env, auth.userId) }),
    ),
  )

  app.get(
    '/ws/jobs/:roomId',
    wsRoute((env) => env.JOB_ROOMS),
  )
}
