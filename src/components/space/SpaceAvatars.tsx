/**
 * Who's in the space right now, at a glance: an overlapping stack of the
 * members who are online, anyone on the same note or board as the viewer
 * ringed. Opens a roster grouped into "here with you", online (with where
 * each person is working) and offline. Locations come from the space's
 * presence (src/lib/use-space.ts), so nothing is stored.
 */

import type { ReactNode } from 'react'
import { Crown, FileText, PenTool } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger, cn } from '@/components/ui'
import { Initials } from '@/components/landing/bits'
import type { SpaceLocation, SpaceState } from '@/lib/use-space'
import type { TeamMember } from '@/schemas/space-types'

const MAX_SHOWN = 5
const STACKED = 'size-7 ring-2 ring-background'

interface Entry {
  key: string
  member: TeamMember
  /** Join order, which picks the avatar colour (matches the members list). */
  i: number
  isOnline: boolean
  location?: SpaceLocation
  isHere: boolean
}

const sameLocation = (a?: SpaceLocation, b?: SpaceLocation) => !!a && !!b && a.kind === b.kind && a.id === b.id

export function SpaceAvatars({ state }: { state: SpaceState }) {
  const { space, members, online, locations, here, userId } = state
  if (!space) return null

  const entries: Entry[] = members.map((m, i) => {
    const location = locations.get(m.data.userId)
    return {
      key: m.recordId,
      member: m.data,
      i,
      isOnline: online.has(m.data.userId),
      location,
      // The viewer counts as here too, so they're listed with the people beside them.
      isHere: sameLocation(location, here),
    }
  })
  const onlineEntries = entries.filter((e) => e.isOnline)
  const hereWithYou = onlineEntries.filter((e) => e.isHere)
  const elsewhere = onlineEntries.filter((e) => !e.isHere)
  const offline = entries.filter((e) => !e.isOnline)
  // Stack: people here first, then the rest who are online.
  const stack = [...hereWithYou, ...elsewhere]
  const shown = stack.slice(0, MAX_SHOWN)
  const hidden = stack.length - shown.length

  return (
    <Popover>
      <PopoverTrigger
        data-testid="space-avatars"
        aria-label={`Members: ${onlineEntries.length} of ${members.length} online`}
        className="flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-2 outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex -space-x-2">
          {shown.map((e) => (
            <Initials
              key={e.key}
              name={e.member.displayName}
              i={e.i}
              className={cn(STACKED, e.isHere && 'ring-primary', e.member.role === 'owner' && 'bg-primary text-primary-foreground')}
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
          {onlineEntries.length}
        </span>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        data-testid="space-roster"
        className="flex max-h-[min(32rem,75vh)] min-h-64 w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <p className="min-w-0 truncate text-sm font-semibold">{space.data.name}</p>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
            <span className="size-2 rounded-full bg-correct" />
            {onlineEntries.length} of {members.length} online
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {here && hereWithYou.length > 0 && (
            <Section label={`Here with you · ${hereWithYou.length}`}>
              {hereWithYou.map((e) => (
                <Row key={e.key} entry={e} userId={userId} />
              ))}
            </Section>
          )}
          {elsewhere.length > 0 && (
            <Section label={`${here ? 'Elsewhere in the space' : 'Online'} · ${elsewhere.length}`}>
              {elsewhere.map((e) => (
                <Row key={e.key} entry={e} userId={userId} />
              ))}
            </Section>
          )}
          {offline.length > 0 && (
            <Section label={`Offline · ${offline.length}`}>
              {offline.map((e) => (
                <Row key={e.key} entry={e} userId={userId} />
              ))}
            </Section>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mb-2 last:mb-0">
      <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <ul>{children}</ul>
    </section>
  )
}

function whereText(e: Entry): ReactNode {
  if (!e.isOnline) return 'Offline'
  if (!e.location) return 'On the space page'
  const Icon = e.location.kind === 'note' ? FileText : PenTool
  return (
    <span className="flex min-w-0 items-center gap-1">
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">In {e.location.title || (e.location.kind === 'note' ? 'a note' : 'a board')}</span>
    </span>
  )
}

function Row({ entry, userId }: { entry: Entry; userId?: string }) {
  const { member, i, isOnline } = entry
  const isYou = member.userId === userId
  return (
    <li data-testid="space-roster-member" data-online={isOnline} className={cn('flex items-center gap-3 rounded-lg px-2 py-1.5', isYou && 'bg-primary/5')}>
      <span className="relative shrink-0">
        <Initials
          name={member.displayName}
          i={i}
          className={cn('size-9', member.role === 'owner' && 'bg-primary text-primary-foreground', !isOnline && 'opacity-50 grayscale')}
        />
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-popover',
            isOnline ? 'bg-correct' : 'bg-muted-foreground',
          )}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate text-sm font-medium">
          {member.displayName}
          {member.role === 'owner' && <Crown className="size-3.5 shrink-0 fill-warning text-warning" aria-label="Owner" />}
        </span>
        <span className="block text-xs text-muted-foreground">{whereText(entry)}</span>
      </span>
      {isYou && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">You</span>}
    </li>
  )
}
