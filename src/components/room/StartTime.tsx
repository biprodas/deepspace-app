/**
 * A game's planned start time in the lobby (docs/features.md F3):
 * - `StartCountdown`: "Starts in 12:34 · Today at 7:00 PM", then "It's time"
 *   once it passes, with "Add to calendar" (a .ics file every calendar app
 *   opens, shown in its own time zone);
 * - `ScheduleButton`: the host sets, changes or removes the time.
 * The countdown runs on server time, so every screen agrees. The host still
 * starts the game; nothing starts by itself.
 */

import { useState } from 'react'
import { CalendarClock, CalendarPlus } from 'lucide-react'
import { Button, Input, Label, Popover, PopoverContent, PopoverTrigger, cn } from '@/components/ui'
import { useServerNow } from '@/lib/clock'
import { joinPath } from '@/lib/join-code'
import {
  buildIcs,
  formatCountdown,
  formatStartTime,
  formatStartTimeInline,
  fromLocalInput,
  MAX_SCHEDULE_AHEAD_MS,
  nextQuarterHour,
  scheduleState,
  toLocalInput,
} from '@/lib/schedule'
import { useAction } from '@/lib/use-action'
import type { Room } from '@/schemas/game-types'

type RoomRec = { recordId: string; data: Room }

/** Downloads the game as a calendar event. */
function downloadIcs(room: RoomRec, title: string) {
  const url = `${window.location.origin}${joinPath(room.data.code)}`
  const ics = buildIcs({
    uid: room.recordId,
    title: `StudyArena: ${title}`,
    start: room.data.scheduledAt!,
    url,
    description: `Join with code ${room.data.code}, or open ${url}`,
  })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  link.download = `${title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'game'}.ics`
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

export function StartCountdown({
  room,
  title,
  hostName,
  className,
}: {
  room: RoomRec
  title: string
  /** Shown to players once the time has come: "waiting for Maya to start". */
  hostName?: string
  className?: string
}) {
  const at = room.data.scheduledAt
  const now = useServerNow(1000, at !== undefined)
  if (at === undefined) return null
  const state = scheduleState(at, now)
  const when = formatStartTime(at, now)
  const whenInline = formatStartTimeInline(at, now)

  return (
    <div data-testid="start-countdown" data-state={state} className={cn('text-center', className)}>
      {state === 'upcoming' ? (
        <>
          <p className="text-sm font-medium text-muted-foreground">Starts in</p>
          <p role="timer" aria-live="off" className="font-display text-4xl font-extrabold tabular-nums tracking-tight">
            {formatCountdown(at - now)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{when}</p>
        </>
      ) : state === 'due' ? (
        <>
          <p className="font-display text-xl font-bold">It’s time</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hostName ? `Starting soon, waiting for ${hostName} to start.` : `Planned for ${whenInline}.`}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Planned for {whenInline}</p>
      )}
      {state === 'upcoming' && (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => downloadIcs(room, title)}>
          <CalendarPlus /> Add to calendar
        </Button>
      )}
    </div>
  )
}

/** The host's control: set a start time, or change or remove it. */
export function ScheduleButton({ room }: { room: RoomRec }) {
  const { run, pending } = useAction()
  const [open, setOpen] = useState(false)
  const at = room.data.scheduledAt
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const openPicker = (next: boolean) => {
    setOpen(next)
    if (next) {
      setValue(toLocalInput(at ?? nextQuarterHour(Date.now())))
      setError('')
    }
  }

  async function save(ms: number | null) {
    const res = await run('scheduleRoom', { roomId: room.recordId, at: ms }, 'scheduleRoom', { toast: false })
    if (res.success) setOpen(false)
    else setError(res.error)
  }

  const quick = [
    { label: 'In 15 min', ms: () => Date.now() + 15 * 60_000 },
    { label: 'In 30 min', ms: () => Date.now() + 30 * 60_000 },
    { label: 'In 1 hour', ms: () => Date.now() + 60 * 60_000 },
    { label: 'Tomorrow', ms: () => (at ?? nextQuarterHour(Date.now())) + 24 * 60 * 60_000 },
  ]

  return (
    <Popover open={open} onOpenChange={openPicker}>
      <PopoverTrigger data-testid="schedule-open" render={<Button variant={at ? 'ghost' : 'outline'} size="sm" />}>
        <CalendarClock /> {at ? 'Change time' : 'Set a start time'}
      </PopoverTrigger>
      <PopoverContent align="center" className="w-80 space-y-3 p-4">
        <div>
          <p className="text-sm font-semibold">Start time</p>
          <p className="text-xs text-muted-foreground">
            Players see a countdown. You still start the game; you can start early too.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="schedule-at">Date and time</Label>
          <Input
            id="schedule-at"
            type="datetime-local"
            value={value}
            min={toLocalInput(Date.now())}
            max={toLocalInput(Date.now() + MAX_SCHEDULE_AHEAD_MS)}
            onChange={(e) => {
              setValue(e.target.value)
              setError('')
            }}
            data-testid="schedule-input"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => setValue(toLocalInput(q.ms()))}
              className="rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
            >
              {q.label}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="flex items-center gap-2 pt-1">
          {at !== undefined && (
            <Button
              variant="ghost"
              size="sm"
              className="mr-auto text-muted-foreground hover:text-destructive"
              onClick={() => void save(null)}
              disabled={pending === 'scheduleRoom'}
              data-testid="schedule-clear"
            >
              Remove time
            </Button>
          )}
          <Button
            size="sm"
            className="ml-auto"
            loading={pending === 'scheduleRoom'}
            onClick={() => {
              const ms = fromLocalInput(value)
              if (ms === null) return setError('Pick a date and time')
              void save(ms)
            }}
            data-testid="schedule-save"
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
