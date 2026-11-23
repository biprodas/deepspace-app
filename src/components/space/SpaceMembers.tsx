/**
 * A space's members: online first, the owner marked, and for the owner a
 * way to remove someone (they can't rejoin with the code afterwards).
 */

import { useState } from 'react'
import { Crown, UserX } from 'lucide-react'
import { Button, ConfirmModal, cn } from '@/components/ui'
import { Initials } from '@/components/landing/bits'
import { useAction } from '@/lib/use-action'
import type { SpaceState } from '@/lib/use-space'
import type { TeamMember } from '@/schemas/space-types'

export function SpaceMembers({ state }: { state: SpaceState }) {
  const { space, members, online, userId, isOwner } = state
  const { run, pending } = useAction()
  const [removing, setRemoving] = useState<TeamMember | null>(null)
  if (!space) return null

  const sorted = members
    .map((m, i) => ({ m, i, isOnline: online.has(m.data.userId) }))
    .sort((a, b) => Number(b.isOnline) - Number(a.isOnline))
  const onlineCount = sorted.filter((s) => s.isOnline).length

  return (
    <section aria-labelledby="space-members">
      <h2 id="space-members" className="mb-3 flex items-baseline gap-2 font-display text-lg font-bold">
        Members
        <span className="text-sm font-normal text-muted-foreground">
          {onlineCount} of {members.length} online
        </span>
      </h2>
      <ul data-testid="space-members" className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {sorted.map(({ m, i, isOnline }) => (
          <li
            key={m.recordId}
            data-testid="space-member"
            data-online={isOnline}
            className="flex items-center gap-3 px-4 py-2.5"
          >
            <span className="relative shrink-0">
              <Initials
                name={m.data.displayName}
                i={i}
                className={cn('size-9', m.data.role === 'owner' && 'bg-primary text-primary-foreground', !isOnline && 'opacity-50 grayscale')}
              />
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card',
                  isOnline ? 'bg-correct' : 'bg-muted-foreground',
                )}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                {m.data.displayName}
                {m.data.role === 'owner' && <Crown className="size-3.5 shrink-0 fill-warning text-warning" aria-label="Owner" />}
                {m.data.userId === userId && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
              </span>
              <span className="block text-xs text-muted-foreground">{isOnline ? 'Online' : 'Offline'}</span>
            </span>
            {isOwner && m.data.userId !== userId && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${m.data.displayName}`}
                onClick={() => setRemoving(m.data)}
              >
                <UserX />
              </Button>
            )}
          </li>
        ))}
      </ul>

      <ConfirmModal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.displayName ?? 'member'}?`}
        description="They lose access to the space and can’t rejoin with the code."
        confirmText="Remove"
        loading={pending === 'removeMember'}
        onConfirm={async () => {
          if (removing) await run('removeMember', { spaceId: space.recordId, userId: removing.userId })
          setRemoving(null)
        }}
      />
    </section>
  )
}
