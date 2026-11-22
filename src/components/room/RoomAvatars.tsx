/**
 * Who's in the game, at a glance, for the focus bar: the host, then an
 * overlapping stack of player avatars, online first, with the online count.
 * Opens a roster card grouped into host, online and offline, with the code
 * to invite more. Player avatar colours follow join order, so they match the
 * lobby's PlayerList; the host's is always the primary colour.
 */

import type { ReactNode } from 'react'
import { useUserLookup } from 'deepspace'
import { Check, Copy, Crown, Users } from 'lucide-react'
import { Button, Popover, PopoverContent, PopoverTrigger, cn } from '@/components/ui'
import { Initials } from '@/components/landing/bits'
import { joinPath } from '@/lib/join-code'
import { useCopy } from '@/lib/use-copy'
import type { RoomState } from '@/lib/use-room'
import type { RoomPlayer } from '@/schemas/game-types'

const MAX_SHOWN = 4
const STACKED = 'size-7 ring-2 ring-background'

interface Entry {
  key: string
  player: RoomPlayer
  /** Join order, which picks the avatar colour. */
  i: number
  isOnline: boolean
}

export function RoomAvatars({ state }: { state: RoomState }) {
  const { room, players, online, userId } = state
  const { getName } = useUserLookup()
  if (!room) return null

  const hostId = room.data.hostId
  const hostName = getName(hostId) ?? 'Host'
  const hostOnline = online.has(hostId)

  const entries: Entry[] = players.map((p, i) => ({
    key: p.recordId,
    player: p.data,
    i,
    isOnline: online.has(p.data.userId),
  }))
  const onlinePlayers = entries.filter((e) => e.isOnline)
  const offlinePlayers = entries.filter((e) => !e.isOnline)
  const onlineCount = onlinePlayers.length + Number(hostOnline)
  const total = players.length + 1

  const shown = [...onlinePlayers, ...offlinePlayers].slice(0, MAX_SHOWN)
  const hidden = entries.length - shown.length

  return (
    <Popover>
      <PopoverTrigger
        data-testid="room-avatars"
        aria-label={`People: ${onlineCount} of ${total} online`}
        className="flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-2 outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex -space-x-2">
          <HostAvatar name={hostName} isOnline={hostOnline} className={STACKED} />
          {shown.map((e) => (
            <Initials
              key={e.key}
              name={e.player.displayName}
              i={e.i}
              className={cn(STACKED, !e.isOnline && 'opacity-50 grayscale')}
            />
          ))}
          {hidden > 0 && (
            <span
              aria-hidden="true"
              className={cn(STACKED, 'inline-flex items-center justify-center rounded-full bg-secondary text-[11px] font-bold')}
            >
              +{hidden}
            </span>
          )}
        </span>
        <span aria-hidden="true" className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-correct" />
          {onlineCount}
        </span>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        data-testid="room-roster"
        className="flex max-h-[min(32rem,75vh)] min-h-80 w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">In this room</p>
          <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
            <span className="size-2 rounded-full bg-correct" />
            {onlineCount} of {total} online
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          <Section label="Host">
            <Row
              avatar={<HostAvatar name={hostName} isOnline={hostOnline} className="size-9" />}
              name={hostName}
              isOnline={hostOnline}
              isYou={hostId === userId}
              testId="roster-host"
            />
          </Section>

          {entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Users className="size-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium">No players yet</p>
              <p className="text-xs text-muted-foreground">Share the code below to invite people.</p>
            </div>
          ) : (
            <>
              {onlinePlayers.length > 0 && (
                <Section label={`Online · ${onlinePlayers.length}`}>
                  {onlinePlayers.map((e) => (
                    <PlayerRow key={e.key} entry={e} userId={userId} />
                  ))}
                </Section>
              )}
              {offlinePlayers.length > 0 && (
                <Section label={`Offline · ${offlinePlayers.length}`}>
                  {offlinePlayers.map((e) => (
                    <PlayerRow key={e.key} entry={e} userId={userId} />
                  ))}
                </Section>
              )}
            </>
          )}
        </div>

        <InviteFooter code={room.data.code} />
      </PopoverContent>
    </Popover>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mb-2 last:mb-0">
      <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <ul>{children}</ul>
    </section>
  )
}

function PlayerRow({ entry, userId }: { entry: Entry; userId?: string }) {
  const { player, i, isOnline } = entry
  return (
    <Row
      avatar={<Initials name={player.displayName} i={i} className={cn('size-9', !isOnline && 'opacity-50 grayscale')} />}
      name={player.displayName}
      isOnline={isOnline}
      isYou={player.userId === userId}
      testId="roster-player"
    />
  )
}

function Row({
  avatar,
  name,
  isOnline,
  isYou,
  testId,
}: {
  avatar: ReactNode
  name: string
  isOnline: boolean
  isYou: boolean
  testId: string
}) {
  return (
    <li
      data-testid={testId}
      data-online={isOnline}
      className={cn('flex items-center gap-3 rounded-lg px-2 py-1.5', isYou && 'bg-primary/5')}
    >
      <span className="relative shrink-0">
        {avatar}
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-popover',
            isOnline ? 'bg-correct' : 'bg-muted-foreground',
          )}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block text-xs text-muted-foreground">{isOnline ? 'Online' : 'Offline'}</span>
      </span>
      {isYou && (
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
          You
        </span>
      )}
    </li>
  )
}

function InviteFooter({ code }: { code: string }) {
  const { copied, copy } = useCopy()
  const copyLink = () => void copy(`${window.location.origin}${joinPath(code)}`)

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border bg-secondary/40 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-[11px] font-medium text-muted-foreground">Room code</span>
        <span className="block font-mono text-base font-bold tracking-[0.15em]">{code}</span>
      </span>
      <Button variant="outline" size="sm" onClick={copyLink}>
        {copied ? <Check /> : <Copy />}
        {copied ? 'Copied' : 'Copy invite'}
      </Button>
    </div>
  )
}

function HostAvatar({ name, isOnline, className }: { name: string; isOnline: boolean; className?: string }) {
  return (
    <span className="relative inline-flex">
      <Initials
        name={name}
        i={0}
        className={cn('bg-primary text-primary-foreground', className, !isOnline && 'opacity-50 grayscale')}
      />
      <Crown
        aria-hidden="true"
        className="absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 fill-warning text-warning"
      />
    </span>
  )
}
