/**
 * Whether the browser says it's online. Used to tell work that can still be
 * saved on the way out (online) from work that would be lost (offline).
 */

import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
}
