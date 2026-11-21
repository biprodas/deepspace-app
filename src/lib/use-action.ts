/**
 * Runs server actions from a component: tracks which one is in flight (so
 * buttons can show a spinner) and toasts refusals.
 */

import { useCallback, useState } from 'react'
import { useToast } from '@/components/ui'
import { callAction, type ActionResponse } from './actions-client'
import type { ActionName } from '../actions'

export function useAction() {
  const { error } = useToast()
  const [pending, setPending] = useState<string | null>(null)

  const run = useCallback(
    async <T = Record<string, never>>(
      name: ActionName,
      params: Record<string, unknown> = {},
      /** Identifies this call in `pending`; defaults to the action name. */
      key: string = name,
    ): Promise<ActionResponse<T>> => {
      setPending(key)
      try {
        const result = await callAction<T>(name, params)
        if (!result.success) error(result.error)
        return result
      } finally {
        setPending(null)
      }
    },
    [error],
  )

  return { run, pending }
}
