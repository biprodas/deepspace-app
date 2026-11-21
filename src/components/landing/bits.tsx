/**
 * Small shared pieces of the landing page: the logo mark, the answer system
 * (letter + shape + color, so answers never rely on color alone), initials
 * avatars and the phone frame used by the product mockups.
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const BRAND = 'StudyArena'

/** Where "Create a quiz" goes: the protected quiz builder (signs in first). */
export const CREATE_QUIZ_PATH = '/quizzes/new'

export type Shape = 'circle' | 'triangle' | 'square' | 'diamond'

export const ANSWER_STYLES = [
  { letter: 'A', shape: 'circle', bg: 'bg-answer-a' },
  { letter: 'B', shape: 'triangle', bg: 'bg-answer-b' },
  { letter: 'C', shape: 'square', bg: 'bg-answer-c' },
  { letter: 'D', shape: 'diamond', bg: 'bg-answer-d' },
] as const satisfies readonly { letter: string; shape: Shape; bg: string }[]

export function AnswerShape({ shape, className }: { shape: Shape; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={cn('size-3 fill-current', className)}>
      {shape === 'circle' && <circle cx="8" cy="8" r="6.5" />}
      {shape === 'triangle' && <path d="M8 1.5 15 14.5H1z" />}
      {shape === 'square' && <rect x="2" y="2" width="12" height="12" rx="1.5" />}
      {shape === 'diamond' && <path d="M8 .8 15.2 8 8 15.2.8 8z" />}
    </svg>
  )
}

/** Letter + shape chip on the answer color. Text is ink, never white. */
export function AnswerChip({ index, className }: { index: number; className?: string }) {
  const a = ANSWER_STYLES[index]
  return (
    <span
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 font-mono text-xs font-bold text-ink',
        a.bg,
        className,
      )}
    >
      {a.letter}
      <AnswerShape shape={a.shape} className="size-2.5" />
    </span>
  )
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('grid size-6 grid-cols-2 gap-0.5', className)}>
      <span className="rounded-[3px] bg-answer-a" />
      <span className="rounded-[3px] bg-answer-b" />
      <span className="rounded-[3px] bg-answer-c" />
      <span className="rounded-[3px] bg-answer-d" />
    </span>
  )
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-lg font-extrabold tracking-tight">{BRAND}</span>
    </span>
  )
}

const AVATAR_BG = ['bg-answer-a', 'bg-answer-b', 'bg-answer-c', 'bg-answer-d'] as const

export function Initials({ name, i, className }: { name: string; i: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-ink',
        AVATAR_BG[i % AVATAR_BG.length],
        className,
      )}
    >
      {name.slice(0, 2)}
    </span>
  )
}

export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-[2rem] border border-border bg-ink p-2 shadow-[0_24px_48px_-16px_rgba(20,20,43,0.35)] dark:border-[#4a4a72] dark:bg-[#2c2c4a]',
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[1.5rem] bg-card text-card-foreground">
        <div className="mx-auto mt-2 h-1.5 w-14 rounded-full bg-border" />
        {children}
      </div>
    </div>
  )
}

/** Mono label naming where a quote came from, e.g. "Wikipedia · Photosynthesis". */
export function SourceLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('font-mono text-[11px] font-medium tracking-tight text-muted-foreground', className)}>
      {children}
    </span>
  )
}
