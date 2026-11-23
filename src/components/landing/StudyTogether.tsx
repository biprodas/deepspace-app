/**
 * Study together: what a group gets between games (docs/features.md F13–F15)
 * — a space per group, notes written together, whiteboards and AI mind maps,
 * and the loop that ties them back to the live quiz. Drawn like the Features
 * cards (small product sketches, no stock icons); names and codes in the
 * drawings are illustrations.
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, FileText, PenTool, Pin, Sparkles, Swords } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Initials } from './bits'
import { pillLink } from './LandingHeader'
import { Container, Eyebrow, H2 } from './LandingSections'

const LOOP = [
  { icon: FileText, text: 'Write notes together' },
  { icon: Sparkles, text: 'Turn them into a quiz' },
  { icon: Swords, text: 'Play it live' },
  { icon: Pin, text: 'Pin tricky questions back into the notes' },
]

export function StudyTogether() {
  return (
    <section id="spaces" aria-labelledby="spaces-title" className="scroll-mt-20 bg-card py-20 md:py-28">
      <Container>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <Eyebrow>Study spaces</Eyebrow>
            <H2 id="spaces-title" className="mt-3">
              Keep studying together <mark className="hl">between games</mark>
            </H2>
            <p className="mt-4 text-muted-foreground">
              Give each group a home. Notes, whiteboards and past games live in one place, and you can see who’s there
              with you right now.
            </p>
          </div>
          <Link
            to="/spaces"
            className={cn(
              pillLink,
              'h-11 self-start border border-input bg-background px-5 text-sm text-foreground hover:border-foreground/30 md:self-auto',
            )}
          >
            Create a space <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        <ul className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card
            title="A home for every group"
            text="Create a space and share its code. Members find every note, board and game in one place, and only members can see it."
          >
            <SpaceArt />
          </Card>
          <Card
            title="Notes you write together"
            text="Type in the same note at once and see each other’s cursors. When it’s ready, turn it into a quiz in one click."
          >
            <NotesArt />
          </Card>
          <Card
            title="Whiteboards and AI mind maps"
            text="Sketch with pens, shapes and sticky notes, or let Claude map a Wikipedia topic into a mind map you can edit together."
          >
            <MindMapArt />
          </Card>
        </ul>

        {/* The loop back to the game: notes become quizzes, games feed the notes. */}
        <ol aria-label="The study loop" className="mt-10 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {LOOP.map(({ icon: Icon, text }, i) => (
            <li
              key={text}
              className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary-text">
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0 flex-1">{text}</span>
              {i < LOOP.length - 1 && (
                <ArrowRight aria-hidden="true" className="hidden size-4 shrink-0 text-muted-foreground lg:block" />
              )}
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}

function Card({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <li className="flex flex-col rounded-2xl border border-border bg-background p-5 transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(20,20,43,0.18)]">
      <div
        aria-hidden="true"
        className="flex h-[208px] items-center justify-center overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-4"
      >
        {children}
      </div>
      <h3 className="mt-5 font-display text-lg font-bold">{title}</h3>
      <p className="mt-1.5 text-muted-foreground">{text}</p>
    </li>
  )
}

/* ---- Drawings ----------------------------------------------------------- */

