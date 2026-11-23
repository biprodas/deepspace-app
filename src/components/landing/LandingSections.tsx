/**
 * Landing sections below the hero, in page order: how a game runs, the
 * educator "receipts" story, the player's side, (study spaces, in
 * StudyTogether.tsx), who it's for, FAQ, the final call to action and the footer. Product mockups are drawn with the same
 * answer chips and source labels as the hero preview, and every claim here
 * matches docs/prd.md (no invented stats or testimonials).
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpenCheck, Check, GraduationCap, Plus, RefreshCw, ShieldCheck, Sparkles, UserCheck, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnswerChip, CREATE_QUIZ_PATH, Initials, Logo, PhoneFrame, SourceLabel } from './bits'
import { focusHeroJoin, JoinCodeForm } from './JoinCodeForm'
import { pillLink } from './LandingHeader'

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto max-w-6xl px-4 sm:px-6', className)}>{children}</div>
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('font-mono text-xs font-bold uppercase tracking-[0.18em] text-primary-text', className)}>{children}</p>
}

export function H2({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <h2 id={id} className={cn('font-display text-[28px] font-extrabold leading-[1.1] tracking-tight sm:text-4xl', className)}>
      {children}
    </h2>
  )
}

/* ---- How a game runs ----------------------------------------------------- */

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-20 bg-card py-20 md:py-28">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>How a game runs</Eyebrow>
          <H2 id="how-title" className="mt-3">From topic to podium in three steps</H2>
          <p className="mt-4 text-muted-foreground">
            Prep takes minutes, not an evening. You stay in charge of every question and the pace of the game.
          </p>
        </div>

        <ol className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          <Step n={1} title="Draft" text="Pick up to three Wikipedia topics or paste your own notes. Claude drafts multiple-choice questions, each tied to a sentence from the source.">
            <div className="flex flex-wrap gap-1.5">
              {['Photosynthesis', 'Calvin cycle'].map((t) => (
                <span key={t} className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold">{t}</span>
              ))}
              <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-input px-2.5 py-1 text-xs text-muted-foreground">
                <Plus aria-hidden="true" className="size-3" /> paste notes
              </span>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs font-bold">
              <Sparkles aria-hidden="true" className="size-3.5 text-primary-text" /> 10 drafts, each with its source
            </p>
          </Step>

          <Step n={2} title="Approve" text="Check each draft against its source. Approve it, edit it, or regenerate it. Only approved questions are played.">
            <p className="text-xs font-bold leading-snug">Which gas is released by the light reactions?</p>
            <p className="mt-1.5 border-l-2 border-highlight pl-2 text-[11px] leading-snug text-muted-foreground">
              “…splitting water and releasing <mark className="hl">oxygen</mark>…”
            </p>
            <div className="mt-3 flex gap-1.5 text-[11px] font-bold">
              <span className="inline-flex items-center gap-1 rounded-md bg-correct px-2 py-1 text-ink"><Check aria-hidden="true" className="size-3" strokeWidth={3} />Approve</span>
              <span className="rounded-md border border-border px-2 py-1">Edit</span>
              <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1"><RefreshCw aria-hidden="true" className="size-3" />Redo</span>
            </div>
          </Step>

          <Step n={3} title="Play & reveal" text="Share a 6-character code. Everyone answers against the clock, then sees the right answer, why it's right, and where it came from.">
            <div className="flex h-[4.5rem] items-end justify-center gap-2">
              {[
                { name: 'Maya', h: 'h-12', place: 2 },
                { name: 'Arjun', h: 'h-[4.5rem]', place: 1 },
                { name: 'Leo', h: 'h-9', place: 3 },
              ].map((p, i) => (
                <div key={p.name} className="flex w-14 flex-col items-center gap-1">
                  <Initials name={p.name} i={i + 1} className="size-6 text-[10px]" />
                  <div className={cn('flex w-full items-start justify-center rounded-t-md bg-accent pt-1 font-mono text-xs font-bold', p.h)}>
                    {p.place}
                  </div>
                </div>
              ))}
            </div>
          </Step>
        </ol>
      </Container>
    </section>
  )
}

