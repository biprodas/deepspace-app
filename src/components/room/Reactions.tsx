/**
 * Emoji reactions in a room: a bar to send them and an overlay where
 * everyone's float up and fade. They travel as presence state (the room's
 * presence scope, see use-room.ts), so nothing is stored and a late joiner
 * never sees old ones.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/components/ui'
import type { RoomState } from '@/lib/use-room'

export const REACTIONS = ['👍', '👏', '🔥', '😂', '🤯', '🤔'] as const

/** How long one reaction floats, and the most kept on screen at once. */
const FLOAT_MS = 2600
const MAX_FLOATING = 30
/** One reaction per viewer per this long, so a held tap can't flood the room. */
const THROTTLE_MS = 700

interface Floating {
  id: string
  emoji: string
  /** Horizontal position, % of the overlay width. */
  left: number
}

interface ReactionState {
  emoji?: unknown
  id?: unknown
  at?: unknown
}

/** Everyone's recent reactions (peers' from presence, plus the viewer's own) and a sender. */
export function useRoomReactions({ peers, react }: Pick<RoomState, 'peers' | 'react'>) {
  const [floating, setFloating] = useState<Floating[]>([])
  const seen = useRef(new Set<string>())
  const lastSent = useRef(0)

  const add = useCallback((id: string, emoji: string) => {
    if (seen.current.has(id)) return
    seen.current.add(id)
    setFloating((prev) => [...prev, { id, emoji, left: 10 + Math.random() * 80 }].slice(-MAX_FLOATING))
    setTimeout(() => {
      setFloating((prev) => prev.filter((f) => f.id !== id))
      seen.current.delete(id)
    }, FLOAT_MS)
  }, [])

  useEffect(() => {
    const now = Date.now()
    for (const peer of peers) {
      const r = (peer.state as { reaction?: ReactionState }).reaction
      if (!r || typeof r.id !== 'string' || typeof r.emoji !== 'string') continue
      // Only fresh ones: a peer's last reaction stays in their state after it played.
      if (typeof r.at !== 'number' || now - r.at > FLOAT_MS) continue
      if (!(REACTIONS as readonly string[]).includes(r.emoji)) continue
      add(r.id, r.emoji)
    }
  }, [peers, add])

  const send = useCallback(
    (emoji: string) => {
      const now = Date.now()
      if (now - lastSent.current < THROTTLE_MS) return
      lastSent.current = now
      react(emoji)
      add(`me-${now}`, emoji)
    },
    [react, add],
  )

  return { floating, send }
}

export function ReactionBar({ onSend, className }: { onSend: (emoji: string) => void; className?: string }) {
  return (
    <div
      role="group"
      aria-label="Send a reaction"
      data-testid="reaction-bar"
      className={cn('flex items-center gap-0.5 rounded-full border border-border bg-popover p-1 shadow-lg', className)}
    >
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSend(emoji)}
          aria-label={`React ${emoji}`}
          className="flex size-9 items-center justify-center rounded-full text-xl transition-transform hover:scale-125 hover:bg-accent active:scale-95"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

export function ReactionOverlay({ floating }: { floating: Floating[] }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 h-2/3 overflow-hidden">
      {floating.map((f) => (
        <span
          key={f.id}
          className="absolute bottom-4 animate-float-up text-4xl motion-reduce:animate-none"
          style={{ left: `${f.left}%` }}
        >
          {f.emoji}
        </span>
      ))}
    </div>
  )
}
