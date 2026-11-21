import type { Page } from '@playwright/test'

export interface ActionResult<T = Record<string, unknown>> {
  success: boolean
  data?: T & { serverNow: number }
  error?: string
  code?: string
}

export type CallAction = <T = Record<string, unknown>>(
  name: string,
  params?: Record<string, unknown>,
) => Promise<ActionResult<T>>

/**
 * Calls server actions as the account signed in to `page`'s context, the way
 * curl with a valid token would (docs/features.md §7): the bearer token comes
 * from the same `/api/auth/token` exchange the SDK's `getAuthToken` uses.
 */
export async function actionsAs(page: Page): Promise<CallAction> {
  const res = await page.request.post('/api/auth/token', { data: {} })
  const { token } = (await res.json()) as { token?: string }
  if (!token) throw new Error(`No auth token for this context (HTTP ${res.status()})`)

  return async (name, params = {}) => {
    const r = await page.request.post(`/api/actions/${name}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: params,
    })
    return (await r.json()) as ActionResult<never>
  }
}