function Step({ n, title, text, children }: { n: number; title: string; text: string; children: ReactNode }) {
  return (
    <li className="flex flex-col rounded-2xl border border-border bg-background p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-foreground font-mono text-sm font-bold text-background">{n}</span>
        <h3 className="font-display text-xl font-bold">{title}</h3>
      </div>
      <p className="mt-3 text-muted-foreground">{text}</p>
      <div className="mt-6 rounded-xl border border-border bg-card p-4">{children}</div>
    </li>
  )
}

/* ---- Receipts (for educators) -------------------------------------------- */

export function Receipts() {
  const points = [
    { icon: BookOpenCheck, title: 'Sourced', text: 'Every question quotes the sentence it came from. If the quote isn’t in the source, the question is dropped.' },
    { icon: UserCheck, title: 'Reviewed', text: 'AI drafts, you decide. Nothing reaches players until you approve it.' },
    { icon: ShieldCheck, title: 'Fair', text: 'Answers stay on the server until the reveal. One answer per player, and late answers don’t count.' },
  ]
  return (
    <section id="educators" aria-labelledby="educators-title" className="scroll-mt-20 bg-card py-20 md:py-28">
      <Container className="grid grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-16">
        <div>
          <Eyebrow>For teachers, tutors and organisers</Eyebrow>
          <H2 id="educators-title" className="mt-3">
            Every question shows its <mark className="hl">receipts</mark>
          </H2>
          <p className="mt-4 text-muted-foreground">
            AI-written quizzes are fast but hard to trust. StudyArena keeps the evidence next to every question, so you can check
            it in seconds and your players learn where the facts come from.
          </p>
          <ul className="mt-8 space-y-5">
            {points.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-text">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <h3 className="font-bold">{title}</h3>
                  <p className="text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <ReviewMockup />
      </Container>
    </section>
  )
}

function ReviewMockup() {
  return (
    <div
      role="img"
      aria-label="The host review screen: a draft question about the Calvin cycle shown next to the Wikipedia paragraph it came from, with the source sentence highlighted."
      className="relative rotate-1 rounded-2xl border border-border bg-background p-4 shadow-[0_30px_60px_-24px_rgba(20,20,43,0.3)] sm:p-5"
    >
      <div className="flex items-center justify-between">
        <span className="rounded-md bg-highlight px-2 py-0.5 font-mono text-[11px] font-bold text-ink">DRAFT · Q4</span>
        <SourceLabel>Wikipedia · Calvin cycle</SourceLabel>
      </div>

      <p className="mt-3 font-display text-lg font-bold leading-snug">Where in the chloroplast does the Calvin cycle take place?</p>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {['Thylakoid membrane', 'Stroma', 'Outer membrane', 'Cytoplasm'].map((t, i) => (
          <li
            key={t}
            className={cn(
              'flex items-center gap-2 rounded-lg border bg-card p-1.5 text-sm font-bold',
              i === 1 ? 'border-correct ring-1 ring-correct' : 'border-border',
            )}
          >
            <AnswerChip index={i} className="h-6" />
            {t}
            {i === 1 && <Check aria-hidden="true" className="ml-auto size-4 text-correct-text" strokeWidth={3} />}
          </li>
        ))}
      </ul>

      <div className="relative mt-5 rounded-xl border border-border bg-card p-3 text-sm leading-relaxed text-muted-foreground">
        <svg aria-hidden="true" viewBox="0 0 60 40" className="absolute -top-7 left-6 h-8 w-12 fill-none stroke-primary" strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 4c4 14 16 26 40 30" />
          <path d="M38 27l9 7-10 3" />
        </svg>
        The Calvin cycle is a set of light-independent reactions.{' '}
        <mark className="hl">These reactions occur in the stroma, the fluid-filled region of a chloroplast</mark>, using ATP and
        NADPH made by the light reactions.
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
        <span className="inline-flex items-center gap-1 rounded-lg bg-correct px-3 py-1.5 text-ink">
          <Check aria-hidden="true" className="size-4" strokeWidth={3} /> Approve
        </span>
        <span className="rounded-lg border border-border bg-card px-3 py-1.5">Edit</span>
        <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5">
          <RefreshCw aria-hidden="true" className="size-3.5" /> Regenerate
        </span>
      </div>
    </div>
  )
}

/* ---- The player's side --------------------------------------------------- */

export function PlayerSide() {
  return (
    <section aria-labelledby="players-title" className="overflow-hidden py-20 md:py-28">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>For players</Eyebrow>
          <H2 id="players-title" className="mt-3">No app to install. Sign in, enter the code, play.</H2>
          <p className="mt-4 text-muted-foreground">
            Works in any phone browser. Drop your connection or refresh mid-question, and you&apos;re back with your answer and score.
          </p>
        </div>

        <ol
          aria-label="What players see"
          className="-mx-4 mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:px-0"
        >
          <PhoneStep n={1} title="Join" caption="Type the code from the screen, or tap the link.">
            <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
              <p className="text-xs text-muted-foreground">Enter game code</p>
              <div className="flex gap-1">
                {'K7QX9P'.split('').map((c, i) => (
                  <span key={i} className="flex h-9 w-7 items-center justify-center rounded-md border border-input bg-background font-mono text-base font-bold">
                    {c}
                  </span>
                ))}
              </div>
              <span className="mt-2 w-full rounded-lg bg-foreground py-2 text-sm font-bold text-background">Join</span>
            </div>
          </PhoneStep>

          <PhoneStep n={2} title="Answer" caption="One tap locks in your answer. Faster correct answers score more.">
            <div className="flex h-full flex-col gap-1.5 p-3">
              <p className="text-[11px] font-bold text-muted-foreground">Q5 of 10 · 0:08</p>
              <p className="text-sm font-bold leading-snug">What pigment absorbs most light for photosynthesis?</p>
              {['Melanin', 'Chlorophyll', 'Carotene', 'Haemoglobin'].map((t, i) => (
                <div key={t} className={cn('flex items-center gap-2 rounded-lg border bg-card p-1.5 text-xs font-bold', i === 1 ? 'border-primary ring-2 ring-primary' : 'border-border')}>
                  <AnswerChip index={i} className="h-6" />
                  {t}
                </div>
              ))}
            </div>
          </PhoneStep>

          <PhoneStep n={3} title="Learn" caption="At the end, see every question you missed and the source to read.">
            <div className="flex h-full flex-col gap-2 p-3">
              <p className="font-display text-base font-bold">What I got wrong</p>
              {[
                { q: 'Where does the Calvin cycle happen?', a: 'Stroma', src: 'Calvin cycle' },
                { q: 'What does RuBisCO fix?', a: 'Carbon dioxide', src: 'RuBisCO' },
              ].map((w) => (
                <div key={w.q} className="rounded-lg border border-border bg-background p-2">
                  <p className="flex gap-1 text-[11px] font-bold leading-snug">
                    <X aria-hidden="true" className="mt-px size-3 shrink-0 text-destructive" strokeWidth={3} />
                    {w.q}
                  </p>
                  <p className="mt-1 text-[11px]">
                    Answer: <mark className="hl">{w.a}</mark>
                  </p>
                  <SourceLabel className="text-[10px]">Read: Wikipedia · {w.src} →</SourceLabel>
                </div>
              ))}
            </div>
          </PhoneStep>
        </ol>
      </Container>
    </section>
  )
}

function PhoneStep({ n, title, caption, children }: { n: number; title: string; caption: string; children: ReactNode }) {
  return (
    <li className="w-[78%] max-w-[280px] shrink-0 snap-center md:w-auto md:max-w-none">
      <PhoneFrame className="mx-auto max-w-[250px]">
        <div aria-hidden="true" className="h-[310px]">{children}</div>
      </PhoneFrame>
      <div className="mx-auto mt-5 max-w-[250px]">
        <h3 className="font-display text-lg font-bold">
          <span className="mr-1.5 font-mono text-sm text-primary-text">0{n}</span> {title}
        </h3>
        <p className="mt-1 text-muted-foreground">{caption}</p>
      </div>
    </li>
  )
}

/* ---- Who it's for -------------------------------------------------------- */

export function Audiences() {
  const items = [
    { icon: Users, who: 'Students', text: 'Turn tomorrow’s exam topic into a study-group showdown.', accent: 'bg-answer-a' },
    { icon: GraduationCap, who: 'Teachers', text: 'A 10-minute sourced recap at the end of class.', accent: 'bg-answer-b' },
    { icon: RefreshCw, who: 'Tutors', text: 'Prepare a quiz once and reuse it with every group you teach.', accent: 'bg-answer-c' },
    { icon: BookOpenCheck, who: 'Teams', text: 'Onboarding facts that stick, with the source doc one tap away.', accent: 'bg-answer-d' },
  ]
  return (
    <section aria-labelledby="audiences-title" className="bg-[#fff6d9] py-20 md:py-28 dark:bg-[#1e1b38]">
      <Container>
        <H2 id="audiences-title">Made for any group that learns together</H2>
        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ icon: Icon, who, text, accent }) => (
            <li key={who} className="rounded-2xl border border-[#f0e2b0] bg-card p-5 shadow-[0_1px_2px_rgba(20,20,43,0.04)] dark:border-border">
              <span className={cn('flex size-10 items-center justify-center rounded-xl text-ink', accent)}>
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{who}</h3>
              <p className="mt-1 text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

/* ---- FAQ ----------------------------------------------------------------- */

const FAQS = [
  {
    q: 'Do players need an account?',
    a: 'Yes. Everyone signs in before joining, so one person can’t answer twice under two names and scores stay fair. The share link takes players to sign-in and then straight into the room.',
  },
  { q: 'How many people can play at once?', a: 'Up to 50 players per room. Open as many rooms from the same quiz as you need.' },
  {
    q: 'Can I use my own notes instead of Wikipedia?',
    a: 'Yes. Paste your notes and questions are drafted from them, each quoting the sentence it came from in your text.',
  },
  {
    q: 'What if the AI gets something wrong?',
    a: 'You review every draft before it’s played: approve it, edit it, regenerate it, or delete it. Drafts whose quote can’t be found in the source are dropped automatically.',
  },
  {
    q: 'Does it work on phones?',
    a: 'Yes, in any modern mobile browser. Hosts usually run the game on a laptop or projector while players answer on their phones.',
  },
  {
    q: 'What’s a study space?',
    a: 'A home for a study group. Members join with a code or link, write notes together, draw on whiteboards and AI mind maps, and host games inside the space. Only members can see what’s in it.',
  },
  {
    q: 'Do I need my own AI account or API key?',
    a: 'No. StudyArena drafts questions and mind maps for you, with nothing to set up. To keep it fair for everyone, each person can start 10 quiz drafts and 5 mind maps a day.',
  },
]

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 py-20 md:py-28">
      <Container className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_1.6fr]">
        {/* The title side: a short intro, then (wide screens) a faint "?" watermark
            with two answer-coloured shapes, as in the hero. It stays in view while
            the answers scroll past. */}
        <div className="md:sticky md:top-24 md:self-start">
          <H2 id="faq-title">Questions, answered</H2>
          <p className="mt-4 max-w-sm text-muted-foreground">
            Quick answers about players, sources, the AI and study spaces.
          </p>
          <div aria-hidden="true" className="pointer-events-none relative mt-4 hidden h-[260px] select-none md:block">
            <span
              className="absolute right-10 top-0 -rotate-[8deg] font-display text-[240px] font-extrabold leading-none text-foreground/[0.06]"
              style={{ WebkitTextFillColor: 'transparent', WebkitTextStroke: '2px currentColor' }}
            >
              ?
            </span>
            <span className="absolute right-4 top-4 size-8 rotate-12 rounded-lg bg-answer-c/70" />
            <span className="absolute bottom-2 right-[190px] size-6 rounded-full bg-answer-a/70" />
          </div>
        </div>
        <div className="divide-y divide-border self-start border-y border-border">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-4 text-lg font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40 [&::-webkit-details-marker]:hidden">
                {f.q}
                <Plus aria-hidden="true" className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-45 motion-reduce:transition-none" />
              </summary>
              <p className="pb-5 text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  )
}