function SpaceArt() {
  const items = [
    { icon: PenTool, label: 'Cell structure', kind: 'Board' },
    { icon: FileText, label: 'Exam week notes', kind: 'Note' },
    { icon: Swords, label: 'Photosynthesis', kind: 'Game' },
  ]
  return (
    <div className="flex w-full max-w-[260px] flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-display text-sm font-extrabold">Biology group</p>
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider">ZJA4GW</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex">
          {['Maya', 'Leo', 'Arjun'].map((n, i) => (
            <Initials key={n} name={n} i={i} className={cn('size-6 text-[9px] ring-2 ring-card', i > 0 && '-ml-1.5')} />
          ))}
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
          <span className="size-1.5 rounded-full bg-correct" /> 3 online
        </span>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
        {items.map(({ icon: Icon, label, kind }) => (
          <li key={label} className="flex items-center gap-2 px-2.5 py-1.5">
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-[11px] font-bold">{label}</span>
            <span className="text-[10px] text-muted-foreground">{kind}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function NotesArt() {
  return (
    <div className="relative w-full max-w-[250px] rounded-lg border border-border bg-white p-3 text-[#1f2937] shadow-sm">
      <p className="font-display text-sm font-extrabold">Exam week notes</p>
      <div className="mt-2 space-y-1.5 text-[10.5px] leading-snug">
        <p>
          The Calvin cycle runs in the <mark className="hl">stroma</mark>, using ATP
          <span className="relative ml-px inline-block h-3 w-0.5 translate-y-0.5 bg-answer-b align-baseline">
            <span className="absolute -top-3.5 left-0 rounded bg-answer-b px-1 text-[8px] font-bold leading-[14px] text-ink">
              Leo
            </span>
          </span>
        </p>
        <p className="flex items-center gap-1.5">
          <span className="size-1 rounded-full bg-[#1f2937]" /> RuBisCO fixes CO₂
        </p>
        <p className="flex items-center gap-1.5">
          <span className="size-1 rounded-full bg-[#1f2937]" /> Light reactions split water
          <span className="relative inline-block h-3 w-0.5 bg-answer-c">
            <span className="absolute -top-3.5 left-0 rounded bg-answer-c px-1 text-[8px] font-bold leading-[14px] text-ink">
              Maya
            </span>
          </span>
        </p>
      </div>
      <span className="mt-3 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">
        <Sparkles className="size-3" /> Make a quiz
      </span>
    </div>
  )
}

function MindMapArt() {
  // The same look as a generated map: an indigo root, tinted branch cards, curved links.
  const branches = [
    { label: 'Organelles', y: 34, color: '#2563eb', fill: '#c9d8fb' },
    { label: 'Membrane', y: 100, color: '#16a34a', fill: '#c5ead3' },
    { label: 'Division', y: 166, color: '#d97706', fill: '#f6dcbd' },
  ]
  return (
    <svg viewBox="0 0 280 200" className="h-full w-full max-w-[300px]" role="img" aria-label="">
      {branches.map((b) => (
        <path
          key={b.label}
          d={`M112 100C140 100 140 ${b.y} 168 ${b.y}`}
          fill="none"
          stroke={b.color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ))}
      <rect x="40" y="84" width="72" height="32" rx="10" fill="#4338ca" />
      <text
        x="76"
        y="104"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill="#fff"
        fontFamily="system-ui, sans-serif"
      >
        Cells
      </text>
      {branches.map((b) => (
        <g key={`${b.label}-card`}>
          <rect x="168" y={b.y - 13} width="100" height="26" rx="8" fill={b.fill} stroke={b.color} strokeWidth="1.25" />
          <text
            x="218"
            y={b.y + 4}
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill="#1e293b"
            fontFamily="system-ui, sans-serif"
          >
            {b.label}
          </text>
        </g>
      ))}
      {/* A sticky note and a pen scribble: it's still a board. */}
      <rect x="2" y="2" width="58" height="40" rx="4" fill="#fde68a" transform="rotate(-4 31 22)" />
      <text x="10" y="20" fontSize="9" fill="#1f2937" fontFamily="system-ui, sans-serif" transform="rotate(-4 31 22)">
        Quiz Friday!
      </text>
      <path d="M6 186c14-10 26 8 40-2s22-8 34 0" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
      <rect x="226" y="2" width="50" height="18" rx="9" fill="#6366f1" fillOpacity="0.16" />
      <text
        x="251"
        y="14.5"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill="#6366f1"
        fontFamily="system-ui, sans-serif"
      >
        ✦ Claude
      </text>
    </svg>
  )
}
