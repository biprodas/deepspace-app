/**
 * The slim bar that replaces the app navigation during a lobby or live game
 * (focus mode): brand, what's being played, the code to join with, and a
 * way out that doesn't end anything. Players keep their seat and can rejoin
 * from /home; the host's game keeps running.
 */

import { Link } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Badge, buttonVariants, cn } from '@/components/ui'
import { ColorModeToggle } from '@/components/ColorModeToggle'
import { LogoMark } from '@/components/landing/bits'
import type { RoomState } from '@/lib/use-room'

export function FocusBar({ state }: { state: RoomState }) {
  const { room, quiz, role } = state
  if (!room) return null
  const isPlayer = role === 'player'

  return (
    <header
      data-testid="focus-bar"
      className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4"
    >
      <LogoMark check className="shrink-0" />
      <span className="min-w-0 truncate text-sm font-semibold">{quiz?.data.title ?? 'StudyArena'}</span>
      {role === 'co-host' && <Badge variant="info" size="sm">Co-host</Badge>}
      <span className="ml-auto flex shrink-0 items-center gap-2">
        <span
          aria-label={`Room code ${room.data.code.split('').join(' ')}`}
          className="hidden rounded-md bg-secondary px-2 py-1 font-mono text-xs font-bold tracking-[0.15em] sm:inline"
        >
          {room.data.code}
        </span>
        <ColorModeToggle />
        <Link
          to={isPlayer ? '/home' : `/quizzes/${room.data.quizId}`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-muted-foreground')}
          title={isPlayer ? 'Your seat is kept; rejoin from Home' : 'The game keeps running; come back from the quiz'}
        >
          <LogOut aria-hidden="true" /> {isPlayer ? 'Leave' : 'Exit to quiz'}
        </Link>
      </span>
    </header>
  )
}
