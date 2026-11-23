/** What the settings layout hands its sections (src/pages/(app)/(protected)/settings/_layout.tsx). */

import { useOutletContext } from 'react-router-dom'

export interface SettingsContext {
  /** How this account signs in ('credential', 'google', 'github'); null while loading. */
  providers: string[] | null
}

export const useSettings = () => useOutletContext<SettingsContext>()
