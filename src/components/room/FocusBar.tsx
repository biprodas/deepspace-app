/**
 * The slim bar that replaces the app navigation during a lobby or live game
 * (focus mode). Left: which game (brand, quiz title, code). Right: who's in
 * it and a way to invite more, then the theme and a way out that doesn't
 * end anything. Players keep their seat and can rejoin from /home; the
 * host's game keeps running. Leaving asks first.
 */

import { Link } from 'react-router-dom'
import { Check, Copy, LogOut } from 'lucide-react'
import { Badge, ConfirmModal, buttonVariants, cn } from '@/components/ui'
import { ColorModeToggle } from '@/components/ColorModeToggle'
import { LogoMark } from '@/components/landing/bits'
import { InviteButton } from '@/components/room/InviteButton'
import { RoomAvatars } from '@/components/room/RoomAvatars'
import { useLeaveGuard } from '@/lib/leave-guard'
import { useCopy } from '@/lib/use-copy'
import type { RoomState } from '@/lib/use-room'

export function FocusBar({ state }: { state: RoomState }) {
  const { room, quiz, role } = state
  const guard = useLeaveGuard(!!room)
  if (!room) return null
  const isPlayer = role === 'player'

  return (
    <header
      data-testid="focus-bar"
      className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4"
    >
      <LogoMark check className="shrink-0" />
      <span className="min-w-0 truncate text-sm font-semibold">{quiz?.data.title ?? 'StudyArena'}</span>
      <CodeChip code={room.data.code} />
      {role === 'co-host' && <Badge variant="info" size="sm">Co-host</Badge>}

      <span className="ml-auto flex shrink-0 items-center gap-2">
        <RoomAvatars state={state} />
        <InviteButton state={state} />
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
        <ColorModeToggle />
        <Link
          to={isPlayer ? '/home' : `/quizzes/${room.data.quizId}`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-muted-foreground')}
          title={isPlayer ? 'Your seat is kept; rejoin from Home' : 'The game keeps running; come back from the quiz'}
        >
          <LogOut aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{isPlayer ? 'Leave' : 'Exit to quiz'}</span>
        </Link>
      </span>

      <ConfirmModal
        open={guard.asking}
        onClose={guard.stay}
        onConfirm={guard.leave}
        variant="default"
        title={isPlayer ? 'Leave the game?' : 'Leave the game screen?'}
        description={
          isPlayer
            ? 'Your seat and score are kept. You can rejoin from Home while the game is open, but you’ll miss questions while you’re away.'
            : 'The game keeps running without you on screen, so players may be left waiting. Come back from Home or the quiz page.'
        }
        confirmText="Leave"
        cancelText="Stay"
      />
    </header>
  )
}

/** The room code; click to copy it (the code alone, for reading out or typing in). */
function CodeChip({ code }: { code: string }) {
  const { copied, copy } = useCopy()
  return (
    <button
      type="button"
      data-testid="focus-bar-code"
      onClick={() => void copy(code)}
      aria-label={copied ? 'Room code copied' : `Copy room code ${code.split('').join(' ')}`}
      title={copied ? 'Copied' : 'Copy code'}
      className="group hidden shrink-0 items-center gap-1.5 rounded-md bg-secondary px-2 py-1 font-mono text-xs font-bold tracking-[0.15em] outline-none hover:bg-secondary/70 focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
    >
      {code}
      {copied ? (
        <Check className="size-3.5 text-correct" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
      )}
    </button>
  )
}
