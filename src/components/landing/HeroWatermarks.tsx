/**
 * Faint quiz glyphs behind the hero: a big "?", the answer shapes, the
 * answer letters, a tick, a score pop and a question number, all as thin
 * outlines at a few percent opacity. They sit only in the hero's empty
 * space (corners, the gutter, the strip under the content), never behind
 * the headline, copy or code card. Shown only with the two-column hero
 * (lg and up), since their spots are placed around that layout. Positions are relative to the content width, so
 * they track the layout rather than the window edges.
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke' } as const

function Mark({ className, children }: { className: string; children: ReactNode }) {
  return <div className={cn('absolute', className)}>{children}</div>
}

/** Outlined text, for the glyphs that are type rather than shapes. */
function OutlineText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    // Only the fill goes transparent; the stroke keeps currentColor (the
    // layer's faint foreground). Setting `color: transparent` would hide both.
    <span
      className={cn('block leading-none', className)}
      style={{ WebkitTextFillColor: 'transparent', WebkitTextStroke: '1.5px currentColor' }}
    >
      {children}
    </span>
  )
}

export function HeroWatermarks() {
  return (
    <div aria-hidden="true" data-hero-watermarks="" className="pointer-events-none absolute inset-0 hidden select-none text-foreground/[0.07] lg:block dark:text-foreground/[0.08]">
      <div className="relative mx-auto h-full max-w-6xl">
        {/* Big question mark, half in the left gutter. */}
        <Mark className="-left-16 top-6">
          <OutlineText className="font-display text-[220px] font-extrabold">?</OutlineText>
        </Mark>

        {/* Triangle in the open space between the badge and the preview. */}
        <Mark className="left-[36%] top-12">
          <svg viewBox="0 0 60 54" className="size-14 rotate-[-8deg]">
            <path d="M30 3 57 51H3z" strokeLinejoin="round" {...STROKE} />
          </svg>
        </Mark>

        {/* Tick above the preview's corner. */}
        <Mark className="right-[2%] top-2">
          <svg viewBox="0 0 48 48" className="size-12 rotate-[6deg]">
            <circle cx="24" cy="24" r="21" {...STROKE} />
            <path d="M14 25l7 7 13-15" strokeLinecap="round" strokeLinejoin="round" {...STROKE} />
          </svg>
        </Mark>

        {/* Circle drifting off the right edge. */}
        <Mark className="-right-14 top-[52%]">
          <svg viewBox="0 0 80 80" className="size-20">
            <circle cx="40" cy="40" r="37" {...STROKE} />
          </svg>
        </Mark>

        {/* Bottom strip: answer letters, a diamond, a score pop, the question number. */}
        <Mark className="bottom-6 left-0">
          <OutlineText className="font-mono text-[44px] font-bold tracking-[0.35em]">ABCD</OutlineText>
        </Mark>
        <Mark className="bottom-8 left-[34%]">
          <svg viewBox="0 0 40 40" className="size-9 rotate-[10deg]">
            <path d="M20 2 38 20 20 38 2 20z" strokeLinejoin="round" {...STROKE} />
          </svg>
        </Mark>
        <Mark className="bottom-1 left-[45%]">
          <OutlineText className="font-display text-[56px] font-extrabold">+840</OutlineText>
        </Mark>
        <Mark className="-right-10 bottom-4">
          <OutlineText className="font-mono text-[64px] font-bold">Q3</OutlineText>
        </Mark>
      </div>
    </div>
  )
}
