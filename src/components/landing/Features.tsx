/**
 * Features: a bento grid of what StudyArena does beyond the three-step flow,
 * each card with a small drawing of the product instead of a stock icon.
 * Every claim maps to a feature in docs/features.md (F1–F12); the numbers
 * in the drawings (scores, codes, names) are illustrations, not stats.
 */

import type { ReactNode } from 'react'
import {
  ArrowRight,
  Check,
  FileText,
  Lock,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Square,
  Trophy,
  WifiOff,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Initials, SourceLabel } from './bits'
import { Container, Eyebrow, H2 } from './LandingSections'

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-20 py-20 md:py-28">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>Features</Eyebrow>
          <H2 id="features-title" className="mt-3">Everything a great quiz night needs</H2>
          <p className="mt-4 text-muted-foreground">
            Built for live groups: quick to prepare, fair while you play, tuned to how the room feels, and useful after
            the last question.
          </p>
        </div>

        <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            wide="sm"
            title="Questions from any source"
            text="Pick up to three Wikipedia topics or paste your own notes. Claude drafts multiple-choice questions, and each one quotes the sentence it came from."
          >
            <SourcesArt />
          </Feature>
          <Feature title="A lobby that fills in live" text="Share a code or link and watch players arrive. Up to 50 per room, and you can remove anyone who shouldn’t be there.">
            <LobbyArt />
          </Feature>
          <Feature title="You run the room" text="Move on when the group is ready. Reveal, pause, skip or end at any moment; nothing advances on its own.">
            <ControlsArt />
          </Feature>
          <Feature title="Fast and fair scoring" text="Quicker correct answers earn more. The answer key stays on the server, so nobody can peek, answer twice, or answer late.">
            <ScoringArt />
          </Feature>
          <Feature title="Drop out, drop back in" text="Lost signal or hit refresh? Players land right back in the game with their answer and score intact. Late joiners can still hop in.">
            <ReconnectArt />
          </Feature>
          <Feature title="Reuse any quiz" text="Prepare once, then open a fresh room for every class or group. Each room gets its own code and its own leaderboard.">
            <ReuseArt />
          </Feature>
          <Feature
            wide="lg"
            title="A recap that teaches"
            text="The game ends with a podium, and every player gets a list of the questions they missed, with the right answer and the source to read."
          >
            <RecapArt />
          </Feature>
          <Feature
            wide="lg"
            title="Read the room"
            text="Run a quick poll, let players flag a question they’re still confused about, and watch emoji reactions float across the screen. Votes stay private; only the totals show."
          >
            <RoomArt />
          </Feature>
          <Feature
            title="History and a leaderboard"
            text="Every game you host or play is saved with its results, and an all-time leaderboard keeps the friendly rivalry going."
          >
            <LeaderboardArt />
          </Feature>
        </ul>
      </Container>
    </section>
  )
}

function Feature({ title, text, wide, children }: { title: string; text: string; wide?: 'sm' | 'lg'; children: ReactNode }) {
  return (
    <li className={cn('flex flex-col rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(20,20,43,0.18)]', wide === 'sm' ? 'sm:col-span-2' : wide === 'lg' && 'lg:col-span-2')}>
      <div aria-hidden="true" className="flex h-[192px] items-center justify-center overflow-hidden rounded-xl border border-border bg-background p-3 sm:p-4">
        {children}
      </div>
      <h3 className="mt-5 font-display text-lg font-bold">{title}</h3>
      <p className="mt-1.5 text-muted-foreground">{text}</p>
    </li>
  )
}

/* ---- Drawings ----------------------------------------------------------- */

