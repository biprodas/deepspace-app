/**
 * Asks before leaving a focused screen: a lobby or live game, or a study
 * space's note or board. In-app navigation (the Leave/Exit button, links,
 * the browser's Back) is held by the router until the viewer confirms;
 * closing or reloading the tab gets the browser's own "Leave site?" prompt
 * unless `beforeUnload: false` (notes and boards save as you type, so a
 * reload loses nothing and the prompt would only get in the way).
 *
 * A navigation that was already confirmed elsewhere (e.g. "End game",
 * "Delete note") passes `LEAVE_CONFIRMED` as its location state to skip
 * the second ask.
 */

import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

export const LEAVE_CONFIRMED = { leaveConfirmed: true } as const

export function useLeaveGuard(active: boolean, { beforeUnload = true }: { beforeUnload?: boolean } = {}) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      active &&
      currentLocation.pathname !== nextLocation.pathname &&
      !(nextLocation.state as { leaveConfirmed?: boolean } | null)?.leaveConfirmed,
  )

  useEffect(() => {
    // Automated browsers (tests) reload rooms on purpose; a prompt would stall them.
    if (!active || !beforeUnload || navigator.webdriver) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Older browsers need returnValue set to show the prompt.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [active, beforeUnload])

  return {
    asking: blocker.state === 'blocked',
    stay: () => blocker.reset?.(),
    leave: () => blocker.proceed?.(),
  }
}
