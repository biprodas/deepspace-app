/**
 * Server clock offset and the countdown (docs/trd.md §7). Cosmetic only:
 * the server decides with its own clock whether an answer is in time.
 */

import { useEffect, useState } from 'react'
import { callAction } from './actions-client'

const SAMPLES = 3

/**
 * Picks the sample with the smallest round trip and assumes the server read
 * its clock halfway through it. `offset` = server time − local time.
 */
export function offsetFromSamples(
  samples: { sentAt: number; receivedAt: number; serverNow: number }[],
): number {
  if (samples.length === 0) return 0
  const best = samples.reduce((a, b) => (b.receivedAt - b.sentAt < a.receivedAt - a.sentAt ? b : a))
  return best.serverNow - (best.sentAt + best.receivedAt) / 2
}

let cached: Promise<number> | null = null

async function measureOffset(): Promise<number> {
  const samples = []
  for (let i = 0; i < SAMPLES; i++) {
    const sentAt = Date.now()
    const result = await callAction('getServerTime')
    const receivedAt = Date.now()
    if (result.success) samples.push({ sentAt, receivedAt, serverNow: result.data.serverNow })
  }
  return offsetFromSamples(samples)
}

/** Server time − local time, measured once per page load (0 until known). */
export function useServerOffset(): number {
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    cached ??= measureOffset()
    let live = true
    void cached.then((value) => live && setOffset(value))
    return () => {
      live = false
    }
  }, [])
  return offset
}

/** Milliseconds left until `deadline` (server time), redrawn every frame; 0 when done. */
export function useCountdown(deadline: number | undefined, offset: number, frozenMs?: number): number {
  const remaining = () =>
    frozenMs ?? (deadline === undefined ? 0 : Math.max(0, deadline - (Date.now() + offset)))
  const [left, setLeft] = useState(remaining)

  useEffect(() => {
    let frame = 0
    let last = -1
    const tick = () => {
      const value = remaining()
      // Re-render ~10×/s, not 60: the display shows tenths at most.
      const bucket = Math.ceil(value / 100)
      if (bucket !== last) {
        last = bucket
        setLeft(value)
      }
      if (value > 0 && frozenMs === undefined) frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [deadline, offset, frozenMs])

  return left
}
