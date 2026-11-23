import { describe, expect, it } from 'vitest'
import {
  buildIcs,
  formatStartTimeInline,
  formatCountdown,
  formatStartTime,
  fromLocalInput,
  nextQuarterHour,
  OVERDUE_AFTER_MS,
  scheduleState,
  toLocalInput,
} from './schedule'

const MIN = 60_000
const HOUR = 60 * MIN

describe('scheduleState', () => {
  it('is upcoming before the time, due at it, overdue well after', () => {
    expect(scheduleState(1_000_000, 999_999)).toBe('upcoming')
    expect(scheduleState(1_000_000, 1_000_000)).toBe('due')
    expect(scheduleState(1_000_000, 1_000_000 + OVERDUE_AFTER_MS + 1)).toBe('overdue')
  })
})

describe('formatCountdown', () => {
  it('shows minutes:seconds under an hour, hours and minutes under a day, then days', () => {
    expect(formatCountdown(4 * MIN + 5_000)).toBe('4:05')
    expect(formatCountdown(59_400)).toBe('1:00')
    expect(formatCountdown(0)).toBe('0:00')
    expect(formatCountdown(-5_000)).toBe('0:00')
    expect(formatCountdown(HOUR + 5 * MIN)).toBe('1 h 05 min')
    expect(formatCountdown(2 * 24 * HOUR + 3 * HOUR)).toBe('2 days 3 h')
    expect(formatCountdown(24 * HOUR)).toBe('1 day')
  })
})

describe('formatStartTime', () => {
  const now = new Date(2026, 10, 23, 10, 0).getTime() // Monday 23 Nov 2026, 10:00 local
  const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime()

  it('says today, tomorrow, a weekday within the week, then a date', () => {
    expect(formatStartTime(at(23, 19), now, 'en-GB')).toBe('Today at 19:00')
    expect(formatStartTime(at(24, 9, 30), now, 'en-GB')).toBe('Tomorrow at 9:30')
    expect(formatStartTime(at(26, 18), now, 'en-GB')).toBe('Thursday at 18:00')
    expect(formatStartTime(at(22, 18), now, 'en-GB')).toBe('Yesterday at 18:00')
    expect(formatStartTime(new Date(2026, 11, 8, 18).getTime(), now, 'en-GB')).toBe('Tue 8 Dec at 18:00')
  })

  it('lowercases only today/tomorrow/yesterday mid-sentence', () => {
    expect(formatStartTimeInline(at(23, 19), now, 'en-GB')).toBe('today at 19:00')
    expect(formatStartTimeInline(at(26, 18), now, 'en-GB')).toBe('Thursday at 18:00')
    expect(formatStartTimeInline(new Date(2026, 11, 8, 18).getTime(), now, 'en-GB')).toBe('Tue 8 Dec at 18:00')
  })
})

describe('datetime-local values', () => {
  it('round-trips a local time, and refuses junk', () => {
    const ms = new Date(2026, 10, 23, 19, 45).getTime()
    expect(toLocalInput(ms)).toBe('2026-11-23T19:45')
    expect(fromLocalInput('2026-11-23T19:45')).toBe(ms)
    expect(fromLocalInput('')).toBeNull()
    expect(fromLocalInput('tomorrow')).toBeNull()
  })

  it('defaults to the next quarter hour at least 15 minutes away', () => {
    const now = new Date(2026, 10, 23, 10, 7).getTime()
    expect(toLocalInput(nextQuarterHour(now))).toBe('2026-11-23T10:30')
  })
})

describe('buildIcs', () => {
  it('writes one UTC event with escaped text and CRLF lines', () => {
    const ics = buildIcs({
      uid: 'room1',
      title: 'Photosynthesis, a quiz',
      start: Date.UTC(2026, 10, 23, 19, 0),
      url: 'https://studyarena.app.space/join/K7QX9P',
      description: 'Code K7QX9P\nJoin at the link',
      now: Date.UTC(2026, 10, 23, 10, 0),
    })
    expect(ics).toContain('\r\nDTSTART:20261123T190000Z\r\n')
    expect(ics).toContain('\r\nDTEND:20261123T193000Z\r\n')
    expect(ics).toContain('SUMMARY:Photosynthesis\\, a quiz')
    expect(ics).toContain('DESCRIPTION:Code K7QX9P\\nJoin at the link')
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
  })
})
