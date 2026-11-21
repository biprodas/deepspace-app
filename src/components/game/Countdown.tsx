/**
 * Time left on the current question: a draining bar plus seconds. Purely a
 * picture of the server's deadline; the server decides what's in time.
 */

import { Pause } from 'lucide-react'
import { cn } from '@/components/ui'
import { useCountdown } from '@/lib/clock'

interface CountdownProps {
  deadline: number
  timeLimitMs: number
  offset: number
  /** Set while paused: the clock shows this and stops. */
  frozenMs?: number
  size?: 'md' | 'lg'
  className?: string
}

export function Countdown({ deadline, timeLimitMs, offset, frozenMs, size = 'md', className }: CountdownProps) {
  const left = useCountdown(deadline, offset, frozenMs)
  const seconds = Math.ceil(left / 1000)
  const fraction = timeLimitMs > 0 ? left / timeLimitMs : 0
  const urgent = frozenMs === undefined && left > 0 && left <= 5000

  return (
    <div className={cn('w-full', className)} role="timer" aria-live="off" aria-label={`${seconds} seconds left`}>
      <div className="mb-1.5 flex items-center justify-between">
        <span
          data-testid="countdown"
          className={cn(
            'font-mono font-extrabold tabular-nums',
            size === 'lg' ? 'text-4xl' : 'text-2xl',
            urgent && 'text-destructive',
          )}
        >
          {seconds}
        </span>
        {frozenMs !== undefined && (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-warning">
            <Pause className="size-4" aria-hidden="true" /> Paused
          </span>
        )}
        {left === 0 && frozenMs === undefined && <span className="text-sm font-semibold">Time’s up</span>}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn('h-full rounded-full transition-[width] duration-100 ease-linear', urgent ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }}
        />
      </div>
    </div>
  )
}
