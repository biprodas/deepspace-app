/**
 * Full-screen frame for the auth pages: a brand panel on the left (from lg
 * up) with a small "reveal" card, and the form card on the right. On phones
 * only the form shows, with the logo above it.
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { ColorModeToggle } from '../ColorModeToggle'
import { AnswerChip, Logo, LogoMark, SourceLabel } from '../landing/bits'

interface AuthShellProps {
  title: string
  subtitle: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-background text-base text-foreground lg:grid-cols-[1fr_1.05fr]">
      <BrandPanel />

      <div className="flex min-h-screen flex-col px-4 py-5 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-bold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-primary/40"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to home
          </Link>
          <ColorModeToggle />
        </div>

        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <Link to="/" aria-label="StudyArena home" className="mb-8 self-start rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40 lg:hidden">
            <Logo />
          </Link>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          <div className="mt-2 text-muted-foreground">{subtitle}</div>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-sm text-muted-foreground">{footer}</div>}
        </main>
      </div>
    </div>
  )
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-primary text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
      {/* Faint answer shapes, the same language as the landing hero. */}
      <svg aria-hidden="true" viewBox="0 0 600 800" className="pointer-events-none absolute inset-0 size-full fill-none stroke-white/15" strokeWidth="1.5" preserveAspectRatio="xMidYMid slice">
        <circle cx="520" cy="120" r="70" />
        <path d="M80 640 140 540 200 640z" strokeLinejoin="round" />
        <rect x="470" y="600" width="80" height="80" rx="10" transform="rotate(12 510 640)" />
        <path d="M300 60 330 90 300 120 270 90z" strokeLinejoin="round" />
      </svg>

      <Link to="/" aria-label="StudyArena home" className="relative inline-flex items-center gap-2 self-start rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-white/60">
        <span className="rounded-lg bg-white p-1.5">
          <LogoMark check />
        </span>
        <span className="font-display text-lg font-extrabold tracking-tight">StudyArena</span>
      </Link>

      <div className="relative">
        <p className="max-w-md font-display text-4xl font-extrabold leading-[1.08] tracking-tight xl:text-5xl">
          Make learning a game everyone wants to play.
        </p>
        <RevealCard />
      </div>

      <p className="relative text-sm text-white/80">Live quizzes, backed by sources.</p>
    </aside>
  )
}

function RevealCard() {
  return (
    <div aria-hidden="true" className="mt-10 max-w-md -rotate-1 rounded-2xl bg-card p-4 text-card-foreground shadow-[0_30px_60px_-24px_rgba(0,0,0,0.45)]">
      <p className="text-xs font-bold text-muted-foreground">Photosynthesis · Q3 of 10</p>
      <p className="mt-1 font-display text-lg font-bold leading-snug">Which molecule is split during the light-dependent reactions?</p>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-correct bg-correct/10 p-2 ring-1 ring-correct">
        <AnswerChip index={1} />
        <span className="text-sm font-bold">Water</span>
        <Check className="ml-auto size-4 text-correct-text" strokeWidth={3} />
      </div>
      <p className="mt-3 text-sm leading-relaxed">
        “…light energy is used to split <mark className="hl">water</mark> molecules, releasing oxygen…”
      </p>
      <SourceLabel>Wikipedia · Photosynthesis ¶3</SourceLabel>
    </div>
  )
}
