/**
 * Preferences kept on this device only (settings page → Preferences), in
 * localStorage. Each one has a default, so a blocked or empty store just
 * means defaults. Changes notify every hook on the page at once.
 *
 * Preferences that must follow the user everywhere, or that the server acts
 * on (like invite emails), live in the `user_prefs` collection instead.
 */

import { useCallback, useSyncExternalStore } from 'react'

const DEFAULTS: { showReactions: boolean } = {
  /** Float other people's emoji reactions over lobby and game screens. */
  showReactions: true,
}

export type DevicePrefKey = keyof typeof DEFAULTS
const storageKey = (key: DevicePrefKey) => `studyarena:pref:${key}`
const EVENT = 'studyarena:device-pref'

function read<K extends DevicePrefKey>(key: K): (typeof DEFAULTS)[K] {
  try {
    const raw = localStorage.getItem(storageKey(key))
    return raw === null ? DEFAULTS[key] : (JSON.parse(raw) as (typeof DEFAULTS)[K])
  } catch {
    return DEFAULTS[key]
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** A device preference and its setter, e.g. `const [show, setShow] = useDevicePref('showReactions')`. */
export function useDevicePref<K extends DevicePrefKey>(key: K) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => DEFAULTS[key],
  )
  const set = useCallback(
    (next: (typeof DEFAULTS)[K]) => {
      try {
        localStorage.setItem(storageKey(key), JSON.stringify(next))
      } catch {
        // Blocked storage: the change can't be saved; the default stays.
      }
      window.dispatchEvent(new Event(EVENT))
    },
    [key],
  )
  return [value, set] as const
}
