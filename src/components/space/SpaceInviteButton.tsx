/**
 * "Invite" on a study space: invite by account or email (any member can),
 * plus the space's join link and code.
 */

import { UserPlus } from 'lucide-react'
import { Button, Popover, PopoverContent, PopoverTrigger } from '@/components/ui'
import { InvitePeople } from '@/components/room/InvitePeople'
import { ShareLink } from '@/components/room/InviteButton'
import { spaceJoinPath } from '@/lib/join-code'
import type { SpaceState } from '@/lib/use-space'

export function SpaceInviteButton({ state }: { state: SpaceState }) {
  const { space, members } = state
  if (!space) return null
  const inSpace = new Set(members.map((m) => m.data.userId))

  return (
    <Popover>
      <PopoverTrigger data-testid="space-invite" render={<Button variant="outline" size="sm" aria-label="Invite people" />}>
        <UserPlus aria-hidden="true" />
        <span className="hidden sm:inline">Invite</span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex max-h-[min(40rem,85vh)] w-96 max-w-[calc(100vw-2rem)] flex-col overflow-y-auto p-0"
      >
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Invite to {space.data.name}</p>
          <p className="text-xs text-muted-foreground">Members see the space’s games and everyone in it.</p>
        </div>
        <InvitePeople target={{ spaceId: space.recordId }} inRoom={inSpace} />
        <ShareLink
          code={space.data.code}
          path={spaceJoinPath(space.data.code)}
          shareTitle={`Join “${space.data.name}” on StudyArena`}
          hint="Join with code"
          compact
        />
      </PopoverContent>
    </Popover>
  )
}
