/**
 * The hero's live quiz preview: a host screen with a player's phone over its
 * corner, cycling lobby → question → reveal → leaderboard on a 12s CSS loop
 * (src/landing.css). Without motion it rests on the reveal frame. It is a
 * picture of the product, so the whole thing is one labelled image to
 * assistive tech rather than a pile of fake controls.
 *
 * On small screens only the phone shows; it runs the same four beats.
 */

import type { CSSProperties } from 'react'
import { Check, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnswerChip, Initials, LogoMark, PhoneFrame, SourceLabel } from './bits'

const CODE = 'K7QX9P'
const CORRECT = 1

const ANSWERS = [
  { text: 'Carbon dioxide', votes: 3 },
  { text: 'Water', votes: 12 },
  { text: 'Glucose', votes: 1 },
  { text: 'ATP', votes: 2 },
]
const TOTAL_VOTES = ANSWERS.reduce((n, a) => n + a.votes, 0)

const LOBBY = ['Maya', 'Leo', 'Arjun', 'Sam', 'Priya', 'Noor', 'Kai', 'Ella', 'Tom', 'Zoe', 'Ravi', 'Ana']

/** Final standings; `move` drives the climb in the loop (see landing.css). */
const BOARD = [
  { name: 'Arjun', score: '3,120' },
  { name: 'Maya', score: '2,960', move: 'qp-rise', gain: '+840' },
  { name: 'Leo', score: '2,710', move: 'qp-drop' },
  { name: 'Sam', score: '2,480', move: 'qp-drop' },
  { name: 'Priya', score: '2,150' },
]

const QUESTION = 'Which molecule is split during the light-dependent reactions?'

export function QuizPreview() {
  return (
    <figure
      role="img"
      aria-label="Preview of a live StudyArena game: 18 players answer a question about photosynthesis, the correct answer, water, is revealed with the Wikipedia sentence it came from, and the leaderboard updates."
      className="relative mx-auto w-full max-w-[540px] select-none md:min-h-[680px]"
    >
      <Decor />
      <HostScreen />
      {/* On desktop the phone sits over the host screen's lower-right corner,
          below the answer tiles; the source card leaves room for it. */}
      <div className="relative mx-auto w-[260px] md:absolute md:right-0 md:top-[17.5rem] md:w-[190px] md:rotate-[3deg]">
        <PlayerPhone />
      </div>
    </figure>
  )
}

function Decor() {
  const shapes = [
    { cls: 'left-[-1.5rem] top-[-1rem] size-10 rounded-full bg-answer-a', r: '0deg' },
    { cls: 'right-[18%] top-[-1.75rem] size-8 bg-answer-c rounded-md', r: '12deg' },
    { cls: 'left-[8%] bottom-[-1.5rem] size-9 bg-answer-d rotate-45 rounded-sm', r: '45deg' },
  ]
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block">
      {shapes.map((s, i) => (
        <span
          key={i}
          className={cn('float-shape absolute opacity-80', s.cls)}
          style={{ '--r': s.r, animationDelay: `${i * -2.3}s` } as CSSProperties}
        />
      ))}
    </div>
  )
}

function HostScreen() {
  return (
    <div className="relative mr-14 hidden -rotate-1 rounded-2xl border border-border bg-card text-card-foreground shadow-[0_30px_60px_-24px_rgba(20,20,43,0.3)] md:block">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <LogoMark className="size-4" />
          <span className="font-bold">Photosynthesis</span>
          <span className="text-muted-foreground">· Q3 of 10</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="rounded-md bg-muted px-2 py-1 font-mono font-bold tracking-[0.15em]">{CODE}</span>
          <span className="text-muted-foreground">
            <span className="qp-players font-bold text-foreground" /> players
          </span>
        </div>
      </div>

      <div className="relative h-[350px] p-4">
        {/* Lobby */}
        <div className="qp-lobby absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center">
          <p className="text-sm text-muted-foreground">Join with code</p>
          <p className="font-mono text-4xl font-bold tracking-[0.2em]">{CODE}</p>
          <div className="flex max-w-[22rem] flex-wrap justify-center gap-2">
            {LOBBY.map((name, i) => (
              <span key={name} className="qp-pop" style={{ '--d': `${i * 0.12}s` } as CSSProperties}>
                <Initials name={name} i={i} />
              </span>
            ))}
          </div>
        </div>

        {/* Question → reveal */}
        <div className="qp-question absolute inset-0 flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-4">
            <p className="font-display text-xl font-bold leading-snug tracking-tight">{QUESTION}</p>
            <Countdown />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ANSWERS.map((a, i) => (
              <HostTile key={a.text} index={i} text={a.text} votes={a.votes} />
            ))}
          </div>
          <div className="qp-source mr-[8.5rem] mt-auto rounded-xl border border-border bg-background p-3">
            <p className="text-sm leading-relaxed">
              “…light energy is used to split <mark className="hl">water</mark> molecules, releasing oxygen as a by-product…”
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <SourceLabel>Wikipedia · Photosynthesis ¶3</SourceLabel>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="qp-board absolute inset-0 flex flex-col p-5">
          <p className="mb-3 font-display text-lg font-bold">Leaderboard · after Q3</p>
          <Board />
        </div>
      </div>
    </div>
  )
}