/* ---- Final call to action + footer ---------------------------------------- */

export function CtaBand() {
  return (
    <section aria-labelledby="cta-title" className="px-4 pb-20 sm:px-6 md:pb-28">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-primary px-6 py-12 text-white sm:px-10 md:py-16">
        <div aria-hidden="true" className="absolute -right-6 -top-6 hidden grid-cols-2 gap-2 opacity-90 sm:grid">
          <span className="size-14 rounded-xl bg-answer-a" />
          <span className="size-14 rounded-xl bg-answer-b" />
          <span className="size-14 rounded-xl bg-answer-c" />
          <span className="size-14 rounded-xl bg-answer-d" />
        </div>
        <CtaWatermarks />
        <div className="relative grid grid-cols-1 items-end gap-10 md:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 id="cta-title" className="max-w-lg font-display text-[32px] font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              Your next study session could be a game.
            </h2>
            <Link
              to={CREATE_QUIZ_PATH}
              className={cn(pillLink, 'mt-8 h-[52px] bg-white px-6 text-base text-primary hover:bg-white/90 focus-visible:ring-white/60')}
            >
              Create a quiz <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <JoinCodeForm variant="band" className="md:max-w-sm md:justify-self-end" />
        </div>
      </div>
    </section>
  )
}

const OUTLINE = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, vectorEffect: 'non-scaling-stroke' } as const

