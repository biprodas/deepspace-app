/** Settings → Password: /settings/password. */

import { PasswordCard } from '@/components/settings/PasswordCard'
import { usePageTitle } from '@/lib/page-title'
import { useSettings } from '@/lib/settings-context'

export default function SettingsPasswordPage() {
  usePageTitle('Password · Settings')
  const { providers } = useSettings()
  if (providers === null) return <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
  return <PasswordCard providers={providers} />
}
