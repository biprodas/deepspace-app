/**
 * Asks before leaving a lobby or live game. In-app navigation (the Leave
 * button, links, the browser's Back) is held by the router until the
 * viewer confirms; closing or reloading the tab gets the browser's own
 * "Leave site?" prompt.
 *
 * A navigation that was already confirmed elsewhere (e.g. "End game")
 * passes `LEAVE_CONFIRMED` as its location state to skip the second ask.
 */

import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

export const LEAVE_CONFIRMED = { leaveConfirmed: true } as const

export function useLeaveGuard(active: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      active &&
      currentLocation.pathname !== nextLocation.pathname &&
      !(nextLocation.state as { leaveConfirmed?: boolean } | null)?.leaveConfirmed,
  )

  useEffect(() => {
    // Automated browsers (tests) reload rooms on purpose; a prompt would stall them.
    if (!active || navigator.webdriver) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Older browsers need returnValue set to show the prompt.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [active])

  return {
    asking: blocker.state === 'blocked',
    stay: () => blocker.reset?.(),
    leave: () => blocker.proceed?.(),
  }
}