/**
 * Faint white outlines of the quiz glyphs on the banner, like the hero's
 * watermarks: a big "?", the answer shapes and a tick. They sit in the
 * banner's empty middle and corners, never behind the headline or the code
 * field; the "?" shows on phones (beside the button) and wide screens, where it
 * fits between the headline and the code field.
 */
function CtaWatermarks() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none text-white/[0.14]">
      <span
        className="absolute right-6 top-[150px] rotate-[10deg] font-display text-[110px] font-extrabold leading-none sm:hidden lg:left-[41%] lg:right-auto lg:top-1/2 lg:block lg:-translate-y-1/2 lg:text-[220px]"
        style={{ WebkitTextFillColor: 'transparent', WebkitTextStroke: '2px currentColor' }}
      >
        ?
      </span>
      <svg viewBox="0 0 100 100" className="absolute -bottom-14 -left-14 size-44">
        <circle cx="50" cy="50" r="46" {...OUTLINE} />
      </svg>
      <svg viewBox="0 0 100 100" className="absolute left-[57%] top-7 hidden size-14 rotate-12 md:block">
        <path d="M50 6 96 92H4z" {...OUTLINE} strokeLinejoin="round" />
      </svg>
      <svg viewBox="0 0 100 100" className="absolute bottom-6 left-[52%] hidden size-10 md:block">
        <path d="M50 3 97 50 50 97 3 50z" {...OUTLINE} strokeLinejoin="round" />
      </svg>
      <svg viewBox="0 0 100 100" className="absolute right-[30%] top-9 hidden size-12 -rotate-6 md:block">
        <path d="M14 54 38 78 88 24" {...OUTLINE} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg viewBox="0 0 100 100" className="absolute bottom-10 left-[30%] hidden size-9 rotate-[18deg] lg:block">
        <rect x="6" y="6" width="88" height="88" rx="14" {...OUTLINE} />
      </svg>
    </div>
  )
}

