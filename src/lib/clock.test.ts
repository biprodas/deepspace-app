import { describe, expect, it } from 'vitest'
import { offsetFromSamples } from './clock'

describe('offsetFromSamples', () => {
  it('uses the midpoint of the fastest round trip', () => {
    const offset = offsetFromSamples([
      { sentAt: 1_000, receivedAt: 1_400, serverNow: 6_000 }, // 400 ms trip
      { sentAt: 2_000, receivedAt: 2_100, serverNow: 7_100 }, // 100 ms trip: wins
      { sentAt: 3_000, receivedAt: 3_250, serverNow: 8_000 },
    ])
    expect(offset).toBe(7_100 - 2_050)
  })

  it('is 0 with no samples', () => {
    expect(offsetFromSamples([])).toBe(0)
  })
})
