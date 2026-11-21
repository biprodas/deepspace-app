/**
 * Browser-tab titles for signed-in pages: "My quizzes · StudyArena".
 *
 * React 19 hoists every rendered <title> into <head> and the browser shows
 * the first, so exactly one is rendered: by the app layout, from the name
 * the current page registers with `usePageTitle`. Pages without one get the
 * bare app name.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { APP_NAME } from '../constants'

const PageTitleContext = createContext<{ title: string | null; setTitle: (t: string | null) => void }>({
  title: null,
  setTitle: () => {},
})

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null)
  return <PageTitleContext.Provider value={{ title, setTitle }}>{children}</PageTitleContext.Provider>
}

/** "Page · StudyArena", or "StudyArena" when no page has named itself. */
export function formatTitle(page: string | null | undefined): string {
  const name = page?.trim()
  return name ? `${name} · ${APP_NAME}` : APP_NAME
}

/** The `<title>` element for the layout to render. */
export function DocumentTitle() {
  return <title>{formatTitle(useContext(PageTitleContext).title)}</title>
}

/** Names the current page in the browser tab while it's mounted. */
export function usePageTitle(title: string | null | undefined): void {
  const { setTitle } = useContext(PageTitleContext)
  useEffect(() => {
    setTitle(title ?? null)
    return () => setTitle(null)
  }, [title, setTitle])
}