function SourcesArt() {
  const drafts = [
    { q: 'What gas do the light reactions release?', src: 'Photosynthesis' },
    { q: 'Where does the Calvin cycle take place?', src: 'Calvin cycle' },
    { q: 'Which enzyme fixes carbon dioxide?', src: 'my-notes.txt' },
  ]
  return (
    <div className="flex w-full max-w-[560px] items-center gap-3 sm:gap-5">
      <div className="hidden w-[38%] shrink-0 flex-col gap-2 sm:flex">
        <div className="flex flex-wrap gap-1.5">
          {['Photosynthesis', 'Calvin cycle'].map((t) => (
            <span key={t} className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold">{t}</span>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-card p-2">
          <p className="flex items-center gap-1 font-mono text-[10px] font-bold text-muted-foreground">
            <FileText className="size-3" /> my-notes.txt
          </p>
          <div className="mt-1.5 space-y-1">
            <div className="h-1.5 w-full rounded-full bg-muted" />
            <div className="h-1.5 w-4/5 rounded-full bg-highlight/70" />
            <div className="h-1.5 w-3/5 rounded-full bg-muted" />
          </div>
        </div>
      </div>
      <ArrowRight className="hidden size-5 shrink-0 text-primary-text sm:block" />
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {drafts.map((d, i) => (
          <li key={d.q} className="rounded-lg border border-border bg-card px-2.5 py-1 leading-tight">
            <p className="truncate text-xs font-bold">
              <span className="mr-1.5 font-mono text-muted-foreground">Q{i + 1}</span>
              {d.q}
            </p>
            <SourceLabel className="text-[10px]">Source · {d.src}</SourceLabel>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LobbyArt() {
  const names = ['Maya', 'Leo', 'Arjun', 'Sam', 'Priya', 'Noor']
  return (
    <div className="flex w-full max-w-[240px] flex-col items-center gap-4">
      <div className="flex">
        {names.map((n, i) => (
          <Initials key={n} name={n} i={i} className={cn('size-9 ring-2 ring-background', i > 0 && '-ml-2.5')} />
        ))}
        <span className="-ml-2.5 flex size-9 items-center justify-center rounded-full bg-muted text-[11px] font-bold ring-2 ring-background">+12</span>
      </div>
      <div className="w-full">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-correct" /> 18 joined
          </span>
          <span className="text-muted-foreground">max 50</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[36%] rounded-full bg-primary" />
        </div>
      </div>
    </div>
  )
}

function ControlsArt() {
  const keys = [
    { icon: Play, label: 'Next' },
    { icon: Check, label: 'Reveal', active: true },
    { icon: Pause, label: 'Pause' },
    { icon: SkipForward, label: 'Skip' },
    { icon: Square, label: 'End' },
  ]
  return (
    <div className="flex w-full max-w-[250px] flex-col gap-3">
      <p className="text-center text-[11px] font-bold text-muted-foreground">Q3 of 10 · 18 of 18 answered</p>
      <div className="grid grid-cols-5 gap-1.5">
        {keys.map(({ icon: Icon, label, active }) => (
          <span
            key={label}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border py-2 text-[10px] font-bold',
              active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card',
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

function ScoringArt() {
  const rows = [
    { t: '2s', pts: '+960', w: 'w-[96%]' },
    { t: '9s', pts: '+780', w: 'w-[78%]' },
    { t: '17s', pts: '+540', w: 'w-[54%]' },
  ]
  return (
    <div className="flex w-full max-w-[250px] flex-col gap-2">
      {rows.map((r) => (
        <div key={r.t} className="flex items-center gap-2 text-[11px] font-bold">
          <span className="w-7 font-mono text-muted-foreground">{r.t}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full rounded-full bg-correct', r.w)} />
          </div>
          <span className="w-9 text-right font-mono text-correct-text">{r.pts}</span>
        </div>
      ))}
      <p className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-input py-1.5 text-[11px] font-bold text-muted-foreground">
        <Lock className="size-3" /> Answer key stays on the server
      </p>
    </div>
  )
}

function ReconnectArt() {
  return (
    <div className="flex w-full max-w-[240px] flex-col gap-2">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-muted-foreground line-through decoration-muted-foreground/50">
        <WifiOff className="size-3.5 shrink-0" /> Connection lost
      </div>
      <RotateCcw className="mx-auto size-4 text-muted-foreground" />
      <div className="rounded-lg bg-correct/15 px-3 py-2 ring-1 ring-correct/50">
        <p className="flex items-center gap-1.5 text-xs font-bold">
          <Check className="size-3.5 text-correct-text" strokeWidth={3} /> Back in · Q4
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">Answer B kept · 2,960 pts</p>
      </div>
    </div>
  )
}

function ReuseArt() {
  const rooms = [
    { code: 'K7QX9P', label: 'Period 2' },
    { code: 'M2RT8B', label: 'Period 4' },
    { code: 'Z9LQ4C', label: 'Tue group' },
  ]
  return (
    <div className="flex w-full max-w-[260px] items-center gap-3">
      <div className="w-[42%] shrink-0 rounded-lg border border-border bg-card p-2.5">
        <p className="text-xs font-bold leading-tight">Photosynthesis</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">10 questions</p>
      </div>
      <svg viewBox="0 0 24 72" className="h-[72px] w-6 shrink-0 fill-none stroke-input" strokeWidth="1.5">
        <path d="M0 36h8M8 36V8h16M8 36h16M8 36v28h16" />
      </svg>
      <ul className="flex flex-1 flex-col gap-1.5">
        {rooms.map((r) => (
          <li key={r.code} className="rounded-md border border-border bg-card px-2 py-1">
            <p className="font-mono text-[11px] font-bold tracking-wider">{r.code}</p>
            <p className="text-[10px] text-muted-foreground">{r.label}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RecapArt() {
  const podium = [
    { name: 'Maya', h: 'h-14', place: 2, i: 1 },
    { name: 'Arjun', h: 'h-20', place: 1, i: 2 },
    { name: 'Leo', h: 'h-10', place: 3, i: 3 },
  ]
  return (
    <div className="flex w-full max-w-[560px] items-end gap-5">
      <div className="hidden shrink-0 items-end gap-1.5 lg:flex">
        {podium.map((p) => (
          <div key={p.name} className="flex w-14 flex-col items-center gap-1">
            <Initials name={p.name} i={p.i} className="size-7 text-[10px]" />
            <div className={cn('flex w-full items-start justify-center rounded-t-md bg-accent pt-1 font-mono text-xs font-bold', p.h)}>{p.place}</div>
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-2 text-xs font-bold">What I got wrong</p>
        <ul className="flex flex-col gap-1.5">
          {[
            { q: 'Where does the Calvin cycle happen?', a: 'Stroma', src: 'Calvin cycle' },
            { q: 'What does RuBisCO fix?', a: 'Carbon dioxide', src: 'RuBisCO' },
          ].map((w, i) => (
            <li key={w.q} className={cn('rounded-lg border border-border bg-card px-2.5 py-1.5', i > 0 && 'hidden lg:block')}>
              <p className="flex items-center gap-1 truncate text-[11px] font-bold">
                <X className="size-3 shrink-0 text-destructive" strokeWidth={3} />
                <span className="truncate">{w.q}</span>
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px]">
                <span>
                  Answer: <mark className="hl">{w.a}</mark>
                </span>
                <SourceLabel className="text-[10px]">Read: Wikipedia · {w.src} →</SourceLabel>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function RoomArt() {
  const options = [
    { label: 'Ready, next topic', pct: 72, color: 'bg-correct' },
    { label: 'Need a minute', pct: 28, color: 'bg-answer-c' },
  ]
  return (
    <div className="relative flex w-full max-w-[560px] items-center gap-5">
      <div className="min-w-0 flex-1 rounded-lg border border-border bg-card p-3">
        <p className="text-xs font-bold">Ready for the next topic?</p>
        <div className="mt-2 space-y-1.5">
          {options.map((o) => (
            <div key={o.label} className="text-[11px] font-bold">
              <div className="flex justify-between">
                <span>{o.label}</span>
                <span className="font-mono text-muted-foreground">{o.pct}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full', o.color)} style={{ width: `${o.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">18 votes · only totals are shown</p>
      </div>
      <div className="hidden shrink-0 flex-col items-center gap-3 sm:flex">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-answer-c/25 px-3 py-1.5 text-[11px] font-bold ring-1 ring-answer-c/60">
          <span aria-hidden="true">🤔</span> 3 still confused
        </span>
        <div className="flex gap-2 text-2xl" aria-hidden="true">
          <span className="-translate-y-2">🎉</span>
          <span>👏</span>
          <span className="-translate-y-3">🔥</span>
          <span className="-translate-y-1">🤯</span>
        </div>
      </div>
    </div>
  )
}

function LeaderboardArt() {
  const rows = [
    { name: 'Arjun', pts: '18,420', i: 2 },
    { name: 'Maya', pts: '16,905', i: 1 },
    { name: 'Leo', pts: '14,310', i: 3 },
  ]
  return (
    <div className="flex w-full max-w-[240px] flex-col gap-1.5">
      <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
        <Trophy className="size-3.5 text-answer-c" /> All-time leaderboard
      </p>
      {rows.map((r, n) => (
        <div key={r.name} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
          <span className="w-3 font-mono text-[11px] font-bold text-muted-foreground">{n + 1}</span>
          <Initials name={r.name} i={r.i} className="size-6 text-[9px]" />
          <span className="flex-1 text-xs font-bold">{r.name}</span>
          <span className="font-mono text-[11px] font-bold">{r.pts}</span>
        </div>
      ))}
    </div>
  )
}
