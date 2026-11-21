/**
 * Focus mode: a page can ask the app layout to hide the full navigation
 * while it's on screen. Live game screens use it so the question, clock and
 * tiles get the whole projector or phone; they draw their own slim bar.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const FocusModeContext = createContext<{ focused: boolean; setFocused: (on: boolean) => void }>({
  focused: false,
  setFocused: () => {},
})

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [focused, setFocused] = useState(false)
  return <FocusModeContext.Provider value={{ focused, setFocused }}>{children}</FocusModeContext.Provider>
}

/** Whether the layout should hide its navigation. */
export function useIsFocusMode(): boolean {
  return useContext(FocusModeContext).focused
}

/** Hides the layout's navigation while `active`; restores it on unmount. */
export function useFocusMode(active: boolean): void {
  const { setFocused } = useContext(FocusModeContext)
  useEffect(() => {
    setFocused(active)
    return () => setFocused(false)
  }, [active, setFocused])
}