function Countdown() {
  return (
    <div className="relative size-12 shrink-0">
      <svg viewBox="0 0 36 36" className="size-12 -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" className="stroke-muted" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          className="qp-ring stroke-primary"
        />
      </svg>
      <span className="qp-count absolute inset-0 flex items-center justify-center font-display text-base font-extrabold" />
    </div>
  )
}

function HostTile({ index, text, votes }: { index: number; text: string; votes: number }) {
  const correct = index === CORRECT
  const width = `${Math.round((votes / TOTAL_VOTES) * 100)}%`
  return (
    <div className={cn('relative rounded-xl border border-border bg-card p-2.5', !correct && 'qp-dim')}>
      <div className="flex items-center gap-2">
        <AnswerChip index={index} />
        <span className="text-sm font-bold">{text}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn('qp-bar h-full rounded-full', ['bg-answer-a', 'bg-answer-b', 'bg-answer-c', 'bg-answer-d'][index])} style={{ '--w': width } as CSSProperties} />
      </div>
      {correct && (
        <span className="qp-reveal pointer-events-none absolute inset-0 rounded-xl bg-correct/10 ring-2 ring-correct">
          <span className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-correct text-ink">
            <Check aria-hidden="true" className="size-4" strokeWidth={3} />
          </span>
        </span>
      )}
    </div>
  )
}

function Board({ compact }: { compact?: boolean }) {
  const row = compact ? 'h-8' : 'h-10'
  return (
    <div className="grid grid-cols-[1.5rem_1fr] gap-x-2">
      <ol aria-hidden="true" className="contents">
        {BOARD.map((_, i) => (
          <li key={i} className={cn('col-start-1 flex items-center font-mono text-sm font-bold text-muted-foreground', row)} style={{ gridRow: i + 1 }}>
            {i + 1}
          </li>
        ))}
      </ol>
      {BOARD.map((p, i) => (
        <div
          key={p.name}
          className={cn(
            'col-start-2 flex items-center gap-2 border-b border-border bg-card',
            row,
            p.move,
            p.gain && 'relative z-10 rounded-md bg-accent px-1.5',
          )}
          style={{ gridRow: i + 1 }}
        >
          <Initials name={p.name} i={i} className={compact ? 'size-6 text-[10px]' : 'size-7'} />
          <span className={cn('font-bold', compact ? 'text-xs' : 'text-sm')}>{p.name}</span>
          {p.gain && !compact && (
            <span className="qp-gain inline-flex items-center gap-0.5 font-mono text-[11px] font-bold text-correct-text">
              <TrendingUp aria-hidden="true" className="size-3" />
              {p.gain}
            </span>
          )}
          <span className={cn('ml-auto font-mono font-bold', compact ? 'text-xs' : 'text-sm')}>{p.score}</span>
        </div>
      ))}
    </div>
  )
}

function PlayerPhone() {
  return (
    <PhoneFrame>
      <div className="relative h-[400px] md:h-[370px]">
        {/* Lobby */}
        <div className="qp-lobby absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center">
          <Initials name="Maya" i={1} className="size-14 text-lg" />
          <p className="font-display text-xl font-bold">You&apos;re in!</p>
          <p className="text-xs text-muted-foreground">Waiting for the host to start…</p>
          <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-bold tracking-[0.15em]">{CODE}</span>
        </div>

        {/* Question → reveal */}
        <div className="qp-question absolute inset-0 flex flex-col gap-2 p-3 pt-4">
          <p className="text-[11px] font-bold text-muted-foreground">Q3 of 10 · Photosynthesis</p>
          <p className="text-sm font-bold leading-snug">{QUESTION}</p>
          <div className="mt-1 flex flex-col gap-1.5">
            {ANSWERS.map((a, i) => (
              <div
                key={a.text}
                className={cn(
                  'flex items-center gap-2 rounded-lg border border-border bg-card p-1.5 text-xs font-bold',
                  i === CORRECT ? 'qp-pick' : 'qp-dim',
                )}
              >
                <AnswerChip index={i} className="h-6" />
                {a.text}
              </div>
            ))}
          </div>
          <div className="relative mt-auto h-14">
            <p className="qp-locked absolute inset-0 flex items-center justify-center rounded-lg bg-muted text-xs font-bold">
              Locked in ✓
            </p>
            <div className="qp-reveal absolute inset-0 rounded-lg bg-correct/15 p-2 ring-1 ring-correct/50">
              <p className="flex items-center gap-1 text-sm font-bold">
                <Check aria-hidden="true" className="size-4 text-correct-text" strokeWidth={3} />
                Correct · <span className="font-mono">+840</span>
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Light splits <mark className="hl">water</mark>, releasing oxygen.
              </p>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="qp-board absolute inset-0 flex flex-col gap-3 p-3 pt-5">
          <div className="text-center">
            <p className="font-display text-3xl font-extrabold">#2</p>
            <p className="inline-flex items-center gap-1 text-xs font-bold text-correct-text">
              <TrendingUp aria-hidden="true" className="size-3.5" /> up 2 places
            </p>
          </div>
          <Board compact />
        </div>
      </div>
    </PhoneFrame>
  )
}
