import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Copies text and reports `copied` for a moment, for "Copied" button states.
 * A blocked clipboard fails quietly: callers keep the text on screen to copy
 * by hand.
 */
export function useCopy(resetMs = 2000) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), resetMs)
      } catch {
        // Clipboard blocked (permissions, insecure origin).
      }
    },
    [resetMs],
  )

  return { copied, copy }
}
