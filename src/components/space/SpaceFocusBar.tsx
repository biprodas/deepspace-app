/**
 * The slim bar that replaces the app navigation on a space's note and board
 * pages (focus mode, like a live game): back to the space, where you are,
 * who's here and online, a way to invite more, the theme, and Exit.
 *
 * Leaving asks first, as in a game: Exit, the back arrow, the breadcrumb
 * links and the browser's Back all open "Leave this note?". There's no
 * prompt on reload or closing the tab, since everything saves as you type.
 */

import { Link } from 'react-router-dom'
import { ArrowLeft, LogOut } from 'lucide-react'
import { ConfirmModal, buttonVariants, cn } from '@/components/ui'
import { ColorModeToggle } from '@/components/ColorModeToggle'
import { LogoMark } from '@/components/landing/bits'
import { SpaceAvatars } from '@/components/space/SpaceAvatars'
import { SpaceInviteButton } from '@/components/space/SpaceInviteButton'
import { useLeaveGuard } from '@/lib/leave-guard'
import type { SpaceState } from '@/lib/use-space'

const SECTION = {
  notes: { label: 'Notes', item: 'note' },
  boards: { label: 'Boards', item: 'board' },
} as const

export function SpaceFocusBar({ state, section }: { state: SpaceState; section: keyof typeof SECTION }) {
  const { space, locations, here, userId } = state
  const spaceId = space?.recordId
  const back = spaceId ? `/spaces/${spaceId}?tab=${section}` : '/spaces'
  const { label, item } = SECTION[section]
  const guard = useLeaveGuard(true, { beforeUnload: false })

  // Who else is in this note or board, for the confirmation's wording.
  const othersHere = here
    ? [...locations].filter(([id, l]) => id !== userId && l.kind === here.kind && l.id === here.id).length
    : 0

  return (
    <header
      data-testid="space-focus-bar"
      className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur sm:gap-3 sm:px-4"
    >
      <Link
        to={back}
        aria-label={`Back to ${label.toLowerCase()}`}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ArrowLeft className="size-5" />
      </Link>
      <Link to="/home" aria-label="StudyArena home" className="hidden shrink-0 sm:block">
        <LogoMark check />
      </Link>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        <Link to={spaceId ? `/spaces/${spaceId}` : '/spaces'} className="min-w-0 truncate font-semibold hover:underline">
          {space?.data.name ?? 'Space'}
        </Link>
        <span aria-hidden="true" className="text-muted-foreground">
          /
        </span>
        <Link to={back} className="shrink-0 text-muted-foreground hover:text-foreground hover:underline">
          {label}
        </Link>
      </nav>

      <span className="ml-auto flex shrink-0 items-center gap-2">
        <SpaceAvatars state={state} />
        <SpaceInviteButton state={state} />
        <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <ColorModeToggle />
        <Link
          to={back}
          data-testid="space-exit"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-muted-foreground')}
          title={`Leave this ${item}; it stays saved`}
        >
          <LogOut aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Exit</span>
        </Link>
      </span>

      <ConfirmModal
        open={guard.asking}
        onClose={guard.stay}
        onConfirm={guard.leave}
        variant="default"
        title={`Leave this ${item}?`}
        description={
          othersHere > 0
            ? `Everything is saved. ${othersHere === 1 ? '1 other member is' : `${othersHere} other members are`} still working here and can keep going without you.`
            : `Everything is saved, so you can pick up where you left off from ${label}.`
        }
        confirmText="Leave"
        cancelText="Stay"
      />
    </header>
  )
}
