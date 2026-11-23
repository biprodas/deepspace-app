/** Settings → Preferences: /settings/preferences. */

import { PreferencesCard } from '@/components/settings/PreferencesCard'
import { usePageTitle } from '@/lib/page-title'

export default function SettingsPreferencesPage() {
  usePageTitle('Preferences · Settings')
  return <PreferencesCard />
}