const FOOTER_LINK =
  // inline-block + py-1.5 gives each link a 24px+ touch target; the lists' spacing shrinks to match.
  'inline-block rounded-sm py-1.5 outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:underline'

/**
 * Footer: the brand and what StudyArena is, the page's sections, and the ways
 * in (create, join, sign up, sign in). Every link goes somewhere real.
 */
export function LandingFooter() {
  const explore = [
    { href: '#how', label: 'How it works' },
    { href: '#features', label: 'Features' },
    { href: '#spaces', label: 'Study spaces' },
    { href: '#educators', label: 'For educators' },
    { href: '#faq', label: 'FAQ' },
  ]
  return (
    <footer className="border-t border-border pb-28 md:pb-10">
      <Container className="pt-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[2fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <span className="text-foreground">
              <Logo />
            </span>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Live quizzes, backed by sources, and a home for your study group between games.
            </p>
          </div>

          <nav aria-label="Explore" className="text-sm">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground">Explore</p>
            <ul className="mt-3 space-y-0.5 text-muted-foreground">
              {explore.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className={FOOTER_LINK}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Get started" className="text-sm">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground">Get started</p>
            <ul className="mt-3 space-y-0.5 text-muted-foreground">
              <li>
                <Link to={CREATE_QUIZ_PATH} className={FOOTER_LINK}>
                  Create a quiz
                </Link>
              </li>
              <li>
                <a href="#join" onClick={focusHeroJoin} className={FOOTER_LINK}>
                  Join a game
                </a>
              </li>
              <li>
                <Link to="/sign-up" className={FOOTER_LINK}>
                  Create an account
                </Link>
              </li>
              <li>
                <Link to="/sign-in" className={FOOTER_LINK}>
                  Sign in
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} StudyArena</p>
          <a href="https://docs.deep.space/" target="_blank" rel="noreferrer" className={FOOTER_LINK}>
            Built on DeepSpace
          </a>
        </div>
      </Container>
    </footer>
  )
}
