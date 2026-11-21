/**
 * The lobby roster: who's in, who's online right now (presence), and, for
 * the host, a menu per player to promote or remove them.
 */

import { MoreHorizontal, ShieldPlus, UserX } from 'lucide-react'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from '@/components/ui'
import { Initials } from '@/components/landing/bits'
import type { RoomPlayer } from '@/schemas/game-types'

interface PlayerListProps {
  players: { recordId: string; data: RoomPlayer }[]
  online: Set<string>
  /** The viewer, highlighted as "you". */
  userId?: string
  /** Host-only controls; omitted for everyone else. */
  onRemove?: (player: RoomPlayer) => void
  onMakeCoHost?: (player: RoomPlayer) => void
  className?: string
}

export function PlayerList({ players, online, userId, onRemove, onMakeCoHost, className }: PlayerListProps) {
  return (
    <ul data-testid="player-list" className={cn('flex flex-wrap gap-2', className)}>
      {players.map(({ recordId, data: player }, i) => {
        const isOnline = online.has(player.userId)
        return (
          <li
            key={recordId}
            data-testid="lobby-player"
            data-online={isOnline}
            className={cn(
              'flex items-center gap-2 rounded-full border bg-card py-1 pl-1 text-sm',
              onRemove ? 'pr-1' : 'pr-3',
              player.userId === userId ? 'border-primary' : 'border-border',
              !isOnline && 'opacity-60',
            )}
          >
            <span className="relative">
              <Initials name={player.displayName} i={i} className="size-7" />
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card',
                  isOnline ? 'bg-correct' : 'bg-muted-foreground',
                )}
              />
            </span>
            <span className="max-w-40 truncate font-medium">{player.displayName}</span>
            <span className="sr-only">{isOnline ? '(online)' : '(offline)'}</span>
            {player.userId === userId && <span className="text-xs text-muted-foreground">you</span>}
            {onRemove && onMakeCoHost && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-full"
                      aria-label={`Options for ${player.displayName}`}
                    />
                  }
                >
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => onMakeCoHost(player)}>
                    <ShieldPlus aria-hidden /> Make co-host
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onRemove(player)}
                    className="text-destructive focus:text-destructive"
                  >
                    <UserX aria-hidden /> Remove from game
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </li>
        )
      })}
    </ul>
  )
}
