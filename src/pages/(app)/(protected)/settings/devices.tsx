/** Settings → Devices: /settings/devices. */

import { SessionsCard } from '@/components/settings/SessionsCard'
import { usePageTitle } from '@/lib/page-title'

export default function SettingsDevicesPage() {
  usePageTitle('Devices · Settings')
  return <SessionsCard />
}
