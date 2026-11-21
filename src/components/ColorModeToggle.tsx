/**
 * Light / dark switch, in StudyArena's own language: the knob is the
 * four-square answer mark, which slides across and turns half a turn (so the
 * answer colors trade places). Day is a highlighter-yellow track with an
 * amber sun; night is a deep track with stars in the answer colors.
 *
 * Every visual state comes from the `dark:` variant (keyed to
 * <html data-mode>), not React state, so the prerendered landing page and
 * the hydrated one always agree, whichever mode the visitor is in.
 */

import { toggleColorMode } from '@/lib/color-mode'
import { cn } from '@/lib/utils'
import { LogoMark } from './landing/bits'

const STARS = [
  'left-[7px] top-[6px] size-[3px] bg-white',
  'left-[14px] top-[15px] size-[2px] bg-answer-b',
  'left-[4px] top-[16px] size-[2px] bg-answer-d',
]

export function ColorModeToggle({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={toggleColorMode}
      className={cn(
        'group relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border p-0.5 outline-none transition-colors duration-300 motion-reduce:transition-none',
        'border-[#f0d98a] bg-[#fff4c7] hover:border-[#e6c65c]',
        'dark:border-[#3a3a66] dark:bg-[#1b1b38] dark:hover:border-[#55558a]',
        'focus-visible:ring-[3px] focus-visible:ring-primary/40',
        className,
      )}
    >
      {/* Night sky: stars on the side the knob leaves. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 motion-reduce:transition-none dark:opacity-100">
        {STARS.map((s) => (
          <span key={s} className={cn('absolute rounded-full', s)} />
        ))}
      </span>

      {/* Day: a small sun on the right. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-[7px] top-1/2 size-2 -translate-y-1/2 rounded-full bg-answer-c shadow-[0_0_0_3px_rgba(255,176,32,0.28)] transition-opacity duration-300 motion-reduce:transition-none dark:opacity-0"
      />

      {/* Knob: the answer mark, sliding and turning. */}
      <span
        aria-hidden="true"
        className={cn(
          'relative z-10 flex size-[22px] items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(20,20,43,0.25)]',
          'transition-[translate,rotate,scale,background-color] duration-500 ease-[cubic-bezier(0.3,0.7,0.2,1.25)] motion-reduce:transition-none',
          'group-hover:scale-105 group-active:scale-95',
          'dark:translate-x-5 dark:rotate-180 dark:bg-[#2c2c4a]',
        )}
      >
        <LogoMark className="size-3 gap-px" />
      </span>

      <span className="sr-only dark:hidden">Switch to dark mode</span>
      <span className="sr-only hidden dark:inline">Switch to light mode</span>
    </button>
  )
}
