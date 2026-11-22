/**
 * Admin console, credits: /admin/credits (docs/features.md F16). The
 * signed-in admin's DeepSpace credit balance, which pays for the app's
 * developer-billed calls (Claude, Wikipedia, email), with where the credits
 * came from. Exact per-call spend and top-ups live in the DeepSpace
 * dashboard.
 */

import { useState } from 'react'
import { useUser } from 'deepspace'
import { Coins, ExternalLink, Gift, RefreshCw, Repeat, ShoppingCart } from 'lucide-react'
import { Button, buttonVariants, cn } from '@/components/ui'
import { AdminHeader, StatCard } from '@/components/admin/admin-ui'
import { usePageTitle } from '@/lib/page-title'

/** 100 credits = $1 (DeepSpace's rate, as `npx deepspace app usage` shows it). */
const CREDITS_PER_USD = 100

const credits = (n: number | undefined) => (n === undefined ? '—' : n.toLocaleString('en-US'))
const dollars = (n: number | undefined) => (n === undefined ? undefined : `≈ $${(n / CREDITS_PER_USD).toFixed(2)}`)

export default function AdminCreditsPage() {
  usePageTitle('Credits')
  const { user, refetch } = useUser()
  const [refreshing, setRefreshing] = useState(false)
  const c = user?.credits ?? undefined

  return (
    <>
      <AdminHeader title="Credits" description="Your DeepSpace balance, which pays for the app’s AI, Wikipedia and email calls.">
        <Button
          variant="outline"
          size="sm"
          loading={refreshing}
          onClick={async () => {
            setRefreshing(true)
            await refetch()
            setRefreshing(false)
          }}
        >
          <RefreshCw /> Refresh
        </Button>
      </AdminHeader>

      {c ? (
        <div data-testid="admin-credits" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Available" icon={<Coins />} value={credits(c.total)} hint={dollars(c.total)} />
          <StatCard label="From your plan" icon={<Repeat />} value={credits(c.subscription)} hint={user?.subscriptionTier ? `${user.subscriptionTier} plan` : undefined} />
          <StatCard label="Bonus" icon={<Gift />} value={credits(c.bonus)} />
          <StatCard label="Purchased" icon={<ShoppingCart />} value={credits(c.purchased)} />
        </div>
      ) : (
        <p data-testid="admin-credits" className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Your balance isn’t available in the app right now. The DeepSpace dashboard always has it.
        </p>
      )}

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="font-medium">Where credits go</p>
          <p className="mt-1 text-muted-foreground">
            AI quiz drafts and mind maps (Claude), Wikipedia lookups and invite emails are billed to the app owner. See
            what the app made on the API usage page.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="font-medium">Top up or see every charge</p>
          <p className="mt-1 text-muted-foreground">
            The dashboard has your plan, top-ups and per-integration spend. From a terminal:{' '}
            <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">npx deepspace app usage</code>.
          </p>
          <a
            href="https://dashboard.deep.space"
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3')}
          >
            Open DeepSpace dashboard <ExternalLink aria-hidden="true" />
          </a>
        </div>
      </div>
    </>
  )
}
