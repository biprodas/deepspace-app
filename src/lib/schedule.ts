/**
 * A game's planned start time (docs/features.md F3): the countdown text,
 * "Today at 7:00 PM"-style labels, whether it's time yet, and the calendar
 * file players can download. Pure, so it's unit-tested. The host still
 * starts the game; the time is a plan everyone can see, not a timer.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** How far ahead a start time may be set. */
export const MAX_SCHEDULE_AHEAD_MS = 30 * DAY
/** After this long past the time with no start, the lobby stops saying "starting soon". */
export const OVERDUE_AFTER_MS = 2 * HOUR

export type ScheduleState = 'upcoming' | 'due' | 'overdue'

export function scheduleState(at: number, now: number): ScheduleState {
  if (now < at) return 'upcoming'
  return now - at > OVERDUE_AFTER_MS ? 'overdue' : 'due'
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "4:05" under an hour, "1 h 05 min" under a day, then "2 days 3 h". */
export function formatCountdown(ms: number): string {
  const left = Math.max(0, ms)
  if (left < HOUR) {
    const total = Math.ceil(left / 1000)
    return `${Math.floor(total / 60)}:${pad(total % 60)}`
  }
  if (left < DAY) {
    const minutes = Math.ceil(left / MINUTE)
    return `${Math.floor(minutes / 60)} h ${pad(minutes % 60)} min`
  }
  const hours = Math.floor(left / HOUR)
  const days = Math.floor(hours / 24)
  const rest = hours % 24
  return `${days} day${days === 1 ? '' : 's'}${rest ? ` ${rest} h` : ''}`
}

const startOfDay = (ms: number) => {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * When, in the viewer's own time zone: "Today at 7:00 PM", "Tomorrow at …",
 * a weekday within the week ("Thursday at …"), then a date ("Mon 8 Dec at …").
 */
export function formatStartTime(at: number, now: number, locale?: string): string {
  const time = new Date(at).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
  // Calendar days apart, counted on local midnights (rounded across daylight-saving changes).
  const days = Math.round((startOfDay(at) - startOfDay(now)) / DAY)
  if (days === 0) return `Today at ${time}`
  if (days === 1) return `Tomorrow at ${time}`
  if (days === -1) return `Yesterday at ${time}`
  if (days > 1 && days < 7) return `${new Date(at).toLocaleDateString(locale, { weekday: 'long' })} at ${time}`
  return `${new Date(at).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })} at ${time}`
}

/** The same, mid-sentence: "Starts today at 7:00 PM", "starts Thursday at …" (only relative words lowercased). */
export function formatStartTimeInline(at: number, now: number, locale?: string): string {
  return formatStartTime(at, now, locale).replace(/^(Today|Tomorrow|Yesterday)\b/, (w) => w.toLowerCase())
}

/** A time as the value of an `<input type="datetime-local">` (local, minutes). */
export function toLocalInput(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** The epoch ms of a `datetime-local` value, read in local time; null when it's empty or invalid. */
export function fromLocalInput(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!m) return null
  const [, y, mo, d, h, mi] = m.map(Number)
  const ms = new Date(y, mo - 1, d, h, mi).getTime()
  return Number.isNaN(ms) ? null : ms
}

/** The next whole quarter hour at least `leadMs` from now: a sensible default start time. */
export function nextQuarterHour(now: number, leadMs = 15 * MINUTE): number {
  const quarter = 15 * MINUTE
  return Math.ceil((now + leadMs) / quarter) * quarter
}

// ─── Calendar file (.ics) ───────────────────────────────

const icsDate = (ms: number) =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

/** RFC 5545 text: backslash, semicolon, comma and newlines escaped. */
const icsText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/**
 * A one-event calendar file for the game. Times are UTC, so every calendar
 * app shows them in its own time zone. Lines end CRLF, as the format asks.
 */
export function buildIcs(event: {
  uid: string
  title: string
  start: number
  durationMinutes?: number
  url: string
  description: string
  now?: number
}): string {
  const end = event.start + (event.durationMinutes ?? 30) * MINUTE
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StudyArena//Game//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.uid}@studyarena`,
    `DTSTAMP:${icsDate(event.now ?? Date.now())}`,
    `DTSTART:${icsDate(event.start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(event.title)}`,
    `DESCRIPTION:${icsText(event.description)}`,
    `URL:${event.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}
