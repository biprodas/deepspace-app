/**
 * Tells a player or host their live connection dropped (docs/features.md
 * F7). Nothing is lost while it's down: answers, scores and the clock live
 * on the server, and the screen rebuilds from it when the socket returns.
 * Shown only after the first successful connection, so a cold load doesn't
 * flash it.
 */

import { useEffect, useState } from 'react'
import { useRecordContext } from 'deepspace'
import { WifiOff } from 'lucide-react'

export function ConnectionBanner() {
  const { status } = useRecordContext()
  const [wasConnected, setWasConnected] = useState(false)

  useEffect(() => {
    if (status === 'connected') setWasConnected(true)
  }, [status])

  if (!wasConnected || status === 'connected') return null
  return (
    <p
      role="status"
      data-testid="connection-banner"
      className="sticky top-0 z-20 flex items-center justify-center gap-2 bg-warning px-4 py-2 text-center text-sm font-semibold text-warning-foreground"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      Reconnecting… Your answers and score are safe on the server.
    </p>
  )
}
