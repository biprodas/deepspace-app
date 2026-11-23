/** Settings → Profile: /settings (the section shown first). */

import { ProfileCard } from '@/components/settings/ProfileCard'
import { usePageTitle } from '@/lib/page-title'
import { useSettings } from '@/lib/settings-context'

export default function SettingsProfilePage() {
  usePageTitle('Profile · Settings')
  const { providers } = useSettings()
  return <ProfileCard providers={providers} />
}
