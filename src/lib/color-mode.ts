/**
 * Light / dark mode.
 *
 * The resolved mode lives on `<html data-mode="light|dark">`; the dark
 * tokens in themes.css and Tailwind's `dark:` variant key off it. A visitor's
 * explicit choice is kept in localStorage; with no choice, the OS setting
 * wins and is followed live.
 *
 * index.html runs the same resolve step inline, before the first paint, so
 * there is never a light flash on a dark page. Keep the storage key and the
 * attribute in sync with that script.
 */

export type ColorMode = 'light' | 'dark'

export const COLOR_MODE_STORAGE_KEY = 'studyarena:color-mode'

/** The mode currently applied to the page. */
export function currentColorMode(): ColorMode {
  return document.documentElement.dataset.mode === 'dark' ? 'dark' : 'light'
}

/** Apply a mode and remember it as the visitor's choice. */
export function setColorMode(mode: ColorMode) {
  document.documentElement.dataset.mode = mode
  try {
    localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode)
  } catch {
    // Private mode or blocked storage: the switch still works for this visit.
  }
}

export function toggleColorMode() {
  setColorMode(currentColorMode() === 'dark' ? 'light' : 'dark')
}
