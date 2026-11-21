/**
 * Calls a Study Arena server action (`POST /api/actions/<name>`) with the
 * signed-in user's token. Never throws for a refusal: branch on `success`
 * and render `error` directly (docs/trd.md §6).
 */

import { getAuthToken } from 'deepspace'
import type { ActionName } from '../actions'

export type ActionResponse<T> =
  | { success: true; data: T & { serverNow: number } }
  | { success: false; error: string; code?: string; details?: Record<string, unknown> }

export async function callAction<T = Record<string, never>>(
  name: ActionName,
  params: Record<string, unknown> = {},
): Promise<ActionResponse<T>> {
  const token = await getAuthToken()
  if (!token) return { success: false, error: 'Sign in to continue', code: 'not_signed_in' }

  let res: Response
  try {
    res = await fetch(`/api/actions/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    })
  } catch {
    return { success: false, error: 'Network error, try again', code: 'network' }
  }

  if (res.status === 401) {
    return { success: false, error: 'Sign in to continue', code: 'not_signed_in' }
  }
  try {
    return (await res.json()) as ActionResponse<T>
  } catch {
    return { success: false, error: `Server error (${res.status})`, code: 'server_error' }
  }
}
