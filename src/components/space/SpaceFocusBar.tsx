/**
 * The slim bar that replaces the app navigation on a space's note and board
 * pages (focus mode, like a live game): back to the space, where you are,
 * who's here and online, a way to invite more, and the theme. Unlike a game
 * there's no leave confirmation: everything saves as you type.
 */

import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ColorModeToggle } from '@/components/ColorModeToggle'
import { LogoMark } from '@/components/landing/bits'
import { SpaceAvatars } from '@/components/space/SpaceAvatars'
import { SpaceInviteButton } from '@/components/space/SpaceInviteButton'
import type { SpaceState } from '@/lib/use-space'

const SECTION_LABEL = { notes: 'Notes', boards: 'Boards' } as const

export function SpaceFocusBar({ state, section }: { state: SpaceState; section: keyof typeof SECTION_LABEL }) {
  const { space } = state
  const spaceId = space?.recordId
  const back = spaceId ? `/spaces/${spaceId}?tab=${section}` : '/spaces'

  return (
    <header
      data-testid="space-focus-bar"
      className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur sm:gap-3 sm:px-4"
    >
      <Link
        to={back}
        aria-label={`Back to ${SECTION_LABEL[section].toLowerCase()}`}
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
          {SECTION_LABEL[section]}
        </Link>
      </nav>

      <span className="ml-auto flex shrink-0 items-center gap-2">
        <SpaceAvatars state={state} />
        <SpaceInviteButton state={state} />
        <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <ColorModeToggle />
      </span>
    </header>
  )
}
